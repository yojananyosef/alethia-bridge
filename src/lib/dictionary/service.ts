import { existsSync } from "node:fs";
import { createDatabase, ensureModuleDbReady, resolveModuleDbPath } from "../db/sqlite.ts";
import { listModules } from "../modules/registry.ts";
import type {
  DictionaryEntry,
  DictionarySearchResponse,
  DictionarySearchResult,
} from "../../types/dictionary.ts";

export function listInstalledDictionaries(
  installedFilter?: string[] | null,
): Array<{ id: string; name: string }> {
  ensureModuleDbReady("EASTON");
  return listModules(installedFilter)
    .filter((m) => m.type === "dictionary" && m.status === "installed")
    .map((m) => ({ id: m.id, name: m.name }));
}

function escapeFtsTerm(term: string): string {
  return term.replace(/"/g, '""').replace(/[*]/g, "");
}

export function searchDictionary(
  queryRaw: string,
  requestedModuleId?: string | null,
  limit = 40,
  installedFilter?: string[] | null,
): DictionarySearchResponse {
  const t0 = performance.now();
  const query = queryRaw.trim();
  const dicts = listInstalledDictionaries(installedFilter);

  if (dicts.length === 0) {
    return {
      query,
      total: 0,
      results: [],
      availableDictionaries: [],
      durationMs: performance.now() - t0,
    };
  }

  const activeDict =
    (requestedModuleId && dicts.find((d) => d.id === requestedModuleId)) ||
    dicts.find((d) => d.id === "EASTON") ||
    dicts[0];

  const dbPath = resolveModuleDbPath(activeDict.id);
  if (!existsSync(dbPath)) {
    return {
      query,
      total: 0,
      results: [],
      availableDictionaries: dicts,
      durationMs: performance.now() - t0,
    };
  }

  const db = createDatabase(dbPath, { readonly: true });
  try {
    const results: DictionarySearchResult[] = [];

    if (!query) {
      // Si la consulta está vacía, devuelve los primeros artículos (A-Z)
      const rows = db
        .prepare(
          `SELECT id_entrada, termino, slug, definicion, fuente
           FROM entradas ORDER BY termino ASC LIMIT ?`,
        )
        .all(limit) as Array<{
        id_entrada: number;
        termino: string;
        slug: string;
        definicion: string;
        fuente: string | null;
      }>;

      for (const r of rows) {
        results.push({
          id: r.id_entrada,
          term: r.termino,
          slug: r.slug,
          snippet: r.definicion.length > 180 ? r.definicion.slice(0, 180) + "…" : r.definicion,
          source: r.fuente,
        });
      }

      return {
        query,
        total: results.length,
        results,
        availableDictionaries: dicts,
        durationMs: performance.now() - t0,
      };
    }

    // 1. Coincidencias prioritarias en el título del término (exactas o prefijo)
    const seenIds = new Set<number>();
    const qLower = query.toLowerCase();
    const titleRows = db
      .prepare(
        `SELECT id_entrada, termino, slug, definicion, fuente
         FROM entradas WHERE LOWER(termino) LIKE ? OR LOWER(slug) LIKE ?
         ORDER BY CASE WHEN LOWER(termino) = ? THEN 0 WHEN LOWER(termino) LIKE ? THEN 1 ELSE 2 END, termino ASC LIMIT 10`,
      )
      .all(`${qLower}%`, `${qLower}%`, qLower, `${qLower}%`) as Array<{
      id_entrada: number;
      termino: string;
      slug: string;
      definicion: string;
      fuente: string | null;
    }>;

    for (const r of titleRows) {
      seenIds.add(r.id_entrada);
      results.push({
        id: r.id_entrada,
        term: r.termino,
        slug: r.slug,
        snippet: r.definicion.length > 180 ? r.definicion.slice(0, 180) + "…" : r.definicion,
        source: r.fuente,
      });
    }

    // 2. Comprobar si existe tabla FTS5 entradas_fts para búsqueda en el cuerpo
    const hasFts = db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='entradas_fts'`)
      .get();

    if (hasFts && results.length < limit) {
      try {
        const cleanTerm = escapeFtsTerm(query);
        const ftsQuery = cleanTerm.includes(" ") ? `"${cleanTerm}"` : `${cleanTerm}*`;
        const remaining = limit - results.length;
        const ftsRows = db
          .prepare(
            `SELECT rowid, highlight(entradas_fts, 0, '<mark>', '</mark>') as term_hl,
                    snippet(entradas_fts, 1, '<mark>', '</mark>', '…', 24) as def_snippet
             FROM entradas_fts WHERE entradas_fts MATCH ? ORDER BY rank LIMIT ?`,
          )
          .all(ftsQuery, remaining + 10) as Array<{
          rowid: number;
          term_hl: string;
          def_snippet: string;
        }>;

        const candidateIds = ftsRows.map((r) => r.rowid).filter((id) => !seenIds.has(id));
        if (candidateIds.length > 0) {
          const placeholders = candidateIds.map(() => "?").join(",");
          const fullRows = db
            .prepare(
              `SELECT id_entrada, termino, slug, definicion, fuente
               FROM entradas WHERE id_entrada IN (${placeholders})`,
            )
            .all(...candidateIds) as Array<{
            id_entrada: number;
            termino: string;
            slug: string;
            definicion: string;
            fuente: string | null;
          }>;

          const rowMap = new Map(fullRows.map((r) => [r.id_entrada, r]));
          for (const fts of ftsRows) {
            if (seenIds.has(fts.rowid)) continue;
            const original = rowMap.get(fts.rowid);
            if (original) {
              seenIds.add(fts.rowid);
              results.push({
                id: original.id_entrada,
                term: original.termino,
                slug: original.slug,
                snippet: fts.def_snippet || original.definicion.slice(0, 160) + "…",
                source: original.fuente,
              });
              if (results.length >= limit) break;
            }
          }
        }
      } catch {
        // Fallback a LIKE
      }
    }

    // Fallback a LIKE si FTS no produjo resultados o falló
    if (results.length === 0) {
      const likeQuery = `%${query}%`;
      const likeRows = db
        .prepare(
          `SELECT id_entrada, termino, slug, definicion, fuente
           FROM entradas WHERE termino LIKE ? OR slug LIKE ? OR definicion LIKE ?
           ORDER BY CASE WHEN termino LIKE ? THEN 1 ELSE 2 END, termino ASC LIMIT ?`,
        )
        .all(likeQuery, likeQuery, likeQuery, `${query}%`, limit) as Array<{
        id_entrada: number;
        termino: string;
        slug: string;
        definicion: string;
        fuente: string | null;
      }>;

      for (const r of likeRows) {
        results.push({
          id: r.id_entrada,
          term: r.termino,
          slug: r.slug,
          snippet: r.definicion.length > 180 ? r.definicion.slice(0, 180) + "…" : r.definicion,
          source: r.fuente,
        });
      }
    }

    return {
      query,
      total: results.length,
      results,
      availableDictionaries: dicts,
      durationMs: performance.now() - t0,
    };
  } finally {
    db.close();
  }
}

export function getDictionaryEntry(
  slugOrTerm: string,
  requestedModuleId?: string | null,
  installedFilter?: string[] | null,
): DictionaryEntry | null {
  if (!slugOrTerm || !slugOrTerm.trim()) return null;

  const dicts = listInstalledDictionaries(installedFilter);
  if (dicts.length === 0) return null;

  const activeDict =
    (requestedModuleId && dicts.find((d) => d.id === requestedModuleId)) ||
    dicts.find((d) => d.id === "EASTON") ||
    dicts[0];

  const dbPath = resolveModuleDbPath(activeDict.id);
  if (!existsSync(dbPath)) return null;

  const db = createDatabase(dbPath, { readonly: true });
  try {
    const clean = slugOrTerm.trim().toLowerCase();
    const row = db
      .prepare(
        `SELECT id_entrada, termino, slug, definicion, referencias, fuente
         FROM entradas WHERE LOWER(slug) = ? OR LOWER(termino) = ? LIMIT 1`,
      )
      .get(clean, clean) as
      | {
          id_entrada: number;
          termino: string;
          slug: string;
          definicion: string;
          referencias: string | null;
          fuente: string | null;
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id_entrada,
      moduleId: activeDict.id,
      moduleName: activeDict.name,
      term: row.termino,
      slug: row.slug,
      definition: row.definicion,
      references: row.referencias,
      source: row.fuente,
    };
  } finally {
    db.close();
  }
}

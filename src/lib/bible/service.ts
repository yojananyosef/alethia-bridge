import { getLexiconDb, getModuleDb, normalizeText } from "../db/sqlite.ts";
import { getModule } from "../modules/registry.ts";
import type {
  BibleLanguage,
  BibleModuleId,
  InterlinearModule,
  LexiconEntry,
  MorphologyAnalysis,
  ReadResponse,
  SearchResponse,
  SearchResult,
  VersePayload,
  WordToken,
} from "../../types/bible.ts";

/** Idioma de un módulo, resuelto desde su manifest (antes: tabla hardcodeada). */
function moduleLanguage(moduleId: string): BibleLanguage {
  const info = getModule(moduleId);
  if (info?.language === "es") return "es";
  if (info?.language === "el") return "el";
  return "he";
}

export function parseModules(raw: string | null): BibleModuleId[] {
  if (!raw) return ["RV1909"];
  return raw
    .split(",")
    .map((m) => m.trim().toUpperCase())
    .filter((m): m is BibleModuleId => getModule(m) !== null)
    .slice(0, 4);
}

export function sanitizeReference(book: string, chapterRaw: string): { book: string; chapter: number } {
  const chapter = Number(chapterRaw);
  if (!book || book.length > 20 || !Number.isInteger(chapter) || chapter < 1 || chapter > 1500) {
    throw new Error("Referencia inválida: book (≤20 chars) y chapter (1-1500) requeridos");
  }
  return { book: book.trim(), chapter };
}

interface VerseRow {
  id_versiculo: number;
  libro_id: string;
  capitulo: number;
  versiculo: number;
  texto_plano: string;
}

interface TokenRow {
  id_palabra: number;
  id_versiculo: number;
  posicion: number;
  texto_superficie: string;
  lema: string | null;
  strong_id: string | null;
  morph_code: string | null;
  alineacion_id: string;
}

export function readChapter(book: string, chapterRaw: string, modulesRaw: string | null): ReadResponse {
  const t0 = performance.now();
  const { book: bookId, chapter } = sanitizeReference(book, chapterRaw);
  const moduleIds = parseModules(modulesRaw);

  const modules: InterlinearModule[] = [];
  const alignmentGroups = new Set<string>();

  for (const moduleId of moduleIds) {
    const db = getModuleDb(moduleId);
    const verses = db
      .prepare(
        `SELECT id_versiculo, libro_id, capitulo, versiculo, texto_plano
         FROM versiculos WHERE libro_id = ? AND capitulo = ? ORDER BY versiculo`,
      )
      .all(bookId, chapter) as VerseRow[];

    const tokensByVerse = new Map<number, TokenRow[]>();
    if (verses.length > 0) {
      const placeholders = verses.map(() => "?").join(",");
      const tokens = db
        .prepare(
          `SELECT id_palabra, id_versiculo, posicion, texto_superficie, lema, strong_id, morph_code, alineacion_id
           FROM palabras_interlineal WHERE id_versiculo IN (${placeholders}) ORDER BY id_versiculo, posicion`,
        )
        .all(...verses.map((v) => v.id_versiculo)) as TokenRow[];
      for (const t of tokens) {
        const list = tokensByVerse.get(t.id_versiculo) ?? [];
        list.push(t);
        tokensByVerse.set(t.id_versiculo, list);
        alignmentGroups.add(t.alineacion_id);
      }
    }

    const versePayloads: VersePayload[] = verses.map((v) => {
      const tokens: WordToken[] = (tokensByVerse.get(v.id_versiculo) ?? []).map((t) => ({
        id: t.id_palabra,
        position: t.posicion,
        text: t.texto_superficie,
        lemma: t.lema,
        strongId: t.strong_id,
        morphCode: t.morph_code,
        alignmentId: t.alineacion_id,
      }));
      return {
        reference: `${v.libro_id} ${v.capitulo}:${v.versiculo}`,
        book: v.libro_id,
        chapter: v.capitulo,
        verse: v.versiculo,
        text: v.texto_plano,
        tokens,
      };
    });

    modules.push({ moduleId, language: moduleLanguage(moduleId), verses: versePayloads });
  }

  return {
    modules,
    alignmentGroups: [...alignmentGroups].sort(),
    durationMs: performance.now() - t0,
  };
}

/** Escapa un término para usarlo dentro de una consulta MATCH de FTS5. */
function escapeTerm(term: string): string {
  return term.replace(/"/g, '""').replace(/\*/g, "");
}

/** Snippet con <mark> sobre la primera coincidencia, desde el texto original. */
function buildSnippet(raw: string, term: string, radius = 48): string {
  // Descomposición NFD: "í" → "i" + marca combinante; las marcas se saltan,
  // y rawIdx conserva la posición original de cada letra base.
  const norm: string[] = [];
  const rawIdx: number[] = [];
  const flat = raw.normalize("NFD");
  let i = 0;
  for (const c of flat) {
    if (/\p{M}/u.test(c)) {
      i++;
      continue;
    }
    norm.push(c.toLowerCase());
    rawIdx.push(i);
    i++;
  }
  const ns = norm.join("");
  const hit = ns.indexOf(term);
  if (hit < 0) return raw.length > 140 ? raw.slice(0, 140) + "…" : raw;
  const s = Math.max(0, hit - radius);
  const e = Math.min(ns.length, hit + term.length + radius);
  const startRaw = rawIdx[s];
  const endRaw = rawIdx[e - 1] + 1;
  const hitStartRaw = rawIdx[hit];
  const hitEndRaw = rawIdx[hit + term.length - 1] + 1;
  return (
    (startRaw > 0 ? "…" : "") +
    raw.slice(startRaw, hitStartRaw) +
    "<mark>" +
    raw.slice(hitStartRaw, hitEndRaw) +
    "</mark>" +
    raw.slice(hitEndRaw, endRaw) +
    (endRaw < raw.length ? "…" : "")
  );
}

export function searchBible(queryRaw: string, modulesRaw: string | null, limit = 20): SearchResponse {
  const t0 = performance.now();
  const query = queryRaw.trim();
  const moduleIds = parseModules(modulesRaw);
  const results: SearchResult[] = [];
  let total = 0;

  if (query.length === 0) {
    return { query, moduleIds, total: 0, results, durationMs: performance.now() - t0 };
  }

  // Búsqueda por Strong number: G3056 o H7225
  const strongMatch = query.match(/^(G|H)\d+$/i);
  if (strongMatch) {
    for (const moduleId of moduleIds) {
      const db = getModuleDb(moduleId);
      const count = (db
        .prepare(`SELECT COUNT(*) AS c FROM palabras_interlineal WHERE strong_id = ?`)
        .get(strongMatch[0].toUpperCase()) as { c: number }).c;
      total += count;
      const rows = db
        .prepare(
          `SELECT v.libro_id, v.capitulo, v.versiculo, v.texto_plano
           FROM palabras_interlineal w JOIN versiculos v ON v.id_versiculo = w.id_versiculo
           WHERE w.strong_id = ? ORDER BY v.libro_id, v.capitulo, v.versiculo LIMIT ?`,
        )
        .all(strongMatch[0].toUpperCase(), limit) as {
        libro_id: string;
        capitulo: number;
        versiculo: number;
        texto_plano: string;
      }[];
      for (const r of rows) {
        results.push({
          moduleId,
          book: r.libro_id,
          chapter: r.capitulo,
          verse: r.versiculo,
          reference: `${r.libro_id} ${r.capitulo}:${r.versiculo}`,
          snippet: r.texto_plano.slice(0, 140),
          score: 1,
          strongIds: [strongMatch[0].toUpperCase()],
        });
      }
    }
  } else {
    // Búsqueda FTS5 full-text con prefijo comodín por término (normalizado: insensible a acentos)
    const terms = query.split(/\s+/).filter(Boolean).map(escapeTerm).map(normalizeText);
    const matchExpr = terms.map((t) => `"${t}"*`).join(" AND ");

    for (const moduleId of moduleIds) {
      const db = getModuleDb(moduleId);
      total += (db
        .prepare(`SELECT COUNT(*) AS c FROM versiculos_fts WHERE versiculos_fts MATCH ?`)
        .get(matchExpr) as { c: number }).c;
      const rows = db
        .prepare(
          `SELECT v.id_versiculo, v.libro_id, v.capitulo, v.versiculo, v.texto_plano,
                  bm25(versiculos_fts) AS score
           FROM versiculos_fts
           JOIN versiculos v ON v.id_versiculo = versiculos_fts.rowid
           WHERE versiculos_fts MATCH ?
           ORDER BY score LIMIT ?`,
        )
        .all(matchExpr, limit) as {
        id_versiculo: number;
        libro_id: string;
        capitulo: number;
        versiculo: number;
        texto_plano: string;
        score: number;
      }[];

      for (const r of rows) {
        const strongIds = (db
          .prepare(
            `SELECT DISTINCT w.strong_id FROM palabras_interlineal w
             WHERE w.id_versiculo = ? AND w.strong_id IS NOT NULL LIMIT 6`,
          )
          .all(r.id_versiculo) as { strong_id: string }[]).map((s) => s.strong_id);
        results.push({
          moduleId,
          book: r.libro_id,
          chapter: r.capitulo,
          verse: r.versiculo,
          reference: `${r.libro_id} ${r.capitulo}:${r.versiculo}`,
          snippet: buildSnippet(r.texto_plano, terms[0] ?? ""),
          score: r.score,
          strongIds,
        });
      }
    }
  }

  results.sort((a, b) => a.score - b.score || a.reference.localeCompare(b.reference));
  return { query, moduleIds, total, results: results.slice(0, limit), durationMs: performance.now() - t0 };
}

interface LexiconRow {
  strong_id: string;
  lema: string;
  transliteracion: string;
  pronunciacion: string | null;
  definicion_corta: string;
  definicion_detallada: string | null;
  dominio_semantico: string | null;
  idioma: "HEBREW" | "GREEK";
}

export function getLexiconEntry(strongId: string): LexiconEntry | null {
  const row = getLexiconDb().prepare(`SELECT * FROM diccionario WHERE strong_id = ?`).get(strongId) as
    | LexiconRow
    | undefined;
  if (!row) return null;
  return {
    strongId: row.strong_id,
    lemma: row.lema,
    transliteration: row.transliteracion,
    pronunciation: row.pronunciacion,
    shortDefinition: row.definicion_corta,
    detailedDefinition: row.definicion_detallada,
    semanticDomain: row.dominio_semantico,
    language: row.idioma,
  };
}

export function getMorphology(code: string): MorphologyAnalysis | null {
  const row = getLexiconDb()
    .prepare(`SELECT * FROM parsing_gramatical WHERE morph_code = ?`)
    .get(code) as { morph_code: string; descripcion_espanol: string; categoria_gramatical: string } | undefined;
  if (!row) return null;
  return {
    code: row.morph_code,
    description: row.descripcion_espanol,
    category: row.categoria_gramatical,
  };
}

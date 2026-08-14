"use client";

import { ClientDatabase } from "../db/client-sqlite";
import { normalizeText } from "../db/client-sqlite";
import {
  getClientLexiconDb,
  getClientModule,
  getClientModuleDb,
  getClientPrimaryBibleModule,
  listClientModules,
} from "../modules/client-registry";
import { parseScriptureReference } from "./reference-parser";
import type {
  BibleLanguage,
  CommentaryModule,
  CommentaryNote,
  CrossRefModule,
  InterlinearModule,
  LexiconEntry,
  MorphologyAnalysis,
  ProperName,
  ReadResponse,
  SearchResponse,
  SearchResult,
  VersePayload,
  WordToken,
} from "../../types/bible";
import type { DevotionEntry, DevotionMoment, DevotionResponse } from "../../types/devotion";
import type {
  DictionaryEntry,
  DictionarySearchResponse,
  DictionarySearchResult,
} from "../../types/dictionary";

/** Idioma de un módulo, resuelto desde su manifest. */
async function moduleLanguage(moduleId: string): Promise<BibleLanguage> {
  const info = await getClientModule(moduleId);
  if (info?.language === "es") return "es";
  if (info?.language === "el" || info?.language === "grc") return "el";
  return "he";
}

export async function parseClientModules(ids: string[] | null | undefined): Promise<string[]> {
  const requested = (ids ?? [])
    .map((m) => m.trim().toUpperCase())
    .filter(Boolean);
  if (requested.length === 0) {
    const primary = await getClientPrimaryBibleModule();
    return primary ? [primary.id] : [];
  }
  const installed = new Set((await listClientModules()).map((m) => m.id));
  const parsed = requested.filter((m) => installed.has(m));
  if (parsed.length === 0) {
    const primary = await getClientPrimaryBibleModule();
    return primary ? [primary.id] : [];
  }
  return parsed;
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

const STRONG_EQUIV: Record<string, string> = {
  G2071: "G1510", G2075: "G1510", G2076: "G1510", G2077: "G1510",
  G2252: "G1510", G2258: "G1510", G2468: "G1510", G5600: "G1510", G5607: "G1510",
};

function canonicalStrong(strong: string | null): string | null {
  return strong ? (STRONG_EQUIV[strong] ?? strong) : null;
}

function loadVerseBlock(db: ClientDatabase, bookId: string, chapter: number): {
  verses: VerseRow[];
  tokensByVerse: Map<number, TokenRow[]>;
  alignmentGroups: Set<string>;
} {
  const verses = db
    .prepare(
      `SELECT id_versiculo, libro_id, capitulo, versiculo, texto_plano
       FROM versiculos WHERE libro_id = ? AND capitulo = ? ORDER BY versiculo`,
    )
    .all(bookId, chapter) as unknown as VerseRow[];

  const tokensByVerse = new Map<number, TokenRow[]>();
  const alignmentGroups = new Set<string>();
  if (verses.length > 0) {
    const placeholders = verses.map(() => "?").join(",");
    const tokens = db
      .prepare(
        `SELECT id_palabra, id_versiculo, posicion, texto_superficie, lema, strong_id, morph_code, alineacion_id
         FROM palabras_interlineal WHERE id_versiculo IN (${placeholders}) ORDER BY id_versiculo, posicion`,
      )
      .all(...verses.map((v) => v.id_versiculo)) as unknown as TokenRow[];
    for (const t of tokens) {
      const list = tokensByVerse.get(t.id_versiculo) ?? [];
      list.push(t);
      tokensByVerse.set(t.id_versiculo, list);
      alignmentGroups.add(t.alineacion_id);
    }
  }
  return { verses, tokensByVerse, alignmentGroups };
}

function toVersePayloads(
  verses: VerseRow[],
  tokensByVerse: Map<number, TokenRow[]>,
): VersePayload[] {
  return verses.map((v) => {
    const tokens: WordToken[] = (tokensByVerse.get(v.id_versiculo) ?? []).map((t) => ({
      id: t.id_palabra,
      position: t.posicion,
      text: t.texto_superficie,
      lemma: t.lema,
      strongId: t.strong_id,
      morphCode: t.morph_code,
      alignmentId: t.strong_id
        ? `${v.libro_id}${v.capitulo}:${v.versiculo}:s${canonicalStrong(t.strong_id)}`
        : t.alineacion_id,
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
}

const chapterCache = new Map<string, ReadResponse>();

export async function readChapter(
  book: string,
  chapterRaw: string,
  modulesRaw: string[] | null,
): Promise<ReadResponse> {
  const t0 = performance.now();
  const { book: bookId, chapter } = sanitizeReference(book, chapterRaw);
  const moduleIds = await parseClientModules(modulesRaw);
  const cacheKey = `${bookId}:${chapter}:${moduleIds.join(",")}`;
  const cached = chapterCache.get(cacheKey);
  if (cached) return cached;

  const modules: InterlinearModule[] = [];
  const alignmentGroups = new Set<string>();

  for (const moduleId of moduleIds) {
    try {
      const db = await getClientModuleDb(moduleId);
      const block = loadVerseBlock(db, bookId, chapter);
      block.alignmentGroups.forEach((g) => alignmentGroups.add(g));
      modules.push({
        moduleId,
        language: await moduleLanguage(moduleId),
        verses: toVersePayloads(block.verses, block.tokensByVerse),
      });
    } catch {
      // Módulo no disponible: se omite
    }
  }

  const totalVerses = modules.reduce((acc, m) => acc + m.verses.length, 0);
  if (totalVerses === 0) {
    const allInstalledBibles = (await listClientModules())
      .filter((m) => m.type === "bible" && m.status === "installed" && !moduleIds.includes(m.id));
    for (const alt of allInstalledBibles) {
      try {
        const altDb = await getClientModuleDb(alt.id);
        const block = loadVerseBlock(altDb, bookId, chapter);
        if (block.verses.length > 0) {
          block.alignmentGroups.forEach((g) => alignmentGroups.add(g));
          modules.push({
            moduleId: alt.id,
            language: await moduleLanguage(alt.id),
            verses: toVersePayloads(block.verses, block.tokensByVerse),
          });
          break;
        }
      } catch {}
    }
  }

  const res: ReadResponse = {
    modules,
    alignmentGroups: [...alignmentGroups].sort(),
    durationMs: performance.now() - t0,
  };
  if (chapterCache.size > 50) chapterCache.clear();
  chapterCache.set(cacheKey, res);
  return res;
}

function escapeTerm(term: string): string {
  return term.replace(/"/g, '""').replace(/\*/g, "");
}

function buildSnippet(raw: string, term: string, radius = 48): string {
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

export async function searchBible(
  queryRaw: string,
  modulesRaw: string[] | null,
  limit = 20,
): Promise<SearchResponse> {
  const t0 = performance.now();
  const query = queryRaw.trim();
  const moduleIds = await parseClientModules(modulesRaw);
  const results: SearchResult[] = [];
  let total = 0;

  if (query.length === 0) {
    return { query, moduleIds, total: 0, results, durationMs: performance.now() - t0 };
  }

  const strongMatch = query.match(/^(G|H)\d+$/i);
  if (strongMatch) {
    for (const moduleId of moduleIds) {
      try {
        const db = await getClientModuleDb(moduleId);
        const count = (
          db.prepare(`SELECT COUNT(*) AS c FROM palabras_interlineal WHERE strong_id = ?`).get(strongMatch[0].toUpperCase()) as unknown as { c: number }
        ).c;
        total += count;
        const rows = db
          .prepare(
            `SELECT v.libro_id, v.capitulo, v.versiculo, v.texto_plano
             FROM palabras_interlineal w JOIN versiculos v ON v.id_versiculo = w.id_versiculo
             WHERE w.strong_id = ? ORDER BY v.libro_id, v.capitulo, v.versiculo LIMIT ?`,
          )
          .all(strongMatch[0].toUpperCase(), limit) as unknown as {
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
      } catch {}
    }
  } else {
    const terms = query.split(/\s+/).filter(Boolean).map(escapeTerm).map(normalizeText);
    const matchExpr = terms.map((t) => `"${t}"*`).join(" AND ");

    for (const moduleId of moduleIds) {
      try {
        const db = await getClientModuleDb(moduleId);
        total += (
          db.prepare(`SELECT COUNT(*) AS c FROM versiculos_fts WHERE versiculos_fts MATCH ?`).get(matchExpr) as unknown as { c: number }
        ).c;
        const rows = db
          .prepare(
            `SELECT v.id_versiculo, v.libro_id, v.capitulo, v.versiculo, v.texto_plano,
                    bm25(versiculos_fts) AS score
             FROM versiculos_fts
             JOIN versiculos v ON v.id_versiculo = versiculos_fts.rowid
             WHERE versiculos_fts MATCH ?
             ORDER BY score LIMIT ?`,
          )
          .all(matchExpr, limit) as unknown as {
          id_versiculo: number;
          libro_id: string;
          capitulo: number;
          versiculo: number;
          texto_plano: string;
          score: number;
        }[];

        for (const r of rows) {
          const strongIds = (
            db
              .prepare(
                `SELECT DISTINCT w.strong_id FROM palabras_interlineal w
                 WHERE w.id_versiculo = ? AND w.strong_id IS NOT NULL LIMIT 6`,
              )
              .all(r.id_versiculo) as unknown as { strong_id: string }[]
          ).map((s) => s.strong_id);
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
      } catch {}
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

const tableExistsCache = new Map<string, boolean>();

function hasTableInDb(db: ClientDatabase, tableName: string, moduleId: string): boolean {
  const cacheKey = `${moduleId}:${tableName}`;
  const cached = tableExistsCache.get(cacheKey);
  if (cached !== undefined) return cached;
  try {
    const has = Boolean(
      db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(tableName),
    );
    tableExistsCache.set(cacheKey, has);
    return has;
  } catch {
    return false;
  }
}

export function clearClientServiceCaches(moduleId?: string): void {
  chapterCache.clear();
  if (moduleId) {
    for (const k of tableExistsCache.keys()) {
      if (k.startsWith(`${moduleId}:`)) tableExistsCache.delete(k);
    }
  } else {
    tableExistsCache.clear();
  }
}

export async function getLexiconEntry(strongId: string): Promise<LexiconEntry | null> {
  const key = strongId.toUpperCase();
  try {
    const db = await getClientLexiconDb();
    if (!hasTableInDb(db, "diccionario", "lexicon")) return null;

    const row = db.prepare(`SELECT * FROM diccionario WHERE strong_id = ?`).get(key) as
      | LexiconRow
      | undefined;
    if (!row) return null;

    let glosa: string | null = null;
    if (hasTableInDb(db, "glosas", "lexicon")) {
      try {
        const glosaRow = db
          .prepare(`SELECT glosa FROM glosas WHERE strong_id = ?`)
          .get(key) as { glosa: string } | undefined;
        glosa = glosaRow?.glosa ?? null;
      } catch {}
    }
    return {
      strongId: row.strong_id,
      lemma: row.lema,
      transliteration: row.transliteracion,
      pronunciation: row.pronunciacion,
      shortDefinition: row.definicion_corta,
      detailedDefinition: row.definicion_detallada,
      semanticDomain: row.dominio_semantico,
      glosa,
      language: row.idioma,
    };
  } catch {
    return null;
  }
}

export async function getMorphology(code: string): Promise<MorphologyAnalysis | null> {
  const key = code.toUpperCase();
  try {
    const db = await getClientLexiconDb();
    if (!hasTableInDb(db, "parsing_gramatical", "lexicon")) return null;

    const row = db
      .prepare(`SELECT * FROM parsing_gramatical WHERE morph_code = ?`)
      .get(key) as { morph_code: string; descripcion_espanol: string; categoria_gramatical: string } | undefined;
    if (!row) return null;
    return {
      code: row.morph_code,
      description: row.descripcion_espanol,
      category: row.categoria_gramatical,
    };
  } catch {
    return null;
  }
}

interface ProperNameRow {
  strong_id: string;
  nombre: string;
  tipo: string;
  categoria: string;
  descripcion: string | null;
  padres: string | null;
  hermanos: string | null;
  conyuges: string | null;
  hijos: string | null;
  tribu: string | null;
  referencias: string | null;
  formas: string | null;
  libros: string;
  geo_lat: number | null;
  geo_lng: number | null;
  openbible: string | null;
}

export async function getProperNames(strongId: string, book?: string): Promise<ProperName[]> {
  try {
    const db = await getClientLexiconDb();
    if (!hasTableInDb(db, "nombres_propios", "lexicon")) return [];

    const rows = db
      .prepare(`SELECT * FROM nombres_propios WHERE strong_id = ?`)
      .all(strongId.toUpperCase()) as unknown as ProperNameRow[];
    const bookMatch = book
      ? (r: ProperNameRow): boolean => r.libros.split(",").includes(book)
      : (): boolean => true;
    const ordered = [...rows].sort((a, b) => Number(bookMatch(b)) - Number(bookMatch(a)));
    return ordered.map((r) => ({
      nombre: r.nombre,
      tipo: r.tipo,
      categoria: (r.categoria === "persona" || r.categoria === "lugar" || r.categoria === "otro"
        ? r.categoria
        : "otro") as ProperName["categoria"],
      descripcion: r.descripcion,
      padres: r.padres,
      hermanos: r.hermanos,
      conyuges: r.conyuges,
      hijos: r.hijos,
      tribu: r.tribu,
      referencias: r.referencias,
      formas: r.formas,
      libros: r.libros ? r.libros.split(",") : [],
      geoLat: r.geo_lat,
      geoLng: r.geo_lng,
      openbible: r.openbible,
    }));
  } catch {
    return [];
  }
}

interface CommentaryRow {
  versiculo: number;
  texto: string;
}

export async function readCommentary(
  book: string,
  chapterRaw: string,
  installedFilter?: string[] | null,
): Promise<{ commentary: CommentaryModule[]; durationMs: number }> {
  const { book: bookId, chapter } = sanitizeReference(book, chapterRaw);
  const t0 = performance.now();
  const altBookId =
    bookId === "John" ? "Jn" : bookId === "Jn" ? "John" : bookId === "Gen" ? "Genesis" : bookId === "Genesis" ? "Gen" : bookId;
  const commentary: CommentaryModule[] = [];

  const candidateModules = await listClientModules();

  for (const info of candidateModules) {
    if (info.type !== "commentary" || info.status !== "installed") continue;
    if (installedFilter && installedFilter.length > 0 && !installedFilter.includes(info.id)) continue;
    try {
      const db = await getClientModuleDb(info.id);
      if (!hasTableInDb(db, "comentarios", info.id)) continue;
      const rows = db
        .prepare(
          `SELECT versiculo, texto FROM comentarios
           WHERE (libro_id = ? OR libro_id = ?) AND capitulo = ? ORDER BY versiculo`,
        )
        .all(bookId, altBookId, chapter) as unknown as CommentaryRow[];
      if (rows.length === 0) continue;
      commentary.push({
        moduleId: info.id,
        name: info.name,
        notes: rows.map((r) => ({ verse: r.versiculo, text: r.texto }) satisfies CommentaryNote),
      });
    } catch {}
  }

  return { commentary, durationMs: performance.now() - t0 };
}

export async function readCrossReferences(
  book: string,
  chapterRaw: string,
  verseRaw?: string | null,
  installedFilter?: string[] | null,
): Promise<{ crossref: CrossRefModule[]; durationMs: number }> {
  const { book: bookId, chapter } = sanitizeReference(book, chapterRaw);
  const verse = verseRaw ? Number.parseInt(verseRaw, 10) || null : null;
  const t0 = performance.now();
  const crossref: CrossRefModule[] = [];
  const altBookId =
    bookId === "John" ? "Jn" : bookId === "Jn" ? "John" : bookId === "Gen" ? "Genesis" : bookId === "Genesis" ? "Gen" : bookId;

  const candidateModules = await listClientModules();

  for (const info of candidateModules) {
    if (info.type !== "crossref" || info.status !== "installed") continue;
    if (installedFilter && installedFilter.length > 0 && !installedFilter.includes(info.id)) continue;
    try {
      const db = await getClientModuleDb(info.id);
      if (!hasTableInDb(db, "referencias_cruzadas", info.id)) continue;

      let rows: Array<{
        id_ref: number;
        libro_origen: string;
        capitulo_origen: number;
        versiculo_origen: number;
        libro_destino: string;
        capitulo_destino: number;
        versiculo_destino_inicio: number;
        versiculo_destino_fin: number | null;
        votos: number;
        nota: string | null;
      }> = [];

      if (verse !== null) {
        rows = db
          .prepare(
            `SELECT id_ref, libro_origen, capitulo_origen, versiculo_origen, libro_destino, capitulo_destino, versiculo_destino_inicio, versiculo_destino_fin, votos, nota
             FROM referencias_cruzadas WHERE (libro_origen = ? OR libro_origen = ?) AND capitulo_origen = ? AND versiculo_origen = ?
             ORDER BY votos DESC, id_ref ASC`,
          )
          .all(bookId, altBookId, chapter, verse) as unknown as typeof rows;
      } else {
        rows = db
          .prepare(
            `SELECT id_ref, libro_origen, capitulo_origen, versiculo_origen, libro_destino, capitulo_destino, versiculo_destino_inicio, versiculo_destino_fin, votos, nota
             FROM referencias_cruzadas WHERE (libro_origen = ? OR libro_origen = ?) AND capitulo_origen = ?
             ORDER BY versiculo_origen ASC, votos DESC, id_ref ASC`,
          )
          .all(bookId, altBookId, chapter) as unknown as typeof rows;
      }

      if (rows.length > 0) {
        crossref.push({
          moduleId: info.id,
          name: info.name,
          references: rows.map((r) => ({
            id: r.id_ref,
            sourceBook: r.libro_origen,
            sourceChapter: r.capitulo_origen,
            sourceVerse: r.versiculo_origen,
            targetBook: r.libro_destino,
            targetChapter: r.capitulo_destino,
            targetVerseStart: r.versiculo_destino_inicio,
            targetVerseEnd: r.versiculo_destino_fin,
            targetReference: `${r.libro_destino} ${r.capitulo_destino}:${r.versiculo_destino_inicio}${
              r.versiculo_destino_fin ? `-${r.versiculo_destino_fin}` : ""
            }`,
            votes: r.votos,
            note: r.nota,
          })),
        });
      }
    } catch {}
  }

  return { crossref, durationMs: performance.now() - t0 };
}

/* ------------------------------- Devoción ------------------------------- */

export async function readDevotion(
  monthParam?: number | null,
  dayParam?: number | null,
  momentParam?: DevotionMoment | null,
  requestedModuleId?: string | null,
): Promise<DevotionResponse> {
  const now = new Date();
  const month = monthParam && monthParam >= 1 && monthParam <= 12 ? monthParam : now.getMonth() + 1;
  const day = dayParam && dayParam >= 1 && dayParam <= 31 ? dayParam : now.getDate();
  const defaultMoment: DevotionMoment = now.getHours() >= 17 ? "noche" : "manana";
  const moment: DevotionMoment = momentParam || defaultMoment;
  const t0 = performance.now();

  const candidateModules = (await listClientModules()).filter(
    (m) => m.type === "devotion" && m.status === "installed",
  );
  const availableModules = candidateModules.map((m) => ({ id: m.id, name: m.name }));

  if (candidateModules.length === 0) {
    return { devotion: null, availableMoments: [], availableModules, durationMs: performance.now() - t0 };
  }

  const activeModuleInfo =
    (requestedModuleId && candidateModules.find((m) => m.id === requestedModuleId)) ||
    candidateModules.find((m) => m.id === "SPURGEON-ME") ||
    candidateModules[0];

  try {
    const db = await getClientModuleDb(activeModuleInfo.id);
    const momentRows = db
      .prepare(`SELECT DISTINCT momento FROM devocionales WHERE mes = ? AND dia = ?`)
      .all(month, day) as unknown as Array<{ momento: string }>;
    const availableMoments = momentRows.map((r) => r.momento as DevotionMoment);

    const momentAliases =
      moment === "manana" ? ["manana", "dia", "morning"] : moment === "dia" ? ["dia", "manana", "morning"] : ["noche", "evening"];

    interface DevotionRow {
  id_devocional: number;
  mes: number;
  dia: number;
  momento: DevotionMoment;
  titulo: string;
  pasaje_clave: string;
  texto: string;
  oracion: string | null;
}

let row: DevotionRow | undefined = undefined;
    for (const mAlias of momentAliases) {
      row = db
        .prepare(
          `SELECT id_devocional, mes, dia, momento, titulo, pasaje_clave, texto, oracion
           FROM devocionales WHERE mes = ? AND dia = ? AND momento = ? LIMIT 1`,
        )
        .get(month, day, mAlias) as unknown as DevotionRow | undefined;
      if (row) break;
    }
    if (!row) {
      row = db
        .prepare(
          `SELECT id_devocional, mes, dia, momento, titulo, pasaje_clave, texto, oracion
           FROM devocionales WHERE mes = ? AND dia = ? LIMIT 1`,
        )
        .get(month, day) as unknown as DevotionRow | undefined;
    }
    if (!row) {
      return { devotion: null, availableMoments, availableModules, durationMs: performance.now() - t0 };
    }

    const parsedRef = parseScriptureReference(row.pasaje_clave);
    const devotion: DevotionEntry = {
      id: row.id_devocional,
      moduleId: activeModuleInfo.id,
      moduleName: activeModuleInfo.name,
      month: row.mes,
      day: row.dia,
      moment: row.momento,
      title: row.titulo,
      keyVerse: row.pasaje_clave,
      text: row.texto,
      prayer: row.oracion || null,
      parsedReference: parsedRef,
    };
    return { devotion, availableMoments, availableModules, durationMs: performance.now() - t0 };
  } catch {
    return { devotion: null, availableMoments: [], availableModules, durationMs: performance.now() - t0 };
  }
}

/* ------------------------------ Diccionario ----------------------------- */

function escapeFtsTerm(term: string): string {
  return term.replace(/"/g, '""').replace(/[*]/g, "");
}

export async function listInstalledDictionaries(): Promise<Array<{ id: string; name: string }>> {
  return (await listClientModules())
    .filter((m) => m.type === "dictionary" && m.status === "installed")
    .map((m) => ({ id: m.id, name: m.name }));
}

export async function searchDictionary(
  queryRaw: string,
  requestedModuleId?: string | null,
  limit = 40,
): Promise<DictionarySearchResponse> {
  const query = queryRaw.trim();
  const t0 = performance.now();
  const dicts = await listInstalledDictionaries();
  if (dicts.length === 0) {
    return { query, total: 0, results: [], availableDictionaries: [], durationMs: performance.now() - t0 };
  }
  const activeDict =
    (requestedModuleId && dicts.find((d) => d.id === requestedModuleId)) ||
    dicts.find((d) => d.id === "EASTON") ||
    dicts[0];

  try {
    const db = await getClientModuleDb(activeDict.id);
    const results: DictionarySearchResult[] = [];

    if (!query) {
      const rows = db
        .prepare(
          `SELECT id_entrada, termino, slug, definicion, fuente
           FROM entradas ORDER BY termino ASC LIMIT ?`,
        )
        .all(limit) as unknown as Array<{
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
      return { query, total: results.length, results, availableDictionaries: dicts, durationMs: performance.now() - t0 };
    }

    const seenIds = new Set<number>();
    const qLower = query.toLowerCase();
    const titleRows = db
      .prepare(
        `SELECT id_entrada, termino, slug, definicion, fuente
         FROM entradas WHERE LOWER(termino) LIKE ? OR LOWER(slug) LIKE ?
         ORDER BY CASE WHEN LOWER(termino) = ? THEN 0 WHEN LOWER(termino) LIKE ? THEN 1 ELSE 2 END, termino ASC LIMIT 10`,
      )
      .all(`${qLower}%`, `${qLower}%`, qLower, `${qLower}%`) as unknown as Array<{
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
          .all(ftsQuery, remaining + 10) as unknown as Array<{
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
            .all(...candidateIds) as unknown as Array<{
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
      } catch {}
    }

    if (results.length === 0) {
      const likeQuery = `%${query}%`;
      const likeRows = db
        .prepare(
          `SELECT id_entrada, termino, slug, definicion, fuente
           FROM entradas WHERE termino LIKE ? OR slug LIKE ? OR definicion LIKE ?
           ORDER BY CASE WHEN termino LIKE ? THEN 1 ELSE 2 END, termino ASC LIMIT ?`,
        )
        .all(likeQuery, likeQuery, likeQuery, `${query}%`, limit) as unknown as Array<{
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

    return { query, total: results.length, results, availableDictionaries: dicts, durationMs: performance.now() - t0 };
  } catch {
    return { query, total: 0, results: [], availableDictionaries: dicts, durationMs: performance.now() - t0 };
  }
}

export async function getDictionaryEntry(
  slugOrTerm: string,
  requestedModuleId?: string | null,
): Promise<DictionaryEntry | null> {
  if (!slugOrTerm || !slugOrTerm.trim()) return null;
  const clean = slugOrTerm.trim().toLowerCase();
  const dicts = await listInstalledDictionaries();
  if (dicts.length === 0) return null;
  const activeDict =
    (requestedModuleId && dicts.find((d) => d.id === requestedModuleId)) ||
    dicts.find((d) => d.id === "EASTON") ||
    dicts[0];

  try {
    const db = await getClientModuleDb(activeDict.id);
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
  } catch {
    return null;
  }
}
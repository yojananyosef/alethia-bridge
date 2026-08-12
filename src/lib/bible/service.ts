import {
  createDatabase,
  ensureModuleDbReady,
  getLexiconDb,
  getModuleDb,
  normalizeText,
  resolveModuleDbPath,
  type Database,
} from "../db/sqlite.ts";
import { getModule, getPrimaryBibleModule, listModules, readModuleInfo } from "../modules/registry.ts";
import type {
  BibleLanguage,
  BibleModuleId,
  CommentaryModule,
  CommentaryNote,
  InterlinearModule,
  LexiconEntry,
  MorphologyAnalysis,
  ProperName,
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
  // "grc" (griego antiguo/koyné, p. ej. la Septuaginta) es griego, no hebreo:
  if (info?.language === "el" || info?.language === "grc") return "el";
  return "he";
}

export function parseModules(raw: string | null): BibleModuleId[] {
  if (!raw || !raw.trim()) {
    const primary = getPrimaryBibleModule();
    return primary ? [primary.id] : [];
  }
  const parsed = raw
    .split(",")
    .map((m) => m.trim().toUpperCase())
    .filter(Boolean)
    .map((m) => {
      ensureModuleDbReady(m);
      return m;
    })
    .filter((m): m is BibleModuleId => getModule(m) !== null);

  if (parsed.length === 0) {
    const primary = getPrimaryBibleModule();
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

/** Formas flexionadas de εἰμί que Strong numeró aparte; equivalen al lema raíz (G1510).
 *  Los módulos RV1909 (numeración por formas) y SBLGNT (raíz morphgnt) se unifican aquí. */
const STRONG_EQUIV: Record<string, string> = {
  G2071: "G1510", G2075: "G1510", G2076: "G1510", G2077: "G1510",
  G2252: "G1510", G2258: "G1510", G2468: "G1510", G5600: "G1510", G5607: "G1510",
};

/** Strong canónico para alineación interlingüística. */
function canonicalStrong(strong: string | null): string | null {
  return strong ? (STRONG_EQUIV[strong] ?? strong) : null;
}

export function readChapter(book: string, chapterRaw: string, modulesRaw: string | null): ReadResponse {
  const t0 = performance.now();
  const { book: bookId, chapter } = sanitizeReference(book, chapterRaw);
  const moduleIds = parseModules(modulesRaw);

  const modules: InterlinearModule[] = [];
  const alignmentGroups = new Set<string>();

  for (const moduleId of moduleIds) {
    try {
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

      modules.push({ moduleId, language: moduleLanguage(moduleId), verses: versePayloads });
    } catch {
      // Si el módulo no existe o no se puede cargar, se omite silenciosamente
    }
  }

  // Si todos los módulos activos devuelven 0 versículos para este libro (ej: WLC en el NT o SBLGNT en el AT)
  const totalVerses = modules.reduce((acc, m) => acc + m.verses.length, 0);
  if (totalVerses === 0) {
    const allInstalledBibles = listModules()
      .filter((m) => m.type === "bible" && m.status === "installed" && !moduleIds.includes(m.id));
    for (const alt of allInstalledBibles) {
      try {
        const altDb = getModuleDb(alt.id);
        const altVerses = altDb
          .prepare(
            `SELECT id_versiculo, libro_id, capitulo, versiculo, texto_plano
             FROM versiculos WHERE libro_id = ? AND capitulo = ? ORDER BY versiculo`,
          )
          .all(bookId, chapter) as VerseRow[];
        if (altVerses.length > 0) {
          const placeholders = altVerses.map(() => "?").join(",");
          const tokens = altDb
            .prepare(
              `SELECT id_palabra, id_versiculo, posicion, texto_superficie, lema, strong_id, morph_code, alineacion_id
               FROM palabras_interlineal WHERE id_versiculo IN (${placeholders}) ORDER BY id_versiculo, posicion`,
            )
            .all(...altVerses.map((v) => v.id_versiculo)) as TokenRow[];
          const tokensByVerse = new Map<number, TokenRow[]>();
          for (const t of tokens) {
            const list = tokensByVerse.get(t.id_versiculo) ?? [];
            list.push(t);
            tokensByVerse.set(t.id_versiculo, list);
            alignmentGroups.add(t.alineacion_id);
          }
          const versePayloads: VersePayload[] = altVerses.map((v) => ({
            reference: `${v.libro_id} ${v.capitulo}:${v.versiculo}`,
            book: v.libro_id,
            chapter: v.capitulo,
            verse: v.versiculo,
            text: v.texto_plano,
            tokens: (tokensByVerse.get(v.id_versiculo) ?? []).map((t) => ({
              id: t.id_palabra,
              position: t.posicion,
              text: t.texto_superficie,
              lemma: t.lema,
              strongId: t.strong_id,
              morphCode: t.morph_code,
              alignmentId: t.strong_id
                ? `${v.libro_id}${v.capitulo}:${v.versiculo}:s${canonicalStrong(t.strong_id)}`
                : t.alineacion_id,
            })),
          }));
          modules.push({ moduleId: alt.id, language: moduleLanguage(alt.id), verses: versePayloads });
          break;
        }
      } catch {}
    }
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

const tableExistsCache = new Map<string, boolean>();

function hasTableInDb(db: Database, tableName: string, moduleId: string): boolean {
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

const lexiconCache = new Map<string, LexiconEntry | null>();
const morphologyCache = new Map<string, MorphologyAnalysis | null>();
const properNamesCache = new Map<string, ProperName[]>();
const commentaryCache = new Map<string, { commentary: CommentaryModule[]; durationMs: number }>();
const crossRefCache = new Map<string, { crossref: import("../../types/bible.ts").CrossRefModule[]; durationMs: number }>();
const chapterCache = new Map<string, ReadResponse>();

export function clearServiceCaches(moduleId?: string): void {
  lexiconCache.clear();
  morphologyCache.clear();
  properNamesCache.clear();
  commentaryCache.clear();
  crossRefCache.clear();
  chapterCache.clear();
  if (moduleId) {
    for (const k of tableExistsCache.keys()) {
      if (k.startsWith(`${moduleId}:`)) tableExistsCache.delete(k);
    }
  } else {
    tableExistsCache.clear();
  }
}

export function getLexiconEntry(strongId: string): LexiconEntry | null {
  const key = strongId.toUpperCase();
  if (lexiconCache.has(key)) return lexiconCache.get(key) ?? null;
  try {
    const db = getLexiconDb();
    if (!hasTableInDb(db, "diccionario", "lexicon")) return null;

    const row = db.prepare(`SELECT * FROM diccionario WHERE strong_id = ?`).get(key) as
      | LexiconRow
      | undefined;
    if (!row) {
      lexiconCache.set(key, null);
      return null;
    }
    let glosa: string | null = null;
    if (hasTableInDb(db, "glosas", "lexicon")) {
      try {
        const glosaRow = db
          .prepare(`SELECT glosa FROM glosas WHERE strong_id = ?`)
          .get(key) as { glosa: string } | undefined;
        glosa = glosaRow?.glosa ?? null;
      } catch {}
    }
    const res: LexiconEntry = {
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
    lexiconCache.set(key, res);
    return res;
  } catch {
    return null;
  }
}

export function getMorphology(code: string): MorphologyAnalysis | null {
  const key = code.toUpperCase();
  if (morphologyCache.has(key)) return morphologyCache.get(key) ?? null;
  try {
    const db = getLexiconDb();
    if (!hasTableInDb(db, "parsing_gramatical", "lexicon")) return null;

    const row = db
      .prepare(`SELECT * FROM parsing_gramatical WHERE morph_code = ?`)
      .get(key) as { morph_code: string; descripcion_espanol: string; categoria_gramatical: string } | undefined;
    if (!row) {
      morphologyCache.set(key, null);
      return null;
    }
    const res: MorphologyAnalysis = {
      code: row.morph_code,
      description: row.descripcion_espanol,
      category: row.categoria_gramatical,
    };
    morphologyCache.set(key, res);
    return res;
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

/** Nombres propios que usan un Strong, ordenados por relevancia al libro actual
 *  (los que lo mencionan primero) y por la primera referencia (más corta antes). */
export function getProperNames(strongId: string, book?: string): ProperName[] {
  const cacheKey = `${strongId.toUpperCase()}:${book ?? ""}`;
  if (properNamesCache.has(cacheKey)) return properNamesCache.get(cacheKey) ?? [];
  const db = getLexiconDb();
  if (!hasTableInDb(db, "nombres_propios", "lexicon")) return [];

  const rows = db
    .prepare(`SELECT * FROM nombres_propios WHERE strong_id = ?`)
    .all(strongId.toUpperCase()) as ProperNameRow[];
  const bookMatch = book
    ? (r: ProperNameRow): boolean => r.libros.split(",").includes(book)
    : (): boolean => true;
  const ordered = [...rows].sort((a, b) => Number(bookMatch(b)) - Number(bookMatch(a)));
  const result: ProperName[] = ordered.map((r) => ({
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
  properNamesCache.set(cacheKey, result);
  return result;
}

interface CommentaryRow {
  versiculo: number;
  texto: string;
}

/** Comentarios instalados (módulos type=commentary, p. ej. Torres Amat)
 *  para un capítulo: notas por versículo, en orden del capítulo. */
export function readCommentary(
  book: string,
  chapterRaw: string,
  installedFilter?: string[] | null,
): {
  commentary: CommentaryModule[];
  durationMs: number;
} {
  const { book: bookId, chapter } = sanitizeReference(book, chapterRaw);
  const cacheKey = `${bookId}:${chapter}:${(installedFilter ?? []).sort().join(",")}`;
  if (commentaryCache.has(cacheKey)) {
    return commentaryCache.get(cacheKey)!;
  }

  const t0 = performance.now();
  const altBookId =
    bookId === "John" ? "Jn" : bookId === "Jn" ? "John" : bookId === "Gen" ? "Genesis" : bookId === "Genesis" ? "Gen" : bookId;
  const commentary: CommentaryModule[] = [];

  const candidateModules = [...listModules(installedFilter)];

  for (const info of candidateModules) {
    if (info.type !== "commentary" || info.status !== "installed") continue;
    try {
      const db = getModuleDb(info.id);
      if (!hasTableInDb(db, "comentarios", info.id)) continue;
      const rows = db
        .prepare(
          `SELECT versiculo, texto FROM comentarios
           WHERE (libro_id = ? OR libro_id = ?) AND capitulo = ? ORDER BY versiculo`,
        )
        .all(bookId, altBookId, chapter) as CommentaryRow[];
      if (rows.length === 0) continue;
      commentary.push({
        moduleId: info.id,
        name: info.name,
        notes: rows.map((r) => ({ verse: r.versiculo, text: r.texto }) satisfies CommentaryNote),
      });
    } catch {
      // Módulo en plena instal/desinstal: se omite en vez de fallar la lectura.
    }
  }

  const res = { commentary, durationMs: performance.now() - t0 };
  commentaryCache.set(cacheKey, res);
  return res;
}

/**
 * Consulta de referencias cruzadas (módulos type=crossref, p. ej. TSK / Treasury of Scripture Knowledge).
 * Filtra por libro, capítulo y opcionalmente versículo específico.
 */
export function readCrossReferences(
  book: string,
  chapterRaw: string,
  verseRaw?: string | null,
  installedFilter?: string[] | null,
): { crossref: import("../../types/bible.ts").CrossRefModule[]; durationMs: number } {
  const { book: bookId, chapter } = sanitizeReference(book, chapterRaw);
  const verse = verseRaw ? Number.parseInt(verseRaw, 10) || null : null;
  const cacheKey = `${bookId}:${chapter}:${verse ?? "all"}:${(installedFilter ?? []).sort().join(",")}`;
  if (crossRefCache.has(cacheKey)) {
    return crossRefCache.get(cacheKey)!;
  }

  const t0 = performance.now();
  const crossref: import("../../types/bible.ts").CrossRefModule[] = [];

  const candidateModules = [...listModules(installedFilter)];

  const altBookId =
    bookId === "John" ? "Jn" : bookId === "Jn" ? "John" : bookId === "Gen" ? "Genesis" : bookId === "Genesis" ? "Gen" : bookId;

  for (const info of candidateModules) {
    if (info.type !== "crossref" || info.status !== "installed") continue;
    try {
      const db = getModuleDb(info.id);
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
          .all(bookId, altBookId, chapter, verse) as typeof rows;
      } else {
        rows = db
          .prepare(
            `SELECT id_ref, libro_origen, capitulo_origen, versiculo_origen, libro_destino, capitulo_destino, versiculo_destino_inicio, versiculo_destino_fin, votos, nota
             FROM referencias_cruzadas WHERE (libro_origen = ? OR libro_origen = ?) AND capitulo_origen = ?
             ORDER BY versiculo_origen ASC, votos DESC, id_ref ASC`,
          )
          .all(bookId, altBookId, chapter) as typeof rows;
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
    } catch {
      // Ignorar fallas si la base está siendo manipulada
    }
  }

  const res = { crossref, durationMs: performance.now() - t0 };
  crossRefCache.set(cacheKey, res);
  return res;
}

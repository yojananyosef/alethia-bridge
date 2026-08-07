/**
 * IMPORT-OSIS / USFX (ETL generalizado)
 * --------------------------------------
 * Importa biblias en XML (USFX o OSIS con milestones) hacia un módulo
 * SQLite instalable (.abmod). Esta es la vía de datos reales del sistema:
 *
 *   - USFX (formato XML de USFM): <book id="GEN"> <c id="1" /> <v id="1" />
 *          <w s="H7225">EN el principio</w> <ve />
 *   - OSIS (milestones): <div type="book" osisID="Gen"> <verse sID="John.3.16"/>
 *          ... <verse eID="John.3.16"/>
 *
 * Soporta:
 *   - Milestones de libro/capítulo/versículo en ambos formatos.
 *   - Tagging Strong: <w s="H7225"> (USFX) / <w lemma="strong:G3056" morph="…">
 *     / <seg subType="x-strong:G3056"> (OSIS).
 *   - Exclusión de notas y títulos (note/f/x/title/h/toc/id/figure).
 *   - Entidades XML estándar, numéricas y Latin-1 comunes; CDATA.
 *   - Escritura de manifest (meta) + canon (libros) → módulo instalable
 *     y empaquetable (bun run package <id>).
 *
 * Uso: node scripts/import-osis.ts <archivo.xml|.usfx|.zip> <ID_MODULO>
 *   [--name "Reina-Valera 1909"] [--lang es] [--version 1.0.0]
 *   [--publisher "…"] [--license "…"] [--year 1909] [--description "…"]
 *   [--deps lexicon] [--strong-scheme strong]
 *
 *   ej: node scripts/import-osis.ts data/osis/spa-rv1909.usfx.xml RV1909 \
 *         --name "Reina-Valera 1909" --lang es --license "Public Domain"
 *
 * Fuentes probadas (dominio público / libres):
 *   - RV1909 USFX con Strongs: github.com/seven1m/open-bibles/spa-rv1909.usfx.xml
 *   - eBible.org distribuye OSIS con milestones para muchas traducciones libres.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sax from "sax";
import { unzipSync } from "fflate";
import Database from "better-sqlite3";
import {
  FTS_TRIGGERS,
  SCHEMA_VERSICULOS,
  getModuleDb,
  initModuleMeta,
  MODULES_DIR,
  normalizeText,
  writeBooks,
  writeManifestMeta,
} from "../src/lib/db/sqlite.ts";
import { BOOKLIST, bookIdByOsisName, bookIdByUsfxCode } from "../src/lib/canon.ts";

/* ------------------------------------------------------------------ */
/* Entidades XML Latin-1 comunes (español y generales)                  */
/* ------------------------------------------------------------------ */

const ENTITIES: Record<string, string> = {
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  ntilde: "ñ", uuml: "ü", agrave: "à", egrave: "è", igrave: "ì",
  ograve: "ò", ugrave: "ù", auml: "ä", ouml: "ö", euml: "ë",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  Ntilde: "Ñ", Uuml: "Ü", szlig: "ß", Ccedil: "Ç", ccedil: "ç",
  deg: "°", mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’",
  ldquo: "“", rdquo: "”", hellip: "…", middot: "·", bull: "•",
};

function decodeEntities(text: string): string {
  return text.replace(/&([A-Za-z][A-Za-z0-9]*);/g, (full, name: string) => ENTITIES[name] ?? full);
}

/** Normaliza un strong: "H0430" → "H430", "G0040" → "G40" (consistente con el lexicon). */
function normalizeStrong(strong: string): string {
  return strong.replace(/^([GH])0+(?=\d)/, "$1");
}

/* ------------------------------------------------------------------ */
/* Tokenización (misma política que el seed)                            */
/* ------------------------------------------------------------------ */

interface Token {
  text: string;
  isPunct: boolean;
}

function tokenize(text: string): Token[] {
  const re = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*|[^\p{L}\p{M}\p{N}\s]+/gu;
  const out: Token[] = [];
  for (const m of text.matchAll(re)) {
    const t = m[0];
    out.push({ text: t, isPunct: !/[\p{L}\p{M}\p{N}]/u.test(t) });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Modelo de salida                                                     */
/* ------------------------------------------------------------------ */

interface WordToken {
  text: string;
  strong: string | null;
  morph: string | null;
}

interface VerseData {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  tokens: WordToken[];
}

/* ------------------------------------------------------------------ */
/* Parser SAX (streaming, tolerante)                                    */
/* ------------------------------------------------------------------ */

const SKIPPED_TAGS = new Set(["note", "f", "x", "title", "h", "toc", "id", "figure"]);

function localName(name: string): string {
  return name.includes(":") ? name.slice(name.lastIndexOf(":") + 1) : name;
}

interface ParserState {
  book: string | null;
  chapter: number | null;
  verse: number | null;
  vText: string;
  vTokens: WordToken[];
  plainBuffer: string;
  wordText: string;
  wordStrong: string | null;
  wordMorph: string | null;
  inWord: boolean;
  skipDepth: number;
  unknownBooks: string[];
  /** true si el versículo se abrió con un milestone auto-cerrado (<verse sID="…"/>): sax
   *  dispara closetag también para self-closing, y no debe cerrar el versículo. */
  verseMilestone: boolean;
}

/** Extrae "G3056" desde atributos lemma/subType/type (OSIS). */
function strongFromAttrs(attrs: Record<string, string>): string | null {
  for (const key of ["lemma", "subType", "type"]) {
    const raw = attrs[key];
    if (!raw) continue;
    const m = String(raw).match(/(?:x-)?strong:([A-Za-z]\d+)/i);
    if (m) return normalizeStrong(m[1].toUpperCase());
  }
  return null;
}

function buildParser(
  emit: (v: VerseData) => void,
  log: (msg: string) => void,
): { parser: sax.SAXParser; state: ParserState } {
  const state: ParserState = {
    book: null,
    chapter: null,
    verse: null,
    vText: "",
    vTokens: [],
    plainBuffer: "",
    wordText: "",
    wordStrong: null,
    wordMorph: null,
    inWord: false,
    skipDepth: 0,
    unknownBooks: [],
    verseMilestone: false,
  };

  /** Texto sin tag <w> → tokens planos (preserva el orden de documento). */
  const flushPlain = (): void => {
    for (const t of tokenize(state.plainBuffer)) {
      if (t.isPunct) continue;
      state.vTokens.push({ text: t.text, strong: null, morph: null });
    }
    state.plainBuffer = "";
  };

  /** Cierra el <w> actual: sus tokens llevan el strong del tag. */
  const flushWord = (): void => {
    flushPlain();
    if (state.inWord) {
      for (const t of tokenize(state.wordText)) {
        if (t.isPunct) continue;
        state.vTokens.push({ text: t.text, strong: state.wordStrong, morph: state.wordMorph });
      }
      state.wordText = "";
      state.inWord = false;
    }
  };

  const closeVerse = (): void => {
    flushWord();
    if (state.verse !== null && state.book) {
      const text = state.vText.replace(/\s+/g, " ").trim();
      if (text) {
        emit({
          book: state.book,
          chapter: state.chapter ?? 0,
          verse: state.verse,
          text,
          tokens: state.vTokens,
        });
      }
    }
    state.verse = null;
    state.vText = "";
    state.vTokens = [];
    state.plainBuffer = "";
  };

  const openVerse = (verse: number): void => {
    closeVerse();
    state.verse = verse;
  };

  const parser = sax.parser(true, {
    trim: false,
    normalize: false,
    lowercase: false,
  });

  parser.onopentag = (node: sax.Tag): void => {
    const tag = localName(node.name);
    const attrs = node.attributes as Record<string, string>;

    switch (tag) {
      case "book": {
        // USFX: <book id="GEN"> — OSIS: <book osisID="Genesis"> (o <div type="book" osisID>)
        const id = attrs.id ? bookIdByUsfxCode(attrs.id) : attrs.osisID ? bookIdByOsisName(attrs.osisID) : undefined;
        closeVerse();
        if (!id) state.unknownBooks.push(String(attrs.id ?? attrs.osisID ?? "?"));
        state.book = id ?? null;
        state.chapter = null;
        break;
      }
      case "div": {
        if (attrs.type === "book" && attrs.osisID) {
          const id = bookIdByOsisName(attrs.osisID);
          closeVerse();
          if (!id) state.unknownBooks.push(attrs.osisID);
          state.book = id ?? null;
          state.chapter = null;
        }
        break;
      }
      case "c": {
        // USFX: <c id="1" />
        const ch = Number(attrs.id);
        if (Number.isInteger(ch)) {
          closeVerse();
          state.chapter = ch;
        }
        break;
      }
      case "chapter": {
        // OSIS: <chapter osisID="Gen.1"/> (milestone) o <chapter osisID="Gen.1">…</chapter>
        const ref = attrs.osisID;
        if (ref) {
          const ch = Number(ref.split(".").pop());
          if (Number.isInteger(ch)) {
            closeVerse();
            state.chapter = ch;
          }
        }
        break;
      }
      case "v": {
        // USFX: <v id="1" />
        const v = Number(attrs.id);
        if (Number.isInteger(v)) openVerse(v);
        break;
      }
      case "ve": {
        // USFX: <ve />
        closeVerse();
        break;
      }
      case "verse": {
        // OSIS: <verse sID="John.3.16"/> … <verse eID="John.3.16"/>
        //       o <verse osisID="John.3.16">…</verse> (forma de elemento)
        if (attrs.eID) {
          closeVerse();
        } else if (attrs.osisID) {
          const parts = attrs.osisID.split(".");
          const v = Number(parts[parts.length - 1]);
          if (Number.isInteger(v)) {
            state.verseMilestone = node.isSelfClosing;
            openVerse(v);
          }
        }
        break;
      }
      case "w": {
        // USFX: <w s="H7225">texto</w> — OSIS: <w lemma="strong:G3056" morph="…">texto</w>
        flushPlain();
        state.inWord = true;
        state.wordStrong = (attrs.s ?? "").trim() || strongFromAttrs(attrs);
        if (state.wordStrong) state.wordStrong = normalizeStrong(state.wordStrong);
        state.wordMorph = attrs.morph ? String(attrs.morph).trim() : null;
        break;
      }
      case "seg": {
        // OSIS interlinear: <seg subType="x-strong:G3056">texto</seg>
        const strong = strongFromAttrs(attrs);
        if (strong) {
          flushPlain();
          state.inWord = true;
          state.wordStrong = strong;
          state.wordMorph = null;
        }
        break;
      }
      default: {
        if (SKIPPED_TAGS.has(tag)) state.skipDepth++;
        break;
      }
    }
  };

  parser.onclosetag = (name: string): void => {
    const tag = localName(name);
    if (tag === "w" || tag === "seg") {
      flushWord();
    } else if (tag === "verse") {
      if (state.verseMilestone) {
        state.verseMilestone = false;
        return;
      }
      closeVerse();
    } else if (tag === "book") {
      closeVerse();
      state.book = null;
      state.chapter = null;
    } else if (SKIPPED_TAGS.has(tag) && state.skipDepth > 0) {
      state.skipDepth--;
    }
  };

  const onText = (raw: string): void => {
    if (state.skipDepth > 0 || state.verse === null) return;
    const text = decodeEntities(raw);
    if (!text) return;
    state.vText += text;
    if (state.inWord) state.wordText += text;
    else state.plainBuffer += text;
  };
  parser.ontext = onText;
  parser.oncdata = onText;

  parser.onerror = (err: Error): void => {
    log(`aviso XML (línea ${parser.line}): ${err.message}`);
    parser.resume();
  };

  return { parser, state };
}

/* ------------------------------------------------------------------ */
/* Detección de formato                                                 */
/* ------------------------------------------------------------------ */

function detectRoot(xml: string): "usfx" | "osis" {
  const stripped = xml
    .replace(/<\?xml[^>]*\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/g, "");
  const m = stripped.match(/<\s*([A-Za-z][\w.-]*)/);
  const root = m ? m[1].toLowerCase() : "";
  if (root === "usfx") return "usfx";
  if (root === "osis" || root === "osistext") return "osis";
  throw new Error(`formato XML no reconocido (raíz: "${root || "ninguna"}")`);
}

/* ------------------------------------------------------------------ */
/* Importación                                                          */
/* ------------------------------------------------------------------ */

interface ManifestFlags {
  name?: string;
  lang?: string;
  version?: string;
  publisher?: string;
  license?: string;
  year?: string;
  description?: string;
  deps?: string[];
  strongScheme?: string;
}

function flagValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}

function readSource(source: string): string {
  if (!existsSync(source)) throw new Error(`archivo no encontrado: ${source}`);
  const bytes = readFileSync(source);
  if (source.toLowerCase().endsWith(".zip")) {
    const files = unzipSync(bytes);
    const names = Object.keys(files);
    const match =
      names.find((n) => /\.(usfx|osis)\.xml$/i.test(n)) ?? names.find((n) => n.endsWith(".xml"));
    if (!match) {
      throw new Error(`no se encontró un .usfx.xml/.osis.xml dentro del zip (${names.join(", ")})`);
    }
    return new TextDecoder("utf-8").decode(files[match]);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function importModule(sourcePath: string, moduleId: string, flags: ManifestFlags): void {
  if (!/^[A-Za-z0-9_.-]+$/.test(moduleId)) throw new Error(`id de módulo inválido: ${moduleId}`);

  const xml = readSource(sourcePath);
  const format = detectRoot(xml);
  const db = getModuleDb(moduleId);
  db.exec(SCHEMA_VERSICULOS);
  db.exec(FTS_TRIGGERS);
  initModuleMeta(db);
  db.exec("DELETE FROM palabras_interlineal; DELETE FROM versiculos;");

  const insVerse = db.prepare(
    `INSERT INTO versiculos (libro_id, capitulo, versiculo, texto_plano, texto_norm)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const insWord = db.prepare(
    `INSERT INTO palabras_interlineal (id_versiculo, posicion, texto_superficie, lema, strong_id, morph_code, alineacion_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  // Lemas desde el lexicon si está instalado (cacheado por strong).
  const lexiconPath = path.join(MODULES_DIR, "lexicon.db");
  const lemmaCache = new Map<string, string | null>();
  let getLemma: ((strong: string) => string | null) | null = null;
  if (existsSync(lexiconPath)) {
    try {
      const lx = new Database(lexiconPath, { readonly: true });
      const q = lx.prepare(`SELECT lema FROM diccionario WHERE strong_id = ?`);
      getLemma = (strong: string): string | null => {
        const row = q.get(strong) as { lema: string } | undefined;
        return row?.lema ?? null;
      };
    } catch {
      getLemma = null;
    }
  }
  const lemmaFor = (strong: string | null): string | null => {
    if (!strong || !getLemma) return null;
    if (lemmaCache.has(strong)) return lemmaCache.get(strong) ?? null;
    const lemma = getLemma(strong);
    lemmaCache.set(strong, lemma);
    return lemma;
  };

  let verses = 0;
  let words = 0;
  let bookBuffer: VerseData[] = [];
  let lastBook: string | null = null;

  const flushBook = (): void => {
    if (bookBuffer.length === 0) return;
    const bookId = bookBuffer[0].book;
    const tx = db.transaction(() => {
      for (const v of bookBuffer) {
        const id = Number(
          insVerse.run(v.book, v.chapter, v.verse, v.text, normalizeText(v.text)).lastInsertRowid,
        );
        v.tokens.forEach((t, ti) => {
          insWord.run(
            id, ti, t.text, lemmaFor(t.strong), t.strong, t.morph,
            `${v.book}${v.chapter}:${v.verse}:g${ti}`,
          );
          words++;
        });
      }
    });
    tx();
    verses += bookBuffer.length;
    console.log(`  ${bookId}: ${bookBuffer.length} versículos`);
    bookBuffer = [];
  };

  const emit = (v: VerseData): void => {
    if (lastBook !== v.book) {
      flushBook();
      lastBook = v.book;
    }
    bookBuffer.push(v);
  };

  const t0 = performance.now();
  console.log(`${format === "usfx" ? "USFX" : "OSIS"}: ${(xml.length / 1024 / 1024).toFixed(1)} MB XML`);
  const { parser, state } = buildParser(emit, (msg) => console.log(`  ${msg}`));
  parser.write(xml).close();
  flushBook();

  if (verses === 0) throw new Error(`no se importó ningún versículo (¿archivo vacío o malformado?)`);
  if (state.unknownBooks.length > 0) {
    console.log(`  aviso: libros no reconocidos: ${[...new Set(state.unknownBooks)].join(", ")}`);
  }

  // Manifest + canon → módulo instalable/empaquetable
  writeBooks(db, BOOKLIST.map((b, i) => ({ ...b, orden: i + 1 })));
  writeManifestMeta(db, {
    id: moduleId,
    name: flags.name ?? moduleId,
    type: "bible",
    language: flags.lang ?? "es",
    version: flags.version ?? "1.0.0",
    publisher: flags.publisher ?? "",
    license: flags.license ?? "",
    year: flags.year ?? "0",
    description:
      flags.description ??
      `${format === "usfx" ? "USFX" : "OSIS"} completo: ${verses} versículos (${sourcePath}).`,
    schemaVersion: "1",
    dependencies: (flags.deps ?? []).join(","),
    strongScheme: flags.strongScheme ?? "",
    bookOrder: BOOKLIST.map((b) => b.id).join(","),
  });

  console.log(
    `OK ${moduleId}: ${verses} versículos, ${words} tokens en ${(performance.now() - t0).toFixed(0)}ms`,
  );
}

/* ------------------------------------------------------------------ */
/* CLI                                                                  */
/* ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const [sourcePath, moduleId] = args;

if (!sourcePath || !moduleId) {
  console.error(
    "Uso: node scripts/import-osis.ts <archivo.xml|.usfx|.zip> <ID_MODULO> [--name …] [--lang es] [--version 1.0.0]\n" +
      "     [--publisher …] [--license …] [--year …] [--description …] [--deps a,b] [--strong-scheme …]",
  );
  process.exit(1);
}

const flags: ManifestFlags = {
  name: flagValue(args, "--name"),
  lang: flagValue(args, "--lang"),
  version: flagValue(args, "--version"),
  publisher: flagValue(args, "--publisher"),
  license: flagValue(args, "--license"),
  year: flagValue(args, "--year"),
  description: flagValue(args, "--description"),
  deps: flagValue(args, "--deps")?.split(",").map((s) => s.trim()).filter(Boolean),
  strongScheme: flagValue(args, "--strong-scheme"),
};

try {
  importModule(sourcePath, moduleId, flags);
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

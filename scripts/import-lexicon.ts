/**
 * IMPORT-LEXICON (diccionario Strong completo)
 * --------------------------------------------
 * Reconstruye data/modules/lexicon.db con el diccionario Strong real:
 *
 *   - Hebreo: HebrewStrong.xml (proyecto StrongSchema / openscriptures, CC BY 4.0)
 *             8.674 entradas (H1..H8674): lema, translit, pronunciación,
 *             significado corto (<meaning>), detalle (<source>+<usage>).
 *   - Griego: strongsgreek.xml (morphgnt/strongs-dictionary-xml, CC BY 4.0)
 *             5.624 entradas (G1..G5624): lema unicode, translit, pronunciación,
 *             kjv_def (corto), strongs_def+derivation (detalle).
 *
 * Mantiene `parsing_gramatical` intacto (es del seed) y escribe el manifest
 * del módulo para empaquetado/instalación (bun run package lexicon).
 *
 * Uso: node scripts/import-lexicon.ts [HebrewStrong.xml] [strongsgreek.xml]
 */
import { existsSync, readFileSync } from "node:fs";
import sax from "sax";
import {
  SCHEMA_LEXICON,
  getModuleDb,
  initModuleMeta,
  writeManifestMeta,
} from "../src/lib/db/sqlite.ts";

interface LexRecord {
  strong_id: string;
  lema: string | null;
  translit: string | null;
  pron: string | null;
  corta: string | null;
  detallada: string | null;
  idioma: "HEBREW" | "GREEK";
}

function normalizeStrongId(id: string, prefix: "H" | "G"): string {
  return `${prefix}${String(id).replace(/^0+(?=\d)/, "")}`;
}

/* ------------------------------------------------------------------ */
/* Hebreo (HebrewStrong.xml, formato StrongSchema)                     */
/* ------------------------------------------------------------------ */

function parseHebrew(xml: string, log: (m: string) => void): LexRecord[] {
  const out: LexRecord[] = [];
  let entry: Partial<LexRecord> | null = null;
  let section = "";
  let buf = "";
  let seenHeadword = false;

  const p = sax.parser(true, { trim: false, normalize: false, lowercase: false });
  p.onopentag = (node: sax.Tag): void => {
    const tag = node.name.includes(":") ? node.name.slice(node.name.lastIndexOf(":") + 1) : node.name;
    if (tag === "entry") {
      const raw = String(node.attributes.id);
      entry = {
        strong_id: raw.startsWith("H") ? raw : normalizeStrongId(raw, "H"),
        idioma: "HEBREW",
      };
      buf = "";
      seenHeadword = false;
    } else if (entry && tag === "w" && !seenHeadword) {
      const a = node.attributes as Record<string, string>;
      entry.translit = a.xlit ?? null;
      entry.pron = a.pron ?? null;
      section = "w";
      buf = "";
      seenHeadword = true;
    } else if (entry && (tag === "source" || tag === "meaning" || tag === "usage")) {
      section = tag;
      buf = "";
    }
  };
  p.onclosetag = (name: string): void => {
    const tag = name.includes(":") ? name.slice(name.lastIndexOf(":") + 1) : name;
    if (!entry) return;
    if (tag === "w" && section === "w") {
      entry.lema = buf.trim();
      section = "";
      buf = "";
    } else if (tag === "meaning") {
      entry.corta = buf.replace(/\s+/g, " ").trim();
      section = "";
      buf = "";
    } else if (tag === "source") {
      const text = buf.trim();
      entry.detallada = text ? text : entry.detallada;
      section = "";
      buf = "";
    } else if (tag === "usage") {
      const text = buf.trim();
      entry.detallada = entry.detallada && text ? `${entry.detallada} — ${text}` : text || entry.detallada;
      section = "";
      buf = "";
    } else if (tag === "entry") {
      if (entry.strong_id) out.push(entry as LexRecord);
      entry = null;
    }
  };
  p.ontext = (t: string): void => {
    if (entry && section) buf += t;
  };
  p.onerror = (err: Error): void => {
    log(`aviso XML (línea ${p.line}): ${err.message}`);
    p.resume();
  };
  p.write(xml).close();
  return out;
}

/* ------------------------------------------------------------------ */
/* Griego (strongsgreek.xml, DTD strongs)                              */
/* ------------------------------------------------------------------ */

function parseGreek(xml: string, log: (m: string) => void): LexRecord[] {
  const out: LexRecord[] = [];
  let entry: Partial<LexRecord> | null = null;
  let section = "";
  let buf = "";
  let seenHeadword = false;
  let strongsDef = "";
  let derivation = "";

  const p = sax.parser(true, { trim: false, normalize: false, lowercase: false });
  p.onopentag = (node: sax.Tag): void => {
    const tag = node.name.includes(":") ? node.name.slice(node.name.lastIndexOf(":") + 1) : node.name;
    if (tag === "entry") {
      entry = { strong_id: normalizeStrongId(String(node.attributes.strongs), "G"), idioma: "GREEK" };
      buf = "";
      strongsDef = "";
      derivation = "";
      seenHeadword = false;
    } else if (entry && tag === "greek" && !seenHeadword) {
      const a = node.attributes as Record<string, string>;
      entry.lema = a.unicode ?? null;
      entry.translit = a.translit ?? null;
      seenHeadword = true;
    } else if (entry && (tag === "pronunciation" || tag === "strongs_def" || tag === "kjv_def" || tag === "strongs_derivation")) {
      section = tag;
      buf = "";
    }
  };
  p.onclosetag = (name: string): void => {
    const tag = name.includes(":") ? name.slice(name.lastIndexOf(":") + 1) : name;
    if (!entry) return;
    if (tag === "pronunciation") {
      entry.pron = buf.trim() || null;
      section = "";
      buf = "";
    } else if (tag === "strongs_def") {
      strongsDef = buf.replace(/\s+/g, " ").trim();
      section = "";
      buf = "";
    } else if (tag === "kjv_def") {
      entry.corta = buf.replace(/\s+/g, " ").trim() || null;
      section = "";
      buf = "";
    } else if (tag === "strongs_derivation") {
      derivation = buf.replace(/\s+/g, " ").trim();
      section = "";
      buf = "";
    } else if (tag === "entry") {
      entry.detallada = [strongsDef, derivation && `Origen: ${derivation}`].filter(Boolean).join(" ") || null;
      if (entry.strong_id) out.push(entry as LexRecord);
      entry = null;
    }
  };
  p.ontext = (t: string): void => {
    if (entry && section) buf += t;
  };
  p.onerror = (err: Error): void => {
    log(`aviso XML (línea ${p.line}): ${err.message}`);
    p.resume();
  };
  p.write(xml).close();
  return out;
}

/* ------------------------------------------------------------------ */
/* Importación                                                         */
/* ------------------------------------------------------------------ */

function readSource(path: string): string {
  if (!existsSync(path)) throw new Error(`archivo no encontrado: ${path}`);
  return new TextDecoder("utf-8").decode(readFileSync(path));
}

const args = process.argv.slice(2);
const hebPath = args[0] ?? "data/osis/HebrewStrong.xml";
const grPath = args[1] ?? "data/osis/strongsgreek.xml";

const db = getModuleDb("lexicon");
db.exec(SCHEMA_LEXICON);
initModuleMeta(db);
db.exec("DELETE FROM diccionario;");

const ins = db.prepare(
  `INSERT INTO diccionario (strong_id, lema, transliteracion, pronunciacion, definicion_corta, definicion_detallada, dominio_semantico, idioma)
   VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
);

const t0 = performance.now();
const hebrew = parseHebrew(readSource(hebPath), (m) => console.log(`  ${m}`));
const greek = parseGreek(readSource(grPath), (m) => console.log(`  ${m}`));

const tx = db.transaction(() => {
  for (const r of [...hebrew, ...greek]) {
    ins.run(r.strong_id, r.lema ?? "", r.translit ?? "", r.pron ?? "", r.corta ?? "", r.detallada ?? "", r.idioma);
  }
});
tx();

writeManifestMeta(db, {
  id: "lexicon",
  name: "Strong's Dictionary (Hebreo + Griego)",
  type: "lexicon",
  language: "he",
  version: "1.0.0",
  publisher: "OpenScriptures / morphgnt (CC BY 4.0)",
  license: "CC BY 4.0",
  year: "2020",
  description: `Diccionario Strong completo: ${hebrew.length} entradas hebreas + ${greek.length} griegas.`,
  schemaVersion: "1",
  dependencies: "",
  strongScheme: "strong",
  bookOrder: "",
});

console.log(
  `OK lexicon: ${hebrew.length} hebreas, ${greek.length} griegas en ${(performance.now() - t0).toFixed(0)}ms`,
);

/**
 * IMPORT-OSIS (borrador ETL)
 * --------------------------
 * Pipeline para importar archivos XML OSIS (Open Scripture Information
 * Standard) hacia la base de datos SQLite de módulos textuales.
 *
 * ESTADO: BORRADOR — la vía de datos reales es scripts/seed-test-db.ts.
 * Este script define la estructura del pipeline:
 *
 *   1. Lee el XML OSIS por streaming (regex por bloque <verse>).
 *   2. Extrae: referencia (osisID), texto plano (sin marcado), y opcionalmente
 *      anotaciones interlineales embebidas (<seg subType="x-strong:...">).
 *   3. Tokeniza el texto y lo inserta en `versiculos` + `palabras_interlineal`
 *      (los triggers de FTS5 mantienen `versiculos_fts` sincronizado).
 *
 * TODO (fase de refinamiento):
 *   - Usar un parser XML real (SAX) en vez de regex (tolerancia a CDATA).
 *   - Alineación interlineal multi-módulo: el archivo OSIS "interlinear"
 *     expone alineación por <seg osisID="..."/>; mapear a `alineacion_id`.
 *   - Soporte para libros sin numeración (e.g. 1 Juan) y canon extendido.
 *   - Mapeo de ids de libro (ej. "John" -> "Jn") y versículos no alineados
 *     en capítulos (e.g. Jn 7:53-8:11 numeración distinta).
 *
 * Uso: node scripts/import-osis.ts <archivo.osis> <ID_MODULO>
 *   ej: node scripts/import-osis.ts ./data/osis/RV1909.osis.xml RV1909
 */
import { readFileSync } from "node:fs";
import { initModuleDb, normalizeText } from "../src/lib/db/sqlite.ts";

const BOOK_ID_MAP: Record<string, string> = {
  Genesis: "Gen", John: "Jn", Revelation: "Apo",
  // ... mapa completo del canon en fase de refinamiento
};

type VerseBlock = {
  ref: string;          // "John.3.16"
  text: string;         // texto plano
  strongs: string[];    // strong ids en orden (por token), si el OSIS los embebe
};

/** Extrae bloques <verse ...>...</verse> del XML OSIS (aproximación regex). */
function extractVerses(xml: string): VerseBlock[] {
  const out: VerseBlock[] = [];
  const verseRe = /<verse\s+osisID="([^"]+)"\s+sID="[^"]*"\s*\/?>([\s\S]*?)<verse\s+eID="\1"\s*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = verseRe.exec(xml)) !== null) {
    const [, ref, raw] = m;
    const text = raw
      .replace(/<seg[^>]*>|<\/seg>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text) out.push({ ref, text, strongs: [] });
  }
  return out;
}

/** Convierte "John.3.16" -> { libro, capitulo, versiculo } */
function parseRef(ref: string): { libro: string; capitulo: number; versiculo: number } {
  const [book, ch, vs] = ref.split(".");
  const libro = BOOK_ID_MAP[book] ?? book;
  return { libro, capitulo: Number(ch), versiculo: Number(vs) };
}

/** Tokeniza texto plano (igual política que el seed). */
function tokenize(text: string): { text: string; isPunct: boolean }[] {
  const re = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*|[^\p{L}\p{M}\p{N}\s]+/gu;
  const out: { text: string; isPunct: boolean }[] = [];
  for (const m of text.matchAll(re)) {
    out.push({ text: m[0], isPunct: !/[\p{L}\p{M}\p{N}]/u.test(m[0]) });
  }
  return out;
}

function importModule(xmlPath: string, moduleId: string): void {
  const db = initModuleDb(moduleId);
  const verses = extractVerses(readFileSync(xmlPath, "utf8"));
  if (verses.length === 0) throw new Error("No se encontraron versículos en el OSIS");

  const insVerse = db.prepare(
    `INSERT INTO versiculos (libro_id, capitulo, versiculo, texto_plano, texto_norm) VALUES (?, ?, ?, ?, ?)`,
  );
  const insWord = db.prepare(
    `INSERT INTO palabras_interlineal (id_versiculo, posicion, texto_superficie, lema, strong_id, morph_code, alineacion_id)
     VALUES (?, ?, ?, ?, NULL, NULL, ?)`,
  );

  let words = 0;
  const tx = db.transaction(() => {
    db.exec("DELETE FROM palabras_interlineal; DELETE FROM versiculos;");
    for (const v of verses) {
      const { libro, capitulo, versiculo } = parseRef(v.ref);
      const idVersiculo = Number(insVerse.run(libro, capitulo, versiculo, v.text, normalizeText(v.text)).lastInsertRowid);
      const tokens = tokenize(v.text);
      tokens.forEach((t, ti) => {
        insWord.run(idVersiculo, ti, t.text, null, null, `${libro}${capitulo}:${versiculo}:g0`);
        words++;
      });
    }
  });
  tx();
  console.log(`${moduleId}: ${verses.length} versículos, ${words} tokens importados de ${xmlPath}`);
}

const [xmlPath, moduleId] = process.argv.slice(2);
if (!xmlPath || !moduleId) {
  console.error("Uso: node scripts/import-osis.ts <archivo.osis> <ID_MODULO>");
  process.exit(1);
}
importModule(xmlPath, moduleId);

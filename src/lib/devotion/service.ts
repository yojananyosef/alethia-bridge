import { existsSync } from "node:fs";
import { CANON, bookIdByOsisId, bookIdByOsisName, bookIdByUsfxCode } from "../canon.ts";
import { createDatabase, resolveModuleDbPath } from "../db/sqlite.ts";
import { listModules } from "../modules/registry.ts";
import type { DevotionEntry, DevotionMoment, DevotionResponse, ParsedVerseRef } from "../../types/devotion.ts";

/** Mapeo extendido para nombres de libros en inglés/español comunes en devocionales */
const DEVOTION_BOOK_MAP: Record<string, string> = {
  "genesis": "Gen",
  "exodus": "Exo",
  "leviticus": "Lev",
  "numbers": "Num",
  "deuteronomy": "Deu",
  "joshua": "Jos",
  "judges": "Jdg",
  "ruth": "Rut",
  "1 samuel": "1Sa",
  "2 samuel": "2Sa",
  "1 kings": "1Ki",
  "2 kings": "2Ki",
  "1 chronicles": "1Ch",
  "2 chronicles": "2Ch",
  "ezra": "Ezr",
  "nehemiah": "Neh",
  "esther": "Est",
  "job": "Job",
  "psalm": "Psa",
  "psalms": "Psa",
  "proverbs": "Pro",
  "ecclesiastes": "Ecc",
  "song of solomon": "Sng",
  "song of songs": "Sng",
  "canticles": "Sng",
  "cantares": "Sng",
  "isaiah": "Isa",
  "jeremiah": "Jer",
  "lamentations": "Lam",
  "ezekiel": "Ezk",
  "daniel": "Dan",
  "hosea": "Hos",
  "joel": "Joe",
  "amos": "Amo",
  "obadiah": "Oba",
  "jonah": "Jon",
  "micah": "Mic",
  "nahum": "Nah",
  "habakkuk": "Hab",
  "zephaniah": "Zep",
  "haggai": "Hag",
  "zechariah": "Zec",
  "malachi": "Mal",
  "matthew": "Mat",
  "mark": "Mrk",
  "luke": "Luk",
  "john": "Jn",
  "acts": "Act",
  "romans": "Rom",
  "1 corinthians": "1Co",
  "2 corinthians": "2Co",
  "galatians": "Gal",
  "ephesians": "Eph",
  "philippians": "Php",
  "colossians": "Col",
  "1 thessalonians": "1Th",
  "2 thessalonians": "2Th",
  "1 timothy": "1Ti",
  "2 timothy": "2Ti",
  "titus": "Tit",
  "philemon": "Phm",
  "hebrews": "Heb",
  "james": "Jas",
  "1 peter": "1Pe",
  "2 peter": "2Pe",
  "1 john": "1Jn",
  "2 john": "2Jn",
  "3 john": "3Jn",
  "jude": "Jud",
  "revelation": "Rev",
};

export function parseScriptureReference(text: string): ParsedVerseRef | null {
  if (!text) return null;

  // Busca el patrón típico al final de la cita: "— Joshua 5:12" o "— Song of Songs 1:4" o "Jn 3:16"
  const m = text.match(/(?:[—–-]\s*|\(\s*|^)?([0-9]?\s*[A-Za-zÁ-ÿ\s]+?)\s+(\d+)[:.](\d+)/i);
  if (!m) return null;

  const rawBook = m[1].trim().replace(/^[—–\-\s"']+|[—–\-\s"']+$/g, "");
  const chapter = Number.parseInt(m[2], 10);
  const verse = Number.parseInt(m[3], 10);

  if (!rawBook || Number.isNaN(chapter) || Number.isNaN(verse)) return null;

  const byOsis = bookIdByOsisId(rawBook) || bookIdByOsisName(rawBook) || bookIdByUsfxCode(rawBook);
  if (byOsis) return { book: byOsis, chapter, verse };

  const lower = rawBook.toLowerCase().replace(/[.\-_]/g, " ").replace(/\s+/g, " ").trim();
  if (DEVOTION_BOOK_MAP[lower]) {
    return { book: DEVOTION_BOOK_MAP[lower], chapter, verse };
  }

  // Canon standard check
  const b = CANON.find(
    (c) =>
      c.id.toLowerCase() === lower ||
      c.nombre.toLowerCase() === lower ||
      c.osis.toLowerCase() === lower,
  );
  if (b) return { book: b.id, chapter, verse };

  return null;
}

export function readDevotion(
  monthParam?: number | null,
  dayParam?: number | null,
  momentParam?: DevotionMoment | null,
  requestedModuleId?: string | null,
  installedFilter?: string[] | null,
): DevotionResponse {
  const t0 = performance.now();
  const now = new Date();
  const month = monthParam && monthParam >= 1 && monthParam <= 12 ? monthParam : now.getMonth() + 1;
  const day = dayParam && dayParam >= 1 && dayParam <= 31 ? dayParam : now.getDate();

  // Si no se especifica momento, por la tarde/noche (>= 17 hrs) sugiere noche, de lo contrario mañana
  const defaultMoment: DevotionMoment = now.getHours() >= 17 ? "noche" : "manana";
  const moment: DevotionMoment = momentParam || defaultMoment;

  const candidateModules = listModules(installedFilter).filter(
    (m) => m.type === "devotion" && m.status === "installed",
  );

  const availableModules = candidateModules.map((m) => ({ id: m.id, name: m.name }));

  if (candidateModules.length === 0) {
    return {
      devotion: null,
      availableMoments: [],
      availableModules: [],
      durationMs: performance.now() - t0,
    };
  }

  const activeModuleInfo =
    (requestedModuleId && candidateModules.find((m) => m.id === requestedModuleId)) ||
    candidateModules.find((m) => m.id === "SPURGEON-ME") ||
    candidateModules[0];

  const dbPath = resolveModuleDbPath(activeModuleInfo.id);
  if (!existsSync(dbPath)) {
    return {
      devotion: null,
      availableMoments: [],
      availableModules,
      durationMs: performance.now() - t0,
    };
  }

  const db = createDatabase(dbPath, { readonly: true });
  try {
    // Verificar momentos disponibles para este día
    const momentRows = db
      .prepare(`SELECT DISTINCT momento FROM devocionales WHERE mes = ? AND dia = ?`)
      .all(month, day) as Array<{ momento: string }>;

    const availableMoments = momentRows.map((r) => r.momento as DevotionMoment);

    // Búsqueda con tolerancia a sinónimos ("manana" vs "dia")
    const momentAliases =
      moment === "manana" ? ["manana", "dia", "morning"] : moment === "dia" ? ["dia", "manana", "morning"] : ["noche", "evening"];

    let row: any = null;
    for (const mAlias of momentAliases) {
      row = db
        .prepare(
          `SELECT id_devocional, mes, dia, momento, titulo, pasaje_clave, texto, oracion
           FROM devocionales WHERE mes = ? AND dia = ? AND momento = ? LIMIT 1`,
        )
        .get(month, day, mAlias);
      if (row) break;
    }

    // Fallback: si no encuentra el momento exacto, toma el primer registro del día
    if (!row) {
      row = db
        .prepare(
          `SELECT id_devocional, mes, dia, momento, titulo, pasaje_clave, texto, oracion
           FROM devocionales WHERE mes = ? AND dia = ? LIMIT 1`,
        )
        .get(month, day);
    }

    if (!row) {
      return {
        devotion: null,
        availableMoments,
        availableModules,
        durationMs: performance.now() - t0,
      };
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

    return {
      devotion,
      availableMoments,
      availableModules,
      durationMs: performance.now() - t0,
    };
  } finally {
    db.close();
  }
}

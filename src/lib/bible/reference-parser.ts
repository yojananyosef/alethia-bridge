import { CANON, bookIdByOsisId, bookIdByOsisName, bookIdByUsfxCode } from "../canon.ts";

export interface ParsedVerseRef {
  book: string;
  chapter: number;
  verse: number;
}

/** Mapeo extendido para nombres de libros en inglés/español comunes en devocionales y diccionarios */
const BIBLE_BOOK_NAME_MAP: Record<string, string> = {
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

/**
 * Parser universal de citas bíblicas (cliente y servidor).
 * Acepta formatos como:
 * - "Joshua 5:12" o "— Song of Songs 1:4" o "Jn 3:16"
 * - "1 Corintios 13:4" o "Salmos 23:1"
 */
export function parseScriptureReference(text: string): ParsedVerseRef | null {
  if (!text) return null;

  const m = text.match(/(?:[—–-]\s*|\(\s*|^)?([0-9]?\s*[A-Za-zÁ-ÿ\s]+?)\s+(\d+)[:.](\d+)/i);
  if (!m) return null;

  const rawBook = m[1].trim().replace(/^[—–\-\s"']+|[—–\-\s"']+$/g, "");
  const chapter = Number.parseInt(m[2], 10);
  const verse = Number.parseInt(m[3], 10);

  if (!rawBook || Number.isNaN(chapter) || Number.isNaN(verse)) return null;

  const byOsis = bookIdByOsisId(rawBook) || bookIdByOsisName(rawBook) || bookIdByUsfxCode(rawBook);
  if (byOsis) return { book: byOsis, chapter, verse };

  const lower = rawBook.toLowerCase().replace(/[.\-_]/g, " ").replace(/\s+/g, " ").trim();
  if (BIBLE_BOOK_NAME_MAP[lower]) {
    return { book: BIBLE_BOOK_NAME_MAP[lower], chapter, verse };
  }

  const b = CANON.find(
    (c) =>
      c.id.toLowerCase() === lower ||
      c.nombre.toLowerCase() === lower ||
      c.osis.toLowerCase() === lower,
  );
  if (b) return { book: b.id, chapter, verse };

  return null;
}

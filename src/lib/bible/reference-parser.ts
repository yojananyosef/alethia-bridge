import { CANON, bookIdByOsisId, bookIdByOsisName, bookIdByUsfxCode } from "../canon.ts";

export interface ParsedVerseRef {
  book: string;
  chapter: number;
  verse: number;
}

/** Mapeo extendido para nombres de libros en inglés/español y abreviaturas exegéticas (Abbott-Smith, STEPBible, OSIS) */
const BIBLE_BOOK_NAME_MAP: Record<string, string> = {
  // Español / Inglés completos
  "genesis": "Gen",
  "exodus": "Exo",
  "exodo": "Exo",
  "éxodo": "Exo",
  "leviticus": "Lev",
  "levitico": "Lev",
  "levítico": "Lev",
  "numbers": "Num",
  "numeros": "Num",
  "números": "Num",
  "deuteronomy": "Deu",
  "deuteronomio": "Deu",
  "joshua": "Jos",
  "josue": "Jos",
  "josué": "Jos",
  "judges": "Jdg",
  "jueces": "Jdg",
  "ruth": "Rut",
  "rut": "Rut",
  "1 samuel": "1Sa",
  "2 samuel": "2Sa",
  "1 kings": "1Ki",
  "2 kings": "2Ki",
  "1 reyes": "1Ki",
  "2 reyes": "2Ki",
  "1 chronicles": "1Ch",
  "2 chronicles": "2Ch",
  "1 cronicas": "1Ch",
  "2 cronicas": "2Ch",
  "1 crónicas": "1Ch",
  "2 crónicas": "2Ch",
  "ezra": "Ezr",
  "esdras": "Ezr",
  "nehemiah": "Neh",
  "nehemias": "Neh",
  "nehemías": "Neh",
  "esther": "Est",
  "ester": "Est",
  "job": "Job",
  "psalm": "Psa",
  "psalms": "Psa",
  "salmo": "Psa",
  "salmos": "Psa",
  "proverbs": "Pro",
  "proverbios": "Pro",
  "ecclesiastes": "Ecc",
  "eclesiastes": "Ecc",
  "eclesiastés": "Ecc",
  "song of solomon": "Sng",
  "song of songs": "Sng",
  "canticles": "Sng",
  "cantares": "Sng",
  "isaiah": "Isa",
  "isaias": "Isa",
  "isaías": "Isa",
  "jeremiah": "Jer",
  "jeremias": "Jer",
  "jeremías": "Jer",
  "lamentations": "Lam",
  "lamentaciones": "Lam",
  "ezekiel": "Ezk",
  "ezequiel": "Ezk",
  "daniel": "Dan",
  "hosea": "Hos",
  "oseas": "Hos",
  "joel": "Joe",
  "amos": "Amo",
  "amós": "Amo",
  "obadiah": "Oba",
  "abdias": "Oba",
  "abdías": "Oba",
  "jonah": "Jon",
  "jonas": "Jon",
  "jonás": "Jon",
  "micah": "Mic",
  "miqueas": "Mic",
  "nahum": "Nah",
  "nahúm": "Nah",
  "habakkuk": "Hab",
  "habacuc": "Hab",
  "zephaniah": "Zep",
  "sofonias": "Zep",
  "sofonías": "Zep",
  "haggai": "Hag",
  "hageo": "Hag",
  "zechariah": "Zec",
  "zacarias": "Zec",
  "zacarías": "Zec",
  "malachi": "Mal",
  "malaquias": "Mal",
  "malaquías": "Mal",
  "matthew": "Mat",
  "mateo": "Mat",
  "mark": "Mrk",
  "marcos": "Mrk",
  "luke": "Luk",
  "lucas": "Luk",
  "john": "Jn",
  "juan": "Jn",
  "acts": "Act",
  "hechos": "Act",
  "romans": "Rom",
  "romanos": "Rom",
  "1 corinthians": "1Co",
  "2 corinthians": "2Co",
  "1 corintios": "1Co",
  "2 corintios": "2Co",
  "galatians": "Gal",
  "galatas": "Gal",
  "gálatas": "Gal",
  "ephesians": "Eph",
  "efesios": "Eph",
  "philippians": "Php",
  "filipenses": "Php",
  "colossians": "Col",
  "colosenses": "Col",
  "1 thessalonians": "1Th",
  "2 thessalonians": "2Th",
  "1 tesalonicenses": "1Th",
  "2 tesalonicenses": "2Th",
  "1 timothy": "1Ti",
  "2 timothy": "2Ti",
  "1 timoteo": "1Ti",
  "2 timoteo": "2Ti",
  "titus": "Tit",
  "tito": "Tit",
  "philemon": "Phm",
  "filemon": "Phm",
  "filemón": "Phm",
  "hebrews": "Heb",
  "hebreos": "Heb",
  "james": "Jas",
  "santiago": "Jas",
  "1 peter": "1Pe",
  "2 peter": "2Pe",
  "1 pedro": "1Pe",
  "2 pedro": "2Pe",
  "1 john": "1Jn",
  "2 john": "2Jn",
  "3 john": "3Jn",
  "1 juan": "1Jn",
  "2 juan": "2Jn",
  "3 juan": "3Jn",
  "jude": "Jud",
  "judas": "Jud",
  "revelation": "Rev",
  "apocalipsis": "Rev",

  // Abreviaturas comunes en léxicos (Abbott-Smith, Thayer, BDB, STEPBible)
  "gen": "Gen", "exo": "Exo", "exod": "Exo", "lev": "Lev", "num": "Num",
  "deu": "Deu", "deut": "Deu", "jos": "Jos", "josh": "Jos", "jdg": "Jdg", "judg": "Jdg",
  "rut": "Rut", "ruth": "Rut", "1sa": "1Sa", "1sam": "1Sa", "2sa": "2Sa", "2sam": "2Sa",
  "1ki": "1Ki", "1kgs": "1Ki", "2ki": "2Ki", "2kgs": "2Ki", "1ch": "1Ch", "1chr": "1Ch",
  "2ch": "2Ch", "2chr": "2Ch", "ezr": "Ezr", "ezra": "Ezr", "neh": "Neh", "est": "Est", "esth": "Est",
  "job": "Job", "psa": "Psa", "ps": "Psa", "pro": "Pro", "prov": "Pro", "ecc": "Ecc", "eccl": "Ecc",
  "sng": "Sng", "song": "Sng", "cant": "Sng", "isa": "Isa", "jer": "Jer", "lam": "Lam",
  "ezk": "Ezk", "ezek": "Ezk", "dan": "Dan", "hos": "Hos", "joe": "Joe", "joel": "Joe",
  "amo": "Amo", "amos": "Amo", "oba": "Oba", "obad": "Oba", "jon": "Jon", "jonah": "Jon",
  "mic": "Mic", "nah": "Nah", "hab": "Hab", "zep": "Zep", "zeph": "Zep", "hag": "Hag",
  "zec": "Zec", "zech": "Zec", "mal": "Mal",

  "mat": "Mat", "matt": "Mat", "mt": "Mat",
  "mrk": "Mrk", "mark": "Mrk", "mk": "Mrk",
  "luk": "Luk", "luke": "Luk", "lk": "Luk",
  "jhn": "Jn", "john": "Jn", "jn": "Jn",
  "act": "Act", "acts": "Act", "ac": "Act",
  "rom": "Rom", "ro": "Rom",
  "1co": "1Co", "1cor": "1Co", "ico": "1Co", "i cor": "1Co", "1 co": "1Co",
  "2co": "2Co", "2cor": "2Co", "iico": "2Co", "ii cor": "2Co", "2 co": "2Co",
  "gal": "Gal", "ga": "Gal",
  "eph": "Eph",
  "php": "Php", "phil": "Php",
  "col": "Col",
  "1th": "1Th", "1thess": "1Th", "ith": "1Th", "1 th": "1Th",
  "2th": "2Th", "2thess": "2Th", "iith": "2Th", "2 th": "2Th",
  "1ti": "1Ti", "1tim": "1Ti", "iti": "1Ti", "1 ti": "1Ti",
  "2ti": "2Ti", "2tim": "2Ti", "iiti": "2Ti", "2 ti": "2Ti",
  "tit": "Tit", "titus": "Tit",
  "phm": "Phm", "phlm": "Phm", "philem": "Phm",
  "heb": "Heb", "hebrews": "Heb",
  "jas": "Jas", "james": "Jas",
  "1pe": "1Pe", "1pet": "1Pe", "ipe": "1Pe", "1 pe": "1Pe",
  "2pe": "2Pe", "2pet": "2Pe", "iipe": "2Pe", "2 pe": "2Pe",
  "1jn": "1Jn", "1john": "1Jn", "ijhn": "1Jn", "ijn": "1Jn", "1 jn": "1Jn", "i jhn": "1Jn",
  "2jn": "2Jn", "2john": "2Jn", "iijhn": "2Jn", "iijn": "2Jn", "2 jn": "2Jn", "ii jhn": "2Jn",
  "3jn": "3Jn", "3john": "3Jn", "iiijhn": "3Jn", "iiijn": "3Jn", "3 jn": "3Jn", "iii jhn": "3Jn",
  "jud": "Jud", "jude": "Jud",
  "rev": "Rev", "revelation": "Rev", "apoc": "Rev",
};

/** Normaliza un identificador o nombre de libro hacia el ID canónico de Alethia. */
export function normalizeBookId(rawBook: string): string | null {
  if (!rawBook) return null;
  const clean = rawBook.trim().replace(/[.\-_]/g, "").toLowerCase();

  const byOsis = bookIdByOsisId(rawBook) || bookIdByOsisName(rawBook) || bookIdByUsfxCode(rawBook);
  if (byOsis) return byOsis;

  if (BIBLE_BOOK_NAME_MAP[clean]) {
    return BIBLE_BOOK_NAME_MAP[clean];
  }

  // Desglosar numerales pegados como "1juan" -> "1 juan", "2corintios" -> "2 corintios"
  const separatedDigit = clean.replace(/^([1-3])([a-z])/i, "$1 $2");
  if (BIBLE_BOOK_NAME_MAP[separatedDigit]) {
    return BIBLE_BOOK_NAME_MAP[separatedDigit];
  }

  // Desglosar números romanos pegados como "iiijhn" -> "3jn", "iico" -> "2co"
  const romanMap: Record<string, string> = { "iii": "3 ", "ii": "2 ", "i": "1 " };
  const romanSeparated = clean.replace(/^(iii|ii|i)([a-z]+)/i, (_, rom, rest) => `${romanMap[rom.toLowerCase()] || ""}${rest}`);
  if (BIBLE_BOOK_NAME_MAP[romanSeparated]) {
    return BIBLE_BOOK_NAME_MAP[romanSeparated];
  }

  const cleanWithSpaces = rawBook.toLowerCase().replace(/[.\-_]/g, " ").replace(/\s+/g, " ").trim();
  if (BIBLE_BOOK_NAME_MAP[cleanWithSpaces]) {
    return BIBLE_BOOK_NAME_MAP[cleanWithSpaces];
  }

  const b = CANON.find(
    (c) =>
      c.id.toLowerCase() === clean ||
      c.nombre.toLowerCase() === cleanWithSpaces ||
      c.osis.toLowerCase() === clean,
  );
  return b?.id ?? null;
}

/**
 * Parser universal de citas bíblicas (cliente y servidor).
 * Acepta formatos como:
 * - "Joshua 5:12" o "— Song of Songs 1:4" o "Jn 3:16"
 * - "1 Corintios 13:4" o "Salmos 23:1"
 */
export function parseScriptureReference(text: string): ParsedVerseRef | null {
  if (!text) return null;

  const m = text.match(/(?:[—–-]\s*|\(\s*|^)?([0-9I|II|III]?\s*[A-Za-zÁ-ÿ\s]+?)[.\s:]+(\d+)[:.](\d+)/i);
  if (!m) return null;

  const rawBook = m[1].trim().replace(/^[—–\-\s"']+|[—–\-\s"']+$/g, "");
  const chapter = Number.parseInt(m[2], 10);
  const verse = Number.parseInt(m[3], 10);

  if (!rawBook || Number.isNaN(chapter) || Number.isNaN(verse)) return null;

  const bookId = normalizeBookId(rawBook);
  if (bookId) {
    return { book: bookId, chapter, verse };
  }

  return null;
}

/**
 * Parser especializado para atributos de referencias de léxicos (Abbott-Smith / STEPBible / OSIS).
 * Maneja cadenas como:
 * - "Mat.2.18; 16.1" -> [{ book: "Mat", chapter: 2, verse: 18 }, { book: "Mat", chapter: 16, verse: 1 }]
 * - "Mrk.2.15" -> [{ book: "Mrk", chapter: 2, verse: 15 }]
 * - "IIIJhn.10" -> [{ book: "3Jn", chapter: 1, verse: 10 }]
 * - "Rom.7.12; 9.4" -> [{ book: "Rom", chapter: 7, verse: 12 }, { book: "Rom", chapter: 9, verse: 4 }]
 * - "1Co.14.9, 19" -> [{ book: "1Co", chapter: 14, verse: 9 }]
 */
export function parseLexiconRef(refStr: string): ParsedVerseRef[] {
  if (!refStr) return [];
  const cleanStr = refStr.replace(/^ref=['"]|['"]$/g, "").trim();
  const parts = cleanStr.split(/;\s*/);
  const results: ParsedVerseRef[] = [];

  let lastBook = "Mat";
  let lastChapter = 1;

  for (const part of parts) {
    if (!part.trim()) continue;

    // Probar: "Book.Chapter.Verse" o "Book Chapter:Verse" o "Book.Chapter:Verse"
    const fullMatch = part.match(/^([1-3I|II|III]*\s*[A-Za-z]+)[.\s:]+(\d+)[.:](\d+)/i);
    if (fullMatch) {
      const b = normalizeBookId(fullMatch[1]);
      if (b) lastBook = b;
      lastChapter = Number.parseInt(fullMatch[2], 10) || 1;
      const verse = Number.parseInt(fullMatch[3], 10) || 1;
      results.push({ book: lastBook, chapter: lastChapter, verse });
      continue;
    }

    // Probar: "Chapter.Verse" (hereda el libro anterior)
    const chVerseMatch = part.match(/^(\d+)[.:](\d+)/);
    if (chVerseMatch) {
      lastChapter = Number.parseInt(chVerseMatch[1], 10) || 1;
      const verse = Number.parseInt(chVerseMatch[2], 10) || 1;
      results.push({ book: lastBook, chapter: lastChapter, verse });
      continue;
    }

    // Probar: "Book.Verse" para libros de 1 capítulo ("IIIJhn.10", "Jud.4", "Phm.12", "Oba.3", "2Jn.5", "3Jn.8")
    const oneChMatch = part.match(/^([1-3I|II|III]*\s*[A-Za-z]+)[.\s:]+(\d+)/i);
    if (oneChMatch) {
      const b = normalizeBookId(oneChMatch[1]);
      if (b) {
        lastBook = b;
        const num = Number.parseInt(oneChMatch[2], 10) || 1;
        if (["Oba", "Phm", "2Jn", "3Jn", "Jud"].includes(lastBook)) {
          results.push({ book: lastBook, chapter: 1, verse: num });
        } else {
          lastChapter = num;
          results.push({ book: lastBook, chapter: lastChapter, verse: 1 });
        }
        continue;
      }
    }
  }

  return results;
}

/** Canon bíblico compartido entre ETL y seeds.
 *
 * Cada libro tiene tres identificadores:
 *  - `id`:   abreviatura interna usada en las tablas (libros.id, versiculos.libro_id)
 *  - `code`: código USFX/USFM (GEN, JHN, 1CH…) — usado por importadores USFX
 *  - `osis`: nombre OSIS completo (Genesis, John, 1John…) — usado por importadores OSIS
 */

export interface CanonBook {
  id: string;
  code: string;
  osis: string;
  nombre: string;
  capitulos: number;
}

export const CANON: CanonBook[] = [
  { id: "Gen", code: "GEN", osis: "Genesis", nombre: "Génesis", capitulos: 50 },
  { id: "Exo", code: "EXO", osis: "Exodus", nombre: "Éxodo", capitulos: 40 },
  { id: "Lev", code: "LEV", osis: "Leviticus", nombre: "Levítico", capitulos: 27 },
  { id: "Num", code: "NUM", osis: "Numbers", nombre: "Números", capitulos: 36 },
  { id: "Deu", code: "DEU", osis: "Deuteronomy", nombre: "Deuteronomio", capitulos: 34 },
  { id: "Jos", code: "JOS", osis: "Joshua", nombre: "Josué", capitulos: 24 },
  { id: "Jdg", code: "JDG", osis: "Judges", nombre: "Jueces", capitulos: 21 },
  { id: "Rut", code: "RUT", osis: "Ruth", nombre: "Rut", capitulos: 4 },
  { id: "1Sa", code: "1SA", osis: "1Samuel", nombre: "1 Samuel", capitulos: 31 },
  { id: "2Sa", code: "2SA", osis: "2Samuel", nombre: "2 Samuel", capitulos: 24 },
  { id: "1Ki", code: "1KI", osis: "1Kings", nombre: "1 Reyes", capitulos: 22 },
  { id: "2Ki", code: "2KI", osis: "2Kings", nombre: "2 Reyes", capitulos: 25 },
  { id: "1Ch", code: "1CH", osis: "1Chronicles", nombre: "1 Crónicas", capitulos: 29 },
  { id: "2Ch", code: "2CH", osis: "2Chronicles", nombre: "2 Crónicas", capitulos: 36 },
  { id: "Ezr", code: "EZR", osis: "Ezra", nombre: "Esdras", capitulos: 10 },
  { id: "Neh", code: "NEH", osis: "Nehemiah", nombre: "Nehemías", capitulos: 13 },
  { id: "Est", code: "EST", osis: "Esther", nombre: "Ester", capitulos: 10 },
  { id: "Job", code: "JOB", osis: "Job", nombre: "Job", capitulos: 42 },
  { id: "Psa", code: "PSA", osis: "Psalms", nombre: "Salmos", capitulos: 150 },
  { id: "Pro", code: "PRO", osis: "Proverbs", nombre: "Proverbios", capitulos: 31 },
  { id: "Ecc", code: "ECC", osis: "Ecclesiastes", nombre: "Eclesiastés", capitulos: 12 },
  { id: "Sng", code: "SNG", osis: "SongOfSongs", nombre: "Cantares", capitulos: 8 },
  { id: "Isa", code: "ISA", osis: "Isaiah", nombre: "Isaías", capitulos: 66 },
  { id: "Jer", code: "JER", osis: "Jeremiah", nombre: "Jeremías", capitulos: 52 },
  { id: "Lam", code: "LAM", osis: "Lamentations", nombre: "Lamentaciones", capitulos: 5 },
  { id: "Ezk", code: "EZK", osis: "Ezekiel", nombre: "Ezequiel", capitulos: 48 },
  { id: "Dan", code: "DAN", osis: "Daniel", nombre: "Daniel", capitulos: 12 },
  { id: "Hos", code: "HOS", osis: "Hosea", nombre: "Oseas", capitulos: 14 },
  { id: "Joe", code: "JOL", osis: "Joel", nombre: "Joel", capitulos: 3 },
  { id: "Amo", code: "AMO", osis: "Amos", nombre: "Amós", capitulos: 9 },
  { id: "Oba", code: "OBA", osis: "Obadiah", nombre: "Abdías", capitulos: 1 },
  { id: "Jon", code: "JON", osis: "Jonah", nombre: "Jonás", capitulos: 4 },
  { id: "Mic", code: "MIC", osis: "Micah", nombre: "Miqueas", capitulos: 7 },
  { id: "Nah", code: "NAM", osis: "Nahum", nombre: "Nahúm", capitulos: 3 },
  { id: "Hab", code: "HAB", osis: "Habakkuk", nombre: "Habacuc", capitulos: 3 },
  { id: "Zep", code: "ZEP", osis: "Zephaniah", nombre: "Sofonías", capitulos: 3 },
  { id: "Hag", code: "HAG", osis: "Haggai", nombre: "Hageo", capitulos: 2 },
  { id: "Zec", code: "ZEC", osis: "Zechariah", nombre: "Zacarías", capitulos: 14 },
  { id: "Mal", code: "MAL", osis: "Malachi", nombre: "Malaquías", capitulos: 4 },
  { id: "Mat", code: "MAT", osis: "Matthew", nombre: "Mateo", capitulos: 28 },
  { id: "Mrk", code: "MRK", osis: "Mark", nombre: "Marcos", capitulos: 16 },
  { id: "Luk", code: "LUK", osis: "Luke", nombre: "Lucas", capitulos: 24 },
  { id: "Jn", code: "JHN", osis: "John", nombre: "Juan", capitulos: 21 },
  { id: "Act", code: "ACT", osis: "Acts", nombre: "Hechos", capitulos: 28 },
  { id: "Rom", code: "ROM", osis: "Romans", nombre: "Romanos", capitulos: 16 },
  { id: "1Co", code: "1CO", osis: "1Corinthians", nombre: "1 Corintios", capitulos: 16 },
  { id: "2Co", code: "2CO", osis: "2Corinthians", nombre: "2 Corintios", capitulos: 13 },
  { id: "Gal", code: "GAL", osis: "Galatians", nombre: "Gálatas", capitulos: 6 },
  { id: "Eph", code: "EPH", osis: "Ephesians", nombre: "Efesios", capitulos: 6 },
  { id: "Php", code: "PHP", osis: "Philippians", nombre: "Filipenses", capitulos: 4 },
  { id: "Col", code: "COL", osis: "Colossians", nombre: "Colosenses", capitulos: 4 },
  { id: "1Th", code: "1TH", osis: "1Thessalonians", nombre: "1 Tesalonicenses", capitulos: 5 },
  { id: "2Th", code: "2TH", osis: "2Thessalonians", nombre: "2 Tesalonicenses", capitulos: 3 },
  { id: "1Ti", code: "1TI", osis: "1Timothy", nombre: "1 Timoteo", capitulos: 6 },
  { id: "2Ti", code: "2TI", osis: "2Timothy", nombre: "2 Timoteo", capitulos: 4 },
  { id: "Tit", code: "TIT", osis: "Titus", nombre: "Tito", capitulos: 3 },
  { id: "Phm", code: "PHM", osis: "Philemon", nombre: "Filemón", capitulos: 1 },
  { id: "Heb", code: "HEB", osis: "Hebrews", nombre: "Hebreos", capitulos: 13 },
  { id: "Jas", code: "JAS", osis: "James", nombre: "Santiago", capitulos: 5 },
  { id: "1Pe", code: "1PE", osis: "1Peter", nombre: "1 Pedro", capitulos: 5 },
  { id: "2Pe", code: "2PE", osis: "2Peter", nombre: "2 Pedro", capitulos: 3 },
  { id: "1Jn", code: "1JN", osis: "1John", nombre: "1 Juan", capitulos: 5 },
  { id: "2Jn", code: "2JN", osis: "2John", nombre: "2 Juan", capitulos: 1 },
  { id: "3Jn", code: "3JN", osis: "3John", nombre: "3 Juan", capitulos: 1 },
  { id: "Jud", code: "JUD", osis: "Jude", nombre: "Judas", capitulos: 1 },
  { id: "Rev", code: "REV", osis: "Revelation", nombre: "Apocalipsis", capitulos: 22 },
];

/** Vista simplificada para writeBooks (id, nombre, capitulos). */
export const BOOKLIST = CANON.map(({ id, nombre, capitulos }) => ({ id, nombre, capitulos }));

/** Abreviaturas del formato simple-xml de simoncozens/open-source-bible-data (SBLGNT). */
const bySbl = new Map<string, string>([
  ["Matt", "Mat"], ["Mark", "Mrk"], ["Luke", "Luk"], ["John", "Jn"], ["Acts", "Act"],
  ["Rom", "Rom"], ["1Cor", "1Co"], ["2Cor", "2Co"], ["Gal", "Gal"], ["Eph", "Eph"],
  ["Phil", "Php"], ["Col", "Col"], ["1Thess", "1Th"], ["2Thess", "2Th"], ["1Tim", "1Ti"],
  ["2Tim", "2Ti"], ["Titus", "Tit"], ["Phlm", "Phm"], ["Heb", "Heb"], ["Jas", "Jas"],
  ["1Pet", "1Pe"], ["2Pet", "2Pe"], ["1John", "1Jn"], ["2John", "2Jn"], ["3John", "3Jn"],
  ["Jude", "Jud"], ["Rev", "Rev"],
]);

const byUsfx = new Map(CANON.map((b) => [b.code.toUpperCase(), b.id]));
const byOsis = new Map(CANON.map((b) => [b.osis.toLowerCase(), b.id]));

/** Resuelve el id interno desde el código USFX/USFM ("GEN" | "gen" → "Gen"). */
export function bookIdByUsfxCode(code: string): string | undefined {
  return byUsfx.get(code.trim().toUpperCase());
}

/** Resuelve el id interno desde el nombre OSIS ("Genesis", "1 John", "SongOfSongs"). */
export function bookIdByOsisName(name: string): string | undefined {
  const norm = name.trim().toLowerCase().replace(/\s+/g, "");
  return byOsis.get(norm) ?? byOsis.get(name.trim().toLowerCase());
}

/** Resuelve el id interno desde las abreviaturas simple-xml ("Matt", "1Cor", "Phlm"). */
export function bookIdBySblCode(code: string): string | undefined {
  return bySbl.get(code.trim());
}

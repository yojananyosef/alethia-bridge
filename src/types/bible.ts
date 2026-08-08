/** ID de módulo biblia: dinámico, descubierto desde data/modules (registry), p. ej. RV1909, SBLGNT, WLC, NBV. */
export type BibleModuleId = string;

export type BibleLanguage = "es" | "el" | "he";

export type ThemeId = "academic-paper" | "dark-contrast" | "sepia";

/** Layout del lector: interleaved (interlineal) o columns (biblia paralela). */
export type ReaderLayout = "interleaved" | "columns";

export interface WordToken {
  id: number;
  position: number;
  text: string;
  lemma: string | null;
  strongId: string | null;
  morphCode: string | null;
  alignmentId: string;
}

export interface VersePayload {
  reference: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  tokens: WordToken[];
}

export interface InterlinearModule {
  moduleId: BibleModuleId;
  language: BibleLanguage;
  verses: VersePayload[];
}

export interface ReadResponse {
  modules: InterlinearModule[];
  alignmentGroups: string[];
  durationMs: number;
}

/** Nota de un comentario (p. ej. Torres Amat) para un versículo. */
export interface CommentaryNote {
  verse: number;
  text: string;
}

/** Comentario de un módulo para un capítulo: notas por versículo. */
export interface CommentaryModule {
  moduleId: BibleModuleId;
  name: string;
  notes: CommentaryNote[];
}

export interface CommentaryResponse {
  commentary: CommentaryModule[];
  durationMs: number;
}

export interface CrossReference {
  id: number;
  sourceBook: string;
  sourceChapter: number;
  sourceVerse: number;
  targetBook: string;
  targetChapter: number;
  targetVerseStart: number;
  targetVerseEnd: number | null;
  targetReference: string;
  votes: number;
  note: string | null;
}

export interface CrossRefModule {
  moduleId: BibleModuleId;
  name: string;
  references: CrossReference[];
}

export interface CrossRefResponse {
  crossref: CrossRefModule[];
  durationMs: number;
}

export interface DevotionalEntry {
  id: number;
  month: number;
  day: number;
  moment: string;
  title: string;
  keyPassage: string;
  text: string;
  prayer: string | null;
}

export interface MorphologyAnalysis {
  code: string;
  description: string;
  category: string;
}

export interface LexiconEntry {
  strongId: string;
  lemma: string;
  transliteration: string;
  pronunciation: string | null;
  shortDefinition: string;
  detailedDefinition: string | null;
  semanticDomain: string | null;
  /** Glosa de traducción derivada del módulo RV1909 (formas más frecuentes). */
  glosa: string | null;
  language: "HEBREW" | "GREEK";
}

/** Nombre propio (TIPNR de STEPBible, CC BY 4.0). */
export interface ProperName {
  nombre: string;
  tipo: string;
  categoria: "persona" | "lugar" | "otro";
  descripcion: string | null;
  padres: string | null;
  hermanos: string | null;
  conyuges: string | null;
  hijos: string | null;
  tribu: string | null;
  referencias: string | null;
  formas: string | null;
  /** Libros (id interno) donde aparece el nombre. */
  libros: string[];
  geoLat: number | null;
  geoLng: number | null;
  openbible: string | null;
}

export interface SearchResult {
  moduleId: BibleModuleId;
  book: string;
  chapter: number;
  verse: number;
  reference: string;
  snippet: string;
  score: number;
  strongIds: string[];
}

export interface SearchResponse {
  query: string;
  moduleIds: BibleModuleId[];
  total: number;
  results: SearchResult[];
  durationMs: number;
}

export interface OmnibarCommand {
  id: string;
  label: string;
  keywords: string[];
  group: "navigation" | "modules" | "search" | "theme";
  action: () => void;
}

export type ReaderFontSize = "sm" | "base" | "lg" | "xl";

export interface SyncGroupReference {
  book: string;
  chapter: number;
  verse: number;
}


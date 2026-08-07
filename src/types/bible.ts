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

export interface SyncGroupReference {
  book: string;
  chapter: number;
  verse: number;
}

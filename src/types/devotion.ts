export type DevotionMoment = "manana" | "noche" | "dia";

export interface ParsedVerseRef {
  book: string;
  chapter: number;
  verse: number;
}

export interface DevotionEntry {
  id: number;
  moduleId: string;
  moduleName: string;
  month: number;
  day: number;
  moment: DevotionMoment;
  title: string;
  keyVerse: string;
  text: string;
  prayer?: string | null;
  parsedReference?: ParsedVerseRef | null;
}

export interface DevotionResponse {
  devotion: DevotionEntry | null;
  availableMoments: DevotionMoment[];
  availableModules: Array<{ id: string; name: string }>;
  durationMs: number;
}

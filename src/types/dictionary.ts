export interface DictionaryEntry {
  id: number;
  moduleId: string;
  moduleName: string;
  term: string;
  slug: string;
  definition: string;
  references?: string | null;
  source?: string | null;
}

export interface DictionarySearchResult {
  id: number;
  term: string;
  slug: string;
  snippet: string;
  source?: string | null;
}

export interface DictionarySearchResponse {
  query: string;
  total: number;
  results: DictionarySearchResult[];
  entry?: DictionaryEntry | null;
  availableDictionaries: Array<{ id: string; name: string }>;
  durationMs: number;
}

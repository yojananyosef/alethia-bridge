/** Tipos del sistema de módulos instalables (formato .abmod). */

export type ModuleType = "bible" | "lexicon" | "commentary" | "crossref" | "devotion" | "dictionary";

export type ModuleLanguage = "es" | "el" | "he" | "en" | "de" | "la" | "grc" | "fr" | "pt" | "it";

/** Versión de esquema que la app entiende; los módulos más nuevos se rechazan con mensaje claro. */
export const APP_SCHEMA_VERSION = 1;

export interface ModuleManifest {
  /** ID único del módulo (nombre de archivo: <id>.db). */
  id: string;
  name: string;
  type: ModuleType;
  language: ModuleLanguage;
  /** Semver: "0.1.0". */
  version: string;
  publisher: string;
  license: string;
  year: number;
  description: string;
  schemaVersion: number;
  /** IDs de módulos requeridos (p. ej. un texto con Strong depende del léxico). */
  dependencies?: string[];
  /** Esquema de tagging: "strong" | "morphhb". */
  strongScheme?: "strong" | "morphhb";
  /** Orden canónico de libros (abreviaturas OSIS); solo módulos bible. */
  bookOrder?: string[];
}

export interface ModuleBook {
  id: string;
  nombre: string;
  capitulos: number;
  orden: number;
}

export type ModuleStatus = "installed" | "disabled";

export interface ModuleInfo extends ModuleManifest {
  status: ModuleStatus;
  fileSize: number;
  /** Nº de libros en la tabla canónica (0 si el módulo no define canon). */
  bookCount: number;
  /** Canon completo (solo se incluye para módulos bible). */
  books?: ModuleBook[];
}

export interface ModuleListResponse {
  modules: ModuleInfo[];
  durationMs: number;
}

export interface InstallModuleResult {
  ok: boolean;
  moduleId?: string;
  error?: string;
}

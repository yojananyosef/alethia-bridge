import type { ModuleLanguage, ModuleStatus, ModuleType } from "./module.ts";

export interface RemoteModuleEntry {
  id: string;
  name: string;
  type: ModuleType;
  language: ModuleLanguage;
  version: string;
  publisher: string;
  license: string;
  year: number;
  description: string;
  sizeBytes: number;
  sha256?: string;
  downloadUrl: string;
  dependencies?: string[];
  hasStrongs?: boolean;
  hasMorphology?: boolean;
  features?: string[];
}

export interface RemoteCatalog {
  schemaVersion: number;
  generatedAt: string;
  catalogSource?: string;
  modules: RemoteModuleEntry[];
}

export type CatalogModuleInstallStatus = "not_installed" | "installed" | "update_available";

export interface CatalogItem extends RemoteModuleEntry {
  installStatus: CatalogModuleInstallStatus;
  installedVersion?: string;
  localStatus?: ModuleStatus;
  localSizeBytes?: number;
  missingDependencies?: string[];
  isLocalOnly?: boolean;
}

export interface CatalogResponse {
  schemaVersion: number;
  generatedAt: string;
  catalogSource: string;
  modules: CatalogItem[];
  installedCount: number;
  availableCount: number;
  updatesCount: number;
  durationMs: number;
}

export interface InstallRemoteRequest {
  moduleId: string;
  downloadUrl?: string;
  sha256?: string;
  force?: boolean;
}

export interface InstallRemoteResponse {
  ok: boolean;
  moduleId: string;
  version: string;
  installedDependencies: string[];
  message: string;
  durationMs: number;
  error?: string;
}

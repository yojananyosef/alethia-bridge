"use client";

import Dexie, { type Table } from "dexie";
import { strFromU8, unzipSync } from "fflate";
import type { ModuleBook, ModuleInfo, ModuleManifest } from "../../types/module";
import type {
  CatalogItem,
  CatalogResponse,
  InstallRemoteResponse,
  RemoteCatalog,
} from "../../types/catalog";
import { ClientDatabase } from "../db/client-sqlite";

interface InstalledModuleRecord {
  id: string;
  manifest: ModuleManifest;
  dbBytes: Blob;
  installedAt: number;
  disabled: boolean;
  books?: ModuleBook[];
}

class ClientModuleDatabase extends Dexie {
  modules!: Table<InstalledModuleRecord, string>;

  constructor() {
    super("alethia-client-modules");
    this.version(1).stores({ modules: "id" });
  }
}

export const clientModuleDb = new ClientModuleDatabase();

const MANIFEST_FILE = "manifest.json";
const MODULE_DB_FILE = "module.db";

const RAW_BASE = "https://raw.githubusercontent.com/yojananyosef/alethia-modules/main";
const CATALOG_URL = `${RAW_BASE}/catalog.json`;
const CATALOG_CACHE_KEY = "alethia-catalog-cache";
const CATALOG_TTL_MS = 60 * 60 * 1000;

/** Caché de conexiones abiertas (LRU): módulos grandes, memoria limitada. */
const openDbs = new Map<string, ClientDatabase>();
const MAX_OPEN_DBS = 5;
let dbAccessOrder: string[] = [];

function touchDb(id: string): void {
  dbAccessOrder = dbAccessOrder.filter((x) => x !== id);
  dbAccessOrder.push(id);
  while (dbAccessOrder.length > MAX_OPEN_DBS) {
    const evict = dbAccessOrder.shift();
    if (evict) {
      const db = openDbs.get(evict);
      if (db) {
        db.close();
        openDbs.delete(evict);
      }
    }
  }
}

export async function closeClientModuleDb(id: string): Promise<void> {
  const db = openDbs.get(id);
  if (db) {
    db.close();
    openDbs.delete(id);
    dbAccessOrder = dbAccessOrder.filter((x) => x !== id);
  }
}

function toModuleInfo(record: InstalledModuleRecord): ModuleInfo {
  return {
    ...record.manifest,
    status: record.disabled ? "disabled" : "installed",
    fileSize: record.dbBytes.size,
    bookCount: record.books?.length ?? 0,
    books: record.manifest.type === "bible" ? record.books : undefined,
  };
}

export async function listClientModules(): Promise<ModuleInfo[]> {
  const records = await clientModuleDb.modules.toArray();
  return records.map(toModuleInfo).sort((a, b) => a.id.localeCompare(b.id));
}

export async function getClientModule(id: string): Promise<ModuleInfo | null> {
  const record = await clientModuleDb.modules.get(id);
  return record ? toModuleInfo(record) : null;
}

export async function getClientPrimaryBibleModule(): Promise<ModuleInfo | null> {
  const bibles = (await listClientModules()).filter(
    (m) => m.type === "bible" && m.status === "installed" && (m.books?.length ?? 0) > 0,
  );
  bibles.sort((a, b) => (b.books?.length ?? 0) - (a.books?.length ?? 0));
  return bibles[0] ?? null;
}

export async function setClientModuleEnabled(
  moduleId: string,
  enabled: boolean,
): Promise<ModuleInfo | null> {
  const record = await clientModuleDb.modules.get(moduleId);
  if (!record) return null;
  await clientModuleDb.modules.update(moduleId, { disabled: !enabled });
  return toModuleInfo({ ...record, disabled: !enabled });
}

export async function uninstallClientModule(moduleId: string): Promise<void> {
  await closeClientModuleDb(moduleId);
  await clientModuleDb.modules.delete(moduleId);
}

/** Lee el canon de libros (tabla libros) de una base abierta. */
function readBooks(db: ClientDatabase): ModuleBook[] {
  try {
    return (
      db.prepare(`SELECT id, nombre, capitulos, orden FROM libros ORDER BY orden`).all() as unknown as ModuleBook[]
    ).map((b) => ({ ...b, capitulos: Number(b.capitulos), orden: Number(b.orden) }));
  } catch {
    return [];
  }
}

export interface InstallClientResult {
  ok: boolean;
  moduleId?: string;
  error?: string;
}

/**
 * Instala un paquete .abmod (zip con manifest.json + module.db) en IndexedDB.
 * Valida el manifest y extrae el canon de libros una sola vez.
 */
export async function installClientModuleFromAbmod(
  zipBytes: Uint8Array,
  options: { allowOverwrite?: boolean } = {},
): Promise<InstallClientResult> {
  let files;
  try {
    files = unzipSync(zipBytes);
  } catch {
    return { ok: false, error: "archivo .abmod corrupto o inválido" };
  }

  const manifestRaw = files[MANIFEST_FILE];
  const dbBytes = files[MODULE_DB_FILE];
  if (!manifestRaw || !dbBytes) {
    return { ok: false, error: `el paquete debe contener ${MANIFEST_FILE} y ${MODULE_DB_FILE}` };
  }

  let manifest: ModuleManifest;
  try {
    manifest = JSON.parse(strFromU8(manifestRaw)) as ModuleManifest;
  } catch {
    return { ok: false, error: "manifest.json inválido" };
  }

  if (!/^[A-Za-z0-9_.-]+$/.test(manifest.id)) return { ok: false, error: "id inválido" };
  if (!manifest.name) return { ok: false, error: "name requerido" };

  const existing = await clientModuleDb.modules.get(manifest.id);
  if (existing && !options.allowOverwrite) {
    return { ok: false, error: `ya instalado: ${manifest.id}` };
  }

  try {
    const db = await ClientDatabase.open(new Uint8Array(dbBytes));
    let books: ModuleBook[] | undefined;
    if (manifest.type === "bible") {
      books = readBooks(db);
    }
    db.close();

    await clientModuleDb.modules.put({
      id: manifest.id,
      manifest,
      dbBytes: new Blob([dbBytes]),
      installedAt: Date.now(),
      disabled: false,
      books,
    });
    await closeClientModuleDb(manifest.id);
    return { ok: true, moduleId: manifest.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "error al abrir la base del módulo",
    };
  }
}

/** Carga (o reutiliza) la base en memoria de un módulo instalado. */
export async function getClientModuleDb(moduleId: string): Promise<ClientDatabase> {
  const cached = openDbs.get(moduleId);
  if (cached) {
    touchDb(moduleId);
    return cached;
  }
  const record = await clientModuleDb.modules.get(moduleId);
  if (!record) throw new Error(`módulo no instalado: ${moduleId}`);
  const bytes = new Uint8Array(await record.dbBytes.arrayBuffer());
  const db = await ClientDatabase.open(bytes);
  openDbs.set(moduleId, db);
  touchDb(moduleId);
  return db;
}

export async function getClientLexiconDb(): Promise<ClientDatabase> {
  return getClientModuleDb("lexicon");
}

/** Comparador estricto de versiones Semver (1 si v1>v2, -1 si v1<v2, 0 si igual). */
export function compareSemver(v1: string, v2: string): number {
  const parse = (v: string) => {
    const clean = v.replace(/^v/, "").split("-")[0];
    const parts = clean.split(".").map((n) => Number.parseInt(n, 10) || 0);
    while (parts.length < 3) parts.push(0);
    return parts;
  };
  const [maj1, min1, pat1] = parse(v1);
  const [maj2, min2, pat2] = parse(v2);
  if (maj1 !== maj2) return maj1 > maj2 ? 1 : -1;
  if (min1 !== min2) return min1 > min2 ? 1 : -1;
  if (pat1 !== pat2) return pat1 > pat2 ? 1 : -1;
  return 0;
}

interface CachedCatalog {
  catalog: RemoteCatalog;
  fetchedAt: number;
}

function readCatalogCache(): CachedCatalog | null {
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY);
    if (raw) return JSON.parse(raw) as CachedCatalog;
  } catch {}
  return null;
}

/** Obtiene el catálogo remoto con caché en localStorage (TTL 1h). */
export async function fetchClientCatalog(forceRefresh = false): Promise<RemoteCatalog> {
  const cached = readCatalogCache();
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < CATALOG_TTL_MS) {
    return cached.catalog;
  }
  try {
    const res = await fetch(CATALOG_URL, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as RemoteCatalog;
      if (data && Array.isArray(data.modules)) {
        try {
          localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ catalog: data, fetchedAt: Date.now() }));
        } catch {}
        return data;
      }
    }
  } catch {}
  if (cached) return cached.catalog;
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), catalogSource: "Alethia Built-in Catalog", modules: [] };
}

/** Catálogo unificado (remoto × instalado en IndexedDB). */
export async function getClientCatalogWithInstallStatus(
  forceRefresh = false,
  installedFilter?: string[] | null,
): Promise<CatalogResponse> {
  const t0 = performance.now();
  const remote = await fetchClientCatalog(forceRefresh);
  const localModules = await listClientModules();
  const localMap = new Map(localModules.map((m) => [m.id, m]));
  const wantedFilter = installedFilter?.length ? new Set(installedFilter) : null;

  const catalogItems: CatalogItem[] = [];
  const processedLocalIds = new Set<string>();
  let installedCount = 0;
  let updatesCount = 0;

  for (const entry of remote.modules) {
    const local = localMap.get(entry.id);
    let installStatus: CatalogItem["installStatus"] = "not_installed";
    if (local) {
      processedLocalIds.add(local.id);
      const cmp = compareSemver(entry.version, local.version);
      if (cmp > 0) {
        installStatus = "update_available";
        updatesCount++;
      } else {
        installStatus = "installed";
        installedCount++;
      }
    }
    const missingDependencies: string[] = [];
    for (const dep of entry.dependencies ?? []) {
      if (!localMap.has(dep)) missingDependencies.push(dep);
    }
    catalogItems.push({
      ...entry,
      installStatus,
      installedVersion: local?.version,
      localStatus: local?.status,
      localSizeBytes: local?.fileSize,
      missingDependencies: missingDependencies.length > 0 ? missingDependencies : undefined,
      isLocalOnly: false,
    });
  }

  for (const local of localModules) {
    if (processedLocalIds.has(local.id)) continue;
    if (wantedFilter && !wantedFilter.has(local.id)) continue;
    installedCount++;
    catalogItems.push({
      id: local.id,
      name: local.name,
      type: local.type,
      language: local.language,
      version: local.version,
      publisher: local.publisher,
      license: local.license,
      year: local.year,
      description: local.description,
      sizeBytes: local.fileSize,
      downloadUrl: "",
      dependencies: local.dependencies,
      hasStrongs: local.strongScheme === "strong",
      hasMorphology: local.strongScheme === "morphhb" || local.type === "lexicon",
      installStatus: "installed",
      installedVersion: local.version,
      localStatus: local.status,
      localSizeBytes: local.fileSize,
      isLocalOnly: true,
    });
  }

  return {
    schemaVersion: remote.schemaVersion || 1,
    generatedAt: remote.generatedAt || new Date().toISOString(),
    catalogSource: remote.catalogSource || "Alethia Catalog",
    modules: catalogItems,
    installedCount,
    availableCount: remote.modules.length,
    updatesCount,
    durationMs: performance.now() - t0,
  };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Descarga e instala un módulo remoto desde el catálogo (con verificación SHA-256
 * y resolución de dependencias). Todo en el navegador; nada pasa por el servidor.
 */
export async function installClientModuleRemote(
  params: { moduleId: string; downloadUrl?: string; sha256?: string; force?: boolean },
  visited = new Set<string>(),
): Promise<InstallRemoteResponse> {
  const t0 = performance.now();
  const { moduleId, force } = params;
  if (visited.has(moduleId)) {
    throw new Error(`Referencia circular de dependencias detectada: ${moduleId}`);
  }
  visited.add(moduleId);

  const catalog = await fetchClientCatalog();
  const entry = catalog.modules.find((m) => m.id === moduleId);
  const downloadUrl = params.downloadUrl || entry?.downloadUrl;
  const expectedSha256 = (params.sha256 || entry?.sha256)?.toLowerCase();
  const version = entry?.version || "1.0.0";
  const dependencies = entry?.dependencies || [];

  const installedDeps: string[] = [];
  const localModules = new Set((await listClientModules()).map((m) => m.id));
  for (const depId of dependencies) {
    if (!localModules.has(depId)) {
      const depResult = await installClientModuleRemote({ moduleId: depId, force: false }, visited);
      if (depResult.ok) {
        installedDeps.push(depId, ...depResult.installedDependencies);
      }
    }
  }

  const candidateUrls: string[] = [];
  if (downloadUrl && /^https?:\/\//.test(downloadUrl)) candidateUrls.push(downloadUrl);
  candidateUrls.push(`${RAW_BASE}/binaries/${moduleId}-${version}.abmod`);
  candidateUrls.push(`${RAW_BASE}/binaries/${moduleId}-1.0.0.abmod`);
  candidateUrls.push(`${RAW_BASE}/binaries/${moduleId}.abmod`);

  let zipBytes: Uint8Array | null = null;
  let isRemoteDownload = false;
  for (const url of Array.from(new Set(candidateUrls))) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        zipBytes = new Uint8Array(await res.arrayBuffer());
        isRemoteDownload = true;
        break;
      }
    } catch {}
  }
  if (!zipBytes) {
    throw new Error(`No se pudo descargar el paquete .abmod del módulo "${moduleId}"`);
  }

  if (expectedSha256 && isRemoteDownload) {
    const actualSha256 = await sha256Hex(zipBytes);
    if (actualSha256 !== expectedSha256) {
      throw new Error(
        `Error de integridad: el hash SHA-256 del paquete "${moduleId}" no coincide (esperado: ${expectedSha256}, obtenido: ${actualSha256})`,
      );
    }
  }

  const installResult = await installClientModuleFromAbmod(zipBytes, {
    allowOverwrite: Boolean(force),
  });
  if (!installResult.ok) {
    throw new Error(`Fallo al instalar módulo "${moduleId}": ${installResult.error}`);
  }

  return {
    ok: true,
    moduleId: installResult.moduleId!,
    version,
    installedDependencies: Array.from(new Set(installedDeps)),
    message: `Módulo ${moduleId} instalado correctamente${
      installedDeps.length > 0 ? ` (dependencias satisfechas: ${installedDeps.join(", ")})` : ""
    }`,
    durationMs: performance.now() - t0,
  };
}
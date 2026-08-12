import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type {
  CatalogItem,
  CatalogResponse,
  InstallRemoteRequest,
  InstallRemoteResponse,
  RemoteCatalog,
} from "../../types/catalog.ts";
import { listModules } from "./registry.ts";
import { installModuleZip, packageModuleToZip } from "./package.ts";

const CATALOG_FILE = path.join(process.cwd(), "data", "catalog.json");
const DIST_MODULES_DIR = path.join(process.cwd(), "dist-modules");
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora de caché en memoria

interface CachedCatalogData {
  catalog: RemoteCatalog;
  fetchedAt: number;
}

let inMemoryCache: CachedCatalogData | null = null;

/**
 * Comparador estricto de versiones Semver.
 * Devuelve:
 *   1 si v1 > v2
 *  -1 si v1 < v2
 *   0 si v1 === v2
 */
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

/**
 * Lee el catálogo maestro desde el archivo local data/catalog.json o lo genera por defecto.
 */
function readFallbackCatalog(): RemoteCatalog {
  if (existsSync(CATALOG_FILE)) {
    try {
      const raw = readFileSync(CATALOG_FILE, "utf8");
      return JSON.parse(raw) as RemoteCatalog;
    } catch {
      // Ignorar y generar catálogo básico de respaldo
    }
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    catalogSource: "Alethia Built-in Catalog",
    modules: [],
  };
}

/**
 * Obtiene el catálogo remoto (con caché en memoria de 1 hora).
 * Soporta configuración por variable de entorno ALETHIA_CATALOG_URL.
 */
export async function fetchRemoteCatalog(forceRefresh = false): Promise<RemoteCatalog> {
  const now = Date.now();
  if (!forceRefresh && inMemoryCache && now - inMemoryCache.fetchedAt < CACHE_TTL_MS) {
    return inMemoryCache.catalog;
  }

  const remoteUrl =
    process.env.ALETHIA_CATALOG_URL ||
    "https://raw.githubusercontent.com/yojananyosef/alethia-modules/main/catalog.json";

  if (remoteUrl && /^https?:\/\//.test(remoteUrl)) {
    try {
      const res = await fetch(remoteUrl, {
        headers: { "User-Agent": "Alethia-Bridge/0.1.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = (await res.json()) as RemoteCatalog;
        if (data && Array.isArray(data.modules)) {
          inMemoryCache = { catalog: data, fetchedAt: now };
          return data;
        }
      }
    } catch {
      // Fallback transparente al catálogo local si falla la red
    }
  }

  const localCatalog = readFallbackCatalog();
  inMemoryCache = { catalog: localCatalog, fetchedAt: now };
  return localCatalog;
}

/**
 * Cruza los datos del catálogo remoto con los módulos locales de registry.ts.
 * Clasifica cada módulo como:
 * - not_installed: no está instalado localmente.
 * - installed: instalado y en versión igual o superior a la del catálogo.
 * - update_available: instalado pero con versión en catálogo superior a la local.
 */
export async function getCatalogWithInstallStatus(
  forceRefresh = false,
  installedFilter?: string[] | null,
): Promise<CatalogResponse> {
  const t0 = performance.now();
  const remote = await fetchRemoteCatalog(forceRefresh);
  const localModules = listModules(installedFilter);
  const localMap = new Map(localModules.map((m) => [m.id, m]));

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

    // Verificar si faltan dependencias requeridas
    const missingDependencies: string[] = [];
    for (const dep of entry.dependencies ?? []) {
      if (!localMap.has(dep)) {
        missingDependencies.push(dep);
      }
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

  // Incluir módulos instalados localmente que no aparezcan en el catálogo remoto
  for (const local of localModules) {
    if (!processedLocalIds.has(local.id)) {
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

/**
 * Busca un paquete .abmod en dist-modules/ o lo empaqueta sobre la marcha si existe en la base de datos local.
 */
async function findOrBuildLocalZip(moduleId: string, version?: string): Promise<Uint8Array | null> {
  // 1. Probar dist-modules/<moduleId>-<version>.abmod
  if (version) {
    const specific = path.join(DIST_MODULES_DIR, `${moduleId}-${version}.abmod`);
    if (existsSync(specific)) return new Uint8Array(readFileSync(specific));
  }

  // 2. Probar dist-modules/<moduleId>-1.0.0.abmod o similar
  const defaultVersion = path.join(DIST_MODULES_DIR, `${moduleId}-1.0.0.abmod`);
  if (existsSync(defaultVersion)) return new Uint8Array(readFileSync(defaultVersion));

  // 3. Probar dist-modules/<moduleId>.abmod
  const bare = path.join(DIST_MODULES_DIR, `${moduleId}.abmod`);
  if (existsSync(bare)) return new Uint8Array(readFileSync(bare));

  // 4. Si el módulo está instalado en data/modules/<moduleId>.db, empaquetarlo
  try {
    const zipped = await packageModuleToZip(moduleId);
    return zipped;
  } catch {
    return null;
  }
}

/**
 * Descarga e instala un módulo desde el catálogo remoto o fallback local.
 * Resuelve dependencias automáticamente en cadena.
 * Valida integridad SHA-256 cuando está provista.
 */
export async function downloadAndInstallRemoteModule(
  params: InstallRemoteRequest,
  visited = new Set<string>(),
): Promise<InstallRemoteResponse> {
  const t0 = performance.now();
  const { moduleId, force } = params;

  if (visited.has(moduleId)) {
    throw new Error(`Referencia circular de dependencias detectada: ${moduleId}`);
  }
  visited.add(moduleId);

  // 1. Obtener catálogo y buscar el módulo
  const catalog = await fetchRemoteCatalog();
  const entry = catalog.modules.find((m) => m.id === moduleId);

  const downloadUrl = params.downloadUrl || entry?.downloadUrl;
  const expectedSha256 = (params.sha256 || entry?.sha256)?.toLowerCase();
  const version = entry?.version || "1.0.0";
  const dependencies = entry?.dependencies || [];

  const installedDeps: string[] = [];

  // 2. Resolución automática de dependencias en cadena
  const localModules = new Set(listModules().map((m) => m.id));
  for (const depId of dependencies) {
    if (!localModules.has(depId)) {
      const depResult = await downloadAndInstallRemoteModule(
        { moduleId: depId, force: false },
        visited,
      );
      if (depResult.ok) {
        installedDeps.push(depId);
        installedDeps.push(...depResult.installedDependencies);
      }
    }
  }

  // 3. Obtener el binario .abmod (probar downloadUrl + CDN de respaldo raw.githubusercontent.com)
  let zipBytes: Uint8Array | null = null;
  let isRemoteDownload = false;

  const candidateUrls: string[] = [];
  if (downloadUrl && /^https?:\/\//.test(downloadUrl)) {
    candidateUrls.push(downloadUrl);
  }

  // URLs de respaldo oficiales en GitHub raw
  const rawBase = "https://raw.githubusercontent.com/yojananyosef/alethia-modules/main/binaries";
  candidateUrls.push(`${rawBase}/${moduleId}-${version}.abmod`);
  candidateUrls.push(`${rawBase}/${moduleId}-1.0.0.abmod`);
  candidateUrls.push(`${rawBase}/${moduleId}.abmod`);

  for (const url of Array.from(new Set(candidateUrls))) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "Alethia-Bridge/0.1.0" },
          signal: AbortSignal.timeout(60000),
        });
        if (res.ok) {
          zipBytes = new Uint8Array(await res.arrayBuffer());
          isRemoteDownload = true;
          break;
        }
      } catch {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
      }
    }
    if (zipBytes) break;
  }

  if (!zipBytes) {
    zipBytes = await findOrBuildLocalZip(moduleId, version);
  }

  if (!zipBytes) {
    throw new Error(
      `No se pudo descargar ni encontrar el paquete .abmod para el módulo "${moduleId}"`,
    );
  }

  // 4. Validación de integridad SHA-256 (para descargas remotas o verificación explícita)
  if (expectedSha256 && (isRemoteDownload || params.sha256)) {
    const actualSha256 = createHash("sha256").update(zipBytes).digest("hex").toLowerCase();
    if (actualSha256 !== expectedSha256) {
      throw new Error(
        `Error de integridad: el hash SHA-256 del paquete "${moduleId}" no coincide (esperado: ${expectedSha256}, obtenido: ${actualSha256})`,
      );
    }
  }

  // 5. Instalación atómica con installModuleZip
  const installResult = installModuleZip(zipBytes, { allowOverwrite: Boolean(force) });
  if (!installResult.ok) {
    throw new Error(`Fallo al instalar módulo "${moduleId}": ${installResult.error}`);
  }

  return {
    ok: true,
    moduleId: installResult.moduleId,
    version,
    installedDependencies: Array.from(new Set(installedDeps)),
    message: `Módulo ${moduleId} instalado correctamente${
      installedDeps.length > 0 ? ` (dependencias satisfechas: ${installedDeps.join(", ")})` : ""
    }`,
    durationMs: performance.now() - t0,
  };
}

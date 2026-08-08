import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { MODULES_DIR, TMP_MODULES_DIR, ensureModuleDbReady, getWritableModulesDir, resolveModuleDbPath } from "../db/sqlite.ts";
import type { ModuleBook, ModuleInfo, ModuleManifest } from "../../types/module.ts";

function getStateFile(): string {
  return path.join(getWritableModulesDir(), ".state.json");
}

type ModuleState = { disabled: string[] };

function readState(): ModuleState {
  try {
    return JSON.parse(readFileSync(getStateFile(), "utf8")) as ModuleState;
  } catch {
    return { disabled: [] };
  }
}

function writeState(state: ModuleState): void {
  try {
    writeFileSync(getStateFile(), JSON.stringify(state, null, 2));
  } catch {}
}

/** Abre un módulo en solo lectura (sin WAL; copia a temp si hay WAL activo). */
function openReadOnly(moduleId: string): Database.Database | null {
  const file = resolveModuleDbPath(moduleId);
  if (!existsSync(file)) return null;
  try {
    const db = new Database(file, { readonly: true });
    return db;
  } catch {
    try {
      const db = new Database(file);
      return db;
    } catch {
      return null;
    }
  }
}

function parseManifest(meta: Record<string, string>): ModuleManifest | null {
  const id = meta.id;
  if (!id) return null;
  return {
    id,
    name: meta.name ?? id,
    type: (meta.type ?? "bible") as ModuleManifest["type"],
    language: (meta.language ?? "en") as ModuleManifest["language"],
    version: meta.version ?? "0.0.0",
    publisher: meta.publisher ?? "",
    license: meta.license ?? "",
    year: Number(meta.year) || 0,
    description: meta.description ?? "",
    schemaVersion: Number(meta.schemaVersion) || 0,
    dependencies: meta.dependencies ? meta.dependencies.split(",").map((s) => s.trim()) : undefined,
    strongScheme: meta.strongScheme as ModuleManifest["strongScheme"] | undefined,
    bookOrder: meta.bookOrder ? meta.bookOrder.split(",").map((s) => s.trim()) : undefined,
  };
}

/** Cache de info por módulo, invalidada por mtime del .db y del .state.json. */
const infoCache = new Map<string, { dbMtime: number; stateMtime: number; info: ModuleInfo | null }>();

export function clearModuleInfoCache(moduleId?: string): void {
  if (moduleId) {
    infoCache.delete(moduleId);
  } else {
    infoCache.clear();
  }
}

/** Lee el manifest y canon de un módulo desde su DB (tolerante a tablas ausentes). */
export function readModuleInfo(moduleId: string): ModuleInfo | null {
  const file = resolveModuleDbPath(moduleId);
  let dbMtime = 0;
  try {
    dbMtime = statSync(file).mtimeMs;
  } catch {
    infoCache.delete(moduleId);
    return null;
  }
  let stateMtime = 0;
  try {
    stateMtime = statSync(getStateFile()).mtimeMs;
  } catch {
    stateMtime = 0;
  }
  const cached = infoCache.get(moduleId);
  if (cached && cached.dbMtime === dbMtime && cached.stateMtime === stateMtime && cached.info !== null) {
    return cached.info;
  }
  const info = readModuleInfoUncached(moduleId);
  if (info) {
    infoCache.set(moduleId, { dbMtime, stateMtime, info });
  } else {
    infoCache.delete(moduleId);
  }
  return info;
}

function readModuleInfoUncached(moduleId: string): ModuleInfo | null {
  const db = openReadOnly(moduleId);
  if (!db) return null;
  try {
    const hasMeta = db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='meta'`)
      .get();
    if (!hasMeta) return null;

    const meta: Record<string, string> = {};
    for (const row of db.prepare(`SELECT clave, valor FROM meta`).all() as {
      clave: string;
      valor: string;
    }[]) {
      const key = row.clave.replace(/^manifest_/, "");
      if (key !== row.clave) meta[key] = row.valor;
    }
    const manifest = parseManifest(meta);
    if (!manifest || manifest.id !== moduleId) return null;

    let books: ModuleBook[] = [];
    try {
      books = (
        db
          .prepare(`SELECT id, nombre, capitulos, orden FROM libros ORDER BY orden`)
          .all() as ModuleBook[]
      ).map((b) => ({ ...b, capitulos: Number(b.capitulos), orden: Number(b.orden) }));
    } catch {
      books = [];
    }

    const state = readState();
    return {
      ...manifest,
      status: state.disabled.includes(moduleId) ? "disabled" : "installed",
      fileSize: statSync(resolveModuleDbPath(moduleId)).size,
      bookCount: books.length,
      books: manifest.type === "bible" ? books : undefined,
    };
  } catch {
    // Instal/desinstal concurrentes pueden dejar archivos a medio renombrar:
    // el módulo se trata como no disponible en vez de reventar la lista.
    return null;
  } finally {
    db.close();
  }
}

/** Helper para extraer los IDs de módulos instalados por el usuario desde la petición (header, cookie o query). */
export function getInstalledIdsFromRequest(request?: Request): string[] | null {
  if (!request) return null;
  // 1. Header x-installed-modules
  const header = request.headers.get("x-installed-modules");
  if (header) {
    const list = header.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length > 0) return list;
  }
  // 2. Cookie alethia_installed
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(/alethia_installed=([^;]+)/);
    if (match && match[1]) {
      try {
        const val = decodeURIComponent(match[1]);
        const list = val.split(",").map((s) => s.trim()).filter(Boolean);
        if (list.length > 0) return list;
      } catch {}
    }
  }
  // 3. Query param ?installed=...
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("installed");
    if (q) {
      const list = q.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length > 0) return list;
    }
  } catch {}
  return null;
}

/** Escanea módulos instalados (filtrando por los IDs instalados por el usuario si se proveen). */
export function listModules(installedFilter?: string[] | null): ModuleInfo[] {
  const moduleMap = new Map<string, ModuleInfo>();

  // Si el cliente especifica los módulos que tiene instalados
  if (installedFilter && installedFilter.length > 0) {
    for (const id of installedFilter) {
      const cleanId = id.trim();
      if (!cleanId) continue;
      ensureModuleDbReady(cleanId);
      const info = readModuleInfo(cleanId);
      if (info) moduleMap.set(cleanId, info);
    }
    return Array.from(moduleMap.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  const dirs = [MODULES_DIR, TMP_MODULES_DIR];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    try {
      for (const file of readdirSync(dir)) {
        if (!file.endsWith(".db") || file.startsWith(".")) continue;
        const moduleId = file.replace(/\.db$/, "");
        const info = readModuleInfo(moduleId);
        if (info) moduleMap.set(moduleId, info);
      }
    } catch {}
  }

  return Array.from(moduleMap.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export function getModule(moduleId: string): ModuleInfo | null {
  return readModuleInfo(moduleId);
}

/** Activa/desactiva un módulo sin desinstalarlo. */
export function setModuleEnabled(moduleId: string, enabled: boolean): ModuleInfo | null {
  const info = readModuleInfo(moduleId);
  if (!info) return null;
  const state = readState();
  const idx = state.disabled.indexOf(moduleId);
  if (enabled && idx >= 0) state.disabled.splice(idx, 1);
  if (!enabled && idx < 0) state.disabled.push(moduleId);
  writeState(state);
  return { ...info, status: enabled ? "installed" : "disabled" };
}

/** Módulo biblia activo con el canon más completo (fuente de navegación). */
export function getPrimaryBibleModule(): ModuleInfo | null {
  const bibles = listModules().filter(
    (m) => m.type === "bible" && m.status === "installed" && (m.books?.length ?? 0) > 0,
  );
  bibles.sort((a, b) => (b.books?.length ?? 0) - (a.books?.length ?? 0));
  return bibles[0] ?? null;
}

/** Valida que las dependencias del manifest estén instaladas. */
export function validateDependencies(manifest: ModuleManifest): string | null {
  const installed = new Set(listModules().map((m) => m.id));
  for (const dep of manifest.dependencies ?? []) {
    if (!installed.has(dep)) return `dependencia faltante: ${dep}`;
  }
  return null;
}

/** Valida un manifest completo para instalación. */
export function validateManifest(manifest: ModuleManifest, allowOverwrite = false): string | null {
  if (!/^[A-Za-z0-9_.-]+$/.test(manifest.id)) return "id inválido";
  if (!manifest.name) return "name requerido";
  if (!allowOverwrite && existsSync(path.join(MODULES_DIR, `${manifest.id}.db`))) {
    return `ya instalado: ${manifest.id}`;
  }
  return null;
}

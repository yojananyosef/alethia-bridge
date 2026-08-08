import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { MODULES_DIR } from "../db/sqlite.ts";
import type { ModuleBook, ModuleInfo, ModuleManifest } from "../../types/module.ts";

const STATE_FILE = path.join(MODULES_DIR, ".state.json");

type ModuleState = { disabled: string[] };

function readState(): ModuleState {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8")) as ModuleState;
  } catch {
    return { disabled: [] };
  }
}

function writeState(state: ModuleState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/** Abre un módulo en solo lectura (sin WAL; copia a temp si hay WAL activo). */
function openReadOnly(moduleId: string): Database.Database | null {
  const file = path.join(MODULES_DIR, `${moduleId}.db`);
  if (!existsSync(file)) return null;
  try {
    const db = new Database(file, { readonly: true });
    return db;
  } catch {
    return null;
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

/** Lee el manifest y canon de un módulo desde su DB (tolerante a tablas ausentes). */
export function readModuleInfo(moduleId: string): ModuleInfo | null {
  const file = path.join(MODULES_DIR, `${moduleId}.db`);
  let dbMtime = 0;
  try {
    dbMtime = statSync(file).mtimeMs;
  } catch {
    return null;
  }
  let stateMtime = 0;
  try {
    stateMtime = statSync(STATE_FILE).mtimeMs;
  } catch {
    stateMtime = 0;
  }
  const cached = infoCache.get(moduleId);
  if (cached && cached.dbMtime === dbMtime && cached.stateMtime === stateMtime) {
    return cached.info;
  }
  const info = readModuleInfoUncached(moduleId);
  infoCache.set(moduleId, { dbMtime, stateMtime, info });
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
      fileSize: statSync(path.join(MODULES_DIR, `${moduleId}.db`)).size,
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

/** Escanea data/modules/*.db y devuelve la info de todos los módulos instalados. */
export function listModules(): ModuleInfo[] {
  const modules: ModuleInfo[] = [];
  for (const file of readdirSync(MODULES_DIR)) {
    if (!file.endsWith(".db")) continue;
    const info = readModuleInfo(file.replace(/\.db$/, ""));
    if (info) modules.push(info);
  }
  return modules.sort((a, b) => a.id.localeCompare(b.id));
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
export function validateManifest(manifest: ModuleManifest): string | null {
  if (!/^[A-Za-z0-9_.-]+$/.test(manifest.id)) return "id inválido";
  if (!manifest.name) return "name requerido";
  if (existsSync(path.join(MODULES_DIR, `${manifest.id}.db`))) return `ya instalado: ${manifest.id}`;
  return null;
}

import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { strFromU8, unzipSync, zipSync, type Zippable } from "fflate";
import Database from "better-sqlite3";
import {
  MODULES_DIR,
  getWritableModulesDir,
  resolveModuleDbPath,
  initModuleMeta,
  writeManifestMeta,
  closeModuleDb,
} from "../db/sqlite.ts";
import type { ModuleManifest } from "../../types/module.ts";
import { validateManifest, validateDependencies, clearModuleInfoCache } from "./registry.ts";

const MANIFEST_FILE = "manifest.json";
const MODULE_DB_FILE = "module.db";

/** Lee el manifest almacenado en la tabla meta de una base. */
function readManifestFromDb(db: Database.Database): ModuleManifest {
  const meta: Record<string, string> = {};
  for (const row of db.prepare(`SELECT clave, valor FROM meta`).all() as {
    clave: string;
    valor: string;
  }[]) {
    const key = row.clave.replace(/^manifest_/, "");
    if (key !== row.clave) meta[key] = row.valor;
  }
  return {
    id: meta.id,
    name: meta.name,
    type: (meta.type ?? "bible") as ModuleManifest["type"],
    language: (meta.language ?? "el") as ModuleManifest["language"],
    version: meta.version ?? "0.0.0",
    publisher: meta.publisher ?? "",
    license: meta.license ?? "",
    year: Number(meta.year) || 0,
    description: meta.description ?? "",
    schemaVersion: Number(meta.schemaVersion) || 0,
    dependencies: meta.dependencies ? meta.dependencies.split(",") : undefined,
    strongScheme: meta.strongScheme as ModuleManifest["strongScheme"] | undefined,
    bookOrder: meta.bookOrder ? meta.bookOrder.split(",") : undefined,
  };
}

/**
 * Empaqueta un módulo instalado en el formato .abmod (zip):
 *   manifest.json — manifest del módulo
 *   module.db     — copia limpia (WAL truncado) de la base
 */
export async function packageModuleToZip(moduleId: string): Promise<Uint8Array> {
  const src = resolveModuleDbPath(moduleId);
  if (!existsSync(src)) throw new Error(`módulo no instalado: ${moduleId}`);

  const writableDir = getWritableModulesDir();
  const tmp = path.join(writableDir, `.tmp-${moduleId}.db`);
  if (existsSync(tmp)) rmSync(tmp);

  let manifest: ModuleManifest;
  try {
    const srcDb = new Database(src, { readonly: true });
    manifest = readManifestFromDb(srcDb);
    await srcDb.backup(tmp);
    srcDb.close();
  } catch (err) {
    if (existsSync(tmp)) rmSync(tmp);
    throw err;
  }

  const files: Zippable = {
    [MANIFEST_FILE]: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
    [MODULE_DB_FILE]: readFileSync(tmp),
  };
  rmSync(tmp);
  return zipSync(files, { level: 6 });
}

/**
 * Instala un paquete .abmod validando manifest y escribiendo
 * en el directorio de módulos de forma atómica (temp + rename).
 */
export function installModuleZip(
  zipBytes: Uint8Array,
  options: { allowOverwrite?: boolean } = {},
): { ok: true; moduleId: string } | { ok: false; error: string } {
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

  const manifestError = validateManifest(manifest, options.allowOverwrite ?? false);
  if (manifestError) return { ok: false, error: manifestError };
  const depError = validateDependencies(manifest);
  if (depError) return { ok: false, error: depError };

  const writableDir = getWritableModulesDir();
  const target = path.join(writableDir, `${manifest.id}.db`);
  const tmp = path.join(writableDir, `.install-${manifest.id}.db`);

  try {
    writeFileSync(tmp, dbBytes);
    const db = new Database(tmp);
    initModuleMeta(db);
    // El manifest.json del paquete es la fuente de verdad → reescribir meta
    writeManifestMeta(db, {
      id: manifest.id,
      name: manifest.name,
      type: manifest.type,
      language: manifest.language,
      version: manifest.version,
      publisher: manifest.publisher,
      license: manifest.license,
      year: String(manifest.year),
      description: manifest.description,
      schemaVersion: String(manifest.schemaVersion),
      dependencies: (manifest.dependencies ?? []).join(","),
      strongScheme: manifest.strongScheme ?? "",
      bookOrder: (manifest.bookOrder ?? []).join(","),
    });
    db.pragma("journal_mode = DELETE");
    db.close();
    if (existsSync(target)) {
      try {
        closeModuleDb(manifest.id);
        clearModuleInfoCache(manifest.id);
        rmSync(target);
      } catch {}
    }
    renameSync(tmp, target);
    clearModuleInfoCache(manifest.id);
  } catch (err) {
    if (existsSync(tmp)) rmSync(tmp);
    return { ok: false, error: err instanceof Error ? err.message : "error al escribir el módulo" };
  }

  return { ok: true, moduleId: manifest.id };
}

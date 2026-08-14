import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import type BetterSqlite3 from "better-sqlite3";

export type Database = BetterSqlite3.Database;

export function createDatabase(file: string, options?: { readonly?: boolean }): Database {
  if (typeof (globalThis as any).Bun !== "undefined") {
    const { Database: BunDb } = require("bun:sqlite");
    return new BunDb(file, options);
  }
  const BetterSqlite3Constructor = require("better-sqlite3");
  return new BetterSqlite3Constructor(file, options);
}

export const MODULES_DIR = path.join(process.cwd(), "data", "modules");
export const TMP_MODULES_DIR = path.join(
  process.env.TMPDIR || process.env.VERCEL_TMPDIR || "/tmp",
  "alethia-modules",
);

export function getWritableModulesDir(): string {
  try {
    mkdirSync(MODULES_DIR, { recursive: true });
    const testFile = path.join(MODULES_DIR, `.test-write-${Date.now()}.tmp`);
    writeFileSync(testFile, "1");
    rmSync(testFile);
    return MODULES_DIR;
  } catch {
    try {
      mkdirSync(TMP_MODULES_DIR, { recursive: true });
      const testFile = path.join(TMP_MODULES_DIR, `.test-write-${Date.now()}.tmp`);
      writeFileSync(testFile, "1");
      rmSync(testFile);
    } catch {}
    return TMP_MODULES_DIR;
  }
}

const readyModulePathCache = new Map<string, string>();

/** Asegura que el archivo .db del módulo esté disponible en disco o tmp (extrayéndolo de dist-modules bajo demanda). */
export function ensureModuleDbReady(moduleId: string): string {
  const cached = readyModulePathCache.get(moduleId);
  if (cached && existsSync(/*turbopackIgnore: true*/ cached)) {
    return cached;
  }

  const local = path.join(MODULES_DIR, `${moduleId}.db`);
  if (existsSync(/*turbopackIgnore: true*/ local)) {
    try {
      if (statSync(/*turbopackIgnore: true*/ local).size > 1024) {
        readyModulePathCache.set(moduleId, local);
        return local;
      }
    } catch {}
  }

  const writableDir = getWritableModulesDir();
  const tmp = path.join(writableDir, `${moduleId}.db`);
  if (existsSync(/*turbopackIgnore: true*/ tmp)) {
    try {
      if (statSync(/*turbopackIgnore: true*/ tmp).size > 1024) {
        readyModulePathCache.set(moduleId, tmp);
        return tmp;
      }
    } catch {}
  }

  const candidateDirs = [
    path.join(process.cwd(), "binaries"),
    path.join(process.cwd(), "dist-modules"),
    path.join(process.cwd(), "..", "alethia-modules", "binaries"),
  ];

  for (const dir of candidateDirs) {
    if (existsSync(/*turbopackIgnore: true*/ dir)) {
      try {
        const candidates = [
          path.join(dir, `${moduleId}-1.0.0.abmod`),
          path.join(dir, `${moduleId}-1.1.0.abmod`),
          path.join(dir, `${moduleId}.abmod`),
        ];
        for (const cand of candidates) {
          if (existsSync(/*turbopackIgnore: true*/ cand)) {
            const zip = unzipSync(new Uint8Array(readFileSync(/*turbopackIgnore: true*/ cand)));
            const dbBytes = zip["module.db"] || zip[`${moduleId}.db`];
            if (dbBytes && dbBytes.length > 0) {
              writeFileSync(tmp, dbBytes);
              return tmp;
            }
          }
        }
      } catch {}
    }
  }

  return existsSync(/*turbopackIgnore: true*/ local) ? local : tmp;
}

export async function ensureModuleReadyAsync(moduleId: string): Promise<string> {
  const ready = ensureModuleDbReady(moduleId);
  if (existsSync(/*turbopackIgnore: true*/ ready)) {
    try {
      if (statSync(/*turbopackIgnore: true*/ ready).size > 1024) return ready;
    } catch {}
  }

  const writableDir = getWritableModulesDir();
  const target = path.join(writableDir, `${moduleId}.db`);

  const rawBase = "https://raw.githubusercontent.com/yojananyosef/alethia-modules/main/binaries";
  const candidateUrls = [
    `${rawBase}/${moduleId}-1.0.0.abmod`,
    `${rawBase}/${moduleId}-1.1.0.abmod`,
    `${rawBase}/${moduleId}.abmod`,
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Alethia-Bridge-Runtime/1.0" },
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        const zip = unzipSync(bytes);
        const dbBytes = zip["module.db"] || zip[`${moduleId}.db`];
        if (dbBytes && dbBytes.length > 0) {
          writeFileSync(target, dbBytes);
          return target;
        }
      }
    } catch {}
  }

  return target;
}

export function resolveModuleDbPath(moduleId: string): string {
  return ensureModuleDbReady(moduleId);
}

export const SCHEMA_VERSICULOS = `
CREATE TABLE IF NOT EXISTS versiculos (
  id_versiculo INTEGER PRIMARY KEY AUTOINCREMENT,
  libro_id TEXT NOT NULL,
  capitulo INTEGER NOT NULL,
  versiculo INTEGER NOT NULL,
  texto_plano TEXT NOT NULL,
  texto_norm TEXT NOT NULL,
  UNIQUE(libro_id, capitulo, versiculo)
);

CREATE TABLE IF NOT EXISTS palabras_interlineal (
  id_palabra INTEGER PRIMARY KEY AUTOINCREMENT,
  id_versiculo INTEGER NOT NULL,
  posicion INTEGER NOT NULL,
  texto_superficie TEXT NOT NULL,
  lema TEXT,
  strong_id TEXT,
  morph_code TEXT,
  alineacion_id TEXT NOT NULL,
  FOREIGN KEY(id_versiculo) REFERENCES versiculos(id_versiculo)
);

CREATE VIRTUAL TABLE IF NOT EXISTS versiculos_fts USING fts5(
  libro_id UNINDEXED,
  capitulo UNINDEXED,
  versiculo UNINDEXED,
  texto_norm,
  content='versiculos',
  content_rowid='id_versiculo',
  tokenize='unicode61'
);

CREATE INDEX IF NOT EXISTS idx_versiculos_ref ON versiculos(libro_id, capitulo, versiculo);
CREATE INDEX IF NOT EXISTS idx_palabras_strong ON palabras_interlineal(strong_id);
CREATE INDEX IF NOT EXISTS idx_palabras_alineacion ON palabras_interlineal(alineacion_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_palabras_versiculo_pos ON palabras_interlineal(id_versiculo, posicion);
`;

export const SCHEMA_MODULE_META = `
CREATE TABLE IF NOT EXISTS meta (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS libros (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  capitulos INTEGER NOT NULL,
  orden INTEGER NOT NULL
);
`;

/** Módulos de comentario: una fila por versículo comentado (p. ej. Torres Amat). */
export const SCHEMA_COMENTARIO = `
CREATE TABLE IF NOT EXISTS comentarios (
  id_comentario INTEGER PRIMARY KEY AUTOINCREMENT,
  libro_id TEXT NOT NULL,
  capitulo INTEGER NOT NULL,
  versiculo INTEGER NOT NULL,
  texto TEXT NOT NULL,
  UNIQUE(libro_id, capitulo, versiculo)
);

CREATE INDEX IF NOT EXISTS idx_comentarios_ref ON comentarios(libro_id, capitulo, versiculo);
`;

/** Módulos de referencias cruzadas (p. ej. Treasury of Scripture Knowledge). */
export const SCHEMA_CROSSREF = `
CREATE TABLE IF NOT EXISTS referencias_cruzadas (
  id_ref INTEGER PRIMARY KEY AUTOINCREMENT,
  libro_origen TEXT NOT NULL,
  capitulo_origen INTEGER NOT NULL,
  versiculo_origen INTEGER NOT NULL,
  libro_destino TEXT NOT NULL,
  capitulo_destino INTEGER NOT NULL,
  versiculo_destino_inicio INTEGER NOT NULL,
  versiculo_destino_fin INTEGER,
  votos INTEGER DEFAULT 1,
  nota TEXT
);

CREATE INDEX IF NOT EXISTS idx_crossref_src ON referencias_cruzadas(libro_origen, capitulo_origen, versiculo_origen);
CREATE INDEX IF NOT EXISTS idx_crossref_dst ON referencias_cruzadas(libro_destino, capitulo_destino);
`;

/** Módulos devocionales (p. ej. Spurgeon, Manantiales en el Desierto). */
export const SCHEMA_DEVOCIONAL = `
CREATE TABLE IF NOT EXISTS devocionales (
  id_devocional INTEGER PRIMARY KEY AUTOINCREMENT,
  mes INTEGER NOT NULL,
  dia INTEGER NOT NULL,
  momento TEXT DEFAULT 'dia',
  titulo TEXT NOT NULL,
  pasaje_clave TEXT NOT NULL,
  texto TEXT NOT NULL,
  oracion TEXT,
  UNIQUE(mes, dia, momento)
);

CREATE INDEX IF NOT EXISTS idx_devocionales_fecha ON devocionales(mes, dia);
`;

export const SCHEMA_LEXICON = `
CREATE TABLE IF NOT EXISTS diccionario (
  strong_id TEXT PRIMARY KEY,
  lema TEXT NOT NULL,
  transliteracion TEXT NOT NULL,
  pronunciacion TEXT,
  definicion_corta TEXT NOT NULL,
  definicion_detallada TEXT,
  dominio_semantico TEXT,
  idioma TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS parsing_gramatical (
  morph_code TEXT PRIMARY KEY,
  descripcion_espanol TEXT NOT NULL,
  categoria_gramatical TEXT NOT NULL
);
`;

/** Diccionarios enciclopédicos y temáticos (p. ej. Easton, Smith, Hastings). */
export const SCHEMA_DICTIONARY = `
CREATE TABLE IF NOT EXISTS entradas (
  id_entrada INTEGER PRIMARY KEY AUTOINCREMENT,
  termino TEXT NOT NULL,
  slug TEXT NOT NULL,
  definicion TEXT NOT NULL,
  referencias TEXT,
  fuente TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS entradas_fts USING fts5(
  termino,
  definicion,
  content='entradas',
  content_rowid='id_entrada',
  tokenize='unicode61'
);

CREATE INDEX IF NOT EXISTS idx_entradas_slug ON entradas(slug);
CREATE INDEX IF NOT EXISTS idx_entradas_termino ON entradas(termino);
`;

export const DICTIONARY_FTS_TRIGGERS = `
CREATE TRIGGER IF NOT EXISTS entradas_ai AFTER INSERT ON entradas BEGIN
  INSERT INTO entradas_fts(rowid, termino, definicion)
  VALUES (new.id_entrada, new.termino, new.definicion);
END;

CREATE TRIGGER IF NOT EXISTS entradas_ad AFTER DELETE ON entradas BEGIN
  INSERT INTO entradas_fts(entradas_fts, rowid, termino, definicion)
  VALUES ('delete', old.id_entrada, old.termino, old.definicion);
END;

CREATE TRIGGER IF NOT EXISTS entradas_au AFTER UPDATE ON entradas BEGIN
  INSERT INTO entradas_fts(entradas_fts, rowid, termino, definicion)
  VALUES ('delete', old.id_entrada, old.termino, old.definicion);
  INSERT INTO entradas_fts(rowid, termino, definicion)
  VALUES (new.id_entrada, new.termino, new.definicion);
END;
`;

export const FTS_TRIGGERS = `
CREATE TRIGGER IF NOT EXISTS versiculos_ai AFTER INSERT ON versiculos BEGIN
  INSERT INTO versiculos_fts(rowid, libro_id, capitulo, versiculo, texto_norm)
  VALUES (new.id_versiculo, new.libro_id, new.capitulo, new.versiculo, new.texto_norm);
END;

CREATE TRIGGER IF NOT EXISTS versiculos_ad AFTER DELETE ON versiculos BEGIN
  INSERT INTO versiculos_fts(versiculos_fts, rowid, libro_id, capitulo, versiculo, texto_norm)
  VALUES ('delete', old.id_versiculo, old.libro_id, old.capitulo, old.versiculo, old.texto_norm);
END;

CREATE TRIGGER IF NOT EXISTS versiculos_au AFTER UPDATE ON versiculos BEGIN
  INSERT INTO versiculos_fts(versiculos_fts, rowid, libro_id, capitulo, versiculo, texto_norm)
  VALUES ('delete', old.id_versiculo, old.libro_id, old.capitulo, old.versiculo, old.texto_norm);
  INSERT INTO versiculos_fts(rowid, libro_id, capitulo, versiculo, texto_norm)
  VALUES (new.id_versiculo, new.libro_id, new.capitulo, new.versiculo, new.texto_norm);
END;
`;

/** Normaliza texto para indexado FTS y búsqueda: NFD, sin diacríticos, minúsculas. */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC").toLowerCase();
}

const moduleCache = new Map<string, Database>();

function openDb(file: string, readonly = false): Database {
  try {
    mkdirSync(path.dirname(file), { recursive: true });
  } catch {}

  let db: Database;
  try {
    db = createDatabase(file, { readonly });
    if (!readonly) {
      try {
        db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
      } catch {
        // En entornos serverless donde el FS es read-only, continuar en modo lectura
      }
    }
  } catch {
    db = createDatabase(file, { readonly: true });
  }
  return db;
}

export function getModuleDb(moduleId: string): Database {
  let db = moduleCache.get(moduleId);
  if (!db) {
    db = openDb(resolveModuleDbPath(moduleId));
    moduleCache.set(moduleId, db);
  }
  return db;
}

export function getLexiconDb(): Database {
  return getModuleDb("lexicon");
}

/** Cierra y descarta la conexión en caché (usado por uninstall). */
export function closeModuleDb(moduleId: string): void {
  readyModulePathCache.delete(moduleId);
  const db = moduleCache.get(moduleId);
  if (db) {
    try {
      db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
    } catch {}
    try {
      db.close();
    } catch {}
    moduleCache.delete(moduleId);
  }
}

/** Escribe el manifest en la tabla meta (claves con prefijo "manifest_"). */
export function writeManifestMeta(db: Database, manifest: Record<string, string>): void {
  const ins = db.prepare(
    `INSERT INTO meta (clave, valor) VALUES (?, ?)
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
  );
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(manifest)) {
      ins.run(`manifest_${k}`, v);
    }
  });
  tx();
}

/** Pobla la tabla canónica de libros. */
export function writeBooks(
  db: Database,
  books: { id: string; nombre: string; capitulos: number; orden: number }[],
): void {
  db.exec("DELETE FROM libros;");
  const ins = db.prepare(`INSERT INTO libros (id, nombre, capitulos, orden) VALUES (?, ?, ?, ?)`);
  const tx = db.transaction(() => {
    for (const b of books) ins.run(b.id, b.nombre, b.capitulos, b.orden);
  });
  tx();
}

/** Crea las tablas meta/libros en un módulo (idempotente). */
export function initModuleMeta(db: Database): void {
  db.exec(SCHEMA_MODULE_META);
}

export function initModuleDb(moduleId: string): Database {
  const db = getModuleDb(moduleId);
  db.exec(SCHEMA_VERSICULOS);
  db.exec(FTS_TRIGGERS);
  return db;
}

export function initLexiconDb(): Database {
  const db = getLexiconDb();
  db.exec(SCHEMA_LEXICON);
  return db;
}

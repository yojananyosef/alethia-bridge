import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export const MODULES_DIR = path.join(process.cwd(), "data", "modules");
export const TMP_MODULES_DIR = path.join(process.env.TMPDIR || "/tmp", "alethia-modules");

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
    } catch {}
    return TMP_MODULES_DIR;
  }
}

export function resolveModuleDbPath(moduleId: string): string {
  const tmp = path.join(TMP_MODULES_DIR, `${moduleId}.db`);
  if (existsSync(tmp)) return tmp;

  const local = path.join(MODULES_DIR, `${moduleId}.db`);
  if (existsSync(local)) return local;

  return tmp;
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

const moduleCache = new Map<string, Database.Database>();

function openDb(file: string, readonly = false): Database.Database {
  try {
    mkdirSync(path.dirname(file), { recursive: true });
  } catch {}

  let db: Database.Database;
  try {
    db = new Database(file, { readonly });
    if (!readonly) {
      try {
        db.pragma("journal_mode = WAL");
        db.pragma("synchronous = NORMAL");
        db.pragma("busy_timeout = 5000");
        db.pragma("foreign_keys = ON");
      } catch {
        // En entornos serverless donde el FS es read-only, continuar en modo lectura
      }
    }
  } catch {
    db = new Database(file, { readonly: true });
  }
  return db;
}

export function getModuleDb(moduleId: string): Database.Database {
  let db = moduleCache.get(moduleId);
  if (!db) {
    db = openDb(resolveModuleDbPath(moduleId));
    moduleCache.set(moduleId, db);
  }
  return db;
}

export function getLexiconDb(): Database.Database {
  return getModuleDb("lexicon");
}

/** Cierra y descarta la conexión en caché (usado por uninstall). */
export function closeModuleDb(moduleId: string): void {
  const db = moduleCache.get(moduleId);
  if (db) {
    db.close();
    moduleCache.delete(moduleId);
  }
}

/** Escribe el manifest en la tabla meta (claves con prefijo "manifest_"). */
export function writeManifestMeta(db: Database.Database, manifest: Record<string, string>): void {
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
  db: Database.Database,
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
export function initModuleMeta(db: Database.Database): void {
  db.exec(SCHEMA_MODULE_META);
}

export function initModuleDb(moduleId: string): Database.Database {
  const db = getModuleDb(moduleId);
  db.exec(SCHEMA_VERSICULOS);
  db.exec(FTS_TRIGGERS);
  return db;
}

export function initLexiconDb(): Database.Database {
  const db = getLexiconDb();
  db.exec(SCHEMA_LEXICON);
  return db;
}

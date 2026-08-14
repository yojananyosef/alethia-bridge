"use client";

import sqlite3InitModule from "../../vendor/sqlite-wasm/index.mjs";
import type { PreparedStatement, Sqlite3Static } from "@sqlite.org/sqlite-wasm";

export type ClientBindValue = string | number | null | bigint | Uint8Array | boolean | undefined;

let sqlite3Promise: Promise<Sqlite3Static> | null = null;

/** Inicializa (una sola vez) el runtime SQLite WASM en el navegador. */
export function initSqliteWasm(): Promise<Sqlite3Static> {
  if (!sqlite3Promise) {
    sqlite3Promise = sqlite3InitModule({
      locateFile: (file: string) => `/${file}`,
    });
  }
  return sqlite3Promise;
}

/**
 * Los .db de módulos se crearon con journal_mode=WAL (bytes 18/19 del header = 2).
 * Una base en memoria (deserializada) no puede usar WAL → SQLite responde
 * SQLITE_CANTOPEN. Se parchean los version bytes a journal legacy (1) antes de
 * deserializar; el contenido es íntegro porque los -wal son vacíos (0 bytes).
 */
export function patchWALHeader(bytes: Uint8Array): Uint8Array {
  if (bytes.length >= 20 && bytes[18] === 2) {
    const copy = new Uint8Array(bytes);
    copy[18] = 1;
    copy[19] = 1;
    return copy;
  }
  return bytes;
}

/** Deserializa bytes de un .db en una conexión sqlite-wasm en memoria. */
export async function deserializeDb(bytes: Uint8Array): Promise<WasmDbHandle> {
  const sqlite3 = await initSqliteWasm();
  const patched = patchWALHeader(bytes);
  const db = new sqlite3.oo1.DB();
  const pData = sqlite3.wasm.allocFromTypedArray(patched);
  db.onclose = {
    after: () => {
      try {
        sqlite3.wasm.dealloc(pData);
      } catch {}
    },
  };
  const rc = sqlite3.capi.sqlite3_deserialize(
    db.pointer as number,
    "main",
    pData,
    patched.length,
    patched.length,
    0,
  );
  if (rc !== sqlite3.capi.SQLITE_OK) {
    db.close();
    throw new Error(`sqlite3_deserialize falló: rc=${rc}`);
  }
  return new WasmDbHandle(sqlite3, db);
}

/** Envoltura con limpieza de memoria WASM. */
export class WasmDbHandle {
  constructor(
    private readonly sqlite3: Sqlite3Static,
    public readonly db: InstanceType<Sqlite3Static["oo1"]["DB"]>,
  ) {}

  close(): void {
    try {
      this.db.close();
    } catch {}
  }
}

/**
 * Adaptador síncrono con API similar a better-sqlite3:
 *   db.prepare(sql).all(...params) | .get(...params) | .run(...params)
 *   db.exec(sql)
 * Internamente usa la API oo1 de sqlite-wasm (síncrona).
 */
export class ClientDatabase {
  private constructor(private readonly handle: WasmDbHandle) {}

  static async open(bytes: Uint8Array): Promise<ClientDatabase> {
    return new ClientDatabase(await deserializeDb(bytes));
  }

  get pointer(): unknown {
    return this.handle.db.pointer;
  }

  exec(sql: string): void {
    this.handle.db.exec(sql);
  }

  prepare(sql: string): ClientStatement {
    return new ClientStatement(this.handle.db.prepare(sql));
  }

  close(): void {
    this.handle.close();
  }
}

export class ClientStatement {
  constructor(private readonly stmt: PreparedStatement) {}

  private bind(args: ClientBindValue[]): void {
    if (args.length > 0) {
      this.stmt.bind(args);
    }
  }

  all(...args: ClientBindValue[]): Record<string, unknown>[] {
    this.bind(args);
    const rows: Record<string, unknown>[] = [];
    try {
      while (this.stmt.step()) {
        rows.push(this.stmt.get({}) as Record<string, unknown>);
      }
    } finally {
      this.stmt.finalize();
    }
    return rows;
  }

  get(...args: ClientBindValue[]): Record<string, unknown> | undefined {
    this.bind(args);
    try {
      return this.stmt.step() ? (this.stmt.get({}) as Record<string, unknown>) : undefined;
    } finally {
      this.stmt.finalize();
    }
  }

  run(...args: ClientBindValue[]): { changes: number; lastInsertRowid: number } {
    this.bind(args);
    try {
      this.stmt.step();
    } finally {
      this.stmt.finalize();
    }
    return { changes: 0, lastInsertRowid: 0 };
  }
}

/** Normaliza texto para indexado FTS y búsqueda: NFD, sin diacríticos, minúsculas. */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC").toLowerCase();
}
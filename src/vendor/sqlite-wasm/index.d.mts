import type { PreparedStatement, Sqlite3Static } from "@sqlite.org/sqlite-wasm";

declare const sqlite3InitModule: (arg?: {
  locateFile?: (file: string) => string;
}) => Promise<Sqlite3Static>;

export default sqlite3InitModule;
export type { PreparedStatement, Sqlite3Static };
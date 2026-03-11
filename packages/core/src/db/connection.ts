import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync } from "node:fs";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import * as schema from "./schema.js";

const ARENA_DIR = join(homedir(), ".arena");
const DEFAULT_DB_PATH = join(ARENA_DIR, "arena.db");

/**
 * Minimal interface shared by both bun:sqlite and better-sqlite3.
 * Only the methods actually used by arena services are declared.
 */
export interface RawDatabase {
  exec(sql: string): void;
  close(): void;
}

export type ArenaDatabase = BaseSQLiteDatabase<"sync", void, typeof schema>;

export interface ArenaDb {
  /** Drizzle ORM instance for typed queries */
  orm: ArenaDatabase;
  /** Raw sqlite instance for transactions and pragmas */
  sqlite: RawDatabase;
}

const isBun = typeof globalThis.Bun !== "undefined";

function openDatabase(dbPath: string): ArenaDb {
  mkdirSync(dirname(dbPath), { recursive: true });

  let sqlite: RawDatabase;
  let orm: ArenaDatabase;

  if (isBun) {
    // Dynamic require to avoid bundler static analysis (Next.js/Turbopack)
    const { Database } = require("bun:sqlite");
    const { drizzle } = require("drizzle-orm/bun-sqlite");
    sqlite = new Database(dbPath);
    orm = drizzle(sqlite, { schema });
  } else {
    const Database = require("better-sqlite3");
    const { drizzle } = require("drizzle-orm/better-sqlite3");
    sqlite = new Database(dbPath);
    orm = drizzle(sqlite, { schema });
  }

  sqlite.exec("PRAGMA journal_mode = WAL");
  sqlite.exec("PRAGMA foreign_keys = ON");

  return { orm, sqlite };
}

export function createDatabase(dbPath: string = DEFAULT_DB_PATH): ArenaDb {
  return openDatabase(dbPath);
}

export function initSchema(dbPath: string = DEFAULT_DB_PATH) {
  mkdirSync(dirname(dbPath), { recursive: true });

  let sqlite: RawDatabase;

  if (isBun) {
    const { Database } = require("bun:sqlite");
    sqlite = new Database(dbPath);
  } else {
    const Database = require("better-sqlite3");
    sqlite = new Database(dbPath);
  }

  sqlite.exec("PRAGMA journal_mode = WAL");
  sqlite.exec("PRAGMA foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      branch TEXT,
      title TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS opinions (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL REFERENCES topics(id),
      agent_name TEXT NOT NULL,
      model TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL REFERENCES topics(id),
      opinion_id TEXT REFERENCES opinions(id),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  sqlite.close();
}

export { schema };

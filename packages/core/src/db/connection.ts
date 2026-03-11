import { dirname } from "node:path";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync } from "node:fs";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema.js";

const ARENA_DIR = join(homedir(), ".arena");
const DEFAULT_DB_PATH = join(ARENA_DIR, "arena.db");

export type ArenaDatabase = ReturnType<typeof drizzle<typeof schema>>;

export interface ArenaDb {
  /** Drizzle ORM instance for typed queries */
  orm: ArenaDatabase;
  /** Raw bun:sqlite instance for transactions and pragmas */
  sqlite: Database;
}

export function createDatabase(dbPath: string = DEFAULT_DB_PATH): ArenaDb {
  // dirname() always returns a non-empty string (at minimum ".")
  mkdirSync(dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);

  // Enable WAL mode for concurrent reads
  sqlite.exec("PRAGMA journal_mode = WAL");
  // Enable foreign keys
  sqlite.exec("PRAGMA foreign_keys = ON");

  const orm = drizzle(sqlite, { schema });

  return { orm, sqlite };
}

export function initSchema(dbPath: string = DEFAULT_DB_PATH) {
  // dirname() always returns a non-empty string (at minimum ".")
  mkdirSync(dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
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

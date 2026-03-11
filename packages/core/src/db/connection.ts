import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const ARENA_DIR = join(homedir(), ".arena");
const DEFAULT_DB_PATH = join(ARENA_DIR, "arena.db");

export type ArenaDatabase = ReturnType<typeof createDatabase>;

export function createDatabase(dbPath: string = DEFAULT_DB_PATH) {
  // Ensure directory exists
  const dir = dbPath.substring(0, dbPath.lastIndexOf("/"));
  if (dir) {
    mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(dbPath);

  // Enable WAL mode for concurrent reads
  sqlite.pragma("journal_mode = WAL");
  // Enable foreign keys
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  return db;
}

export function initSchema(dbPath: string = DEFAULT_DB_PATH) {
  const dir = dbPath.substring(0, dbPath.lastIndexOf("/"));
  if (dir) {
    mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

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

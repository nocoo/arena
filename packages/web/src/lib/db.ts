import { createDatabase, initSchema } from "@arena/core";
import { join } from "node:path";
import { homedir } from "node:os";

const dbPath = join(homedir(), ".arena", "arena.db");

let dbInstance: ReturnType<typeof createDatabase> | null = null;

export function getDb() {
  if (!dbInstance) {
    initSchema(dbPath);
    dbInstance = createDatabase(dbPath);
  }
  return dbInstance;
}

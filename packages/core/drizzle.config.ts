import { defineConfig } from "drizzle-kit";
import { join } from "node:path";
import { homedir } from "node:os";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: join(homedir(), ".arena", "arena.db"),
  },
});

import { resolve } from "node:path";
import {
  createDatabase,
  initSchema,
  pop as corePop,
} from "@arena/core";
import { detectBranch } from "../utils.js";

export interface PopOptions {
  project?: string;
  branch?: string;
}

export function popCommand(options: PopOptions): void {
  // Resolve project path
  const projectPath = options.project
    ? resolve(options.project)
    : process.cwd();

  // Resolve branch
  const branch: string | null =
    options.branch !== undefined ? options.branch : detectBranch(projectPath);

  try {
    initSchema();
    const db = createDatabase();

    const result = corePop(db, { projectPath, branch });

    process.stdout.write(JSON.stringify(result, null, 2) + "\n");

    if (!result.ok) {
      process.exitCode = 1;
    }
  } catch (err) {
    process.stdout.write(
      JSON.stringify(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        null,
        2,
      ) + "\n",
    );
    process.exitCode = 1;
  }
}

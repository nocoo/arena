import { resolve } from "node:path";
import {
  createDatabase,
  initSchema,
  status as coreStatus,
} from "@arena/core";
import { detectBranch } from "../utils.js";

export interface StatusOptions {
  project?: string;
  branch?: string;
}

export function statusCommand(options: StatusOptions): void {
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

    const result = coreStatus(db, { projectPath, branch });

    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
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

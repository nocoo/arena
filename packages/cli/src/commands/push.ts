import { resolve } from "node:path";
import {
  createDatabase,
  initSchema,
  push as corePush,
} from "@arena/core";
import { detectBranch, readStdin } from "../utils.js";

export interface PushOptions {
  agent: string;
  model: string;
  content?: string;
  project?: string;
  branch?: string;
}

export async function pushCommand(options: PushOptions): Promise<void> {
  // Validate required params
  if (!options.agent) {
    outputError('Missing required parameter: --agent');
    process.exitCode = 1;
    return;
  }

  if (!options.model) {
    outputError('Missing required parameter: --model');
    process.exitCode = 1;
    return;
  }

  // Resolve content: --content flag or stdin
  let content = options.content ?? null;
  if (!content) {
    content = await readStdin();
  }

  if (!content) {
    outputError('Missing required parameter: --content (or pipe via stdin)');
    process.exitCode = 1;
    return;
  }

  // Resolve project path
  const projectPath = options.project
    ? resolve(options.project)
    : process.cwd();

  // Resolve branch
  const branch: string | null =
    options.branch !== undefined ? options.branch : detectBranch(projectPath);

  try {
    // Ensure DB exists
    initSchema();

    const db = createDatabase();

    const result = corePush(db, {
      agentName: options.agent,
      model: options.model,
      content,
      projectPath,
      branch,
    });

    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (err) {
    outputError(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

function outputError(message: string): void {
  process.stdout.write(
    JSON.stringify({ ok: false, error: message }, null, 2) + "\n",
  );
}

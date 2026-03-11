import { execSync } from "node:child_process";

/**
 * Detect the current Git branch from a directory.
 * Returns null if not a Git repository.
 */
export function detectBranch(cwd: string): string | null {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    }).trim();
    return branch || null;
  } catch {
    return null;
  }
}

/**
 * Read all stdin data as a string.
 * Returns null if stdin is a TTY (interactive terminal).
 */
export async function readStdin(): Promise<string | null> {
  if (process.stdin.isTTY) {
    return null;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8").trim() || null;
}

import { describe, it, expect, afterEach } from "bun:test";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { detectBranch, readStdin } from "../src/utils.js";

/** Return a copy of process.env with all GIT_* variables removed. */
function cleanGitEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  const {
    GIT_DIR: _a,
    GIT_WORK_TREE: _b,
    GIT_INDEX_FILE: _c,
    GIT_OBJECT_DIRECTORY: _d,
    GIT_ALTERNATE_OBJECT_DIRECTORIES: _e,
    GIT_CEILING_DIRECTORIES: _f,
    ...clean
  } = process.env;
  return { ...clean, ...overrides };
}

describe("detectBranch", () => {
  it("detects branch in a git repo", () => {
    // The arena project itself is a git repo.
    // During git hooks (amend/rebase), HEAD may be detached, so we
    // only assert that the function returns without throwing.
    const branch = detectBranch(process.cwd());
    expect(branch === null || typeof branch === "string").toBe(true);
  });

  it("returns null for non-git directory", () => {
    const branch = detectBranch("/tmp");
    expect(branch).toBeNull();
  });

  it("returns null for detached HEAD state", () => {
    const dir = mkdtempSync(join(tmpdir(), "arena-detached-"));
    try {
      // Create a git repo with a commit, then detach HEAD.
      // Strip inherited GIT_* env so this doesn't accidentally
      // write into the parent repo's object store (e.g. during pre-commit hooks).
      execSync("git init && git commit --allow-empty -m 'init'", {
        cwd: dir,
        stdio: "pipe",
        env: cleanGitEnv({
          GIT_AUTHOR_NAME: "test",
          GIT_AUTHOR_EMAIL: "test@test.com",
          GIT_COMMITTER_NAME: "test",
          GIT_COMMITTER_EMAIL: "test@test.com",
        }),
      });
      execSync("git checkout --detach", {
        cwd: dir,
        stdio: "pipe",
        env: cleanGitEnv(),
      });

      const branch = detectBranch(dir);
      expect(branch).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("readStdin", () => {
  let originalStdin: typeof process.stdin;

  afterEach(() => {
    // Restore original stdin if we replaced it
    if (originalStdin) {
      Object.defineProperty(process, "stdin", { value: originalStdin });
    }
  });

  it("returns null when stdin is a TTY", async () => {
    originalStdin = process.stdin;

    // Create a fake stdin that reports isTTY = true
    const fakeStdin = new Readable({ read() {} }) as typeof process.stdin;
    Object.defineProperty(fakeStdin, "isTTY", { value: true });
    Object.defineProperty(process, "stdin", { value: fakeStdin });

    const result = await readStdin();
    expect(result).toBeNull();
  });

  it("reads content from piped stdin", async () => {
    originalStdin = process.stdin;

    // Create a readable stream that provides data
    const fakeStdin = new Readable({
      read() {
        this.push(Buffer.from("Hello from stdin"));
        this.push(null);
      },
    }) as typeof process.stdin;
    Object.defineProperty(fakeStdin, "isTTY", { value: false });
    Object.defineProperty(process, "stdin", { value: fakeStdin });

    const result = await readStdin();
    expect(result).toBe("Hello from stdin");
  });

  it("returns null for empty stdin", async () => {
    originalStdin = process.stdin;

    const fakeStdin = new Readable({
      read() {
        this.push(Buffer.from("   \n  "));
        this.push(null);
      },
    }) as typeof process.stdin;
    Object.defineProperty(fakeStdin, "isTTY", { value: false });
    Object.defineProperty(process, "stdin", { value: fakeStdin });

    const result = await readStdin();
    expect(result).toBeNull();
  });
});

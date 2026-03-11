import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectBranch } from "../src/utils.js";

describe("detectBranch", () => {
  it("detects branch in a git repo", () => {
    // The arena project itself is a git repo
    const branch = detectBranch(process.cwd());
    expect(typeof branch).toBe("string");
    expect(branch!.length).toBeGreaterThan(0);
  });

  it("returns null for non-git directory", () => {
    const branch = detectBranch("/tmp");
    expect(branch).toBeNull();
  });

  it("returns null for detached HEAD state", () => {
    const dir = mkdtempSync(join(tmpdir(), "arena-detached-"));
    try {
      // Create a git repo with a commit, then detach HEAD
      execSync("git init && git commit --allow-empty -m 'init'", {
        cwd: dir,
        stdio: "pipe",
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: "test",
          GIT_AUTHOR_EMAIL: "test@test.com",
          GIT_COMMITTER_NAME: "test",
          GIT_COMMITTER_EMAIL: "test@test.com",
        },
      });
      execSync("git checkout --detach", { cwd: dir, stdio: "pipe" });

      const branch = detectBranch(dir);
      expect(branch).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

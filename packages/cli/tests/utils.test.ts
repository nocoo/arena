import { describe, it, expect } from "vitest";
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
});

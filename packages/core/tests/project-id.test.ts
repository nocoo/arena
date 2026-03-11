import { describe, it, expect } from "bun:test";
import { deriveProjectId, deriveProjectName } from "../src/services/project-id.js";

describe("deriveProjectId", () => {
  it("converts Unix path to project id", () => {
    expect(deriveProjectId("/Users/nocoo/workspace/personal/arena")).toBe(
      "users-nocoo-workspace-personal-arena",
    );
  });

  it("converts another Unix path", () => {
    expect(deriveProjectId("/Users/nocoo/workspace/work/studio")).toBe(
      "users-nocoo-workspace-work-studio",
    );
  });

  it("converts Windows path to project id", () => {
    expect(deriveProjectId("C:\\Users\\dev\\projects\\app")).toBe(
      "c-users-dev-projects-app",
    );
  });

  it("handles mixed separators", () => {
    expect(deriveProjectId("/foo\\bar/baz")).toBe("foo-bar-baz");
  });

  it("converts to lowercase", () => {
    expect(deriveProjectId("/Users/FOO/Bar")).toBe("users-foo-bar");
  });

  it("strips leading dashes", () => {
    expect(deriveProjectId("/path")).toBe("path");
  });
});

describe("deriveProjectName", () => {
  it("extracts last segment of Unix path", () => {
    expect(deriveProjectName("/Users/nocoo/workspace/personal/arena")).toBe(
      "arena",
    );
  });

  it("extracts last segment of Windows path", () => {
    expect(deriveProjectName("C:\\Users\\dev\\projects\\app")).toBe("app");
  });

  it("handles single segment", () => {
    expect(deriveProjectName("myproject")).toBe("myproject");
  });

  it("returns input when no segments found (empty string)", () => {
    expect(deriveProjectName("")).toBe("");
  });
});

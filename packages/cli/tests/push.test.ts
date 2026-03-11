import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CLI_PATH = join(__dirname, "../dist/index.js");

function runCli(
  args: string,
  options?: { input?: string; env?: Record<string, string>; cwd?: string },
): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${args}`, {
      encoding: "utf-8",
      input: options?.input,
      env: {
        ...process.env,
        ...options?.env,
        // Use temp DB to avoid polluting real data
        HOME: options?.env?.HOME ?? process.env.HOME,
      },
      cwd: options?.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; status?: number };
    return {
      stdout: e.stdout ?? "",
      exitCode: e.status ?? 1,
    };
  }
}

describe("arena push", () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = mkdtempSync(join(tmpdir(), "arena-cli-test-"));
  });

  afterEach(() => {
    rmSync(tmpHome, { recursive: true, force: true });
  });

  it("succeeds with --content flag", () => {
    const { stdout, exitCode } = runCli(
      'push --agent "OpenCode" --model "Claude Opus 4.6" --content "Test opinion"',
      { env: { HOME: tmpHome } },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(result.opinion_id).toBeTruthy();
    expect(result.topic_id).toBeTruthy();
    expect(result.project_id).toBeTruthy();
    expect(result.message).toContain("Opinion submitted");
  });

  it("succeeds with stdin pipe", () => {
    const { stdout, exitCode } = runCli(
      'push --agent "Cursor" --model "GPT-4o"',
      {
        input: "# My Opinion\n\nI think we should use approach B.",
        env: { HOME: tmpHome },
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
  });

  it("fails without --agent", () => {
    const { exitCode } = runCli(
      'push --model "GPT-4o" --content "test"',
      { env: { HOME: tmpHome } },
    );

    // Commander exits with code 1 for missing required options
    expect(exitCode).not.toBe(0);
  });

  it("fails without --model", () => {
    const { exitCode } = runCli(
      'push --agent "OpenCode" --content "test"',
      { env: { HOME: tmpHome } },
    );

    expect(exitCode).not.toBe(0);
  });

  it("reuses topic for same project + branch on same day", () => {
    const { stdout: s1 } = runCli(
      'push --agent "OpenCode" --model "Claude" --content "Opinion 1"',
      { env: { HOME: tmpHome } },
    );
    const { stdout: s2 } = runCli(
      'push --agent "Cursor" --model "GPT-4o" --content "Opinion 2"',
      { env: { HOME: tmpHome } },
    );

    const r1 = JSON.parse(s1);
    const r2 = JSON.parse(s2);

    expect(r1.topic_id).toBe(r2.topic_id);
    expect(r1.opinion_id).not.toBe(r2.opinion_id);
  });

  it("uses explicit --project override", () => {
    const { stdout, exitCode } = runCli(
      'push --agent "Test" --model "Test" --content "test" --project /tmp/fake-project',
      { env: { HOME: tmpHome } },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.project_id).toBe("tmp-fake-project");
  });

  it("uses explicit --branch override", () => {
    const { stdout, exitCode } = runCli(
      'push --agent "Test" --model "Test" --content "test" --branch feat/custom',
      { env: { HOME: tmpHome } },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.message).toContain("feat/custom");
  });
});

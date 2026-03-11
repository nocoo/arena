import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CLI_PATH = join(__dirname, "../dist/index.js");

function runCli(
  args: string,
  options?: { input?: string; env?: Record<string, string> },
): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`bun ${CLI_PATH} ${args}`, {
      encoding: "utf-8",
      input: options?.input,
      env: { ...process.env, ...options?.env },
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

describe("arena pop", () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = mkdtempSync(join(tmpdir(), "arena-cli-test-"));
  });

  afterEach(() => {
    rmSync(tmpHome, { recursive: true, force: true });
  });

  it("returns no_topic when no topic exists", () => {
    const { stdout, exitCode } = runCli(
      "pop --project /tmp/nonexistent --branch test",
      { env: { HOME: tmpHome } },
    );

    expect(exitCode).toBe(1);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("no_topic");
  });

  it("returns pending when topic has opinions but no checkpoint", () => {
    // First push an opinion
    runCli(
      'push --agent "Test" --model "Test" --content "Opinion" --branch main --project /tmp/test-pop',
      { env: { HOME: tmpHome } },
    );

    // Then pop
    const { stdout, exitCode } = runCli(
      "pop --branch main --project /tmp/test-pop",
      { env: { HOME: tmpHome } },
    );

    expect(exitCode).toBe(1);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("pending");
    expect(result.opinions_count).toBe(1);
  });

  it("is idempotent — multiple pops return same result", () => {
    runCli(
      'push --agent "Test" --model "Test" --content "Opinion" --branch main --project /tmp/test-idem',
      { env: { HOME: tmpHome } },
    );

    const { stdout: s1 } = runCli(
      "pop --branch main --project /tmp/test-idem",
      { env: { HOME: tmpHome } },
    );
    const { stdout: s2 } = runCli(
      "pop --branch main --project /tmp/test-idem",
      { env: { HOME: tmpHome } },
    );

    expect(JSON.parse(s1)).toEqual(JSON.parse(s2));
  });
});

describe("arena status", () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = mkdtempSync(join(tmpdir(), "arena-cli-test-"));
  });

  afterEach(() => {
    rmSync(tmpHome, { recursive: true, force: true });
  });

  it("returns null topic when no data exists", () => {
    const { stdout, exitCode } = runCli(
      "status --project /tmp/empty-project --branch main",
      { env: { HOME: tmpHome } },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(result.project.id).toBe("tmp-empty-project");
    expect(result.topic).toBeNull();
  });

  it("shows opinions after push", () => {
    runCli(
      'push --agent "OpenCode" --model "Claude" --content "First opinion" --branch main --project /tmp/status-test',
      { env: { HOME: tmpHome } },
    );
    runCli(
      'push --agent "Cursor" --model "GPT-4o" --content "Second opinion" --branch main --project /tmp/status-test',
      { env: { HOME: tmpHome } },
    );

    const { stdout, exitCode } = runCli(
      "status --branch main --project /tmp/status-test",
      { env: { HOME: tmpHome } },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(result.topic).not.toBeNull();
    expect(result.topic.opinions).toHaveLength(2);
    expect(result.topic.opinions[0].agent_name).toBe("OpenCode");
    expect(result.topic.opinions[1].agent_name).toBe("Cursor");
    expect(result.topic.latest_checkpoint).toBeNull();
  });

  it("shows opinions in chronological order", () => {
    runCli(
      'push --agent "A" --model "M" --content "1st" --branch main --project /tmp/chrono-test',
      { env: { HOME: tmpHome } },
    );
    runCli(
      'push --agent "B" --model "M" --content "2nd" --branch main --project /tmp/chrono-test',
      { env: { HOME: tmpHome } },
    );
    runCli(
      'push --agent "C" --model "M" --content "3rd" --branch main --project /tmp/chrono-test',
      { env: { HOME: tmpHome } },
    );

    const { stdout } = runCli(
      "status --branch main --project /tmp/chrono-test",
      { env: { HOME: tmpHome } },
    );

    const result = JSON.parse(stdout);
    const agents = result.topic.opinions.map(
      (o: { agent_name: string }) => o.agent_name,
    );
    expect(agents).toEqual(["A", "B", "C"]);
  });
});

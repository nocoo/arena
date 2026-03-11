import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PushResult } from "@arena/core";

// Mock @arena/core before importing the command
vi.mock("@arena/core", () => ({
  createDatabase: vi.fn(() => "mock-db"),
  initSchema: vi.fn(),
  push: vi.fn(),
}));

// Mock utils
vi.mock("../src/utils.js", () => ({
  detectBranch: vi.fn(() => "main"),
  readStdin: vi.fn(() => Promise.resolve(null)),
}));

import { pushCommand } from "../src/commands/push.js";
import { push as corePush, initSchema, createDatabase } from "@arena/core";
import { detectBranch, readStdin } from "../src/utils.js";

const mockedPush = vi.mocked(corePush);
const mockedInitSchema = vi.mocked(initSchema);
const mockedCreateDatabase = vi.mocked(createDatabase);
const mockedDetectBranch = vi.mocked(detectBranch);
const mockedReadStdin = vi.mocked(readStdin);

describe("pushCommand (unit)", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  const fakePushResult: PushResult = {
    ok: true,
    opinion_id: "opinion-123",
    topic_id: "topic-456",
    project_id: "test-project",
    message: "Opinion submitted to topic on branch main",
  };

  it("succeeds with --content flag", async () => {
    mockedPush.mockReturnValue(fakePushResult);

    await pushCommand({
      agent: "OpenCode",
      model: "Claude Opus 4.6",
      content: "Test opinion",
    });

    expect(mockedInitSchema).toHaveBeenCalled();
    expect(mockedCreateDatabase).toHaveBeenCalled();
    expect(mockedPush).toHaveBeenCalledWith("mock-db", {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "Test opinion",
      projectPath: process.cwd(),
      branch: "main",
    });
    expect(process.exitCode).toBeUndefined();

    const output = JSON.parse(
      (stdoutSpy.mock.calls[0]![0] as string).trim(),
    );
    expect(output.ok).toBe(true);
    expect(output.opinion_id).toBe("opinion-123");
  });

  it("reads from stdin when --content is omitted", async () => {
    mockedReadStdin.mockResolvedValue("Stdin opinion content");
    mockedPush.mockReturnValue(fakePushResult);

    await pushCommand({ agent: "Cursor", model: "GPT-4o" });

    expect(mockedReadStdin).toHaveBeenCalled();
    expect(mockedPush).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ content: "Stdin opinion content" }),
    );
    expect(process.exitCode).toBeUndefined();
  });

  it("fails without agent", async () => {
    await pushCommand({ agent: "", model: "GPT-4o", content: "test" });

    expect(process.exitCode).toBe(1);
    const output = JSON.parse(
      (stdoutSpy.mock.calls[0]![0] as string).trim(),
    );
    expect(output.ok).toBe(false);
    expect(output.error).toContain("--agent");
  });

  it("fails without model", async () => {
    await pushCommand({ agent: "OpenCode", model: "", content: "test" });

    expect(process.exitCode).toBe(1);
    const output = JSON.parse(
      (stdoutSpy.mock.calls[0]![0] as string).trim(),
    );
    expect(output.ok).toBe(false);
    expect(output.error).toContain("--model");
  });

  it("fails without content or stdin", async () => {
    mockedReadStdin.mockResolvedValue(null);

    await pushCommand({ agent: "OpenCode", model: "Claude" });

    expect(process.exitCode).toBe(1);
    const output = JSON.parse(
      (stdoutSpy.mock.calls[0]![0] as string).trim(),
    );
    expect(output.ok).toBe(false);
    expect(output.error).toContain("--content");
  });

  it("uses explicit --project override", async () => {
    mockedPush.mockReturnValue(fakePushResult);

    await pushCommand({
      agent: "Test",
      model: "Test",
      content: "test",
      project: "/tmp/fake-project",
    });

    expect(mockedPush).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ projectPath: "/tmp/fake-project" }),
    );
  });

  it("uses explicit --branch override", async () => {
    mockedPush.mockReturnValue(fakePushResult);

    await pushCommand({
      agent: "Test",
      model: "Test",
      content: "test",
      branch: "feat/custom",
    });

    expect(mockedDetectBranch).not.toHaveBeenCalled();
    expect(mockedPush).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ branch: "feat/custom" }),
    );
  });

  it("auto-detects branch when --branch is not provided", async () => {
    mockedDetectBranch.mockReturnValue("develop");
    mockedPush.mockReturnValue(fakePushResult);

    await pushCommand({
      agent: "Test",
      model: "Test",
      content: "test",
    });

    expect(mockedDetectBranch).toHaveBeenCalledWith(process.cwd());
    expect(mockedPush).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ branch: "develop" }),
    );
  });

  it("handles core push throwing an error", async () => {
    mockedPush.mockImplementation(() => {
      throw new Error("database locked");
    });

    await pushCommand({
      agent: "Test",
      model: "Test",
      content: "test",
    });

    expect(process.exitCode).toBe(1);
    const output = JSON.parse(
      (stdoutSpy.mock.calls[0]![0] as string).trim(),
    );
    expect(output.ok).toBe(false);
    expect(output.error).toBe("database locked");
  });

  it("handles non-Error throw", async () => {
    mockedPush.mockImplementation(() => {
      throw "string error";
    });

    await pushCommand({
      agent: "Test",
      model: "Test",
      content: "test",
    });

    expect(process.exitCode).toBe(1);
    const output = JSON.parse(
      (stdoutSpy.mock.calls[0]![0] as string).trim(),
    );
    expect(output.ok).toBe(false);
    expect(output.error).toBe("string error");
  });
});

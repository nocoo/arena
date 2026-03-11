import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from "bun:test";
import type { Mock } from "bun:test";
import type { PushResult } from "@arena/core";

// Mock @arena/core before importing the command
const mockPush = mock(() => {}) as Mock<(...args: unknown[]) => unknown>;
const mockInitSchema = mock(() => {});
const mockCreateDatabase = mock(() => "mock-db");

mock.module("@arena/core", () => ({
  createDatabase: mockCreateDatabase,
  initSchema: mockInitSchema,
  push: mockPush,
}));

// Mock utils
const mockDetectBranch = mock(() => "main") as Mock<(...args: unknown[]) => string | null>;
const mockReadStdin = mock(() => Promise.resolve(null)) as Mock<(...args: unknown[]) => Promise<string | null>>;

mock.module("../src/utils.js", () => ({
  detectBranch: mockDetectBranch,
  readStdin: mockReadStdin,
}));

const { pushCommand } = await import("../src/commands/push.js");

describe("pushCommand (unit)", () => {
  let stdoutSpy: ReturnType<typeof spyOn>;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    mockPush.mockReset();
    mockInitSchema.mockReset();
    mockCreateDatabase.mockReset();
    mockDetectBranch.mockReset();
    mockReadStdin.mockReset();

    mockCreateDatabase.mockReturnValue("mock-db");
    mockDetectBranch.mockReturnValue("main");
    mockReadStdin.mockReturnValue(Promise.resolve(null));

    stdoutSpy = spyOn(process.stdout, "write").mockReturnValue(true);
    originalExitCode = process.exitCode;
    process.exitCode = 0;
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
    mockPush.mockReturnValue(fakePushResult);

    await pushCommand({
      agent: "OpenCode",
      model: "Claude Opus 4.6",
      content: "Test opinion",
    });

    expect(mockInitSchema).toHaveBeenCalled();
    expect(mockCreateDatabase).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("mock-db", {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "Test opinion",
      projectPath: process.cwd(),
      branch: "main",
    });
    expect(process.exitCode).toBe(0);

    const output = JSON.parse(
      (stdoutSpy.mock.calls[0]![0] as string).trim(),
    );
    expect(output.ok).toBe(true);
    expect(output.opinion_id).toBe("opinion-123");
  });

  it("reads from stdin when --content is omitted", async () => {
    mockReadStdin.mockResolvedValue("Stdin opinion content");
    mockPush.mockReturnValue(fakePushResult);

    await pushCommand({ agent: "Cursor", model: "GPT-4o" });

    expect(mockReadStdin).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ content: "Stdin opinion content" }),
    );
    expect(process.exitCode).toBe(0);
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
    mockReadStdin.mockResolvedValue(null);

    await pushCommand({ agent: "OpenCode", model: "Claude" });

    expect(process.exitCode).toBe(1);
    const output = JSON.parse(
      (stdoutSpy.mock.calls[0]![0] as string).trim(),
    );
    expect(output.ok).toBe(false);
    expect(output.error).toContain("--content");
  });

  it("uses explicit --project override", async () => {
    mockPush.mockReturnValue(fakePushResult);

    await pushCommand({
      agent: "Test",
      model: "Test",
      content: "test",
      project: "/tmp/fake-project",
    });

    expect(mockPush).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ projectPath: "/tmp/fake-project" }),
    );
  });

  it("uses explicit --branch override", async () => {
    mockPush.mockReturnValue(fakePushResult);

    await pushCommand({
      agent: "Test",
      model: "Test",
      content: "test",
      branch: "feat/custom",
    });

    expect(mockDetectBranch).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ branch: "feat/custom" }),
    );
  });

  it("auto-detects branch when --branch is not provided", async () => {
    mockDetectBranch.mockReturnValue("develop");
    mockPush.mockReturnValue(fakePushResult);

    await pushCommand({
      agent: "Test",
      model: "Test",
      content: "test",
    });

    expect(mockDetectBranch).toHaveBeenCalledWith(process.cwd());
    expect(mockPush).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ branch: "develop" }),
    );
  });

  it("handles core push throwing an error", async () => {
    mockPush.mockImplementation(() => {
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
    mockPush.mockImplementation(() => {
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

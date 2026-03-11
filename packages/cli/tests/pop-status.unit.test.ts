import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from "bun:test";
import type { Mock } from "bun:test";
import type { PopResult, StatusResult } from "@arena/core";

// Mock @arena/core before importing commands
const mockPop = mock(() => {}) as Mock<(...args: unknown[]) => unknown>;
const mockStatus = mock(() => {}) as Mock<(...args: unknown[]) => unknown>;
const mockInitSchema = mock(() => {});
const mockCreateDatabase = mock(() => "mock-db");

mock.module("@arena/core", () => ({
  createDatabase: mockCreateDatabase,
  initSchema: mockInitSchema,
  pop: mockPop,
  status: mockStatus,
}));

// Mock utils
const mockDetectBranch = mock(() => "main") as Mock<(...args: unknown[]) => string | null>;

mock.module("../src/utils.js", () => ({
  detectBranch: mockDetectBranch,
}));

const { popCommand } = await import("../src/commands/pop.js");
const { statusCommand } = await import("../src/commands/status.js");

describe("popCommand (unit)", () => {
  let stdoutSpy: ReturnType<typeof spyOn>;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    mockPop.mockReset();
    mockStatus.mockReset();
    mockInitSchema.mockReset();
    mockCreateDatabase.mockReset();
    mockDetectBranch.mockReset();

    mockCreateDatabase.mockReturnValue("mock-db");
    mockDetectBranch.mockReturnValue("main");

    stdoutSpy = spyOn(process.stdout, "write").mockReturnValue(true);
    originalExitCode = process.exitCode;
    process.exitCode = 0;
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    process.exitCode = originalExitCode ?? 0;
  });

  it("returns checkpoint when available", () => {
    const fakeResult: PopResult = {
      ok: true,
      checkpoint: {
        id: "cp-1",
        topic_id: "topic-1",
        content: { decision: "Use approach A" },
        opinion_id: "op-1",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    };
    mockPop.mockReturnValue(fakeResult);

    popCommand({});

    expect(mockInitSchema).toHaveBeenCalled();
    expect(mockCreateDatabase).toHaveBeenCalled();
    expect(mockPop).toHaveBeenCalledWith("mock-db", {
      projectPath: process.cwd(),
      branch: "main",
    });
    expect(process.exitCode).toBe(0);

    const output = JSON.parse(
      (stdoutSpy.mock.calls[0]![0] as string).trim(),
    );
    expect(output.ok).toBe(true);
    expect(output.checkpoint.id).toBe("cp-1");
  });

  it("returns no_topic when no topic exists", () => {
    const fakeResult: PopResult = {
      ok: false,
      status: "no_topic",
      message: "No active topic found",
    };
    mockPop.mockReturnValue(fakeResult);

    popCommand({ project: "/tmp/nonexistent", branch: "test" });

    expect(process.exitCode).toBe(1);
    const output = JSON.parse(
      (stdoutSpy.mock.calls[0]![0] as string).trim(),
    );
    expect(output.ok).toBe(false);
    expect(output.status).toBe("no_topic");
  });

  it("returns pending when opinions exist but no checkpoint", () => {
    const fakeResult: PopResult = {
      ok: false,
      status: "pending",
      topic_id: "topic-1",
      opinions_count: 2,
      message: "Topic has 2 opinions but no checkpoint yet",
    };
    mockPop.mockReturnValue(fakeResult);

    popCommand({});

    expect(process.exitCode).toBe(1);
    const output = JSON.parse(
      (stdoutSpy.mock.calls[0]![0] as string).trim(),
    );
    expect(output.ok).toBe(false);
    expect(output.status).toBe("pending");
    expect(output.opinions_count).toBe(2);
  });

  it("uses explicit --project override", () => {
    mockPop.mockReturnValue({
      ok: false,
      status: "no_topic",
      message: "No active topic found",
    });

    popCommand({ project: "/tmp/my-project" });

    expect(mockPop).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ projectPath: "/tmp/my-project" }),
    );
  });

  it("uses explicit --branch override", () => {
    mockPop.mockReturnValue({
      ok: false,
      status: "no_topic",
      message: "No active topic found",
    });

    popCommand({ branch: "feat/test" });

    expect(mockDetectBranch).not.toHaveBeenCalled();
    expect(mockPop).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ branch: "feat/test" }),
    );
  });

  it("auto-detects branch when not provided", () => {
    mockDetectBranch.mockReturnValue("develop");
    mockPop.mockReturnValue({
      ok: false,
      status: "no_topic",
      message: "No active topic found",
    });

    popCommand({});

    expect(mockDetectBranch).toHaveBeenCalledWith(process.cwd());
    expect(mockPop).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ branch: "develop" }),
    );
  });

  it("handles core pop throwing an Error", () => {
    mockPop.mockImplementation(() => {
      throw new Error("database locked");
    });

    popCommand({});

    expect(process.exitCode).toBe(1);
    const output = JSON.parse(
      (stdoutSpy.mock.calls[0]![0] as string).trim(),
    );
    expect(output.ok).toBe(false);
    expect(output.error).toBe("database locked");
  });

  it("handles core pop throwing a non-Error", () => {
    mockPop.mockImplementation(() => {
      throw "string error";
    });

    popCommand({});

    expect(process.exitCode).toBe(1);
    const output = JSON.parse(
      (stdoutSpy.mock.calls[0]![0] as string).trim(),
    );
    expect(output.ok).toBe(false);
    expect(output.error).toBe("string error");
  });
});

describe("statusCommand (unit)", () => {
  let stdoutSpy: ReturnType<typeof spyOn>;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    mockPop.mockReset();
    mockStatus.mockReset();
    mockInitSchema.mockReset();
    mockCreateDatabase.mockReset();
    mockDetectBranch.mockReset();

    mockCreateDatabase.mockReturnValue("mock-db");
    mockDetectBranch.mockReturnValue("main");

    stdoutSpy = spyOn(process.stdout, "write").mockReturnValue(true);
    originalExitCode = process.exitCode;
    process.exitCode = 0;
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    process.exitCode = originalExitCode ?? 0;
  });

  const fakeStatusResult: StatusResult = {
    ok: true,
    project: { id: "test-project", name: "test-project" },
    topic: null,
  };

  it("returns status with no topic", () => {
    mockStatus.mockReturnValue(fakeStatusResult);

    statusCommand({});

    expect(mockInitSchema).toHaveBeenCalled();
    expect(mockCreateDatabase).toHaveBeenCalled();
    expect(mockStatus).toHaveBeenCalledWith("mock-db", {
      projectPath: process.cwd(),
      branch: "main",
    });
    expect(process.exitCode).toBe(0);

    const output = JSON.parse(
      (stdoutSpy.mock.calls[0]![0] as string).trim(),
    );
    expect(output.ok).toBe(true);
    expect(output.topic).toBeNull();
  });

  it("returns status with topic and opinions", () => {
    const resultWithTopic: StatusResult = {
      ok: true,
      project: { id: "test-project", name: "test-project" },
      topic: {
        id: "topic-1",
        branch: "main",
        created_at: "2026-01-01T00:00:00.000Z",
        opinions: [
          {
            id: "op-1",
            agent_name: "OpenCode",
            model: "Claude",
            content: "My opinion",
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        latest_checkpoint: null,
      },
    };
    mockStatus.mockReturnValue(resultWithTopic);

    statusCommand({});

    const output = JSON.parse(
      (stdoutSpy.mock.calls[0]![0] as string).trim(),
    );
    expect(output.ok).toBe(true);
    expect(output.topic.opinions).toHaveLength(1);
    expect(output.topic.opinions[0].agent_name).toBe("OpenCode");
  });

  it("uses explicit --project override", () => {
    mockStatus.mockReturnValue(fakeStatusResult);

    statusCommand({ project: "/tmp/my-project" });

    expect(mockStatus).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ projectPath: "/tmp/my-project" }),
    );
  });

  it("uses explicit --branch override", () => {
    mockStatus.mockReturnValue(fakeStatusResult);

    statusCommand({ branch: "feat/test" });

    expect(mockDetectBranch).not.toHaveBeenCalled();
    expect(mockStatus).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ branch: "feat/test" }),
    );
  });

  it("auto-detects branch when not provided", () => {
    mockDetectBranch.mockReturnValue("develop");
    mockStatus.mockReturnValue(fakeStatusResult);

    statusCommand({});

    expect(mockDetectBranch).toHaveBeenCalledWith(process.cwd());
    expect(mockStatus).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ branch: "develop" }),
    );
  });

  it("handles core status throwing an Error", () => {
    mockStatus.mockImplementation(() => {
      throw new Error("database corrupted");
    });

    statusCommand({});

    expect(process.exitCode).toBe(1);
    const output = JSON.parse(
      (stdoutSpy.mock.calls[0]![0] as string).trim(),
    );
    expect(output.ok).toBe(false);
    expect(output.error).toBe("database corrupted");
  });

  it("handles core status throwing a non-Error", () => {
    mockStatus.mockImplementation(() => {
      throw 42;
    });

    statusCommand({});

    expect(process.exitCode).toBe(1);
    const output = JSON.parse(
      (stdoutSpy.mock.calls[0]![0] as string).trim(),
    );
    expect(output.ok).toBe(false);
    expect(output.error).toBe("42");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PopResult, StatusResult } from "@arena/core";

// Mock @arena/core before importing commands
vi.mock("@arena/core", () => ({
  createDatabase: vi.fn(() => "mock-db"),
  initSchema: vi.fn(),
  pop: vi.fn(),
  status: vi.fn(),
}));

// Mock utils
vi.mock("../src/utils.js", () => ({
  detectBranch: vi.fn(() => "main"),
}));

import { popCommand } from "../src/commands/pop.js";
import { statusCommand } from "../src/commands/status.js";
import {
  pop as corePop,
  status as coreStatus,
  initSchema,
  createDatabase,
} from "@arena/core";
import { detectBranch } from "../src/utils.js";

const mockedPop = vi.mocked(corePop);
const mockedStatus = vi.mocked(coreStatus);
const mockedInitSchema = vi.mocked(initSchema);
const mockedCreateDatabase = vi.mocked(createDatabase);
const mockedDetectBranch = vi.mocked(detectBranch);

describe("popCommand (unit)", () => {
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
    mockedPop.mockReturnValue(fakeResult);

    popCommand({});

    expect(mockedInitSchema).toHaveBeenCalled();
    expect(mockedCreateDatabase).toHaveBeenCalled();
    expect(mockedPop).toHaveBeenCalledWith("mock-db", {
      projectPath: process.cwd(),
      branch: "main",
    });
    expect(process.exitCode).toBeUndefined();

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
    mockedPop.mockReturnValue(fakeResult);

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
    mockedPop.mockReturnValue(fakeResult);

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
    mockedPop.mockReturnValue({
      ok: false,
      status: "no_topic",
      message: "No active topic found",
    });

    popCommand({ project: "/tmp/my-project" });

    expect(mockedPop).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ projectPath: "/tmp/my-project" }),
    );
  });

  it("uses explicit --branch override", () => {
    mockedPop.mockReturnValue({
      ok: false,
      status: "no_topic",
      message: "No active topic found",
    });

    popCommand({ branch: "feat/test" });

    expect(mockedDetectBranch).not.toHaveBeenCalled();
    expect(mockedPop).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ branch: "feat/test" }),
    );
  });

  it("auto-detects branch when not provided", () => {
    mockedDetectBranch.mockReturnValue("develop");
    mockedPop.mockReturnValue({
      ok: false,
      status: "no_topic",
      message: "No active topic found",
    });

    popCommand({});

    expect(mockedDetectBranch).toHaveBeenCalledWith(process.cwd());
    expect(mockedPop).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ branch: "develop" }),
    );
  });

  it("handles core pop throwing an Error", () => {
    mockedPop.mockImplementation(() => {
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
    mockedPop.mockImplementation(() => {
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
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedDetectBranch.mockReturnValue("main");
    stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  const fakeStatusResult: StatusResult = {
    ok: true,
    project: { id: "test-project", name: "test-project" },
    topic: null,
  };

  it("returns status with no topic", () => {
    mockedStatus.mockReturnValue(fakeStatusResult);

    statusCommand({});

    expect(mockedInitSchema).toHaveBeenCalled();
    expect(mockedCreateDatabase).toHaveBeenCalled();
    expect(mockedStatus).toHaveBeenCalledWith("mock-db", {
      projectPath: process.cwd(),
      branch: "main",
    });
    expect(process.exitCode).toBeUndefined();

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
    mockedStatus.mockReturnValue(resultWithTopic);

    statusCommand({});

    const output = JSON.parse(
      (stdoutSpy.mock.calls[0]![0] as string).trim(),
    );
    expect(output.ok).toBe(true);
    expect(output.topic.opinions).toHaveLength(1);
    expect(output.topic.opinions[0].agent_name).toBe("OpenCode");
  });

  it("uses explicit --project override", () => {
    mockedStatus.mockReturnValue(fakeStatusResult);

    statusCommand({ project: "/tmp/my-project" });

    expect(mockedStatus).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ projectPath: "/tmp/my-project" }),
    );
  });

  it("uses explicit --branch override", () => {
    mockedStatus.mockReturnValue(fakeStatusResult);

    statusCommand({ branch: "feat/test" });

    expect(mockedDetectBranch).not.toHaveBeenCalled();
    expect(mockedStatus).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ branch: "feat/test" }),
    );
  });

  it("auto-detects branch when not provided", () => {
    mockedDetectBranch.mockReturnValue("develop");
    mockedStatus.mockReturnValue(fakeStatusResult);

    statusCommand({});

    expect(mockedDetectBranch).toHaveBeenCalledWith(process.cwd());
    expect(mockedStatus).toHaveBeenCalledWith(
      "mock-db",
      expect.objectContaining({ branch: "develop" }),
    );
  });

  it("handles core status throwing an Error", () => {
    mockedStatus.mockImplementation(() => {
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
    mockedStatus.mockImplementation(() => {
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

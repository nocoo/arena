import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDatabase, initSchema } from "../src/db/connection.js";
import { push, pop, status, createCheckpoint } from "../src/services/arena.js";

function createTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "arena-test-"));
  const dbPath = join(dir, "test.db");
  initSchema(dbPath);
  const db = createDatabase(dbPath);
  return { db, dbPath, dir };
}

describe("push", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
  });

  afterEach(() => {
    rmSync(ctx.dir, { recursive: true, force: true });
  });

  it("creates project and topic on first push", () => {
    const result = push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "I think approach A is better.",
      projectPath: "/Users/nocoo/workspace/personal/myapp",
      branch: "main",
    });

    expect(result.ok).toBe(true);
    expect(result.project_id).toBe("users-nocoo-workspace-personal-myapp");
    expect(result.opinion_id).toBeTruthy();
    expect(result.topic_id).toBeTruthy();
    expect(result.message).toContain("Opinion submitted");
  });

  it("reuses existing topic on same day + branch", () => {
    const r1 = push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "Opinion 1",
      projectPath: "/Users/test/project",
      branch: "main",
    });

    const r2 = push(ctx.db, {
      agentName: "Cursor",
      model: "GPT-4o",
      content: "Opinion 2",
      projectPath: "/Users/test/project",
      branch: "main",
    });

    expect(r1.topic_id).toBe(r2.topic_id);
    expect(r1.opinion_id).not.toBe(r2.opinion_id);
  });

  it("creates separate topics for different branches", () => {
    const r1 = push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "Opinion on main",
      projectPath: "/Users/test/project",
      branch: "main",
    });

    const r2 = push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "Opinion on feat",
      projectPath: "/Users/test/project",
      branch: "feat/new",
    });

    expect(r1.topic_id).not.toBe(r2.topic_id);
  });

  it("handles null branch (no Git)", () => {
    const r1 = push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "Opinion 1",
      projectPath: "/Users/test/project",
      branch: null,
    });

    const r2 = push(ctx.db, {
      agentName: "Cursor",
      model: "GPT-4o",
      content: "Opinion 2",
      projectPath: "/Users/test/project",
      branch: null,
    });

    expect(r1.topic_id).toBe(r2.topic_id);
  });

  it("isolates null branch from named branch", () => {
    const r1 = push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "No branch",
      projectPath: "/Users/test/project",
      branch: null,
    });

    const r2 = push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "With branch",
      projectPath: "/Users/test/project",
      branch: "main",
    });

    expect(r1.topic_id).not.toBe(r2.topic_id);
  });

  it("allows same agent to push multiple opinions (multi-round)", () => {
    const r1 = push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "First take",
      projectPath: "/Users/test/project",
      branch: "main",
    });

    const r2 = push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "Revised take",
      projectPath: "/Users/test/project",
      branch: "main",
    });

    expect(r1.topic_id).toBe(r2.topic_id);
    expect(r1.opinion_id).not.toBe(r2.opinion_id);
  });
});

describe("pop", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
  });

  afterEach(() => {
    rmSync(ctx.dir, { recursive: true, force: true });
  });

  it("returns no_topic when nothing exists", () => {
    const result = pop(ctx.db, {
      projectPath: "/Users/test/empty",
      branch: "main",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("no_topic");
    }
  });

  it("returns pending when topic exists but no checkpoint", () => {
    push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "My opinion",
      projectPath: "/Users/test/project",
      branch: "main",
    });

    const result = pop(ctx.db, {
      projectPath: "/Users/test/project",
      branch: "main",
    });

    expect(result.ok).toBe(false);
    if (!result.ok && result.status === "pending") {
      expect(result.opinions_count).toBe(1);
      expect(result.topic_id).toBeTruthy();
    }
  });

  it("returns checkpoint when one exists", () => {
    const pushResult = push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "My opinion",
      projectPath: "/Users/test/project",
      branch: "main",
    });

    createCheckpoint(ctx.db, {
      topicId: pushResult.topic_id,
      opinionId: pushResult.opinion_id,
      content: {
        decision: "Go with approach A",
        reasoning: "It is simpler",
        actions: ["Implement A"],
      },
    });

    const result = pop(ctx.db, {
      projectPath: "/Users/test/project",
      branch: "main",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.checkpoint.content.decision).toBe("Go with approach A");
      expect(result.checkpoint.content.reasoning).toBe("It is simpler");
      expect(result.checkpoint.content.actions).toEqual(["Implement A"]);
      expect(result.checkpoint.opinion_id).toBe(pushResult.opinion_id);
    }
  });

  it("returns the latest checkpoint when multiple exist", () => {
    const pushResult = push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "My opinion",
      projectPath: "/Users/test/project",
      branch: "main",
    });

    createCheckpoint(ctx.db, {
      topicId: pushResult.topic_id,
      content: { decision: "First decision" },
    });

    // Small delay to ensure different timestamps
    createCheckpoint(ctx.db, {
      topicId: pushResult.topic_id,
      content: { decision: "Revised decision" },
    });

    const result = pop(ctx.db, {
      projectPath: "/Users/test/project",
      branch: "main",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.checkpoint.content.decision).toBe("Revised decision");
    }
  });

  it("is idempotent — multiple pops return the same result", () => {
    const pushResult = push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "My opinion",
      projectPath: "/Users/test/project",
      branch: "main",
    });

    createCheckpoint(ctx.db, {
      topicId: pushResult.topic_id,
      content: { decision: "Final answer" },
    });

    const r1 = pop(ctx.db, {
      projectPath: "/Users/test/project",
      branch: "main",
    });

    const r2 = pop(ctx.db, {
      projectPath: "/Users/test/project",
      branch: "main",
    });

    expect(r1).toEqual(r2);
  });
});

describe("status", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
  });

  afterEach(() => {
    rmSync(ctx.dir, { recursive: true, force: true });
  });

  it("returns null topic when no topic exists", () => {
    const result = status(ctx.db, {
      projectPath: "/Users/test/project",
      branch: "main",
    });

    expect(result.ok).toBe(true);
    expect(result.project.id).toBe("users-test-project");
    expect(result.project.name).toBe("project");
    expect(result.topic).toBeNull();
  });

  it("returns topic with opinions in chronological order", () => {
    push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "First opinion",
      projectPath: "/Users/test/project",
      branch: "main",
    });

    push(ctx.db, {
      agentName: "Cursor",
      model: "GPT-4o",
      content: "Second opinion",
      projectPath: "/Users/test/project",
      branch: "main",
    });

    const result = status(ctx.db, {
      projectPath: "/Users/test/project",
      branch: "main",
    });

    expect(result.ok).toBe(true);
    expect(result.topic).not.toBeNull();
    expect(result.topic!.opinions).toHaveLength(2);
    expect(result.topic!.opinions[0]!.agent_name).toBe("OpenCode");
    expect(result.topic!.opinions[1]!.agent_name).toBe("Cursor");
    expect(result.topic!.latest_checkpoint).toBeNull();
  });

  it("includes latest checkpoint when present", () => {
    const pushResult = push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "My opinion",
      projectPath: "/Users/test/project",
      branch: "main",
    });

    createCheckpoint(ctx.db, {
      topicId: pushResult.topic_id,
      content: { decision: "Approved" },
    });

    const result = status(ctx.db, {
      projectPath: "/Users/test/project",
      branch: "main",
    });

    expect(result.topic!.latest_checkpoint).not.toBeNull();
    expect(result.topic!.latest_checkpoint!.content.decision).toBe("Approved");
  });
});

describe("createCheckpoint", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
  });

  afterEach(() => {
    rmSync(ctx.dir, { recursive: true, force: true });
  });

  it("creates checkpoint without opinion_id (custom conclusion)", () => {
    const pushResult = push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "My opinion",
      projectPath: "/Users/test/project",
      branch: "main",
    });

    const result = createCheckpoint(ctx.db, {
      topicId: pushResult.topic_id,
      content: { decision: "Custom decision" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.checkpoint_id).toBeTruthy();
    }
  });

  it("creates checkpoint with valid opinion_id", () => {
    const pushResult = push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "My opinion",
      projectPath: "/Users/test/project",
      branch: "main",
    });

    const result = createCheckpoint(ctx.db, {
      topicId: pushResult.topic_id,
      opinionId: pushResult.opinion_id,
      content: { decision: "Use this opinion" },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects checkpoint when topic not found", () => {
    const result = createCheckpoint(ctx.db, {
      topicId: "nonexistent",
      content: { decision: "Whatever" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Topic not found");
    }
  });

  it("rejects checkpoint when opinion not found", () => {
    const pushResult = push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "My opinion",
      projectPath: "/Users/test/project",
      branch: "main",
    });

    const result = createCheckpoint(ctx.db, {
      topicId: pushResult.topic_id,
      opinionId: "nonexistent",
      content: { decision: "Whatever" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Opinion not found");
    }
  });

  it("rejects cross-topic opinion reference", () => {
    // Create two different topics (different branches)
    const push1 = push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "Opinion in topic A",
      projectPath: "/Users/test/project",
      branch: "branch-a",
    });

    const push2 = push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "Opinion in topic B",
      projectPath: "/Users/test/project",
      branch: "branch-b",
    });

    // Try to reference opinion from topic A in topic B's checkpoint
    const result = createCheckpoint(ctx.db, {
      topicId: push2.topic_id,
      opinionId: push1.opinion_id,
      content: { decision: "Cross-topic ref" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("does not belong to the specified topic");
    }
  });

  it("allows multiple checkpoints per topic", () => {
    const pushResult = push(ctx.db, {
      agentName: "OpenCode",
      model: "Claude Opus 4.6",
      content: "My opinion",
      projectPath: "/Users/test/project",
      branch: "main",
    });

    const r1 = createCheckpoint(ctx.db, {
      topicId: pushResult.topic_id,
      content: { decision: "First decision" },
    });

    const r2 = createCheckpoint(ctx.db, {
      topicId: pushResult.topic_id,
      content: { decision: "Revised decision" },
    });

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
  });
});

describe("concurrency", () => {
  it("parallel pushes to same project+branch create only one topic", async () => {
    const dir = mkdtempSync(join(tmpdir(), "arena-test-"));
    const dbPath = join(dir, "test.db");
    initSchema(dbPath);

    // Create multiple independent DB connections to simulate concurrent agents
    const connections = Array.from({ length: 5 }, () => createDatabase(dbPath));

    // Fire all pushes concurrently
    const results = await Promise.all(
      connections.map((db, i) =>
        Promise.resolve(
          push(db, {
            agentName: `Agent-${i}`,
            model: "test-model",
            content: `Opinion from agent ${i}`,
            projectPath: "/Users/test/concurrent-project",
            branch: "main",
          }),
        ),
      ),
    );

    // All should succeed
    for (const r of results) {
      expect(r.ok).toBe(true);
    }

    // All should share the same topic
    const topicIds = new Set(results.map((r) => r.topic_id));
    expect(topicIds.size).toBe(1);

    // Should have 5 distinct opinions
    const opinionIds = new Set(results.map((r) => r.opinion_id));
    expect(opinionIds.size).toBe(5);

    rmSync(dir, { recursive: true, force: true });
  });
});

describe("schema initialization", () => {
  it("initSchema is idempotent", () => {
    const dir = mkdtempSync(join(tmpdir(), "arena-test-"));
    const dbPath = join(dir, "test.db");

    // Run twice — should not throw
    initSchema(dbPath);
    initSchema(dbPath);

    // Verify DB works after double init
    const db = createDatabase(dbPath);
    const result = push(db, {
      agentName: "Test",
      model: "Test",
      content: "Test",
      projectPath: "/test",
      branch: null,
    });

    expect(result.ok).toBe(true);

    rmSync(dir, { recursive: true, force: true });
  });
});

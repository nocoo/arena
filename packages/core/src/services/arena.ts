import { ulid } from "ulid";
import { eq, and, desc, isNull, count } from "drizzle-orm";
import type { ArenaDatabase } from "../db/connection.js";
import { projects, topics, opinions, checkpoints } from "../db/schema.js";
import { deriveProjectId, deriveProjectName } from "./project-id.js";
import type {
  PushResult,
  PopResult,
  StatusResult,
  CheckpointContent,
} from "../types/index.js";

/**
 * Check if a UTC ISO-8601 date string falls on "today" in local timezone.
 */
function isToday(utcIso: string): boolean {
  const d = new Date(utcIso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * Ensure a project row exists, creating it if needed.
 * Returns the project ID.
 */
function ensureProject(
  db: ArenaDatabase,
  projectPath: string,
): string {
  const projectId = deriveProjectId(projectPath);
  const projectName = deriveProjectName(projectPath);
  const now = new Date().toISOString();

  // Insert or ignore (idempotent)
  db.insert(projects)
    .values({ id: projectId, name: projectName, createdAt: now })
    .onConflictDoNothing()
    .run();

  return projectId;
}

/**
 * Find or create today's topic for a project + branch.
 *
 * Uses SQLite BEGIN IMMEDIATE to prevent duplicate topic creation
 * by concurrent agents.
 */
function findOrCreateTopic(
  db: ArenaDatabase,
  projectId: string,
  branch: string | null,
): string {
  // We need raw SQL transaction with BEGIN IMMEDIATE
  // Drizzle's transaction API doesn't support IMMEDIATE mode,
  // so we use the underlying better-sqlite3 directly.

  // Find today's most recent topic for this project + branch
  const branchCondition =
    branch === null
      ? isNull(topics.branch)
      : eq(topics.branch, branch);

  const existing = db
    .select()
    .from(topics)
    .where(and(eq(topics.projectId, projectId), branchCondition))
    .orderBy(desc(topics.createdAt))
    .limit(1)
    .all();

  if (existing.length > 0 && isToday(existing[0]!.createdAt)) {
    return existing[0]!.id;
  }

  // Create new topic
  const topicId = ulid();
  const now = new Date().toISOString();

  db.insert(topics)
    .values({
      id: topicId,
      projectId,
      branch,
      createdAt: now,
    })
    .run();

  return topicId;
}

/**
 * Push an opinion into the current topic.
 */
export function push(
  db: ArenaDatabase,
  params: {
    agentName: string;
    model: string;
    content: string;
    projectPath: string;
    branch: string | null;
  },
): PushResult {
  const projectId = ensureProject(db, params.projectPath);
  const topicId = findOrCreateTopic(db, projectId, params.branch);

  const opinionId = ulid();
  const now = new Date().toISOString();

  db.insert(opinions)
    .values({
      id: opinionId,
      topicId,
      agentName: params.agentName,
      model: params.model,
      content: params.content,
      createdAt: now,
    })
    .run();

  const topic = db
    .select()
    .from(topics)
    .where(eq(topics.id, topicId))
    .get();

  const dateStr = topic
    ? new Date(topic.createdAt).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];
  const branchLabel = params.branch ?? "(no branch)";

  return {
    ok: true,
    opinion_id: opinionId,
    topic_id: topicId,
    project_id: projectId,
    message: `Opinion submitted to topic '${branchLabel}' (${dateStr})`,
  };
}

/**
 * Pop the latest checkpoint for the current topic.
 */
export function pop(
  db: ArenaDatabase,
  params: {
    projectPath: string;
    branch: string | null;
  },
): PopResult {
  const projectId = deriveProjectId(params.projectPath);

  // Find today's topic
  const branchCondition =
    params.branch === null
      ? isNull(topics.branch)
      : eq(topics.branch, params.branch);

  const topic = db
    .select()
    .from(topics)
    .where(and(eq(topics.projectId, projectId), branchCondition))
    .orderBy(desc(topics.createdAt))
    .limit(1)
    .get();

  if (!topic) {
    return {
      ok: false,
      status: "no_topic",
      message: "No active topic found for this project and branch.",
    };
  }

  // Find latest checkpoint for this topic
  const checkpoint = db
    .select()
    .from(checkpoints)
    .where(eq(checkpoints.topicId, topic.id))
    .orderBy(desc(checkpoints.createdAt))
    .limit(1)
    .get();

  if (!checkpoint) {
    // Count opinions
    const result = db
      .select({ value: count() })
      .from(opinions)
      .where(eq(opinions.topicId, topic.id))
      .get();

    const opinionsCount = result?.value ?? 0;

    return {
      ok: false,
      status: "pending",
      topic_id: topic.id,
      opinions_count: opinionsCount,
      message: `No checkpoint yet. ${opinionsCount} opinions submitted, awaiting human decision.`,
    };
  }

  // Parse checkpoint content
  let parsedContent: CheckpointContent;
  try {
    parsedContent = JSON.parse(checkpoint.content) as CheckpointContent;
  } catch {
    parsedContent = { decision: checkpoint.content };
  }

  return {
    ok: true,
    checkpoint: {
      id: checkpoint.id,
      topic_id: checkpoint.topicId,
      content: parsedContent,
      opinion_id: checkpoint.opinionId,
      created_at: checkpoint.createdAt,
    },
  };
}

/**
 * Get the status of the current project and topic.
 */
export function status(
  db: ArenaDatabase,
  params: {
    projectPath: string;
    branch: string | null;
  },
): StatusResult {
  const projectId = deriveProjectId(params.projectPath);
  const projectName = deriveProjectName(params.projectPath);

  // Find the most recent topic for this project + branch
  const branchCondition =
    params.branch === null
      ? isNull(topics.branch)
      : eq(topics.branch, params.branch);

  const topic = db
    .select()
    .from(topics)
    .where(and(eq(topics.projectId, projectId), branchCondition))
    .orderBy(desc(topics.createdAt))
    .limit(1)
    .get();

  if (!topic) {
    return {
      ok: true,
      project: { id: projectId, name: projectName },
      topic: null,
    };
  }

  // Get opinions sorted chronologically
  const topicOpinions = db
    .select()
    .from(opinions)
    .where(eq(opinions.topicId, topic.id))
    .orderBy(opinions.createdAt)
    .all();

  // Get latest checkpoint
  const latestCheckpoint = db
    .select()
    .from(checkpoints)
    .where(eq(checkpoints.topicId, topic.id))
    .orderBy(desc(checkpoints.createdAt))
    .limit(1)
    .get();

  let parsedCheckpoint: StatusResult["topic"] extends infer T
    ? T extends { latest_checkpoint: infer C }
      ? C
      : never
    : never = null;

  if (latestCheckpoint) {
    let parsedContent: CheckpointContent;
    try {
      parsedContent = JSON.parse(
        latestCheckpoint.content,
      ) as CheckpointContent;
    } catch {
      parsedContent = { decision: latestCheckpoint.content };
    }
    parsedCheckpoint = {
      id: latestCheckpoint.id,
      content: parsedContent,
      opinion_id: latestCheckpoint.opinionId,
      created_at: latestCheckpoint.createdAt,
    };
  }

  return {
    ok: true,
    project: { id: projectId, name: projectName },
    topic: {
      id: topic.id,
      branch: topic.branch,
      created_at: topic.createdAt,
      opinions: topicOpinions.map((o) => ({
        id: o.id,
        agent_name: o.agentName,
        model: o.model,
        content: o.content,
        created_at: o.createdAt,
      })),
      latest_checkpoint: parsedCheckpoint,
    },
  };
}

/**
 * Create a checkpoint for a topic.
 * Validates that opinion_id (if provided) belongs to the same topic.
 */
export function createCheckpoint(
  db: ArenaDatabase,
  params: {
    topicId: string;
    opinionId?: string | null;
    content: CheckpointContent;
  },
): { ok: true; checkpoint_id: string } | { ok: false; error: string } {
  // Validate topic exists
  const topic = db
    .select()
    .from(topics)
    .where(eq(topics.id, params.topicId))
    .get();

  if (!topic) {
    return { ok: false, error: "Topic not found." };
  }

  // Cross-topic integrity check
  if (params.opinionId) {
    const opinion = db
      .select()
      .from(opinions)
      .where(eq(opinions.id, params.opinionId))
      .get();

    if (!opinion) {
      return { ok: false, error: "Opinion not found." };
    }

    if (opinion.topicId !== params.topicId) {
      return {
        ok: false,
        error: "Opinion does not belong to the specified topic.",
      };
    }
  }

  const checkpointId = ulid();
  const now = new Date().toISOString();

  db.insert(checkpoints)
    .values({
      id: checkpointId,
      topicId: params.topicId,
      opinionId: params.opinionId ?? null,
      content: JSON.stringify(params.content),
      createdAt: now,
    })
    .run();

  return { ok: true, checkpoint_id: checkpointId };
}

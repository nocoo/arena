import { desc, eq, count } from "drizzle-orm";
import { schema } from "@arena/core";
import { getDb } from "./db";

export interface ProjectWithStats {
  id: string;
  name: string;
  createdAt: string;
  topicCount: number;
  latestTopicDate: string | null;
}

export interface TopicWithCounts {
  id: string;
  projectId: string;
  branch: string | null;
  title: string | null;
  createdAt: string;
  opinionsCount: number;
  checkpointsCount: number;
}

export function getProjects(): ProjectWithStats[] {
  const db = getDb();

  const projects = db
    .select()
    .from(schema.projects)
    .orderBy(desc(schema.projects.createdAt))
    .all();

  return projects.map((p) => {
    const topicStats = db
      .select({ value: count() })
      .from(schema.topics)
      .where(eq(schema.topics.projectId, p.id))
      .get();

    const latestTopic = db
      .select()
      .from(schema.topics)
      .where(eq(schema.topics.projectId, p.id))
      .orderBy(desc(schema.topics.createdAt))
      .limit(1)
      .get();

    return {
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
      topicCount: topicStats?.value ?? 0,
      latestTopicDate: latestTopic?.createdAt ?? null,
    };
  });
}

export function getTopicsForProject(projectId: string): TopicWithCounts[] {
  const db = getDb();

  const topics = db
    .select()
    .from(schema.topics)
    .where(eq(schema.topics.projectId, projectId))
    .orderBy(desc(schema.topics.createdAt))
    .all();

  return topics.map((t) => {
    const opinionStats = db
      .select({ value: count() })
      .from(schema.opinions)
      .where(eq(schema.opinions.topicId, t.id))
      .get();

    const checkpointStats = db
      .select({ value: count() })
      .from(schema.checkpoints)
      .where(eq(schema.checkpoints.topicId, t.id))
      .get();

    return {
      id: t.id,
      projectId: t.projectId,
      branch: t.branch,
      title: t.title,
      createdAt: t.createdAt,
      opinionsCount: opinionStats?.value ?? 0,
      checkpointsCount: checkpointStats?.value ?? 0,
    };
  });
}

export interface TopicDetail {
  id: string;
  projectId: string;
  branch: string | null;
  title: string | null;
  createdAt: string;
  opinions: Array<{
    id: string;
    agentName: string;
    model: string;
    content: string;
    createdAt: string;
  }>;
  checkpoints: Array<{
    id: string;
    opinionId: string | null;
    content: string;
    createdAt: string;
  }>;
}

export function getTopicDetail(topicId: string): TopicDetail | null {
  const db = getDb();

  const topic = db
    .select()
    .from(schema.topics)
    .where(eq(schema.topics.id, topicId))
    .get();

  if (!topic) return null;

  const opinions = db
    .select()
    .from(schema.opinions)
    .where(eq(schema.opinions.topicId, topicId))
    .orderBy(schema.opinions.createdAt)
    .all();

  const checkpoints = db
    .select()
    .from(schema.checkpoints)
    .where(eq(schema.checkpoints.topicId, topicId))
    .orderBy(desc(schema.checkpoints.createdAt))
    .all();

  return {
    id: topic.id,
    projectId: topic.projectId,
    branch: topic.branch,
    title: topic.title,
    createdAt: topic.createdAt,
    opinions: opinions.map((o) => ({
      id: o.id,
      agentName: o.agentName,
      model: o.model,
      content: o.content,
      createdAt: o.createdAt,
    })),
    checkpoints: checkpoints.map((c) => ({
      id: c.id,
      opinionId: c.opinionId,
      content: c.content,
      createdAt: c.createdAt,
    })),
  };
}

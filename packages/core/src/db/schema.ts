import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// --- projects ---
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

// --- topics ---
export const topics = sqliteTable("topics", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  branch: text("branch"),
  title: text("title"),
  createdAt: text("created_at").notNull(),
});

// --- opinions ---
export const opinions = sqliteTable("opinions", {
  id: text("id").primaryKey(),
  topicId: text("topic_id")
    .notNull()
    .references(() => topics.id),
  agentName: text("agent_name").notNull(),
  model: text("model").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
});

// --- checkpoints ---
export const checkpoints = sqliteTable("checkpoints", {
  id: text("id").primaryKey(),
  topicId: text("topic_id")
    .notNull()
    .references(() => topics.id),
  opinionId: text("opinion_id").references(() => opinions.id),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
});

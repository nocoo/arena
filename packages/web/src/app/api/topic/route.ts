import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { schema } from "@arena/core";
import { eq } from "drizzle-orm";
import { monotonicFactory } from "ulid";

const ulid = monotonicFactory();

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { projectId, branch } = body as {
    projectId?: string;
    branch?: string | null;
  };

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  // Verify project exists
  const { orm } = getDb();
  const project = orm
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .get();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const topicId = ulid();
  const now = new Date().toISOString();

  orm
    .insert(schema.topics)
    .values({
      id: topicId,
      projectId,
      branch: branch ?? null,
      createdAt: now,
    })
    .run();

  return NextResponse.json({ ok: true, topicId });
}

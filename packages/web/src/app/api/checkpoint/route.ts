import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { createCheckpoint } from "@arena/core";
import type { CheckpointContent } from "@arena/core";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const { topicId, opinionId, decision, reasoning, actions } = body as {
    topicId?: string;
    opinionId?: string | null;
    decision?: string;
    reasoning?: string;
    actions?: string[];
  };

  if (!topicId || !decision) {
    return NextResponse.json(
      { error: "topicId and decision are required" },
      { status: 400 }
    );
  }

  const content: CheckpointContent = { decision };
  if (reasoning) content.reasoning = reasoning;
  if (actions?.length) content.actions = actions;

  const db = getDb();
  const result = createCheckpoint(db, {
    topicId,
    opinionId: opinionId ?? null,
    content,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, checkpointId: result.checkpoint_id });
}

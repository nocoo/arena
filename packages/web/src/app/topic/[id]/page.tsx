import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTopicDetail } from "@/lib/data";
import { notFound } from "next/navigation";
import { TopicView } from "./topic-view";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function TopicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const topic = getTopicDetail(id);
  if (!topic) {
    notFound();
  }

  return (
    <AppShell title={topic.title || "Topic"}>
      <TopicView topic={topic} />
    </AppShell>
  );
}

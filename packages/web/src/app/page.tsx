import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { WorkspacePage } from "./workspace";
import { AppShell } from "@/components/layout/app-shell";
import { getProjects, getTopicsForProject } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const projects = getProjects();
  const topicsByProject: Record<string, ReturnType<typeof getTopicsForProject>> = {};
  for (const p of projects) {
    topicsByProject[p.id] = getTopicsForProject(p.id);
  }

  return (
    <AppShell title="Dashboard">
      <WorkspacePage projects={projects} topicsByProject={topicsByProject} />
    </AppShell>
  );
}

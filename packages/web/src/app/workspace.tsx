"use client";

import { useState } from "react";
import Link from "next/link";
import { Swords, FolderOpen, GitBranch, MessageSquare, Flag, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProjectWithStats, TopicWithCounts } from "@/lib/data";

interface WorkspaceProps {
  projects: ProjectWithStats[];
  topicsByProject: Record<string, TopicWithCounts[]>;
}

export function WorkspacePage({ projects, topicsByProject }: WorkspaceProps) {
  const [expandedProject, setExpandedProject] = useState<string | null>(
    projects[0]?.id ?? null
  );

  if (projects.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Swords className="h-4 w-4" />
          </div>
          <h1 className="text-lg font-semibold">Arena</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Projects
          </h2>
        </div>

        <div className="space-y-3">
          {projects.map((project) => {
            const isExpanded = expandedProject === project.id;
            const topics = topicsByProject[project.id] ?? [];

            return (
              <Card key={project.id} className="py-0 overflow-hidden">
                <button
                  onClick={() =>
                    setExpandedProject(isExpanded ? null : project.id)
                  }
                  className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-accent/50 cursor-pointer"
                >
                  <FolderOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{project.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {project.id}
                    </div>
                  </div>
                  <Badge variant="secondary">{project.topicCount} topics</Badge>
                  <ChevronRight
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                  />
                </button>

                {isExpanded && topics.length > 0 && (
                  <div className="border-t">
                    {topics.map((topic) => (
                      <Link
                        key={topic.id}
                        href={`/topic/${topic.id}`}
                        className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-accent/30 border-b last:border-b-0"
                      >
                        <div className="w-5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {topic.branch && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <GitBranch className="h-3 w-3" />
                                {topic.branch}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDate(topic.createdAt)}
                            </span>
                            {topic.title && (
                              <span className="text-sm font-medium truncate">
                                {topic.title}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {topic.opinionsCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <Flag className="h-3 w-3" />
                            {topic.checkpointsCount}
                          </span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                )}

                {isExpanded && topics.length === 0 && (
                  <div className="border-t px-6 py-6 text-center text-sm text-muted-foreground">
                    No topics yet. Push an opinion from the CLI to get started.
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Swords className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold">No projects yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Push your first opinion from the CLI to create a project:
        </p>
        <pre className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          arena push --agent &quot;OpenCode&quot; --model &quot;Claude&quot; --content &quot;...&quot;
        </pre>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

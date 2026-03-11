"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FolderOpen,
  GitBranch,
  MessageSquare,
  Flag,
  ChevronRight,
  Swords,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProjectWithStats, TopicWithCounts } from "@/lib/data";

interface WorkspaceProps {
  projects: ProjectWithStats[];
  topicsByProject: Record<string, TopicWithCounts[]>;
}

export function WorkspacePage({ projects, topicsByProject }: WorkspaceProps) {
  const [expandedProject, setExpandedProject] = useState<string | null>(
    projects[0]?.id ?? null,
  );

  if (projects.length === 0) {
    return <EmptyState />;
  }

  // Stats row
  const totalTopics = projects.reduce((sum, p) => sum + p.topicCount, 0);

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Projects" value={projects.length} />
        <StatCard label="Topics" value={totalTopics} />
        <StatCard
          label="Active"
          value={projects.filter((p) => p.topicCount > 0).length}
        />
        <StatCard label="Agents" value="-" />
      </div>

      {/* Section header */}
      <div className="mb-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Projects
        </h2>
      </div>

      {/* Project cards */}
      <div className="space-y-3">
        {projects.map((project) => {
          const isExpanded = expandedProject === project.id;
          const topics = topicsByProject[project.id] ?? [];

          return (
            <div
              key={project.id}
              className="rounded-card bg-secondary border-0 shadow-none overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedProject(isExpanded ? null : project.id)
                }
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/50 cursor-pointer"
              >
                <FolderOpen
                  className="h-5 w-5 text-muted-foreground shrink-0"
                  strokeWidth={1.5}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">
                    {project.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {project.id}
                  </div>
                </div>
                <Badge variant="secondary" className="bg-accent">
                  {project.topicCount} topics
                </Badge>
                <ChevronRight
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                  strokeWidth={1.5}
                />
              </button>

              {isExpanded && topics.length > 0 && (
                <div className="border-t border-border">
                  {topics.map((topic) => (
                    <Link
                      key={topic.id}
                      href={`/topic/${topic.id}`}
                      className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-accent/30 border-b border-border last:border-b-0"
                    >
                      <div className="w-5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {topic.branch && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <GitBranch
                                className="h-3 w-3"
                                strokeWidth={1.5}
                              />
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
                          <MessageSquare
                            className="h-3 w-3"
                            strokeWidth={1.5}
                          />
                          {topic.opinionsCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Flag className="h-3 w-3" strokeWidth={1.5} />
                          {topic.checkpointsCount}
                        </span>
                      </div>
                      <ChevronRight
                        className="h-4 w-4 text-muted-foreground"
                        strokeWidth={1.5}
                      />
                    </Link>
                  ))}
                </div>
              )}

              {isExpanded && topics.length === 0 && (
                <div className="border-t border-border px-5 py-6 text-center text-sm text-muted-foreground">
                  No topics yet. Push an opinion from the CLI to get started.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-card bg-secondary border-0 shadow-none px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Swords className="h-7 w-7" strokeWidth={1.5} />
      </div>
      <h2 className="text-lg font-semibold">No projects yet</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Push your first opinion from the CLI to create a project:
      </p>
      <pre className="rounded-widget bg-secondary px-4 py-3 text-sm text-muted-foreground">
        arena push --agent &quot;OpenCode&quot; --model &quot;Claude&quot;
        --content &quot;...&quot;
      </pre>
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

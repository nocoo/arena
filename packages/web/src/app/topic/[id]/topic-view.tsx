"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  GitBranch,
  Flag,
  CheckCircle2,
  PenLine,
  Plus,
  Bot,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TopicDetail } from "@/lib/data";

interface TopicViewProps {
  topic: TopicDetail;
}

export function TopicView({ topic }: TopicViewProps) {
  const router = useRouter();
  const [checkpointDialog, setCheckpointDialog] = useState<{
    open: boolean;
    opinionId: string | null;
    prefill: string;
  }>({ open: false, opinionId: null, prefill: "" });
  const [decision, setDecision] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [actions, setActions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const latestCheckpoint = topic.checkpoints[0] ?? null;

  function openCheckpointDialog(opinionId: string | null, prefill: string) {
    setCheckpointDialog({ open: true, opinionId, prefill });
    setDecision(prefill);
    setReasoning("");
    setActions("");
  }

  async function submitCheckpoint() {
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        topicId: topic.id,
        decision: decision.trim(),
      };
      if (checkpointDialog.opinionId) {
        body.opinionId = checkpointDialog.opinionId;
      }
      if (reasoning.trim()) {
        body.reasoning = reasoning.trim();
      }
      if (actions.trim()) {
        body.actions = actions
          .trim()
          .split("\n")
          .filter((l) => l.trim());
      }

      const res = await fetch("/api/checkpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Failed to create checkpoint");
        return;
      }

      setCheckpointDialog({ open: false, opinionId: null, prefill: "" });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function createNewTopic() {
    const res = await fetch("/api/topic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: topic.projectId,
        branch: topic.branch,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Failed to create topic");
      return;
    }

    const data = await res.json();
    router.push(`/topic/${data.topicId}`);
  }

  return (
    <div>
      {/* Topic header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {topic.branch && (
              <Badge variant="secondary">
                <GitBranch className="h-3 w-3" strokeWidth={1.5} />
                {topic.branch}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground shrink-0">
              {formatDate(topic.createdAt)}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={createNewTopic}>
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          New Topic
        </Button>
      </div>

      {/* Latest checkpoint banner */}
      {latestCheckpoint && (
        <div className="mb-6 rounded-card bg-primary/5 border border-primary/20 px-5 py-4">
          <div className="flex items-start gap-3">
            <Flag
              className="h-5 w-5 text-primary shrink-0 mt-0.5"
              strokeWidth={1.5}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">Latest Checkpoint</span>
                <span className="text-xs text-muted-foreground">
                  {formatTime(latestCheckpoint.createdAt)}
                </span>
              </div>
              <CheckpointContentDisplay content={latestCheckpoint.content} />
            </div>
          </div>
        </div>
      )}

      {/* Opinions section */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Opinions ({topic.opinions.length})
        </h2>
        <Button
          variant="default"
          size="sm"
          onClick={() => openCheckpointDialog(null, "")}
        >
          <PenLine className="h-3.5 w-3.5" strokeWidth={1.5} />
          Write Checkpoint
        </Button>
      </div>

      {topic.opinions.length === 0 ? (
        <div className="rounded-card bg-secondary border-0 shadow-none py-12 text-center text-sm text-muted-foreground">
          No opinions yet. Agents will push opinions via the CLI.
        </div>
      ) : (
        <div className="space-y-3">
          {topic.opinions.map((opinion, index) => (
            <div key={opinion.id}>
              {/* Opinion card */}
              <div className="rounded-card bg-secondary border-0 shadow-none px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent shrink-0">
                    <Bot
                      className="h-4 w-4 text-muted-foreground"
                      strokeWidth={1.5}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium">
                        {opinion.agentName}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {opinion.model}
                      </Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto shrink-0">
                        <Clock className="h-3 w-3" strokeWidth={1.5} />
                        {formatTime(opinion.createdAt)}
                      </span>
                    </div>
                    <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
                      {opinion.content}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          openCheckpointDialog(opinion.id, opinion.content)
                        }
                        className="text-xs"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                        Choose this
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interspersed checkpoints */}
              {renderInterspersedCheckpoints(
                topic.checkpoints,
                opinion.createdAt,
                topic.opinions[index + 1]?.createdAt ?? null,
              )}
            </div>
          ))}
        </div>
      )}

      {/* Checkpoint history */}
      {topic.checkpoints.length > 1 && (
        <>
          <Separator className="my-8" />
          <h2 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Checkpoint History ({topic.checkpoints.length})
          </h2>
          <div className="space-y-3">
            {topic.checkpoints.map((cp, i) => (
              <div
                key={cp.id}
                className="rounded-card bg-secondary border-0 shadow-none px-5 py-3"
              >
                <div className="flex items-start gap-3">
                  <Flag
                    className={`h-4 w-4 shrink-0 mt-0.5 ${
                      i === 0 ? "text-primary" : "text-muted-foreground"
                    }`}
                    strokeWidth={1.5}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {i === 0 && (
                        <Badge variant="default" className="text-[10px]">
                          Latest
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatTime(cp.createdAt)}
                      </span>
                    </div>
                    <CheckpointContentDisplay content={cp.content} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Checkpoint creation dialog */}
      <Dialog
        open={checkpointDialog.open}
        onOpenChange={(open) =>
          setCheckpointDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Set Checkpoint</DialogTitle>
            <DialogDescription>
              {checkpointDialog.opinionId
                ? "Using selected opinion as the basis. Edit or keep as-is."
                : "Write a custom checkpoint decision."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Decision *
              </label>
              <Textarea
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                placeholder="The core decision or instruction..."
                className="min-h-24 rounded-widget"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Reasoning
              </label>
              <Textarea
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                placeholder="Why this decision was made..."
                className="min-h-16 rounded-widget"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Actions (one per line)
              </label>
              <Textarea
                value={actions}
                onChange={(e) => setActions(e.target.value)}
                placeholder={
                  "Refactor UserService to use Redis\nAdd cache invalidation on write"
                }
                className="min-h-16 rounded-widget"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setCheckpointDialog({
                  open: false,
                  opinionId: null,
                  prefill: "",
                })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={submitCheckpoint}
              disabled={!decision.trim() || submitting}
            >
              {submitting ? "Saving..." : "Set Checkpoint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CheckpointContentDisplay({ content }: { content: string }) {
  try {
    const parsed = JSON.parse(content);
    return (
      <div className="space-y-1.5">
        <div className="text-sm font-medium">{parsed.decision}</div>
        {parsed.reasoning && (
          <div className="text-xs text-muted-foreground">
            {parsed.reasoning}
          </div>
        )}
        {parsed.actions?.length > 0 && (
          <ul className="text-xs text-muted-foreground list-disc list-inside">
            {parsed.actions.map((a: string, i: number) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        )}
      </div>
    );
  } catch {
    return <div className="text-sm">{content}</div>;
  }
}

function renderInterspersedCheckpoints(
  checkpoints: TopicDetail["checkpoints"],
  afterTime: string,
  beforeTime: string | null,
) {
  const relevant = checkpoints.filter((cp) => {
    const cpTime = cp.createdAt;
    return cpTime > afterTime && (beforeTime === null || cpTime <= beforeTime);
  });

  if (relevant.length === 0) return null;

  return (
    <div className="my-3 ml-11 space-y-2">
      {relevant.map((cp) => (
        <div
          key={cp.id}
          className="flex items-start gap-2 rounded-widget bg-primary/5 border border-primary/20 px-3 py-2"
        >
          <Flag
            className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5"
            strokeWidth={1.5}
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground mb-0.5">
              Checkpoint set at {formatTime(cp.createdAt)}
            </div>
            <CheckpointContentDisplay content={cp.content} />
          </div>
        </div>
      ))}
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

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

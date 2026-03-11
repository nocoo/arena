export interface CheckpointContent {
  decision: string;
  reasoning?: string;
  actions?: string[];
}

export interface PushParams {
  agentName: string;
  model: string;
  content: string;
  projectPath?: string;
  branch?: string | null;
}

export interface PushResult {
  ok: true;
  opinion_id: string;
  topic_id: string;
  project_id: string;
  message: string;
}

export interface PopResultCheckpoint {
  ok: true;
  checkpoint: {
    id: string;
    topic_id: string;
    content: CheckpointContent;
    opinion_id: string | null;
    created_at: string;
  };
}

export interface PopResultPending {
  ok: false;
  status: "pending";
  topic_id: string;
  opinions_count: number;
  message: string;
}

export interface PopResultNoTopic {
  ok: false;
  status: "no_topic";
  message: string;
}

export type PopResult = PopResultCheckpoint | PopResultPending | PopResultNoTopic;

export interface StatusResult {
  ok: true;
  project: {
    id: string;
    name: string;
  };
  topic: {
    id: string;
    branch: string | null;
    created_at: string;
    opinions: Array<{
      id: string;
      agent_name: string;
      model: string;
      content: string;
      created_at: string;
    }>;
    latest_checkpoint: {
      id: string;
      content: CheckpointContent;
      opinion_id: string | null;
      created_at: string;
    } | null;
  } | null;
}

export interface ErrorResult {
  ok: false;
  error: string;
}

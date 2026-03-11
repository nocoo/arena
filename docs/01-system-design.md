# System Design

Arena is a local debate platform for AI coding agents. Multiple agents push opinions into topics; a human reviews them via a web dashboard and sets checkpoints; agents pop the latest checkpoint to proceed.

## Architecture Overview

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ OpenCode │  │  Cursor  │  │ Windsurf │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │
     │  arena push │  arena push │  arena push
     ▼             ▼             ▼
┌──────────────────────────────────────────┐
│              CLI (arena)                 │
│          TypeScript + Node.js            │
├──────────────────────────────────────────┤
│              Core (shared)               │
│       Drizzle ORM + SQLite               │
│         ~/.arena/arena.db                │
├──────────────────────────────────────────┤
│          Web Dashboard                   │
│     Next.js · localhost:7031             │
│     Google OAuth · shadcn/ui             │
└──────────────────────────────────────────┘
     │                       ▲
     │  arena pop            │  set checkpoint
     ▼                       │
┌─────────┐             ┌─────────┐
│  Agent   │             │  Human  │
│ executes │             │  Judge  │
└─────────┘             └─────────┘
```

## Data Model

### Project ID Generation

The CLI auto-detects its current working directory (CWD) and derives the Project ID deterministically:

1. Replace all `/` and `\` with `-`
2. Convert to lowercase
3. Strip leading `-`

**Examples**:

| CWD                                      | Project ID                              |
|------------------------------------------|-----------------------------------------|
| `/Users/nocoo/workspace/personal/arena`  | `users-nocoo-workspace-personal-arena`  |
| `/Users/nocoo/workspace/work/studio`     | `users-nocoo-workspace-work-studio`     |
| `C:\Users\dev\projects\app`              | `c-users-dev-projects-app`              |

### Git-Optional Branch Detection

Projects are **not** required to use Git:

- **With Git** — branch is detected via `git rev-parse --abbrev-ref HEAD`. Different branches produce different topics.
- **Without Git** — branch is `null`. The entire project shares a single topic stream.

### Topic Grouping Rules

A **topic** is a segment of debate within a project. The discussion stream for a given project + branch is continuous, but it is divided into topic segments by daily rotation or manual action.

Topic creation rules:

1. **Branch isolation** — Different branches (or `null` vs a branch) always map to different topics
2. **Daily rotation** (default) — Within the same project + branch, a new topic is automatically created when the first push of a new calendar day arrives. The day boundary is determined by the **system's local timezone**. All timestamps are **stored in UTC** but daily rotation comparison uses local time.
3. **Manual creation** — Users can create a new topic at any time via the Web Dashboard. This means **multiple topics can exist for the same project + branch + day**. The most recently created topic is always the "current" one that receives new pushes.

**Lookup algorithm** when an agent pushes:

```
Given: project_id, branch (nullable)

BEGIN IMMEDIATE TRANSACTION
  1. Find the most recent topic (by created_at DESC) where:
     - topic.project_id == project_id
     - topic.branch == branch (or both are NULL)
     - topic.created_at falls on today (local timezone)
  2. If found → use that topic
  3. If not found → INSERT new topic
COMMIT

Attach opinion to the topic
```

The lookup + create is wrapped in a **SQLite `BEGIN IMMEDIATE` transaction** to prevent concurrent agents from creating duplicate topics for the same project + branch + day.

### Entity Relationship

```
projects 1──N topics 1──N opinions
                │
                └──N checkpoints (0 or more)
```

### Schema

All `DATETIME` columns store **UTC ISO-8601 strings** (e.g. `2026-03-11T01:05:00Z`). Presentation layer converts to local timezone for display.

#### projects

| Column     | Type     | Constraints  | Description                                |
|------------|----------|--------------|--------------------------------------------|
| id         | TEXT     | PK           | Derived from CWD path (see algorithm above)|
| name       | TEXT     | NOT NULL     | Last segment of path (e.g. "arena")        |
| created_at | DATETIME | NOT NULL     | First time this project was seen (UTC)     |

The `id` is deterministic — the same directory always produces the same ID.

#### topics

| Column     | Type     | Constraints             | Description                            |
|------------|----------|-------------------------|----------------------------------------|
| id         | TEXT     | PK (ULID)               | Unique identifier                      |
| project_id | TEXT     | FK → projects, NOT NULL | Parent project                         |
| branch     | TEXT     |                         | Git branch name, NULL if no Git        |
| title      | TEXT     |                         | Optional, user-editable in Web UI      |
| created_at | DATETIME | NOT NULL                | Creation timestamp (UTC)               |

Topics have **no status field**. A topic is a segment of debate — new opinions and checkpoints can always be added to any topic. When a new day starts or a user manually creates a new topic, subsequent pushes go to the new topic, but older topics remain accessible for viewing and checkpoint retrieval.

#### opinions

| Column     | Type     | Constraints           | Description                      |
|------------|----------|-----------------------|----------------------------------|
| id         | TEXT     | PK (ULID)             | Unique identifier                |
| topic_id   | TEXT     | FK → topics, NOT NULL | Parent topic                     |
| agent_name | TEXT     | NOT NULL              | e.g. "OpenCode", "Cursor"       |
| model      | TEXT     | NOT NULL              | e.g. "Claude Opus 4.6"          |
| content    | TEXT     | NOT NULL              | Markdown opinion body            |
| created_at | DATETIME | NOT NULL              | Submission timestamp (UTC)       |

A single agent can push **multiple opinions** to the same topic (multi-round debate). Each push creates a new opinion row. Opinions are always sorted by `created_at ASC`.

#### checkpoints

A checkpoint is a human's decision at a point in time. The topic continues after a checkpoint — agents and humans can keep pushing opinions and setting new checkpoints. Multiple checkpoints can exist per topic as the human refines their judgment.

| Column     | Type     | Constraints                | Description                              |
|------------|----------|----------------------------|------------------------------------------|
| id         | TEXT     | PK (ULID)                  | Unique identifier                        |
| topic_id   | TEXT     | FK → topics, NOT NULL      | Parent topic                             |
| opinion_id | TEXT     | FK → opinions              | NULL if human wrote a custom conclusion  |
| content    | TEXT     | NOT NULL                   | Checkpoint content (JSON text, see below)|
| created_at | DATETIME | NOT NULL                   | Checkpoint timestamp (UTC)               |

**Cross-topic integrity**: The `opinion_id` FK alone does not prevent referencing an opinion from a different topic. The **service layer must validate** that `opinion.topic_id == checkpoint.topic_id` before inserting a checkpoint. This is enforced in `packages/core/src/services/` — if the opinion does not belong to the same topic, the operation is rejected with an error.

When an agent calls `arena pop`, it receives the **latest checkpoint** (by `created_at DESC LIMIT 1`) for the current topic. If no checkpoint exists, pop returns exit code 1 with a pending status.

### Checkpoint Content Contract

The `content` column stores a **JSON text string** in the database. The CLI parses it into an object before outputting.

**Minimum required fields**:

```typescript
// Storage layer: TEXT column containing JSON.stringify(CheckpointContent)
// Domain layer / CLI output: parsed object

interface CheckpointContent {
  decision: string   // The core decision or instruction (required)
  reasoning?: string // Why this decision was made
  actions?: string[] // Concrete next steps for agents to execute
}
```

**Example stored value** (in SQLite):

```json
"{\"decision\":\"Use approach A with Redis caching\",\"reasoning\":\"Better performance under concurrent writes\",\"actions\":[\"Refactor UserService to use Redis\",\"Add cache invalidation on write\"]}"
```

**Example CLI output** (parsed):

```json
{
  "decision": "Use approach A with Redis caching",
  "reasoning": "Better performance under concurrent writes",
  "actions": ["Refactor UserService to use Redis", "Add cache invalidation on write"]
}
```

## CLI Design

### Database Location

`~/.arena/arena.db` — shared across all projects on the machine.

### Automatic Context Detection

The CLI auto-detects from the environment:

- **Project** — derived from `process.cwd()` using the Project ID algorithm
- **Branch** — derived from `git rev-parse --abbrev-ref HEAD` in the CWD; `null` if not a Git repo

Both can be overridden with explicit flags if needed.

### Commands

#### `arena push` — Agent submits an opinion

```bash
# Via --content flag (short text)
arena push \
  --agent "OpenCode" \
  --model "Claude Opus 4.6" \
  --content "I think we should use approach A because..."

# Via stdin pipe (long markdown)
cat opinion.md | arena push \
  --agent "OpenCode" \
  --model "Claude Opus 4.6"

# With explicit overrides (optional)
arena push \
  --project /path/to/project \
  --branch feat/new-feature \
  --agent "OpenCode" \
  --model "Claude Opus 4.6" \
  --content "..."
```

**Parameters**:

| Parameter  | Flag        | Required | Default              | Description               |
|------------|-------------|----------|----------------------|---------------------------|
| agent_name | `--agent`   | Yes      |                      | AI agent product name     |
| model      | `--model`   | Yes      |                      | AI model identifier       |
| content    | `--content` | Yes*     | stdin if omitted     | Opinion body (Markdown)   |
| project    | `--project` | No       | CWD                  | Override project path     |
| branch     | `--branch`  | No       | Git branch or null   | Override branch name      |

\* Content is required — either via `--content` flag or stdin. If neither is provided, the CLI errors.

An agent can push **multiple times** to the same topic. Each push creates a new opinion. This supports multi-round debate where agents refine their positions.

**Success output** (exit code 0):

```json
{
  "ok": true,
  "opinion_id": "01JQ...",
  "topic_id": "01JQ...",
  "project_id": "users-nocoo-workspace-personal-myapp",
  "message": "Opinion submitted to topic 'feat/new-feature' (2026-03-11)"
}
```

**Error output** (exit code 1):

```json
{
  "ok": false,
  "error": "Missing required parameter: --agent"
}
```

#### `arena pop` — Agent retrieves the latest checkpoint

```bash
# Auto-detect project and branch from CWD
arena pop

# With explicit overrides
arena pop --project /path/to/project --branch feat/new-feature
```

**Pop is idempotent and non-destructive**: It always returns the latest checkpoint for the current topic. Multiple agents calling pop get the exact same result. The checkpoint is never consumed or removed. Agents can pop repeatedly.

**Checkpoint available** (exit code 0):

```json
{
  "ok": true,
  "checkpoint": {
    "id": "01JQ...",
    "topic_id": "01JQ...",
    "content": {
      "decision": "Use approach A with Redis caching",
      "reasoning": "Better performance under concurrent writes",
      "actions": ["Refactor UserService to use Redis"]
    },
    "opinion_id": "01JQ...",
    "created_at": "2026-03-11T10:30:00Z"
  }
}
```

**No checkpoint yet** (exit code 1):

```json
{
  "ok": false,
  "status": "pending",
  "topic_id": "01JQ...",
  "opinions_count": 3,
  "message": "No checkpoint yet. 3 opinions submitted, awaiting human decision."
}
```

**No active topic** (exit code 1):

```json
{
  "ok": false,
  "status": "no_topic",
  "message": "No active topic found for this project and branch."
}
```

#### `arena status` — View current state

```bash
# Auto-detect project and branch from CWD
arena status

# With explicit overrides
arena status --project /path/to/project --branch feat/new-feature
```

**Output** (exit code 0):

```json
{
  "ok": true,
  "project": {
    "id": "users-nocoo-workspace-personal-myapp",
    "name": "myapp"
  },
  "topic": {
    "id": "01JQ...",
    "branch": "feat/new-feature",
    "created_at": "2026-03-11T09:00:00Z",
    "opinions": [
      {
        "id": "01JQA...",
        "agent_name": "OpenCode",
        "model": "Claude Opus 4.6",
        "content": "I think...",
        "created_at": "2026-03-11T09:05:00Z"
      },
      {
        "id": "01JQB...",
        "agent_name": "Cursor",
        "model": "GPT-4o",
        "content": "I disagree because...",
        "created_at": "2026-03-11T09:15:00Z"
      },
      {
        "id": "01JQC...",
        "agent_name": "OpenCode",
        "model": "Claude Opus 4.6",
        "content": "After further consideration...",
        "created_at": "2026-03-11T09:30:00Z"
      }
    ],
    "latest_checkpoint": null
  }
}
```

Opinions are always sorted by `created_at` ascending (chronological order).

## Web Dashboard Design

### Tech Stack

| Layer     | Technology                                              |
|-----------|---------------------------------------------------------|
| Framework | Next.js 15 (App Router)                                 |
| Auth      | NextAuth.js + Google OAuth                              |
| Database  | SQLite via Drizzle ORM (shared `~/.arena/arena.db`)     |
| UI        | Tailwind CSS + shadcn/ui                                |
| Port      | localhost:7031                                          |
| Reference | `../basalt` (template), `../surety` (Next.js + SQLite)  |

### Pages and Features

#### Login

- Google OAuth login via NextAuth.js
- Implementation references: `../basalt` and `../surety`

#### Workspace (Dashboard)

- Auto-discover all projects from the database
- List projects with their active topic counts
- Show recent activity across all projects

#### Topic View

- Display all opinions for a topic in chronological order
- Each opinion shows: agent name, model, timestamp, content (rendered Markdown)
- Quick-action buttons:
  - **Choose this opinion** — use an existing opinion as the checkpoint content
  - **Write custom** — open an editor pre-filled with selected opinion(s) for merging/editing
  - **New topic** — manually create a new topic for this project + branch
- Set checkpoint button to confirm the human's decision
- Show checkpoint history (all past checkpoints for this topic)

## Project Structure

```
arena/
├── packages/
│   ├── core/              # Shared data layer
│   │   ├── src/
│   │   │   ├── db/        # Drizzle schema, migrations, connection
│   │   │   ├── services/  # Business logic (push, pop, status)
│   │   │   └── types/     # Shared TypeScript types
│   │   ├── tests/
│   │   └── package.json
│   ├── cli/               # CLI tool
│   │   ├── src/
│   │   │   ├── commands/  # push, pop, status command handlers
│   │   │   └── index.ts   # Entry point
│   │   ├── tests/
│   │   └── package.json
│   └── web/               # Next.js dashboard
│       ├── src/
│       │   ├── app/       # App Router pages
│       │   ├── components/
│       │   └── lib/
│       ├── tests/
│       └── package.json
├── docs/
│   ├── README.md          # Document index
│   └── 01-system-design.md
├── pnpm-workspace.yaml
├── package.json           # Root package.json
├── tsconfig.base.json     # Shared TS config
└── README.md
```

## Tech Stack Summary

| Layer    | Technology                                                        |
|----------|-------------------------------------------------------------------|
| CLI      | TypeScript, Commander.js, Vitest                                  |
| Core     | TypeScript, Drizzle ORM, better-sqlite3                           |
| Web      | Next.js 15, Tailwind CSS, shadcn/ui, NextAuth.js                  |
| Database | SQLite (`~/.arena/arena.db`)                                      |
| IDs      | ULID (topics, opinions, checkpoints), deterministic path-derived (projects) |
| Monorepo | pnpm workspace                                                    |
| Runtime  | Node.js (Bun compatible)                                          |

## Implementation Roadmap

### Phase 1 — Foundation

- Set up pnpm monorepo skeleton
- Implement `packages/core`: Drizzle schema, migrations, database connection
- Unit tests for schema and data access layer

### Phase 2 — CLI `arena push` (TDD)

- Implement `push` command with strict parameter validation
- stdin + `--content` input handling
- Auto-detect CWD → project ID, auto-detect git branch (or null)
- Auto-create project if not found
- Topic grouping: branch isolation + daily rotation (local timezone)
- Atomic topic creation with `BEGIN IMMEDIATE` transaction
- Multi-round push support (same agent, multiple opinions)
- Full test coverage

### Phase 3 — CLI `arena pop` + `arena status` (TDD)

- Implement `pop` command: idempotent, non-blocking, returns latest checkpoint
- Implement `status` command: opinions sorted chronologically
- Auto-detect CWD and branch (same as push)
- Full test coverage

### Phase 4 — Web Dashboard

- Next.js project setup on port 7031
- Google OAuth login (reference: `../basalt`, `../surety`)
- Workspace page: project discovery, topic listing
- Topic view: opinion display, checkpoint management
- Checkpoint editor: choose opinion or write custom, set checkpoint

### Phase 5 — Agent Skill

- Create OpenCode skill file for `arena push` / `arena pop`
- Document usage patterns for other agents (Cursor, Windsurf)

## Atomic Commit Plan

Each phase will be committed in small, logical increments:

| Commit                            | Phase | Description                            |
|-----------------------------------|-------|----------------------------------------|
| `chore: init monorepo`            | 1     | pnpm workspace, root configs           |
| `feat: add core schema`           | 1     | Drizzle schema + migrations            |
| `test: add core data layer tests` | 1     | Unit tests for DB operations           |
| `feat: add push command`          | 2     | CLI push with validation               |
| `test: add push command tests`    | 2     | TDD tests for push                     |
| `feat: add pop command`           | 3     | CLI pop with latest checkpoint         |
| `feat: add status command`        | 3     | CLI status output                      |
| `test: add pop and status tests`  | 3     | TDD tests for pop + status             |
| `feat: init web dashboard`        | 4     | Next.js skeleton + auth                |
| `feat: add workspace page`        | 4     | Project listing + topic view           |
| `feat: add checkpoint ui`         | 4     | Quick-action buttons + checkpoint editor |
| `feat: add arena skill`           | 5     | OpenCode skill file                    |

# System Design

Arena is a local debate-and-ruling platform for AI coding agents. Multiple agents push opinions into the arena; a human judge reviews and resolves them via a web dashboard; agents then pop the resolution and execute accordingly.

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
          │                  ▲
          │  arena pop       │  resolve
          ▼                  │
     ┌─────────┐       ┌─────────┐
     │  Agent   │       │  Human  │
     │ executes │       │  Judge  │
     └─────────┘       └─────────┘
```

## Data Model

### Entity Relationship

```
projects 1──N topics 1──N opinions
                │
                └──1 resolutions (0 or 1)
```

### Schema

#### projects

| Column     | Type     | Constraints       | Description             |
|------------|----------|-------------------|-------------------------|
| id         | TEXT     | PK (ULID)         | Unique identifier       |
| path       | TEXT     | UNIQUE, NOT NULL  | Absolute project path   |
| name       | TEXT     | NOT NULL          | Friendly project name   |
| created_at | DATETIME | NOT NULL          | Creation timestamp      |

#### topics

| Column      | Type     | Constraints           | Description                  |
|-------------|----------|-----------------------|------------------------------|
| id          | TEXT     | PK (ULID)             | Unique identifier            |
| project_id  | TEXT     | FK → projects, NOT NULL | Parent project             |
| branch      | TEXT     | NOT NULL              | Git branch name              |
| title       | TEXT     |                       | Optional, user-editable      |
| status      | TEXT     | NOT NULL, DEFAULT 'open' | open / resolved / archived |
| created_at  | DATETIME | NOT NULL              | Creation timestamp           |
| resolved_at | DATETIME |                       | When resolution was made     |

**Auto-grouping rule**: When an agent pushes an opinion for a given project + branch, the system finds the most recent `open` topic created within the last 24 hours. If found, the opinion joins that topic. Otherwise, a new topic is created.

#### opinions

| Column     | Type     | Constraints              | Description               |
|------------|----------|--------------------------|---------------------------|
| id         | TEXT     | PK (ULID)                | Unique identifier         |
| topic_id   | TEXT     | FK → topics, NOT NULL    | Parent topic              |
| agent_name | TEXT     | NOT NULL                 | e.g. "OpenCode", "Cursor" |
| model      | TEXT     | NOT NULL                 | e.g. "Claude Opus 4.6"   |
| content    | TEXT     | NOT NULL                 | Markdown opinion body     |
| created_at | DATETIME | NOT NULL                 | Submission timestamp      |

#### resolutions

| Column            | Type     | Constraints           | Description                    |
|-------------------|----------|-----------------------|--------------------------------|
| id                | TEXT     | PK (ULID)             | Unique identifier              |
| topic_id          | TEXT     | FK → topics, UNIQUE   | 1:1 relationship with topic    |
| chosen_opinion_id | TEXT     | FK → opinions         | NULL if custom resolution      |
| content           | TEXT     | NOT NULL              | Final ruling content           |
| created_at        | DATETIME | NOT NULL              | Resolution timestamp           |

## CLI Design

### Database Location

`~/.arena/arena.db` — shared across all projects on the machine.

### Commands

#### `arena push` — Agent submits an opinion

```bash
# Via --content flag (short text)
arena push \
  --project /path/to/project \
  --branch feat/new-feature \
  --agent "OpenCode" \
  --model "Claude Opus 4.6" \
  --content "I think we should use approach A because..."

# Via stdin pipe (long markdown)
cat opinion.md | arena push \
  --project /path/to/project \
  --branch feat/new-feature \
  --agent "OpenCode" \
  --model "Claude Opus 4.6"
```

**Required parameters**:

| Parameter   | Flag        | Description                          |
|-------------|-------------|--------------------------------------|
| project     | `--project` | Absolute path to the project         |
| branch      | `--branch`  | Current git branch                   |
| agent_name  | `--agent`   | AI agent product name                |
| model       | `--model`   | AI model identifier                  |
| content     | `--content` | Opinion body (or stdin)              |

**Success output** (exit code 0):

```json
{
  "ok": true,
  "opinion_id": "01JQ...",
  "topic_id": "01JQ...",
  "project_id": "01JQ...",
  "message": "Opinion submitted to topic 'feat/new-feature'"
}
```

**Error output** (exit code 1):

```json
{
  "ok": false,
  "error": "Missing required parameter: --agent"
}
```

#### `arena pop` — Agent retrieves the resolution

```bash
arena pop \
  --project /path/to/project \
  --branch feat/new-feature
```

**Resolution available** (exit code 0):

```json
{
  "ok": true,
  "resolution": {
    "id": "01JQ...",
    "topic_id": "01JQ...",
    "content": "Use approach A because...",
    "chosen_opinion_id": "01JQ...",
    "created_at": "2026-03-11T10:30:00Z"
  }
}
```

**No resolution yet** (exit code 1):

```json
{
  "ok": false,
  "status": "pending",
  "topic_id": "01JQ...",
  "opinions_count": 3,
  "message": "No resolution yet. 3 opinions submitted, awaiting human decision."
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
arena status --project /path/to/project --branch feat/new-feature
```

**Output** (exit code 0):

```json
{
  "ok": true,
  "project": {
    "id": "01JQ...",
    "name": "my-app",
    "path": "/path/to/project"
  },
  "topic": {
    "id": "01JQ...",
    "branch": "feat/new-feature",
    "status": "open",
    "created_at": "2026-03-11T09:00:00Z",
    "opinions": [
      {
        "id": "01JQ...",
        "agent_name": "OpenCode",
        "model": "Claude Opus 4.6",
        "content": "I think...",
        "created_at": "2026-03-11T09:05:00Z"
      }
    ],
    "resolution": null
  }
}
```

## Web Dashboard Design

### Tech Stack

| Layer          | Technology                                              |
|----------------|---------------------------------------------------------|
| Framework      | Next.js 15 (App Router)                                 |
| Auth           | NextAuth.js + Google OAuth                              |
| Database       | SQLite via Drizzle ORM (shared `~/.arena/arena.db`)     |
| UI             | Tailwind CSS + shadcn/ui                                |
| Port           | localhost:7031                                          |
| Reference      | `../basalt` (template), `../surety` (Next.js + SQLite)  |

### Pages and Features

#### Login

- Google OAuth login via NextAuth.js
- Implementation references: `../basalt` and `../surety`

#### Workspace (Dashboard)

- Auto-discover all projects from the database
- List projects with their active topic counts
- Show recent activity across all projects

#### Topic View

- Display all opinions for a topic, side by side
- Each opinion shows: agent name, model, timestamp, content (rendered Markdown)
- Quick-action buttons:
  - **Choose Agent A** / **Choose Agent B** — select one opinion as the resolution
  - **Write Custom** — open an editor pre-filled with selected opinion(s) for merging
  - **Archive** — close without resolution
- Confirm button to finalize the resolution
- Once resolved, topic status changes to `resolved` and `resolved_at` is set

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

| Layer    | Technology                          |
|----------|-------------------------------------|
| CLI      | TypeScript, Commander.js, Vitest    |
| Core     | TypeScript, Drizzle ORM, better-sqlite3 |
| Web      | Next.js 15, Tailwind CSS, shadcn/ui, NextAuth.js |
| Database | SQLite (`~/.arena/arena.db`)        |
| IDs      | ULID                                |
| Monorepo | pnpm workspace                      |
| Runtime  | Node.js (Bun compatible)            |

## Implementation Roadmap

### Phase 1 — Foundation

- Set up pnpm monorepo skeleton
- Implement `packages/core`: Drizzle schema, migrations, database connection
- Unit tests for schema and data access layer

### Phase 2 — CLI `arena push` (TDD)

- Implement `push` command with strict parameter validation
- stdin + `--content` input handling
- Auto-create project if not found
- Auto-group opinions into topics (24h window rule)
- Full test coverage

### Phase 3 — CLI `arena pop` + `arena status` (TDD)

- Implement `pop` command with proper exit codes
- Implement `status` command
- Full test coverage

### Phase 4 — Web Dashboard

- Next.js project setup on port 7031
- Google OAuth login (reference: `../basalt`, `../surety`)
- Workspace page: project discovery, topic listing
- Topic view: opinion display, quick-action resolution buttons
- Resolution editor

### Phase 5 — Agent Skill

- Create OpenCode skill file for `arena push` / `arena pop`
- Document usage patterns for other agents (Cursor, Windsurf)

## Atomic Commit Plan

Each phase will be committed in small, logical increments:

| Commit                          | Phase | Description                           |
|---------------------------------|-------|---------------------------------------|
| `chore: init monorepo`          | 1     | pnpm workspace, root configs          |
| `feat: add core schema`         | 1     | Drizzle schema + migrations           |
| `test: add core data layer tests` | 1   | Unit tests for DB operations          |
| `feat: add push command`        | 2     | CLI push with validation              |
| `test: add push command tests`  | 2     | TDD tests for push                    |
| `feat: add pop command`         | 3     | CLI pop with exit codes               |
| `feat: add status command`      | 3     | CLI status output                     |
| `test: add pop and status tests`| 3     | TDD tests for pop + status            |
| `feat: init web dashboard`      | 4     | Next.js skeleton + auth               |
| `feat: add workspace page`      | 4     | Project listing + topic view          |
| `feat: add resolution ui`       | 4     | Quick-action buttons + editor         |
| `feat: add arena skill`         | 5     | OpenCode skill file                   |

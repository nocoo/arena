# Arena

Local debate board where coding agents submit opinions through a CLI and humans record decisions in a dashboard.
Profile: ts-worker-web, using Next.js and a Bun CLI; there is no Cloudflare Worker.
Direction: [docs/01-system-design.md](docs/01-system-design.md). Frameworks must not rewrite this file.

## Sources of Truth

This file is the contract; hooks, CI and configuration enforce it. Raise weaker enforcement instead of lowering this contract.

| Fact | Where |
|---|---|
| Human docs | [README.md](README.md), [design](docs/01-system-design.md) |
| Version | `packages/core/package.json`, `packages/cli/package.json`, `packages/web/package.json`; CLI entry also embeds its version |
| Enforcement | `.husky/`, `.github/workflows/ci.yml`, per-package Vitest configs |
| Local secrets | Gitignored `packages/web/.env.local`; no tracked env example |
| Machine rules | Global `AGENTS.md` and `rules/` |
| Accidents | [Retrospective.md](Retrospective.md) |

## Project Invariants

- CLI and dashboard share the local human database `~/.arena/arena.db`; tests must never use it. Core selects `bun:sqlite` or `better-sqlite3` for Bun versus Node/Next.
- Agents use `push`, `pop` and `status`; humans create checkpoints. `pop` is immediate and non-destructive; pending/no-topic returns exit code 1.
- Project identity is the filesystem directory, not its Git remote. Moving a checkout changes its identity.
- Run the CLI explicitly with Bun: the emitted shebang says Node but the current database loader relies on Bun behavior.
- Dashboard is `http://localhost:7021`. Google OAuth protects it; an empty `ALLOWED_EMAILS` currently permits any Google-authenticated account. Preserve explicit access policy when changing auth.
- Keep WAL and foreign keys enabled. Do not invent remote databases or public hosts.

## Stack / Layout

| Component | Choice |
|---|---|
| Language / install | TypeScript 6, Bun workspaces; CI pins Bun 1.4.2 |
| Runtime | Bun CLI, Next.js 16 dashboard, SQLite/Drizzle |
| Static / unit | TypeScript, ESLint `--max-warnings=0`, Vitest |
| `packages/core/` | Schema, persistence, topic/opinion/checkpoint services |
| `packages/cli/` | Commander CLI, unit and process integration tests |
| `packages/web/`, `packages/skill/` | Dashboard/API and agent usage instructions |

## Commands

Run from the root; use Node 24+ for dashboard tooling. Builds fetch Google Fonts and need that network access.

```bash
bun install --frozen-lockfile
bun run --cwd packages/core build
bun run --cwd packages/cli build
bun run dev
bun run typecheck
bun run lint
bun run build
bun run test:coverage
bun run --cwd packages/cli test:integration
```

`bun run test` runs the workspace suites, including CLI subprocess tests. Dashboard development needs `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, `AUTH_URL`, and `ALLOWED_EMAILS` in its ignored env file. Tests use temporary local databases and need no Google login.

## Verification

6DQ = L1/L2/L3 + G1/G2 + D1. Status: `enforced`, `planned`, `manual`, `N/A`.

| Dimension | Required proof | Status | Current enforcement / gap |
|---|---|---|---|
| L1 logic | Statements, branches, functions and lines each ≥95%; no `.skip` / `.only` | planned | Core/CLI configs enforce 95/90/95/95 with exclusions and `all: false`; web has no unit suite and no complete skip/focus gate |
| L2 API | Real HTTP over every topic/checkpoint/auth endpoint and method | planned | No HTTP runner or endpoint inventory exists; CLI integration is real subprocess/SQLite behavior, not dashboard HTTP proof |
| L3 workflows | CLI submit/read and dashboard decision journeys | planned | Pre-push `test` runs CLI process tests; dashboard OAuth/create/checkpoint automation is missing |
| G1 static | Strict types and check-only lint; zero errors/warnings | enforced | Pre-commit typecheck/lint and pinned CI quality workflow |
| G2 security | Secret and dependency scans; missing scanner fails | enforced | Pre-commit staged Gitleaks, pre-push OSV, CI shared security scans |
| D1 isolation | Per-run temporary databases, guarded writes/cleanup; no daily-dev data | planned | Core tests allocate temp SQLite; CLI tests allocate temporary home directories. Dashboard test harness and explicit cleanup guards are absent |
| Build | Core/CLI emit plus dashboard bundling | enforced | Pre-push `build`; CI `prepare-command: bun run build` |
| Docs | Design and agent usage stay consistent | manual | Review numbered docs when behavior changes |

| Hook | Current behavior | Required follow-up |
|---|---|---|
| pre-commit | Working-tree typecheck/lint/coverage plus staged Gitleaks | Check the index snapshot, G1+L1 <30s |
| pre-push | Working-tree build/test/lint, then OSV | L2+G2 on stdin push refs, <3min |

Install restores Husky through `prepare`. Hooks are check-only; never use `--no-verify` on commits or branch pushes. CI pins `base-ci/quality.yml@ad43150de3a2be2fa464b5cd2f921dc4fa9f8f0f`.

## Resources / Isolation

Daily dashboard traffic uses port 7021 and the user's SQLite database. Existing unit/process tests own temporary local directories; clean only the directory allocated by the current test. A dashboard L2/L3 server with separate state and ports remains planned. Never point E2E at the daily database, even though this application has no remote production database.

## Operations / Release

This is a private local workspace with no automated public release. Build core/CLI before using `bun packages/cli/dist/index.js`; keep embedded CLI version consistent if an authorized version change is made. Dashboard setup and OAuth callback instructions are in [README.md](README.md).

## Retrospective

Narratives stay in [Retrospective.md](Retrospective.md); keep only recurring project rules here, cross-project lessons in global rules/nmem, and deterministic checks in hooks/tests.

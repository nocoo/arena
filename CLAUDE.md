# Arena

Local debate board for AI coding agents: agents `push`/`pop`, a human sets checkpoints on a web dashboard.
Profile: ts-worker-web (Next.js dashboard + CLI, not a Worker).
Direction: [docs/01-system-design.md](docs/01-system-design.md). Frameworks must not rewrite this file.

## Sources of Truth

This file is the **contract**. Hooks, CI, and config are **enforcement**. If they disagree, that is a failure — raise enforcement; never lower this file to a weaker hook.

| Fact | Where |
|---|---|
| Agent handbook | this file |
| Human docs | README.md, `docs/01-system-design.md` |
| Version | `packages/{core,cli,web}/package.json` `"version"` (`0.1.0`); root has none |
| Enforcement | `.husky/pre-commit`, `.husky/pre-push`, `packages/core/vitest.config.ts`, `packages/cli/vitest.config.ts` |
| Machine rules | global `AGENTS.md`, `rules/git-commit.md` |
| Accidents | [Retrospective.md](Retrospective.md) |
| Env files | omit (no tracked `.env.example`) |

## Project Invariants

- SQLite lives at `~/.arena/arena.db` via `bun:sqlite`. Do not point tests or the dashboard at a remote database.
- Agents only `arena push` / `arena pop`. Humans set checkpoints in the dashboard.
- Dashboard is `http://localhost:7021`. Do not invent extra public hosts.
- Coverage gates apply to `core` and `cli` only. `@arena/web` has no unit tests today.

## Stack / Layout

| Component | Choice |
|---|---|
| Language | TypeScript 6 |
| Package manager | Bun workspaces |
| Runtime | CLI on Bun; Next.js 16 dashboard |
| Lint | ESLint `--max-warnings=0` |
| Tests | Vitest L1 on core+cli (95/95/95, branches 90) |
| Data | `bun:sqlite` `~/.arena/arena.db` |

```
packages/core/   schema, drizzle, services
packages/cli/    arena push/pop/status
packages/web/    Next.js dashboard :7021
docs/            numbered design doc
```

## Commands

```bash
bun run dev
bun run typecheck
bun run lint
bun run build
bun run test:coverage
```

## Verification

Status: `enforced` | `planned` | `manual` | `N/A`. `enforced` Evidence = hook/CI/config/script. `planned` has no Evidence. `manual` = human checklist.

Org gaps to raise later (do not lower this file): index-snapshot pre-commit; stdin-range pre-push; `.skip`/`.only`; L2 real-HTTP; web L1; L3/L5. Today’s hooks run on the working tree (`typecheck`/`lint`/`test:coverage`/`gitleaks`; pre-push `build && test && lint` + osv).

| Change | Proof | Status | Evidence |
|---|---|---|---|
| Logic | L1 vitest ≥95% stmt/func/line, 90% branches on core+cli | enforced | pre-commit → `test:coverage`; vitest configs |
| API L2 real HTTP | 100% HTTP method combos | N/A | — (local sqlite services, no HTTP API suite) |
| UI L3 | Playwright | planned | — |
| Types / lint | tsc + ESLint 0 warning | enforced | pre-commit → `typecheck`, `lint` (working tree; not snapshot) |
| G2 secrets | gitleaks | enforced | pre-commit → `gitleaks protect --staged` |
| G2 deps | osv-scanner | enforced | pre-push → `osv-scanner scan --lockfile=bun.lock` |
| `.skip` / `.only` | lint error | planned | — |
| Bundler | `next build` + workspace build | enforced | pre-push → `bun run build` |
| Docs | numbered doc if behavior changes | manual | human review |
| Release | none | N/A | — |

| Hook | Org bar | Status | Evidence |
|---|---|---|---|
| pre-commit | index snapshot for G1+L1 | planned | — |
| pre-push | stdin ref range | planned | — |

`--no-verify` forbidden on commits and branch pushes. Tag-only may skip.

## Resources / Isolation

| Purpose | Port / resource | Isolation |
|---|---|---|
| Dev | 7021 `http://localhost:7021` | local sqlite `~/.arena/arena.db` |
| Tests | vitest in-process | package tests; do not use a shared human DB |

E2E never touches prod data stores (there is no remote prod).

## Retrospective

| Kind | Where |
|---|---|
| Accident narrative | [Retrospective.md](Retrospective.md) |
| Recurring project rule | one line here (cap ~10) |
| Cross-project | nmem / global rules |
| Checkable rule | hook or test |

- (none yet)

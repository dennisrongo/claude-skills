# claude-skills

The [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) skills I ([Dennis Rongo](https://github.com/dennisrongo)) use every day — not shelfware, not theory. Each one earns its place by surviving real work: shipping features, reviewing PRs, debugging production, designing architecture, and keeping commits clean.

They're small, composable, and meant to be tuned. Install the ones you want, edit them in-place, send a PR if yours sharpens mine.

> Skills are reusable bundles of instructions that Claude consults when relevant. This repo is my personal daily-driver library — grow it over time, tune the ones that misfire, install the set you want on any machine.

## Quick start

### From npm (recommended)

The package is published as [`@dennisrongo/skills`](https://www.npmjs.com/package/@dennisrongo/skills). The installed binary is `skills`.

```bash
# See what's in the library
npx @dennisrongo/skills list

# Interactive picker, global (~/.claude/skills)
npx @dennisrongo/skills install

# Interactive picker, project-scoped (./.claude/skills)
npx @dennisrongo/skills install -p

# Install specific skills globally (~/.claude/skills)
npx @dennisrongo/skills install conventional-commits pr-review

# Install specific skills into the current project
npx @dennisrongo/skills install conventional-commits pr-review -p

# Install everything into the current project (./.claude/skills)
npx @dennisrongo/skills install --all --project
```

Or install once and call it directly:

```bash
npm install -g @dennisrongo/skills
skills list
```

### From GitHub (for the latest `main`)

Useful if you want changes that haven't been released to npm yet.

```bash
npx github:dennisrongo/claude-skills list
npx github:dennisrongo/claude-skills install
```

> The interactive picker, `--all`, and named-skill installs all accept `-p` / `--project` to target `./.claude/skills` instead of the global `~/.claude/skills`. Run it from the project root.

### Shorter alias (recommended)

`npx github:dennisrongo/claude-skills` is a mouthful. Add a shell alias:

```bash
# bash / zsh — add to ~/.bashrc or ~/.zshrc
alias skills="npx --yes github:dennisrongo/claude-skills"

# fish — add to ~/.config/fish/config.fish
alias skills "npx --yes github:dennisrongo/claude-skills"
```

Then:

```bash
skills list
skills install --all
```

### Pinning a version

`npx github:...` resolves to the latest commit on `main`. To pin to a specific commit, branch, or tag:

```bash
npx github:dennisrongo/claude-skills#v0.1.0 install      # tag
npx github:dennisrongo/claude-skills#abc1234 install     # commit SHA
npx github:dennisrongo/claude-skills#some-branch install # branch
```

### Local clone (for contributors)

```bash
git clone https://github.com/dennisrongo/claude-skills.git
cd claude-skills
npm install
node bin/claude-skills.js list
```

## Available skills

| Skill | What it does |
|---|---|
| [`api-contract-review`](./skills/api-contract-review/SKILL.md) | Review an API's contract as a **promise to consumers you can't see** — HTTP endpoints, webhooks, published events, SDK-facing types. Two evidence rules do the work: a **breaking** verdict requires a before/after diff of a consumer-visible element (`git show` the old DTO/spec vs. the working tree — removed/renamed fields, type changes, requiredness tightened on requests, status-code or enum semantics changed under the same name), and an **inconsistency** finding requires citing the in-repo precedent being violated (error envelope, naming, pagination style, auth placement — grep the siblings first or don't flag it). Also checks the day-one invariants that can't be retrofitted: collections paginate from the start, retryable writes are idempotent, errors carry a machine-usable `code`, no ORM entities serialized wholesale, timestamps/money carry explicit units. Reports **Breaking / Design / Questions**, ranked — zero findings is a valid outcome. Distinct from [`code-review`](./skills/code-review/SKILL.md) (implementation quality): this reviews the *surface*. Triggers on "review this API", "is this a breaking change", "check backward compatibility", "review the contract", or `/api-contract-review`. |
| [`autopilot`](./skills/autopilot/SKILL.md) | Fully autonomous end-to-end task run with **no human gates** — acquires the work item (via [`azure-devops`](./skills/azure-devops/SKILL.md) or [`github`](./skills/github/SKILL.md) if installed, **including embedded screenshots**, or an inline description), plans against the real codebase and **self-grills the plan** (the [`think-like-fable`](./skills/think-like-fable/SKILL.md) attack replaces the approval click), executes incrementally with observed verification per increment, writes risk-ranked tests, runs code review with **blocker-fix authority** (suggestions are logged, never applied unattended — that's scope creep), then **stops dead before any commit/push/PR** and delivers an evidence-backed report with an ASSUMPTIONS table (every question it would have asked → the answer chosen → blast radius if wrong) and paste-ready commit commands. Replaces questions with documented assumptions; hard-stops only on destructive actions, missing access, or a spec the codebase contradicts. Launch headless: `claude -p "autopilot task 123" --permission-mode acceptEdits`. Triggers on "autopilot task <id>", "run this autonomously", "work this end to end without asking", or `/autopilot`. |
| [`azure-devops`](./skills/azure-devops/SKILL.md) | Work with any Azure DevOps org via the az CLI, fully **config-driven** — org, project, target branch, and required-reviewer GUIDs live in `.claude/azure-devops.json` (the skill offers to create it on first use; nothing org-specific is hardcoded). Queries assigned/sprint work items with WIQL, reads a work item's description **and downloads + views its embedded screenshots** (acceptance criteria hide in images), publishes branches only with approval, and creates PRs with house defaults — one PR per repo, required reviewers with a GUID PUT fallback when email resolution fails, auto-complete, work item linked — then **verifies every setting after creation**. Ships the battle-tested az.cmd sharp edges: JMESPath quoting through the batch wrapper, plain-float `--api-version`, stderr-polluted JSON parsing, PAT scope-gap diagnosis. Triggers on "pull my tasks", "read task 12345", "create a PR", "az boards", "az repos". |
| [`backlog-planner`](./skills/backlog-planner/SKILL.md) | The **intake side** of [`goal-runner`](./skills/goal-runner/SKILL.md) — turn a feature idea, conversation, or rough notes into researched, detailed, dependency-ordered checkbox tasks appended to the project's roadmap/backlog file, in exactly the format `goal-runner` and `/goal` consume unattended. **Research is most of the work**: every file/module/endpoint a task names is a claim that gets grepped or opened first (or rewritten as a locate-first spike), scouting scales from inline reads to parallel `Explore` sub-agents, the riskiest unknown is front-loaded, and [`think-like-fable`](./skills/think-like-fable/SKILL.md) rigor applies when installed. Each task passes the **fresh-session test** — one `- [ ]` line carrying what + done-when, with verified entry points, acceptance criteria, a verification command, and labeled `Assumes:` lines in plain sub-bullets (never nested checkboxes — those become phantom queue items). Appends to the existing `ROADMAP.md`/`BACKLOG.md`/`TODO.md` without reordering or ticking anything; when none exists, asks once and defaults to `ROADMAP.md` (goal-runner auto-discovers it). Two detailed tasks is a valid outcome — no padding, no invented requirements. Triggers on "add this to the backlog", "add it to the roadmap", "plan these tasks", "break this down into tasks", or `/backlog-planner`. |
| [`browser-use-web-test`](./skills/browser-use-web-test/SKILL.md) | Verify a web app end-to-end using [browser-use](https://github.com/browser-use/browser-use) — an open-source AI agent that drives a real headless browser to test flows, assert on visible state, and catch visual/DOM regressions. The web counterpart to [`maestro-mobile-test`](./skills/maestro-mobile-test/SKILL.md). Works against any URL the agent can reach (localhost dev servers, staging, production). Covers what fixed Playwright cannot: AI-driven exploratory testing where the agent decides what to click based on natural-language intent, not brittle selectors. Ships with cross-platform `scripts/setup.sh` (detects macOS/Linux/Windows, creates a dedicated venv, installs Playwright Chromium), `scripts/config.py` (auto-detects your LLM provider from standard env vars — OpenAI, Gemini, DashScope, Anthropic, Groq, OpenRouter, or Ollama — no hardcoded endpoints), and `scripts/verify_template.py` (copy-and-edit template). Same evidence discipline as [`e2e-verify`](./skills/e2e-verify/SKILL.md): ration by journey risk, quote observations per flow, prove assertions red-capable, "no issues found in the paths walked" — never "e2e passes". Triggers on "test my web app", "verify the web UI", "e2e test the frontend", "browser test this", "run browser-use", or `/browser-use-web-test`. |
| [`code-review`](./skills/code-review/SKILL.md) | Production-readiness review of **uncommitted** working-tree changes (staged + unstaged). Hunts DRY violations, dead code, leaky abstractions, premature abstraction, magic values, missing error handling, debug residue, missing migrations / flags / logs, and other common best-practice gaps — prioritized correctness → DRY/design → tests → security → performance → production-readiness → readability. On non-trivial diffs, convenes a **lens council**: parallel `Explore` sub-agents reviewing through distinct lenses (correctness / design / security / tests / production-readiness), followed by an **adversarial critique round** that challenges each lens's blocking flags against context from the others — false positives demoted, contradictions surfaced for the user, multi-lens findings promoted. Small diffs skip the council. Auto-detects and runs the project's tests and build (`npm`, `pytest`, `dotnet`, `go`, `cargo`, `Makefile`, monorepo orchestrators) and gates the verdict on them being green. **Never edits code unprompted** — produces a categorized report (`blocking` / `suggestion` / `nit` / `praise`) with `file:line` citations, then asks per-finding before fixing. Distinct from [`pr-review`](./skills/pr-review/SKILL.md), which scopes to committed branch work. Triggers on "code review", "review the diff", "is this production ready", "DRY check", or `/code-review`. |
| [`codebase-explainer`](./skills/codebase-explainer/SKILL.md) | Produce a durable onboarding artifact for a repo — writes `ONBOARDING.md` (or `docs/ONBOARDING.md` if `docs/` exists) with a tight **read this first** minimum, system overview, dependency map (top-level prod deps + how each is actually used in *this* codebase, with key call site), startup flow (entry point → bootstrap → config), auth flow (or an explicit "no auth detected" when there isn't one), and the 5–15 important files — every claim backed by a `file:line` citation. Walks the repo with **parallel Explore sub-agents** to stay context-safe on big projects, refreshes an existing `ONBOARDING.md` in place instead of rewriting from scratch, and is opinionated about what *not* to include (no dev/test/types deps, no 40-file "important files" lists, no fabricated auth flows, no dates that rot). Built for revisiting a project after months away — and for new teammates landing in an unfamiliar repo. Composes with [`improve-codebase-architecture`](./skills/improve-codebase-architecture/SKILL.md) when shallow-module clusters surface and [`handoff`](./skills/handoff/SKILL.md) for session-level state. Triggers on "explain this codebase", "onboard me", "give me a tour", "where do I start", "I haven't looked at this in months", or `/codebase-explainer`. |
| [`conventional-commits`](./skills/conventional-commits/SKILL.md) | Write git commit messages that follow the [Conventional Commits](https://www.conventionalcommits.org/) spec (`feat`, `fix`, `chore`, `docs`, …), auto-prefixed with the ticket number from the current branch (e.g. `feature/12345-...` → `#12345`) and a project tag (`API` / `CLIENT` / `CONSOLE` / `DB`) when detectable from the diff. Both prefixes are omitted when they don't apply. Triggers on commit-message requests. |
| [`create-pr`](./skills/create-pr/SKILL.md) | End-to-end pull-request flow with the review gate **before** publishing, where it belongs: runs [`pr-review`](./skills/pr-review/SKILL.md) on the branch (plus [`sql-review`](./skills/sql-review/SKILL.md) when SQL changed) — blocking findings are fixed or explicitly waived, with the waiver recorded in the PR body — then pushes with approval, creates **one PR per repo per work item** with configured house defaults, cross-references sibling PRs with deploy-order coupling stated (DB → API → client), and **re-reads each PR after creation** to confirm reviewers/links/auto-complete actually stuck (a setting you didn't check is not set). Detects the provider from the git remote: Azure DevOps → [`azure-devops`](./skills/azure-devops/SKILL.md), GitHub → [`github`](./skills/github/SKILL.md). Triggers on "create a PR", "publish the branch and create a PR", "ship this branch", or `/create-pr`. |
| [`diagnose`](./skills/diagnose/SKILL.md) | Disciplined diagnosis loop for hard bugs and performance regressions — reproduce → minimise → hypothesise → instrument → fix → regression-test. Forces a fast, deterministic feedback loop before any guessing. On non-trivial cases, Phase 3 convenes a **hypothesis council**: parallel `Explore` sub-agents — one per candidate hypothesis — each defending its case with falsifiable predictions and `file:line` evidence from the actual codebase, followed by a cross-examination round that drops defenders who couldn't find supporting evidence and ranks the survivors. Trivial bugs skip the council and use 1–2 inline hypotheses. Uses tagged `[DEBUG-...]` instrumentation that's trivially cleaned up, and ends with a post-mortem on what would have prevented the bug. Triggers on "diagnose this" / "debug this" / bug reports / flaky tests / perf regressions. |
| [`dotnet-onion-api`](./skills/dotnet-onion-api/SKILL.md) | Scaffold a new .NET solution (Web API + Worker microservices) using ONION architecture and EF Core, codifying battle-tested layered patterns and explicitly removing common legacy pitfalls (sproc-centric repos with reflection, EF6 on netstandard2.1, polling console workers, mutable base-service state, missing `CancellationToken`). Three modes — full solution scaffold, add-a-feature slice, add-a-worker microservice. Resolves TFM and NuGet versions at scaffold time (not hard-coded). |
| [`e2e-verify`](./skills/e2e-verify/SKILL.md) | Verify a change end-to-end in a real browser, routed by one question: **who needs this check to run again?** Nobody → **ephemeral**: run [Expect](https://github.com/millionco/expect) if installed (explicit non-prod `--url`, `--no-cookies` by default) or have Claude drive the browser directly — walking the flows the *diff* touches, verifying via DOM/accessibility state, and checking the console + network log after each flow (a page that looks right while logging exceptions is a finding). CI-forever (money/auth/signup/checkout/deletion) → **durable**: Playwright tests committed to the repo under [`write-tests`](./skills/write-tests/SKILL.md) discipline — extend the repo's existing e2e setup, `getByRole`/`getByTestId` selectors never CSS chains, no sleeps, API-seeded independent tests, every test **proven red-capable** with both runs quoted. The evidence rule that holds across every engine: an AI-walked flow yields *"no issues found in the paths walked"* with paths enumerated and observations quoted — never "e2e passes"; unobserved behavior is "not verified", never "works". Hard gate: no production targets, no real user cookies. Triggers on "verify this in the browser", "test it end to end", "e2e test this", "write playwright tests", "run expect", "smoke test the UI", or `/e2e-verify`. |
| [`github`](./skills/github/SKILL.md) | The gh-CLI twin of [`azure-devops`](./skills/azure-devops/SKILL.md) — fully config-driven (`.claude/github.json`: reviewers, target branch, title pattern, link keyword, auto-merge strategy; offered on first use). Queries assigned issues (`gh issue list`, cross-repo `gh search`, milestones as the sprint equivalent, Projects v2 boards), reads an issue's body **and comments** — acceptance criteria hide there — **and downloads embedded screenshots with the auth token** (private-repo attachments serve a login page to anonymous curl), publishes branches with approval, and creates PRs with reviewers, auto-merge (`gh pr merge --auto`), and the issue linked via a configurable closing keyword (`Closes` vs `Refs`, so merges don't silently close issues that should stay open). Knows the sharp edges: sibling PRs cross-referenced as `owner/repo#N` (bare `#N` resolves to the wrong item across repos), `--json` everywhere instead of parsing human output, and the honest answer on "required reviewers" (that's branch-protection/CODEOWNERS territory, not a PR flag). Triggers on "pull my issues", "read issue 123", "create a PR", "enable auto-merge". |
| [`goal-runner`](./skills/goal-runner/SKILL.md) | Autonomous roadmap loop — pairs with the built-in `/goal` Stop hook to work a task file (ROADMAP.md or any checkbox list) **one task at a time until it's done**, capturing the orchestration contract you'd otherwise retype into every `/goal` prompt. The main agent **orchestrates only**, driving each task with a distilled coordinator doctrine — risk-scaled fan-out (0–3 parallel scouts, exactly **one** coder as sole writer to the tree, review lenses in parallel, one task in flight at a time), riskiest-unknown-first scouting, and sub-agent reports treated as **testimony, not truth** (quoted output or `file:line` citation, else "not run") — composing every sub-agent prompt from bundled briefs (`references/agent-briefs.md`: scout / coder / reviewer / fixer, each with MUST-contain items and report formats). Coding runs under [`autopilot`](./skills/autopilot/SKILL.md)'s assumption-logging discipline, review via [`code-review`](./skills/code-review/SKILL.md) (blockers fixed, suggestions logged never applied), regression against a baseline suite run captured before task 1. A task closes only on observed evidence — quoted green run, zero blockers — then its checkbox is ticked; **no commits or pushes unless the goal text explicitly grants them** (the same human-gate guardrail as `autopilot` — when granted, one commit per task, never red, never batched; when not, the report ends with a paste-ready commit block), and never a faked checkbox (blocked tasks get annotated `BLOCKED: <reason>` and skipped, then reported). Context running low mid-roadmap → [`handoff`](./skills/handoff/SKILL.md) so the next session resumes the loop instead of restarting it. Triggers on "work on the roadmap tasks til completion", "work the roadmap", "use sub agents to work tasks until completion", or `/goal-runner`. |
| [`handoff`](./skills/handoff/SKILL.md) | Capture a session hand-off before context runs out — writes a dated `.claude/handoffs/*.md` (objective, progress, decisions, files, open issues, ready-to-paste next-session prompt) plus a lightweight memory pointer so a fresh Claude session can resume cleanly. |
| [`improve-codebase-architecture`](./skills/improve-codebase-architecture/SKILL.md) | Surface architectural friction and propose **deepening opportunities** — refactors that collapse clusters of shallow modules into one deep module with a real seam. Walks the codebase with an Explore sub-agent, applies the **deletion test** to suspected pass-throughs, presents numbered candidates (files / problem / solution / benefits) using `CONTEXT.md` for the domain and a strict architecture glossary (module / interface / seam / depth / leverage / locality) for the structure, then drops into a grilling loop with optional parallel sub-agent interface design ("Design It Twice"). Updates `CONTEXT.md` inline as new concepts get named and offers an ADR only when a rejection is load-bearing. Writes no production code. Triggers on "improve architecture", "architecture review", "find refactoring / deepening opportunities", "find shallow modules", "make this more testable", or `/improve-codebase-architecture`. |
| [`maestro-mobile-test`](./skills/maestro-mobile-test/SKILL.md) | Write and run E2E tests for React Native / Expo apps using [Maestro](https://github.com/mobile-dev-inc/maestro) CLI — the open-source tool that drives the **real native app** on an emulator/simulator, not a web build. Covers what browser-based e2e ([`e2e-verify`](./skills/e2e-verify/SKILL.md), [`browser-use-web-test`](./skills/browser-use-web-test/SKILL.md)) cannot reach: native components, biometrics (`expo-local-authentication`), secure storage (`expo-secure-store`), push notifications, platform-specific modules. Write YAML flows, run headed for authoring or headless for CI. Ships with cross-platform `scripts/setup.sh` (auto-installs Java 17 via Homebrew/apt/winget, detects Android SDK, installs Maestro CLI), `scripts/run_flow.sh` (boots emulator, sets up `adb reverse` for backend access, runs a flow), and `scripts/flow_template.yaml` (copy-and-edit). Hard-won pitfalls baked in: dev builds break under cold launch (Metro connection drops), the `back` button exits the app, `hideKeyboard` backgrounds it, icon-only buttons need `accessibilityLabel`, and the emulator can't reach your `localhost` without `adb reverse`. Triggers on "test my react native app", "e2e the mobile app", "write maestro tests", "test the expo app", "automate emulator testing", or `/maestro-mobile-test`. |
| [`migration-safety`](./skills/migration-safety/SKILL.md) | Review a schema migration for **production safety under live traffic** — the three failure axes are locks, deploy ordering, and irreversibility. Destructive ops (drops, renames — a rename IS a drop+add to running old code — type narrowing, `NOT NULL` tightening) are blockers unless an **expand → migrate readers → contract-in-a-later-release** plan is stated. Lock findings must name the engine, the specific lock, and its duration driver (no "might be slow" — and no flagging what's actually free, like a defaulted nullable add on modern PG/SQL Server). Checks the deploy-order contract **both ways** (old code on new schema during rollout, new-code data on old schema during rollback), separates backfills from DDL, and demands an honest rollback verdict per migration (an auto-generated down that drops a column does *not* restore its data). **Never executes** migrations or any SQL. Distinct from [`sql-review`](./skills/sql-review/SKILL.md) (T-SQL antipatterns in procs): this judges schema changes against the deploy timeline. Triggers on "review this migration", "is this migration safe", "will this lock the table", "zero-downtime migration", or `/migration-safety`. |
| [`nextjs-app-router`](./skills/nextjs-app-router/SKILL.md) | Scaffold a new Next.js (App Router) **fullstack** app — TypeScript, **NextAuth (Auth.js v5)**, **Prisma + PostgreSQL**, Route Handlers as the backend, Redux Toolkit + RTK Query, Tailwind + shadcn/ui (Radix), React Hook Form + Zod. **API-driven by deliberate choice**: pages are `'use client'`, all data flows UI → RTK Query → `/api/**` Route Handlers → Prisma. No `fetch()` in server components, no Server Actions, no async `page.tsx`. Confirms the database (Postgres + Prisma) and NextAuth providers with the user before writing files. Forbids the usual pitfalls (custom JWT cookies alongside NextAuth, multiple `createApi`/`PrismaClient` instances, `serializableCheck: false`, `@ts-ignore`, mixed `moment`/`date-fns`, `styled-components` alongside Tailwind, case-sensitive folder dupes, `dangerouslySetInnerHTML` without sanitization, Route Handlers that skip `requireSession()` or trust client-sent user IDs, `prisma db push` in CI). Three modes — full project scaffold, add-a-feature slice (page + form + Route Handler + Zod schema + RTK Query endpoints + Prisma model), add-an-API-slice. Resolves package versions at scaffold time (not hard-coded). |
| [`pr-review`](./skills/pr-review/SKILL.md) | Structured review of a local branch, **grouped per `#NNN` task** referenced in commit messages, prioritized correctness → design → tests → security → performance → readability, with categorized feedback (`blocking` / `suggestion` / `question` / `nit` / `praise`). On non-trivial tasks, convenes a **per-task lens council**: parallel `Explore` sub-agents through distinct lenses (correctness / design / security / tests) on that task's diff only, followed by an **adversarial critique round** that demotes false-positive blockers when another lens defuses them, surfaces contradictions as `question` items for the user, and promotes findings raised by multiple lenses independently. Small tasks skip the council. The council never crosses task boundaries — each `#NNN` gets its own verdict. Triggers on "review my PR", "review the diff", "review my branch", or `/pr-review`. |
| [`safe-refactor`](./skills/safe-refactor/SKILL.md) | Execute a behavior-preserving refactor as a **sequence of proofs, not a rewrite**. Writes the behavior contract first (public surface, side effects, error types — the falsifiable definition of "preserved"), audits the safety net (every contract item mapped to a covering test, characterization tests written via [`write-tests`](./skills/write-tests/SKILL.md) for the gaps — **no net, no refactor**, and "the change is simple" is not an exemption), locks a quoted-green baseline, then moves in single mechanical transformations with the suite green between steps. Renames are **grep-verified repo-wide** (strings, routes, reflection, and serialized names don't compile-check). The **assertion-change tripwire**: if fixing a red step means changing a test's expected value, stop — that's a behavior change wearing a refactor's clothes; surface it, never silently absorb it. Ends with an adversarial diff read hunting the smuggled change (reordered side effects, dropped `await`, widened catch). Completes the chain: [`improve-codebase-architecture`](./skills/improve-codebase-architecture/SKILL.md) names the target, this makes the move. Triggers on "refactor this", "clean this up without changing behavior", "extract/inline/split", "rename across the codebase", or `/safe-refactor`. |
| [`security-review`](./skills/security-review/SKILL.md) | Attacker's-eye security audit of a diff, branch, or module — maps trust boundaries, then walks a fixed catalog: missing authn **and object-level authz** (IDOR is the most common real miss), client-sent identity trusted in queries, injection (SQL / command / path traversal / XSS), secrets in code or logs (a committed secret means *rotate*, not delete-the-line), SSRF, open redirects, insecure deserialization, mass assignment, crypto misuse, dependency CVEs (only via an actual audit-tool run with output quoted — otherwise `dependencies: not checked`). The gate that keeps it honest: every finding must state a one-sentence **attack path** (*who* does X → gains Y) or be demoted to hardening advice; every finding is re-derived by tracing input to sink (untraced pattern-matches are labeled `unconfirmed`); the report never claims "secure" — only "nothing found in the classes checked", plus the explicit unchecked list. Zero findings is a valid outcome. Never edits code unprompted. Distinct from the security *lens* in [`code-review`](./skills/code-review/SKILL.md) / [`pr-review`](./skills/pr-review/SKILL.md): this is the dedicated deep pass for trust-boundary changes. Triggers on "security review", "is this secure", "check for vulnerabilities", "audit the auth", "threat model this", or `/security-review`. |
| [`ship-it`](./skills/ship-it/SKILL.md) | Pre-launch **operational-readiness** gate for a feature, release, or branch — the complement to [`code-review`](./skills/code-review/SKILL.md). Walks a fixed 10-category checklist (logging, error handling, telemetry, feature flags, migrations, rollback strategy, secrets, local-first storage, auth, update strategy) against the named scope and produces a structured report with PASS / GAP / N/A per item — every PASS backed by a `file:line` citation, every GAP labelled `no evidence found at <path>`, every N/A justified in one line. The final verdict groups findings as **Blocking** (secrets in code, missing authz on a new endpoint, destructive migration without rollback, no way to disable the change in prod) / **Should-fix** / **N/A with reason** / **Passing**, then asks per-blocker whether to draft a fix. **Never edits code unprompted** and **forces scope before auditing** — a PR, a flag, a release tag, or a module — so the output stays actionable. Distinct from `code-review` (diff quality) and `pr-review` (branch / per-task review): `ship-it` is the operational gate that catches what diff-level reviews don't surface. Triggers on "is this ready to ship?", "ship-it check", "production checklist", "pre-launch checklist", "release readiness", or `/ship-it`. |
| [`sql-review`](./skills/sql-review/SKILL.md) | Pre-commit SQL code review for uncommitted `.sql` changes (staged + unstaged). Detects 17 antipattern classes that map to **real production incident causes** — `sp_send_dbmail` in CATCH blocks (masks the real exception as a misleading permission denial), broken retry patterns (`@retry` declared without a surrounding `WHILE` loop), swallowing CATCH blocks (no `THROW`/`RAISERROR`/log), **new tables created without a primary key or any index** (the silent perf-then-deadlock killer), parameter-vs-column type mismatches (8152 truncation risk), `EXEC()` string concatenation without `sp_executesql` parameters (SQL injection), `NOLOCK` inside transactional write paths, `UPDATE`/`DELETE` without `WHERE`, cursors without `READ_ONLY FORWARD_ONLY LOCAL`, hardcoded environment values (emails, server names, paths, linked servers), cross-DB references like `msdb.dbo.*`, missing `SET NOCOUNT ON`, missing `GRANT EXECUTE` on `CREATE PROC`, `BEGIN TRANSACTION` outside `TRY`/`CATCH` with `XACT_STATE` handling, and vestigial control-flow comments hinting at refactor leftovers (e.g. `-- end while loop` with no `WHILE`). **Scope-aware** — full-file scan for new files, diff-only scan for modified files so legacy antipatterns in untouched parts of a large SP don't flood the report. Categorizes findings as `BLOCKER` / `WARN` / `INFO` with `file:line` citations and per-finding fix recommendations. **Never edits SQL unprompted** — produces the report, then asks per fix. Distinct from [`code-review`](./skills/code-review/SKILL.md), which carries the general best-practice catalog without SQL-specific patterns. Triggers on `/sql-review`, "review my SQL", "review the SQL diff", "lint the SQL", "check my SQL changes", "SQL pre-commit check", or "audit my stored proc". |
| [`task-executor`](./skills/task-executor/SKILL.md) | Disciplined execution loop for a single, already-defined task — Understand → Inspect → Plan → Execute incrementally → Validate after every change → Track assumptions → Update progress. Forces a strict per-turn output format with six fixed sections (**Goal** / **Current understanding** / **Files to inspect** / **Plan** / **Progress** / **Risks** / **Assumptions**) so the work stays legible and resumable instead of devolving into ad-hoc edits across turns. When the inspection working set spans multiple layers (controller + service + persistence + tests), Phase 2 convenes an **inspection council**: parallel `Explore` sub-agents — one per layer slice — each map their area and return `file:line`-cited findings on existing patterns, wiring points, and sibling test classes; the main session aggregates the results into `Current understanding` so the working context window stays free for the strict per-turn output the executional phase keeps emitting. Small inspection sets (≤ ~5 files, one layer) skip the council and read inline. Enters Plan Mode after inspection and gates on `ExitPlanMode` approval before writing any code; every plan step is then one logical change followed by an immediate validation (test, build, type-check, curl, page load) before the next checkbox ticks. Assumptions are tracked explicitly until confirmed by code or the user — and promoted into `Current understanding` or killed, never silently carried. Triggers on `/task-executor`, "Work on task: …", or any concrete, already-defined task handed to Claude for execution. |
| [`tauri-2-app`](./skills/tauri-2-app/SKILL.md) | Scaffold a new Tauri 2 desktop app (Rust backend + TypeScript/React frontend) using a thin-frontend / rich-Rust-backend architecture with modular `commands/`, `state/`, `storage/`, `platform/` traits, `error/` macros, single-instance + updater plugins wired correctly, capability JSON per window, encrypted secrets at rest, `spawn_blocking` for sync work, and typed frontend command hooks — while forbidding common pitfalls (committed `.backup`/`.orig`/`.temp` files, plaintext API keys in `settings.json`, tokens in `localStorage`, `cfg!(target_os)` in command bodies instead of trait-based platform code, hand-rolled date math instead of `chrono`, raw `std::fs` bypassing capability checks, blocking I/O inside async commands, missing `windows_subsystem = "windows"` in `main.rs`, `devtools: true` in release, hardcoded bundle identifiers / updater pubkeys / CDN URLs). Three modes — full project scaffold, add-a-command end-to-end, add-a-Rust-module slice. Resolves Cargo + npm versions at scaffold time (not hard-coded). |
| [`think-like-fable`](./skills/think-like-fable/SKILL.md) | An operating manual for rigorous reasoning, written as a senior operator handing their craft to a sharp junior — applied to whatever task is at hand rather than replacing it. Eight disciplines, each with the procedure, a worked example, and the failure it prevents: read the need behind the literal ask, decompose into **independently checkable** pieces, spend effort where the risk lives (not where the work is easy or interesting), verify load-bearing claims by **re-deriving** them instead of recognizing them ("a claim about code you haven't opened is a hypothesis"), tag every claim **verified / inferred / assumed** in the text, attack your own conclusion before handing it over, and communicate answer → reasoning → risk in that order. Names the seven mistakes that look like competence and aren't (thoroughness theater, fluent overclaiming, premature agreement, complexity as signal, silent scope repair, momentum completion, deference to your own prior output) and ends with a five-question self-test to run on every answer before sending. Triggers on "think like fable", "/think-like-fable", "be rigorous", "are you sure?", "don't guess", or any high-stakes analysis where a confident wrong answer is worse than a slow right one. |
| [`upgrade-deps`](./skills/upgrade-deps/SKILL.md) | Upgrade dependencies as a **verification exercise, not a version edit**. Inventory comes from the tool (`npm outdated` / `dotnet list package --outdated` / `pip list --outdated` / `cargo outdated` — never from training-data memory of "latest"), baseline suite quoted green before anything moves, patch/minor bumps batched, **majors strictly one at a time**: read the actual changelog across every crossed version (a breaking-change claim without a citation is a hypothesis), grep the repo for each breaking API (cite the call sites, or state the negative: "no usage — grep for `X` returned nothing"), list behavioral changes that don't grep (changed defaults, stricter parsing) as named **runtime risks** with the test that would catch each — or the admission that none would. Red bump → one informed retry → revert, mark **blocked** with the quoted error, move on. Never silences peer conflicts with `--force`/`--legacy-peer-deps` without surfacing the override. Reports a per-package table (from → to, breaking changes affecting *this* repo, evidence, result) plus the honest residue. Triggers on "upgrade dependencies", "update packages", "bump X", "is it safe to upgrade", "fix the npm audit", "handle the dependabot PRs", or `/upgrade-deps`. |
| [`write-a-skill`](./skills/write-a-skill/SKILL.md) | Author a new Claude Code skill — interview-driven scaffolding that produces a properly-structured `SKILL.md` (trigger-rich YAML description, "When to use", workflow, examples, anti-patterns), drops it in the right location (library `skills/`, project `./.claude/skills/`, or global `~/.claude/skills/`), updates the README skills table when extending this library, and runs a review checklist focused on the failure mode that matters most — under-triggering descriptions. Triggers on "create/write/add a skill", "/write-a-skill", or a pasted SKILL.md URL with "one like this". |
| [`write-tests`](./skills/write-tests/SKILL.md) | Author tests whose only job is to **fail when the behavior breaks** — everything else (coverage %, test count, green checkmarks) is a gameable proxy. Ranks WHAT to test by risk (error paths, money, auth, deletion, retry/idempotency, date math outrank happy paths), checks for existing coverage first (**zero new tests is a valid outcome** — cite the existing test), asserts observable behavior only (return values, persisted state, real-boundary calls — never internal call order), and **proves every new test can fail**: TDD-red first, or mutate the behavior → confirm red → revert → confirm green, both runs quoted. A test never seen red is decoration; a green claim without a quoted run is `tests: not run`. Mocks only boundaries you don't own (network, clock, fs, db) using the repo's existing double convention. For untested legacy code: **characterization tests** that pin actual behavior — bugs included, labeled — before anything changes ([`safe-refactor`](./skills/safe-refactor/SKILL.md) depends on this). Test pain gets reported as design feedback, not mocked through. Triggers on "write tests", "add tests / coverage", "test this", "add a regression test", "TDD this", "characterization tests", or `/write-tests`. |

Run `skills list` to see this list with install status, or browse [`skills/`](./skills) directly.

## How Claude Code finds these skills

Claude Code looks for `SKILL.md` files in:

- `~/.claude/skills/<skill>/SKILL.md` — available in every session (global)
- `<project>/.claude/skills/<skill>/SKILL.md` — available only inside that project

This CLI just copies skill folders to one of those locations. Nothing magic.

## Commands

| Command | What it does |
|---|---|
| `skills list` | List skills available in the library, marking which are installed |
| `skills installed` | List skills currently installed |
| `skills install` | Interactive multi-select picker |
| `skills install <name>...` | Install one or more skills by name |
| `skills install --all` | Install every skill in the library |
| `skills remove <name>...` | Remove installed skill(s) |
| `skills remove --all` | Remove every installed skill |

## Flags

- `-g, --global` — target `~/.claude/skills` (default)
- `-p, --project` — target `./.claude/skills`
- `-f, --force` — overwrite if already installed (interactive install always overwrites selected items)
- `-h, --help` / `-v, --version`

## Adding your own skills

This library ships with a [`write-a-skill`](./skills/write-a-skill/SKILL.md) skill that scaffolds new ones for you — that's the intended path. Don't hand-edit `SKILL.md` from scratch; the skill knows the structure, writes a trigger-rich description (the part Claude actually reads), and updates the README table for you.

Install it once, globally, from npm — no clone needed to use it:

```bash
npx @dennisrongo/skills install write-a-skill
```

From there:

- **For a project skill or a global skill on your machine** — `cd` to the project (or anywhere), open Claude Code, and say `/write-a-skill`. It interviews you, picks the right location (`./.claude/skills/` for a project skill, `~/.claude/skills/` for a global one), and drops the new `SKILL.md`. Done.
- **To contribute a skill back to this library** — you do need a working tree to commit. Clone the repo, `cd` in, open Claude Code, and say `/write-a-skill`. It detects the library repo, writes to `skills/<name>/SKILL.md`, and adds the row to the table above. Commit and push to `main`; on any machine `npx --yes github:dennisrongo/claude-skills install <your-skill-name>` picks it up.

### The directory shape

The library lives in [`skills/`](./skills). Each skill is a directory containing a `SKILL.md` with YAML frontmatter.

```
skills/
├── _template/              # starting point — the leading underscore skips it from install
│   └── SKILL.md
├── conventional-commits/
│   └── SKILL.md
└── my-new-skill/
    ├── SKILL.md
    ├── references/         # optional supporting files
    └── scripts/            # optional executable helpers
```

### If you'd rather do it by hand

Copy `skills/_template/` to `skills/<your-skill-name>/`, edit the `SKILL.md`, and add a row to the skills table above. Minimum viable file:

```markdown
---
name: my-skill-name
description: One sentence describing what it does AND when to trigger it. Be specific about phrases the user might use.
---

# My Skill Name

Instructions for Claude...
```

The `description` is the single highest-leverage field — it's the only thing Claude reads when deciding whether to consult the skill. Be explicit about trigger conditions; under-triggering is the more common failure mode. (This is the part [`write-a-skill`](./skills/write-a-skill/SKILL.md) is opinionated about — using it will save you from the rookie mistake of writing "Helps with X.")

> Tip: `npx` caches the package per version spec. If you push an update to `main` and the next `npx github:dennisrongo/claude-skills ...` call doesn't seem to pick it up, run `npx --yes ...` to force a refresh, or clear the cache with `npx clear-npx-cache`.

## Fine-tuning skills you've installed

Two patterns:

**Tune in-place, then upstream:**
Edit the file at `~/.claude/skills/<name>/SKILL.md` directly while you're iterating with Claude. Once it feels right, copy the edits back into this repo's `skills/<name>/SKILL.md` and commit.

**Tune in the repo, reinstall:**
Edit `skills/<name>/SKILL.md` in your clone, then run `npx github:dennisrongo/claude-skills install <name> --force` to push it to your install location.

**Pull upstream updates (npm-global install):**
If you installed the CLI globally (`npm install -g @dennisrongo/skills`), updating is a two-step process — bumping the CLI does *not* automatically refresh the skills already copied into `~/.claude/skills/`.

```bash
# 1. Update the CLI to the latest published version
npm install -g @dennisrongo/skills@latest

# 2. Re-copy the bundled skills over your existing installs
skills install --all --force
```

- Step 1 replaces the `skills` binary and the bundled skill files inside the global node_modules.
- Step 2 overwrites everything in `~/.claude/skills/` with the new bundled versions. Without `--force` the CLI skips skills that already exist.
- Add `-p` / `--project` to step 2 if the skills live in `./.claude/skills` instead.
- To update just one skill instead of all: `skills install <name> --force`.

**Pull upstream updates (npx-from-GitHub):**
If you're using `npx github:dennisrongo/claude-skills` without a global install, force-reinstall with a cache-bust:

```bash
# Single skill
npx --yes github:dennisrongo/claude-skills install <name> --force

# All installed skills
npx --yes github:dennisrongo/claude-skills install --all --force
```

- `--yes` bypasses the `npx` cache so it re-fetches the latest commit on `main` instead of reusing an old one.
- `--force` overwrites the existing install (without it, the CLI skips skills that already exist).
- Add `-p` / `--project` if the skill lives in `./.claude/skills` instead of the global `~/.claude/skills`.

## Releasing

Releases are published to npm automatically by [`.github/workflows/publish.yml`](./.github/workflows/publish.yml) **when a GitHub Release is published**. The package ships with [npm provenance](https://docs.npmjs.com/generating-provenance-statements) — npm verifies it was built by this repo's Actions workflow.

### Cutting a release — step by step

Run these from a clean working tree on `main`, in this order.

1. **Commit and push your work first.** The release is cut from the tip of `main`; nothing uncommitted gets shipped.
   ```bash
   git status            # must be clean
   git push origin main
   ```
2. **Pick the bump.** Follow semver (pre-1.0: still treat new features as `minor`):
   - `patch` — bug fix in an existing skill, doc tweak, CLI fix.
   - `minor` — new skill, materially new behavior in an existing skill, new CLI flag.
   - `major` — removal or rename of a skill / CLI command, breaking change to install layout.
3. **Bump the version + create the tag.**
   ```bash
   npm version <patch|minor|major>
   # creates a "vX.Y.Z" commit and a matching git tag
   ```
4. **Push the bump commit and the tag together.**
   ```bash
   git push --follow-tags
   ```
5. **Create the GitHub Release** — this is the step that **triggers the npm publish workflow**.
   ```bash
   gh release create "v$(node -p "require('./package.json').version")" --generate-notes
   ```
6. **Watch the workflow run.**
   ```bash
   gh run watch           # interactive, exits when done
   # or
   gh run list --workflow=publish.yml --limit 1
   ```
7. **Verify the publish.** Once the run is green:
   ```bash
   npm view @dennisrongo/skills version    # should match the new tag
   npx @dennisrongo/skills@latest list     # smoke test
   ```

If the workflow fails, fix forward — don't reuse a published version number. npm rejects republishing the same version, so the next attempt needs a fresh bump.

### What the workflow does

`.github/workflows/publish.yml` runs on `release: published` and:

1. Checks out the tag.
2. Asserts `package.json` version matches the release tag (fails fast on mismatch).
3. Runs `npm test`.
4. Runs `npm publish --provenance --access public`.

Both invocation forms work after publish:

```bash
npx @dennisrongo/skills install                 # via npm (recommended)
npx github:dennisrongo/claude-skills install    # latest commit on main
```

### One-time setup (already done for this repo)

Keep this for reference if the package ever moves or gets forked:

1. Create an automation-scoped `NPM_TOKEN` at https://www.npmjs.com/settings/<user>/tokens (use a "Granular Access Token" or "Automation" token).
2. Add it to the repo as a secret: **Settings → Secrets and variables → Actions → New repository secret**, name `NPM_TOKEN`.
3. If you ever rename the package, confirm the new name is free: `npm view <name>`. The current scoped name `@dennisrongo/skills` lives under your npm user/org — `npm publish --access public` will create it on first publish.

## License

[MIT](./LICENSE) © Dennis Rongo

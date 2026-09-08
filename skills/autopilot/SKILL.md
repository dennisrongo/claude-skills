---
name: autopilot
description: >-
  Fully autonomous end-to-end run of ONE defined task with no human gates — a work item
  (Azure DevOps or GitHub id, or inline text) becomes a verified working tree plus an
  evidence-backed report, and every question that would have been asked becomes a logged
  assumption with its blast radius. Puts every applicable skill in this library to work on
  observable predicates, and stops dead before any commit, push, or PR. Hard stops only for
  a destructive or irreversible step, missing access, an architectural or unimplementable
  spec, or three failed fixes on one behavior. Use this skill whenever the user says
  "autopilot", "/autopilot", "run task <id> autonomously", "work this task end to end
  without asking", "full autonomy on this", "do the whole task, skip commits and PR", or
  launches a headless run with a task id — even if they don't name the skill. Not for
  interactive plan approval (task-executor), a queue of tasks (goal-runner), or when
  commits or PRs should be created (create-pr).
---

# Autopilot

The full loop — acquire → plan → execute → test → review → report — with the human gates replaced by an explicit contract, for headless or hands-off runs where nobody can answer questions mid-flight. It does not reinvent review, testing, or diagnosis: every skill in this library that applies is used, on a predicate you can observe, and the report proves which ones ran. Model routing and launch flags live in [references/runtime.md](references/runtime.md).

## When to use this skill

- "autopilot task 12345" / "run task 12345 autonomously" / "/autopilot 12345"
- "work this end to end without asking me anything, skip PR and commits"
- A headless (`claude -p`) invocation naming a work item or task description.

Do **not** use when the user wants to approve the plan (`task-executor`), has a queue of tasks (`goal-runner`), or wants a commit or PR produced (`create-pr`).

## The autonomy contract

1. **No questions.** Never call `AskUserQuestion`; never enter a plan-approval gate. Every question you *would* have asked becomes an ASSUMPTIONS row: question, choice, why, blast radius if wrong. Choose the option that (a) matches the codebase's existing pattern and (b) is cheapest to reverse; when they conflict, prefer reversible. "Matches the codebase" is an evidence claim — cite the instance (`file:line`); if you searched and found none, say so and justify by reversibility alone.
   - ❌ "Assumed camelCase keys — matches project conventions." (no instance cited)
   - ✅ "Assumed camelCase keys — every DTO in `src/api/dto/` uses them (`UserDto.ts:12`). Blast radius: one serializer line."
2. **Hard stops only.** Halt and report (never improvise) when the next step is destructive or hard to reverse (data deletion, force push, dropping schema objects, external side effects); access or credentials are missing; the task is architectural (Phase 0); every reading of the task contradicts the codebase expensively; or three fixes have failed on one behavior. The stop-vs-assume test: *would a wrong guess destroy data, publish something, or cost more to undo than redoing the task?* No → assume and log. Yes → hard stop, with the tree left at the last observed-green state and the one decision needed to resume.
3. **Never commit, push, or create PRs.** The deliverable is a verified working tree plus the report. The human gets the final gate.
4. **Scope is the task, exactly.** Adjacent problems go in "Found along the way", never in the diff.
   - ❌ Adding a `-j` alias because "it's consistent" when the task said `--json`. ✅ `--json` only; the alias idea goes in Found along the way.
5. **Unobserved is `not run`, never `passed`.** Every Evidence line carries a tag: `verified` (you ran it and quote the output), `inferred` (follows from a named verified fact), `assumed` (unverified; name what breaks if wrong). "Tests pass" is not "requirements met".
6. **A present skill is mandatory.** For every routing row whose predicate is true, run the probe; a hit means you open that SKILL.md with the Read tool and follow it. The fallback is legal only when the probe finds nothing, and "the diff is small" never skips a skill — the skill's own body decides how much ceremony a small diff gets. **`used` is an evidence claim:** the Skills used row quotes the heading of the section you applied, which you cannot do without opening the file. A present skill you did not open is `skipped`, and one `skipped` row caps the Outcome at `done-with-caveats: skipped <skill>`.
   - ❌ "code-review is for bigger diffs; I did a focused self-review instead." (present, predicate true, skipped)
   - ❌ "task-executor — used (inspection discipline)" with no file opened — you know its name, not its rules; that row is `skipped`.
   - ✅ "code-review present → Read `skills/code-review/SKILL.md` → applied 'When to convene the council' → single-pass; 0 blockers."

## Skill routing table

**Probe** (run it, quote the result): `ls skills/<name>/SKILL.md .claude/skills/<name>/SKILL.md ~/.claude/skills/<name>/SKILL.md 2>/dev/null`. Any path printed, or the Skill tool listing the name → present. Nothing → absent → fallback column, marked `absent` in the report. Where a row names two skills, pick by its predicate.

| Phase | Skill | Use it when (observable predicate) | If absent |
|---|---|---|---|
| 0 | `azure-devops` / `github` | A work-item or issue id was given; `git remote -v` shows `devops.example.invalid`/`legacy-devops.example.invalid` → azure-devops, `github.com` → github | `az boards work-item show --id <id>` / `gh issue view <id> --json title,body,comments` if the CLI works; else hard stop and ask for the task text |
| 0 | `design-brief` | `.claude/design-briefs/` holds an `APPROVED` brief whose Intent line matches → it is the spec. Task classified architectural → hard stop naming this skill as the route back | Hard stop still; the report lists the design decisions the human must make |
| 0 | `codebase-explainer` | `ONBOARDING.md` exists → read it before inspecting (never run the skill; writing docs is out of scope) | Skip |
| 0 / any | `handoff` | `.claude/handoffs/` holds a file naming this task → resume from its Next Session Prompt; context runs low mid-run → write one | Write objective, progress, decisions, next step to `.claude/handoffs/` |
| 0 | `model-inventory` | Sub-agents will be spawned (see references/runtime.md) | Spawn with no model override |
| 1 | `task-executor` | Always: Phase 2 (inspection council threshold) and Phase 5 (Requirements table shape) | Read every touched file plus one precedent per new pattern; ≥2 layers → parallel `Explore` agents, one per layer |
| 1 | `think-like-fable` | Always: §6 self-grill of the plan | Ask: what discovery would invalidate the plan, which increment is riskiest, what am I assuming — then reorder |
| 1 | `dotnet-onion-api` / `nextjs-app-router` / `tauri-2-app` | The marker exists: `*.sln`/`*.csproj` with Domain/Application/Infrastructure projects; `next.config.*`; `src-tauri/tauri.conf.json` → convention source for the plan | Follow the nearest existing slice, route, or command |
| 1 | `upgrade-deps` / `write-a-skill` | The task text IS a dependency bump, or creates/edits a `SKILL.md` → that skill's workflow is Phase 2 | One major at a time with the suite quoted green between; `_template/SKILL.template.md` plus CLAUDE.md |
| 2 | `safe-refactor` | An increment is planned as behavior-preserving (rename, extract, move, inline) | Safety net first, suite green between mechanical steps, never change an assertion |
| 2 | `write-tests` | Every increment that adds or changes behavior (red first, quoted) | Write the test, run it red, quote it, then the minimum code |
| 2 | `diagnose` | A verification fails and the error text does not name the one thing to change | Reproduce → minimise → one falsifiable hypothesis → fix → regression test |
| 3 | `e2e-verify` / `maestro-mobile-test` | Diff touches browser-rendered UI or a web route AND a local run script exists; `package.json` depends on `react-native`/`expo` AND a device is reachable | Log `not run: no browser / device available` |
| 4 | `code-review` | Always | Walk the diff as a reviewer: correctness, error paths, dead code, DRY, tests; a blocker must state *this input → this wrong outcome* |
| 4 | `regression-hunt` | Any one of: the diff renames anything; changes a signature, default, or shared state (an added optional parameter counts); edits a file with ≥3 importers (`grep` count) | List every caller of each changed symbol and run their tests |
| 4 | `security-review` | Diff touches auth/sessions, input validation, SQL/shell/HTML sinks, file paths from input, secrets, crypto, or adds an endpoint | Check those classes; report "nothing found in the classes checked" |
| 4 | `sql-review` | Diff contains `.sql` files, stored procedures, or raw SQL strings | UPDATE/DELETE have WHERE, no dynamic-SQL concatenation, errors not swallowed |
| 4 | `migration-safety` | Diff adds or changes a file under a migrations directory (`migrations/`, `Migrations/`, `prisma/migrations/`, `alembic/`) | Flag destructive DDL and missing rollback |
| 4 | `api-contract-review` | Diff changes a route/handler signature, a request/response type, or an OpenAPI/GraphQL schema | Diff the before/after surface; list removed or renamed fields and status-code changes |
| 4 | `ship-it` | Diff adds an endpoint, background job, feature flag, secret, or migration | Note logging, error-handling, and rollback gaps in Found along the way |
| 5 | `conventional-commits` | Always: the "Your move" commit message | `<type>(<scope>): <summary>` with the work-item id |
| 5 | `create-pr` / `backlog-planner` | Always name `/create-pr` as the human's next step; Found along the way has ≥1 item → also suggest `/backlog-planner`. Neither is run | Name `git push` plus the provider's PR command; suggest adding the items to the backlog |
| stop | `improve-codebase-architecture` | Three failed fixes on one behavior → named in the hard-stop report as the route | Report the coupling that defeated each fix |

Two skills are deliberately absent: `goal-runner` is autopilot's consumer, not a dependency, and `humanizer` is never applied to your own report unless the user asked for it.

## Workflow

### Phase 0 — Acquire, baseline, classify

1. **Acquire.** Id given → route by remote (table); never reconstruct a task from its id, title, or branch name alone. Read description, comments, AND embedded screenshots (an image you did not open is `not viewed`). Quote acceptance criteria verbatim.
2. **Restate:** "This task needs `___` so that `___`." Can't fill the second blank from the artifacts → hard stop.
3. **Branch posture.** On `main`/`master`/the default branch → create a branch named from the work item, following `git branch -a` conventions, logged as an assumption.
4. **Baseline.** Run the suite and build before the first edit; quote the summary line. If any output must stay unchanged, capture it to a file now for a later diff.
5. **Classify, out loud.** *Spike* → anything built is labeled throwaway. *Bounded* (changes a flow that exists in this repo) → proceed. *Architectural* (new subsystem, restructured boundaries, interfaces others depend on) → hard stop; `design-brief` is the route back. Hidden complexity mid-run upgrades the class, never downgrades it.

### Phase 1 — Plan (self-gated, not user-gated)

Inspect under `task-executor`'s discipline (its threshold decides inline reads vs. parallel explorers); load the stack skill the table selects. Draft increments, each with its own verification command. **Self-grill** per `think-like-fable` §6: what discovery would invalidate the plan? Which increment is riskiest? Run that one first. The plan goes in the report verbatim; it replaces the approval gate.

### Phase 2 — Execute incrementally

One increment at a time, observed verification after each. A behavior increment **opens with its failing test** under `write-tests` (red for the right reason, quoted) and closes with the minimum code that turns it green. Before each increment, restate the Phase 0 one-liner; an increment that doesn't serve it means the plan drifted — re-plan. An assumption load-bearing for 3+ increments is re-verified against the code; one resting on another multiplies both blast radii — re-verify the base first.

**Command-failure protocol.** A command fails → read the full error, change exactly one thing it names, retry once. Second failure on the same step → the approach is wrong: run `diagnose` if the error doesn't name the fix, then re-plan or hard stop. **Three failed fixes on one behavior is a hard stop**, never a fourth attempt. **A step that cannot go green is reverted** (`git diff -- <files>` shows what to undo) so the tree sits at the last observed-green state.

### Phase 3 — Test

Run the full suite for every package containing a changed file, plus whatever CI runs for those paths; quote the summary line. Live verification per the table when its predicate holds. A failure in untouched code → stash, re-run, unstash to prove it pre-existing when the suite takes ≤5 minutes; otherwise tag the claim `assumed`.

### Phase 4 — Review, with fix authority for blockers

Run `code-review` (always) and every Phase 4 lens whose predicate is true. Autonomous exception to code-review's report-first rule: **blocking findings are fixed immediately**, one at a time, each re-verified. Suggestions and nits are logged, NOT applied. Re-review; loop until zero blockers or two iterations — survivors are known issues that downgrade the Outcome.

### Phase 5 — Report (the deliverable)

Fill this exact structure; keep the headings verbatim, replace every `<...>`, delete no section (an empty one says `none`):

````markdown
## Outcome
<one sentence: done | done-with-caveats: <caveat> | hard-stopped at Phase <n>: <decision needed>>
## Requirements
| # | Requirement (task text, quoted) | Evidence (test name / command → output / file:line) | Status |
|---|---|---|---|
| 1 | "<quoted>" | <observed evidence> | met / gap / deviation |
## What changed
- `<file>` — <why>
## Evidence
- <command> → <quoted output> — verified | inferred from <fact> | assumed (<what breaks if wrong>)
- <increment>: red `<quoted failing line>` → green `<quoted summary>` — verified
## Review outcome
<lenses run; findings by category; fixes applied; anything remaining>
## Skills used
| Skill | Predicate | Probe | Result | Section applied (heading quoted from the file you opened) |
|---|---|---|---|---|
| <name> | true: <evidence> | present at <path> / absent | used / skipped / absent → fallback | "<heading>" or — |
Predicates false: <comma-separated skills whose predicate was false>
## Assumptions
| Question | Choice | Why (file:line or "no precedent found") | Blast radius if wrong |
|---|---|---|---|
| <q> | <choice> | <why> | <blast radius> |
## Found along the way
- <adjacent problem noticed, not touched>
## Your move
```bash
<paste-ready commit command per conventional-commits>
# then: /create-pr   (when create-pr is absent: the push and provider PR commands instead)
```
````

"Done" is earned only when every Requirements row is `met` with observed evidence, every Evidence line is `verified`, Review outcome has zero surviving blockers, and no Skills used row says `skipped`. Any `gap`, `not run`, `skipped`, `assumed` on a load-bearing claim, or surviving blocker makes it `done-with-caveats` with the caveat in the same sentence — never buried below.

**Delivery gate — answer each before handing back; any "no" → fix it or downgrade Outcome:** zero questions asked? zero commits/pushes/PRs (`git status`, `git log` quoted)? every behavior increment has a quoted red and green? every Requirements row has evidence or says `gap`? every routing row with a true predicate and a present skill marked `used` **with a quoted heading** (no heading → `skipped` → Outcome downgraded)? every Evidence line tagged? every Assumptions row cites `file:line` or says "no precedent found"?

## Examples

- **Headless work item.** "autopilot task 4711" → remote is `devops.example.invalid` → `azure-devops` pulls #4711 with two screenshots (both viewed); baseline `47 passed` quoted; 4 increments, each red-then-green under `write-tests`; the diff adds an endpoint → `code-review`, `security-review`, `api-contract-review`, `ship-it` run, one blocker (missing authz) fixed and re-reviewed; report has Requirements 5/5 met, a Skills used table with quoted headings, 2 cited assumptions, a `conventional-commits` block. No commits.
- **Hard stop done right.** "run task 8912 end to end without asking" → task says "remove the legacy sync"; inspection shows production traffic still hitting it (log timestamps quoted). Destructive and contradicts the spec → hard stop after Phase 1, tree untouched, report names the one decision ("confirm the consumer at X is decommissioned").

## Anti-patterns

- ❌ Asking "just one quick question" mid-run — the user is not there; that's what Assumptions is for.
- ❌ Committing "to save progress" or opening a draft PR "for convenience".
- ❌ Skipping a present skill because the diff "felt small", or marking one `used` without a heading quoted from the file you opened.
- ❌ Writing the test after the code and quoting only green — no quoted red, no behavior increment.
- ❌ Applying suggestion-level findings unattended, or expanding scope because the code "really needed it".
- ❌ Soft-stopping on mere ambiguity — choose per the contract, log it, continue.
- ❌ Reporting "done" with a `gap` row, a `skipped` row, an unobserved check, or a buried failed suite.
- ❌ Retrying a failing command verbatim, or leaving a half-applied step in the tree at a hard stop.
- ✅ Zero questions, zero commits, every present skill opened and used, quoted red and green per increment, a Requirements row per criterion, human decides what ships.

## Notes

- Composes with every skill in the routing table, plus `goal-runner`, which delegates per-task execution to this discipline. All optional — the fallback column is the degraded path, and the Skills used table shows which path was taken.

---
name: task-executor
description: >-
    Disciplined, legible, resumable execution of a single already-defined task — one task,
    one plan the user approves before any code is written, every change validated. Use this
    skill whenever the user says "/task-executor", "task-executor", "Work on task: <description>",
    "execute this task", "implement this ticket", "work this item", or hands you one concrete,
    already-specified task — even if they don't name the skill. Do NOT auto-trigger on a
    greenfield idea with a fuzzy spec (design-brief) or on something broken (diagnose) — the
    spec is assumed given.
---

# Task Executor

A discipline for working on a single, already-defined task. The task is given; the goal is to execute it without skipping context, without batching changes, and without losing the thread mid-way. Every turn emits the same seven sections so the user (and any future session) can pick up the state at a glance.

## When to use this skill

- The user runs `/task-executor` or types "task-executor".
- The user says "Work on task: …" with a concrete task description (a ticket, a bullet, a paragraph spec).
- The user hands you a defined deliverable and asks you to execute it — not to design it from scratch.

Do **not** use this skill for:

- Fuzzy or greenfield feature work where the spec still needs grilling — this skill assumes the spec is given.
- Bug diagnosis. Use [`diagnose`](../diagnose/SKILL.md).
- One-line fixes, renames, doc edits — the per-turn output format is more ceremony than value at that size.

If the user invokes this skill on a spec that turns out fuzzy mid-flight, stop and ask the user to clarify the spec before proceeding.

## The per-turn output format (non-negotiable)

Every assistant turn during this skill — from the first response to the final report — opens with these seven sections, in this order, with exactly these headers. Sections that have nothing yet say `_(none yet)_` rather than being omitted, so the structure stays scannable.

```markdown
## Goal
<one short paragraph — the task in the user's terms, restated>

## Current understanding
<what is now known about the task, the code, the constraints — updated each turn>

## Files to inspect
- path/to/file1.ext — why
- path/to/file2.ext — why

## Plan
1. Step
2. Step
3. Step

## Progress
- [x] Completed step (with one-line evidence: test passing, command output, file written)
- [ ] Pending step
- [ ] Pending step

## Risks
- Risk or open question
- Risk or open question

## Assumptions
- Assumption being relied on that has NOT been confirmed by code or the user
- Assumption being relied on that has NOT been confirmed by code or the user
```

Rules:

- **Restate the goal verbatim each turn.** It anchors against drift. If the user redirects, update the goal and note the redirect in `Current understanding`.
- **Files to inspect is a live list.** Add as you discover relevance; mark a file as inspected by moving it into `Current understanding` with what you learned. Don't carry a file in both places.
- **Progress checkboxes are append-only across turns.** Never silently delete a step — if a step is dropped, leave it ticked or struck and explain in `Current understanding`.
- **Assumptions get promoted or killed.** When you confirm an assumption (by reading the code, running the loop, or asking the user), move it into `Current understanding` as a fact and remove it from `Assumptions`. When you falsify one, say what changed.

If the conversation runs long and the sections grow, **compact** rather than truncate: collapse old completed steps into a one-line summary at the top of `Progress` and keep the active checkboxes verbatim.

**Resuming in a fresh session.** The last emitted block (or a `.claude/handoffs/` file from the `handoff` skill, if installed) is the starting state — but it is a claim about a tree you haven't seen. Before continuing: run `git status` and `git diff --stat` and reconcile them against `Progress`; re-run the validation of the last ticked step and quote it. A tick you cannot re-observe is un-ticked. Then continue from the first unticked step.

**Git posture for the whole task:** read-only git except the branch created in Phase 3 and edits to files. No `stash`, `checkout`, `reset`, `rebase`, `commit`, or `push` — the user owns those. Need another revision? `git show <ref>:<path>`.

## Model routing

The skill cannot change the model of the session it runs in. Understanding, inspection judgment, the plan, the plan gate, every validation, and every ruling stay on the **session model** — start the session on the strongest model you want making those calls. Only two kinds of work are delegable to sub-agents on a different model: **reading** (the Phase 2 inspection council, role `scout`) and **coding a single approved plan step** (Phase 4 delegation, role `coder`; `coder_high_risk` when the step touches auth, money, deletion, migrations, or concurrency).

Resolve each role's model in this order, once per task, and state the result in the first `Current understanding`:

1. **The user's words.** "use opus for coding", "sonnet for the scouts", "everything on the session model" — an instruction in this session outranks every file. Pass only bare aliases (`haiku` / `sonnet` / `opus` / `fable`) as the Agent tool's `model`.
2. **The inventory.** `~/.claude/model-inventory.json` (written by the `model-inventory` skill, if installed) maps roles to fallback chains. Trust it only if it parses, `probed` is `true`, and `generated_at` is under 7 days old; take the chain's first entry not marked unavailable, blocked-by-auth, or quota-exhausted. Stale or missing with the skill installed → run it once before the first spawn, never mid-execution.
3. **No override.** Neither source resolves → spawn with no `model`; the sub-agent inherits the session model. Routing never blocks a task.

A spawn rejected over its model (entitlement, quota, unknown alias) falls to the next chain entry, then to no override — log it in `Risks`.

- ❌ "Planning on fable, coding on opus" implemented by switching the session — there is no such switch; the skill has silently kept everything on one model.
- ✅ Session started on fable; `Current understanding` reads `Routing: scout → sonnet (inventory), coder → opus (user), plan/validate → session`; every Phase 4 delegated step spawns with `model: opus` and the session re-runs the step's validation itself.

## Phases

### Phase 1 — Understand

If `.claude/design-briefs/` holds an `APPROVED` brief whose Intent line matches this task, that brief is the spec: its Decisions, Interfaces, and Constraints go into `Current understanding` verbatim, and its Intent line becomes `Goal`. Restate the task back to the user in your own words inside the `Goal` section of the first turn. Surface anything ambiguous as a `Risks` item or, if it blocks design, ask **one** clarifying question with `AskUserQuestion`. Do not interview broadly — this skill assumes the spec is given. If you find yourself with more than two clarifying questions, stop and ask the user to tighten the spec.

Specifically capture in `Current understanding`:

- What done looks like (the user's acceptance criteria, or your inferred version if they didn't state one).
- Constraints that are stated, not inferred (auth model, framework, persistence, naming).
- Anything the user said NOT to do.

Anything you're filling in by inference goes into `Assumptions`, not `Current understanding` — until it's confirmed.

**Classify the shape of the task out loud** in `Current understanding`, so the user can override it:

- **Spike** — a feasibility question ("can we…", "is it possible…"). Output is an *answer*, not code you keep. Plan = the probe; anything built stays labeled throwaway. Keeping the code is a new task — reclassify.
- **Bounded** — a change to a flow that already exists in this repo (new flag, small endpoint, one-file fix). Bounded measures the *repo*, not your familiarity with the kind of app: no existing flow to change → not bounded. Normal plan gate.
- **Architectural** — new subsystem, restructured component boundaries, interfaces others depend on. Not this skill: stop and get the design agreed first — the `design-brief` skill if installed, otherwise a short design conversation with the user covering the goal, the constraints, the component boundaries, and the interfaces others will depend on — then come back with the approved design as the spec.

The ratchet is one-way. Hidden complexity discovered mid-task upgrades the classification — stop, say so in `Risks`, re-plan (or route out). Nothing downgrades mid-task, and "almost done" is not a reason to skip the upgrade.

### Phase 2 — Inspect

Before drafting a plan, read the relevant code. Start with the project's own instructions — `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `.editorconfig`, the `scripts` block of `package.json` or its equivalent — and record the test, build, lint, and format commands they name in `Current understanding`. A command you guessed is an `Assumption`.

**Baseline the suite before touching anything.** Run the project's test command once and quote its summary line into `Current understanding`. Pre-existing failures belong to the baseline, not to your task; the Phase 4 gate is "no new failures", and the Phase 5 gate is "green, or exactly the baseline's red". No runnable suite → say so; every step's validation then has to be an observable signal you name.

**Capture what must not change, before you change anything.** If the task says some output, format, or behavior stays the same ("byte-for-byte unchanged", "existing callers unaffected"), run it now and save the output to a file outside the tree (`node bin/cli.js list > /tmp/list.before.txt`). The Phase 5 comparison is `diff` against that file. The pre-change tree exists only now — never recover it later with `stash` or `checkout`.

Populate `Files to inspect` as a working set, then actually read them — don't list-and-skip. Use `Glob` / `Grep` / `Read` in parallel where the lookups are independent. Stop reading when you understand:

- The existing pattern for whatever layer this task touches (controller, page, service, hook, migration).
- The wiring points the new code needs to hook into (DI registration, route table, exports, schema).
- Any sibling test class or test file the new tests should be appended to.

Move each inspected file from `Files to inspect` into `Current understanding` with a one-line takeaway. Skip generic file summaries — note only the takeaway that affects the plan.

#### Decision gate: inline reads vs. inspection council

Be honest about scope before deciding. Manufacturing a sub-agent council for a three-file task is ceremony.

- **Inline reads (default)** when the inspection set is ≤ ~5 files or stays inside one layer / module. Read them directly with `Read` (in parallel) and roll the takeaways into `Current understanding`.
- **Inspection council** when the set spans ≥ 2 distinct layers (e.g. controller + service + persistence + tests) and the total reading is wide enough that doing it inline would burn the main context — especially since every turn of this skill re-emits the seven-section output block. The council protects the working window so you can still execute cleanly over many turns.

#### Inspection council (parallel `Explore` sub-agents)

When convened:

1. **Slice by layer / area.** Name 2–4 distinct slices of the codebase the plan will touch (e.g. *Controller + routing*, *Service / domain*, *Persistence + migrations*, *Tests + fixtures*). Each slice gets one sub-agent. Slices must be non-overlapping — if two slices would re-read the same files, merge them.
2. **Spawn in parallel.** Send a **single message** with N `Agent` calls using `subagent_type=Explore`, one per slice. Pass each agent the `scout` model resolved per [Model routing](#model-routing). Each agent gets a self-contained brief:
   - The verbatim task (the `Goal` paragraph).
   - The one slice it owns and what to map within it.
   - What to report: existing pattern for that layer, wiring points the new code must hook into, sibling test class / test file to append to, any forbidden-pattern signals (e.g. "no `ExecuteSqlRaw`", "no direct `fetch` in server components"), and `file:line` citations for every claim.
   - Hard constraint: "Do not propose a plan. Do not invent. If you cannot find an existing pattern in your slice, say so explicitly — do not fabricate."
   - Length cap: ≤ 300 words.
3. **Aggregate, don't duplicate.** When all sub-agents return, merge their findings into `Current understanding` as one consolidated picture — not four parallel sections. Each finding keeps its `file:line` citation. Anything no sub-agent could find a pattern for goes into `Assumptions` (you'll be inventing it; that needs to be visible).
4. **Re-emit the seven-section output** with the consolidated `Current understanding` before moving to Phase 3.

The point isn't "more agents = better." It's that wide inspection eats the main context window and the per-turn output format eats it again every turn — the council pushes the reading off-window so the executional phase still has room to breathe.

**Library API check.** If the plan depends on a specific third-party library / framework symbol (e.g. EF Core, Prisma, NextAuth, Stripe SDK), and the version is pinned in this repo, query `context7` for the current docs before drafting the plan. Training-data API knowledge can be a major version behind.

### Phase 3 — Plan (gate on approval)

Draft the `Plan` section as a numbered list of concrete, verifiable steps. Each step is one logical change and names its validation **as the command or check you will run, verbatim** — a step whose validation is a phrase is a hope, not a step.

- ❌ `3. Add the --json flag and make sure it works.`
- ✅ `3. Add --json to OPTIONS in bin/claude-skills.js and branch in the list case → validate: node bin/claude-skills.js list --json | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))" exits 0.`

Order the steps so that **new or changed behavior starts with its test**: "write failing test for X" → "run, confirm red for the right reason" → "implement minimum" → "run, confirm green" are separate steps with separate validations, not one "add X with tests" step. Steps that can't have a test (config, wiring) say what observable signal validates them instead.

**Check the plan's shape before presenting it.** Walk the numbered list once and confirm: every step that adds or changes behavior is *preceded* by its failing-test step; no two steps share a validation; every validation is a verbatim command or named observable. A plan whose test steps cluster at the end is reordered before the user sees it — long plans drift this way (implementation 1–4, tests 5–6), and the reorder costs nothing now and a lost red signal later.

- ❌ `1. env override  2. mark field  3. warn in list  4. warn in install  5. unit tests  6. CLI tests  7. npm test`
- ✅ `1. unit test for the marker → red  2. mark field → green  3. CLI test for the warning → red  4. warn in list → green  5. …`

Confirm the branch before planning file writes: implementing on `main`/`master` (or the repo's default branch) needs the user's explicit consent — otherwise propose a branch name in the plan and create it as step 0.

Then enter Plan Mode (`EnterPlanMode`) and present the plan along with the rest of the per-turn output. Call `ExitPlanMode` and **wait**. Do not write a single file until the user approves the plan. If Plan Mode is unavailable in this environment, present the plan and end the turn with one line — "Reply **approved** to start, or tell me what to change." — and wait for that word. Silence, a tangential message, or "looks reasonable" with a question attached is not approval.

If the user pushes back, revise and re-present. Do not partial-implement against an unapproved plan.

### Phase 4 — Execute incrementally

Walk the plan one step at a time. Before each step, decide who writes it:

**Delegation gate.** Hand the step to a coder sub-agent (`subagent_type=general-purpose`, `model` = the `coder` or `coder_high_risk` resolution from [Model routing](#model-routing)) when **either** the user asked for a model split **or** the step touches 3+ files or a risky path (auth, money, deletion, migration, concurrency). Otherwise write it inline — a one-file step delegated is more brief than work. Whichever writes, steps 0–4 below are the session's and are never delegated.

When delegating, one sub-agent per step, fresh each time, and the brief MUST contain:

- This plan step **verbatim**, with its validation criterion, and the `Goal` paragraph.
- The `file:line` findings from `Current understanding` for the files this step touches, and the pattern to follow (cite the instance).
- The constraints block: follow the cited pattern or state "no precedent — chose X because cheapest to reverse"; test first where a seam exists (write it, run it, quote the red, then the minimum that turns it green); the command-failure protocol (read the full error, change one named thing, retry once, second failure = stop and report); scope is this step exactly — adjacent problems go in a "found along the way" list, not the diff; **NEVER commit, branch, edit other steps' files, or spawn sub-agents.**
- Report format: files changed → commands run with quoted output → verified vs. assumed, labeled → found along the way. Status is exactly one of `DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`.

The sub-agent's report is testimony. `NEEDS_CONTEXT` → supply it and re-dispatch on the same model. `BLOCKED` → treat as the step's command failure below. `DONE` → proceed to step 2 and **run the validation yourself**; the sub-agent's quoted green is not your observation.

- ❌ Sub-agent returns "implemented, tests pass" → tick the box. Nothing was observed in this session.
- ✅ Sub-agent returns its report → session runs `npm test -- webhooks` → `12 passed` pasted → tick.

For each step:

0. **Re-anchor.** Re-read the `Goal` section and this step's validation criterion from `Plan` before touching anything. Thirty seconds of re-reading is what keeps turn 20 aligned with turn 1 — drift is silent and this is the only cheap defense.
1. **Make the smallest change that completes the step.** No drive-by refactors, no "while I'm here" fixes, no batched edits across multiple steps. Done means the step's criterion, nothing more — improvements you notice (missing validation, refactor opportunity, extra config) go into `Risks` as findings, not into the diff. If completing the step requires doing something the task text did not ask for, or differently than it said (dropping a placeholder, renaming a field, changing a default), that is a **deviation**: write it in `Risks` as `Deviation: <what> — <why> — <how to revert>` the turn you make it, so the user can veto it before it compounds. A deviation mentioned only in passing is a decision made for the user.
2. **Validate immediately.** Run the test, build, type-check, lint, curl the endpoint, or load the page — whichever signal is appropriate for that step. If there's no automated signal at all, say so explicitly in `Progress`; don't pretend there is one.
3. **Tick the checkbox** with evidence that is an **observed artifact from this turn** — a pasted output line, an exit code, a status code. A claim is not evidence.
   - ❌ `tests pass` — an assertion; nothing was observed.
   - ✅ `dotnet test → Passed! 42 passed, 0 failed, 0 skipped` — pasted from output you just saw.
   If you didn't run it this turn, you can't tick it.
4. **Re-emit the full per-turn output** before moving to the next step.

When a command fails:

- Read the **full** error output — the load-bearing detail is usually in the last lines you'd skim past.
- Change exactly one thing based on what the error says, then retry once.
- Two failures on the same step = stop. Add the verbatim error to `Risks` and surface to the user. Never retry verbatim, and never continue as if the command succeeded — a result you didn't observe is not a result.

When a validation fails:

- Do not move on.
- Add the failure mode to `Risks`.
- Diagnose in place (one focused investigation, not a tangent). If it turns into a real debugging session, suggest dropping into `diagnose` and pausing this skill.
- **Leave the tree consistent when you stop.** A step that cannot be made green under the protocol is reverted — undo *that step's* edits (yours or the sub-agent's; `git diff -- <files>` shows exactly what to undo) so the tree is back at the last observed-green state, then stop and report. Never hand the user a half-applied step.
- **Three failed fixes on the same behavior is a hard stop, not a fourth attempt.** Each fix surfacing new coupling somewhere else means the approach is wrong, not unlucky — say so in `Risks`, name what the plan assumed that the code contradicts, and re-plan or route out (`design-brief` if the shape turned architectural).

When you find new files you need to read mid-execution, add them to `Files to inspect` rather than reading silently. The list is the audit trail.

### Phase 5 — Final validation and report

When every checkbox is ticked:

- Re-run the full validation suite for the task (tests + build + any acceptance criteria from `Current understanding`). A green run from an earlier turn proves the tree it ran on, not this one.
- **Review the diff before you call it done.** `git diff` the whole change and walk it once as a reviewer, not the author: debug residue, dead code, a helper with one caller, a magic value, an error path with no test, a name that says *what* instead of *what for*. Then the threshold decides, not your sense of how small the change feels: 3+ files changed or a risky path touched → run the `code-review` skill if installed (a self-review is the fallback only when it is not). Renamed anything, changed a default or signature, or touched shared state → run `regression-hunt` if installed. Fix blockers before reporting; log suggestions in `Risks`; a review skipped because it "felt small" is a `Deviation:` line.
- **Requirements checklist, line by line.** Re-read the original task text and the acceptance criteria in `Current understanding`; for each one, point at the observed evidence (test name, command output, file) that satisfies it. "Tests pass" is not "requirements met" — tests only cover what you thought to test. Any requirement without evidence is reported as a gap, not rounded up.
- Emit one last full per-turn output where `Progress` is entirely `[x]`, `Assumptions` is empty (or each remaining assumption is justified as out-of-scope), and `Risks` lists anything the user should know about that wasn't part of the task — followed by an eighth section that appears **only** in this final turn:

  ```markdown
  ## Requirements
  | # | Requirement (task text, quoted) | Evidence (test name / command → output / file:line) | Status |
  | 1 | "print one warning line per such skill to STDERR" | cli.test.js `list warns on stderr…` → pass | met |
  | 2 | "stdout must stay byte-for-byte unchanged" | diff /tmp/list.before.txt <(node bin/cli.js list) → empty | met |
  | 3 | … | no test covers this; verified manually only | gap |
  ```

  One row per requirement in the task text, quoted not paraphrased. `met` needs observed evidence in the cell; anything else is `gap` or `deviation` (cross-referenced to `Risks`). A final turn without this table is not a final turn.
- End with one short paragraph: what changed, what to run, what's deliberately not done.

## Anti-patterns

- ❌ Omitting sections "because nothing changed". The structure exists precisely so a future session can resume — write `_(none yet)_` instead.
- ❌ Skipping inspection because the answer "looks obvious". The cost of being wrong is much higher than the cost of one extra `Read`.
- ❌ Starting edits without a baseline suite run — the first red test then has no owner, and a pre-existing failure eats the rest of the session.
- ❌ Resuming from a previous block by trusting its ticks. Re-observe the last validation before continuing.
- ❌ Stopping on a failed step with the half-applied change still in the tree. Revert the step, then report.
- ❌ Treating "looks reasonable — but what about X?" as plan approval. Answer X, re-present, wait.
- ❌ Presenting a plan whose tests all sit at the end. Reorder before presenting; the red signal is the point.
- ❌ Recovering the pre-change behavior with `git stash` to compare outputs. Capture it in the baseline, before the first edit.
- ❌ Changing something the task didn't ask for and mentioning it in `Current understanding`. That's a `Deviation:` line in `Risks`, the turn it happens.
- ❌ Batching multiple plan steps into a single change and ticking them together. The validation-per-step is the discipline; collapsing it loses the value.
- ❌ Treating an unconfirmed inference as `Current understanding`. Anything you're betting on without evidence is an `Assumption` until proven.
- ❌ Drifting from the strict header set ("here's a quick update" prose-only turns). One ad-hoc turn becomes ten.
- ❌ Running this skill on a fuzzy spec. Stop and ask the user to clarify before proceeding.
- ❌ Calling an architectural change "bounded" to avoid the design conversation — reaching for the label to skip work *is* the doubt; take the heavier path.
- ❌ Writing the implementation, then the tests, in one plan step. Red first, then green, each observed.
- ❌ Exiting Plan Mode while the plan still has open questions or assumptions that materially change the design.
- ❌ Continuing past a failed validation. A red test is a Phase-4 stop, not a TODO for later.
- ❌ Delegating the plan, the plan gate, or a validation to a sub-agent — those are the session model's job; only reading and single-step coding move off-session.
- ❌ Ticking a delegated step on the sub-agent's word. Re-run the step's validation in the session and paste what you saw.
- ❌ Spawning a coder for a one-file step because routing exists. The gate is the user's ask or 3+ files / a risky path.
- ❌ Inventing new abstractions when an existing pattern in the repo would have answered the same need. The inspection phase exists to prevent this.
- ❌ Convening the inspection council for a 3-file task. Ceremony for its own sake. Inline reads are the default — escalate only when the inspection set genuinely spans multiple layers.
- ❌ Spawning the inspection sub-agents serially instead of in parallel — one message, N `Agent` calls. Serial defeats the context-protection rationale.
- ❌ Letting a sub-agent slice overlap with another's. If two slices would re-read the same files, merge them first.
- ❌ Ticking a checkbox with claimed evidence (`tests pass`) when the command wasn't run this turn. Evidence is pasted observation, not memory or assertion.
- ❌ Retrying a failed command verbatim, or proceeding as if it succeeded. Read the error, change one thing, retry once; twice failed = `Risks` + stop.
- ❌ Gold-plating a step: extra config options, defensive layers, speculative hooks the plan didn't call for. Findings go to `Risks`; the diff stays the size of the step.
- ✅ Same seven headers every turn, one step at a time, one validation per step, assumptions tracked explicitly until confirmed or killed.

## Examples

### Example 1: A concrete task with a defined scope

**User:** "/task-executor — Work on task: Add a Stripe subscriptions webhook endpoint that records subscription state changes in our existing `Subscriptions` table."

**Claude:**

1. **Phase 1 — Understand.** First turn opens with all seven headers. `Goal` restates the task. `Current understanding` notes "endpoint must verify Stripe signature; state changes recorded in existing `Subscriptions` table". `Assumptions` lists "endpoint lives under `/api/webhooks/stripe`" (not yet confirmed) and "no new table needed".
2. **Phase 2 — Inspect.** Populates `Files to inspect` with `BillingService.cs`, `Subscriptions.cs` (the entity), `appsettings.json` (for the webhook secret), one existing webhook endpoint as a pattern reference. Reads them in parallel, then moves each into `Current understanding` with a one-line takeaway. Confirms the assumption about the route (or revises it).
3. **Phase 3 — Plan.** Enters Plan Mode. Plan lists: (1) add `StripeWebhookController` with signature verification, (2) extend `BillingService.HandleSubscriptionEvent`, (3) wire DI, (4) append three NUnit tests to `BillingServiceTests`, (5) run `dotnet test`, (6) run `dotnet build`. Calls `ExitPlanMode` and waits.
4. **Phase 4 — Execute.** Step (1): writes the controller, runs `dotnet build`, ticks `[x] controller scaffolded — build green`. Re-emits all seven sections. Step (2): writes the service method, writes the first test, runs `dotnet test` — red for the right reason, then green after implementation, ticks. Continues one at a time.
5. **Phase 5 — Report.** Final turn shows every step `[x]`, lists files written, gives the exact command for the user to test the endpoint locally with Stripe CLI.

### Example 2: User invokes the skill on a fuzzy spec

**User:** "/task-executor — Build the subscription management area."

**Claude:** First turn opens with the seven headers anyway. `Goal` restates what the user said. `Current understanding` flags that "subscription management area" is undefined (pages? roles? actions? entry point?). `Risks` lists three or four concrete ambiguities. Then a single short paragraph at the end: "This spec is too fuzzy for `task-executor` — I need a clearer definition before I can execute with discipline. Can you narrow down what 'subscription management area' means (pages, roles, actions, entry point)?"

### Example 3: A validation fails mid-execution

**User:** Mid-task. Claude has ticked steps 1–3 and just ran the tests for step 4.

**Claude:** Re-emits all seven sections. `Progress` shows step 4 unchecked with a one-line note `tests failed — NullReferenceException at BillingService.cs:84`. `Risks` adds the failure. `Current understanding` notes the call site. Diagnoses in place — one targeted read, one minimal fix, re-runs. If the fix is one-line and obvious, ticks the step and continues. If the failure spreads or the cause is non-obvious, suggests pausing this skill and dropping into [`diagnose`](../diagnose/SKILL.md).

## Notes

- The seven-header format is deliberately rigid. It's the part of the skill that loses value the moment you let it slip — one ad-hoc turn breaks the contract.
- If the task is small enough that the seven-section output dwarfs the actual work, the task is too small for this skill. Just do it.

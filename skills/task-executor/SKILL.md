---
name: task-executor
description: Disciplined execution loop for a single defined task — Understand → Inspect → Plan → Execute incrementally → Validate after every change → Track assumptions → Update progress. Forces a strict per-turn output format (Goal / Current understanding / Files to inspect / Plan / Progress / Risks / Assumptions) so the work stays legible and resumable instead of devolving into ad-hoc edits. When the inspection set spans multiple layers (controller + service + persistence + tests), Phase 2 convenes an **inspection council**: parallel `Explore` sub-agents — one per layer — each map their slice and return `file:line`-cited findings on existing patterns, wiring points, and sibling test classes; the main session aggregates the results into `Current understanding` so the working context window stays free for execution. Small inspection sets skip the council. Enters Plan Mode after inspection and gates on `ExitPlanMode` approval before writing any code. Each incremental change is followed by a validation step (run the test, build, type-check, or curl the endpoint) before moving to the next checkbox. Use this skill whenever the user says "/task-executor", "Work on task: <description>", "task-executor", or hands you a single concrete task to execute with discipline — even if they don't name the skill. Do **not** auto-trigger on greenfield feature design with a fuzzy spec — this skill assumes the spec is given.
---

# Task Executor

A discipline for working on a single, already-defined task. The task is given; the goal is to execute it without skipping context, without batching changes, and without losing the thread mid-way. Every turn emits the same six sections so the user (and any future session) can pick up the state at a glance.

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

Every assistant turn during this skill — from the first response to the final report — opens with these six sections, in this order, with exactly these headers. Sections that have nothing yet say `_(none yet)_` rather than being omitted, so the structure stays scannable.

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

## Phases

### Phase 1 — Understand

Restate the task back to the user in your own words inside the `Goal` section of the first turn. Surface anything ambiguous as a `Risks` item or, if it blocks design, ask **one** clarifying question with `AskUserQuestion`. Do not interview broadly — this skill assumes the spec is given. If you find yourself with more than two clarifying questions, stop and ask the user to tighten the spec.

Specifically capture in `Current understanding`:

- What done looks like (the user's acceptance criteria, or your inferred version if they didn't state one).
- Constraints that are stated, not inferred (auth model, framework, persistence, naming).
- Anything the user said NOT to do.

Anything you're filling in by inference goes into `Assumptions`, not `Current understanding` — until it's confirmed.

### Phase 2 — Inspect

Before drafting a plan, read the relevant code. Populate `Files to inspect` as a working set, then actually read them — don't list-and-skip. Use `Glob` / `Grep` / `Read` in parallel where the lookups are independent. Stop reading when you understand:

- The existing pattern for whatever layer this task touches (controller, page, service, hook, migration).
- The wiring points the new code needs to hook into (DI registration, route table, exports, schema).
- Any sibling test class or test file the new tests should be appended to.

Move each inspected file from `Files to inspect` into `Current understanding` with a one-line takeaway. Skip generic file summaries — note only the takeaway that affects the plan.

#### Decision gate: inline reads vs. inspection council

Be honest about scope before deciding. Manufacturing a sub-agent council for a three-file task is ceremony.

- **Inline reads (default)** when the inspection set is ≤ ~5 files or stays inside one layer / module. Read them directly with `Read` (in parallel) and roll the takeaways into `Current understanding`.
- **Inspection council** when the set spans ≥ 2 distinct layers (e.g. controller + service + persistence + tests) and the total reading is wide enough that doing it inline would burn the main context — especially since every turn of this skill re-emits the six-section output block. The council protects the working window so you can still execute cleanly over many turns.

#### Inspection council (parallel `Explore` sub-agents)

When convened:

1. **Slice by layer / area.** Name 2–4 distinct slices of the codebase the plan will touch (e.g. *Controller + routing*, *Service / domain*, *Persistence + migrations*, *Tests + fixtures*). Each slice gets one sub-agent. Slices must be non-overlapping — if two slices would re-read the same files, merge them.
2. **Spawn in parallel.** Send a **single message** with N `Agent` calls using `subagent_type=Explore`, one per slice. Each agent gets a self-contained brief:
   - The verbatim task (the `Goal` paragraph).
   - The one slice it owns and what to map within it.
   - What to report: existing pattern for that layer, wiring points the new code must hook into, sibling test class / test file to append to, any forbidden-pattern signals (e.g. "no `ExecuteSqlRaw`", "no direct `fetch` in server components"), and `file:line` citations for every claim.
   - Hard constraint: "Do not propose a plan. Do not invent. If you cannot find an existing pattern in your slice, say so explicitly — do not fabricate."
   - Length cap: ≤ 300 words.
3. **Aggregate, don't duplicate.** When all sub-agents return, merge their findings into `Current understanding` as one consolidated picture — not four parallel sections. Each finding keeps its `file:line` citation. Anything no sub-agent could find a pattern for goes into `Assumptions` (you'll be inventing it; that needs to be visible).
4. **Re-emit the six-section output** with the consolidated `Current understanding` before moving to Phase 3.

The point isn't "more agents = better." It's that wide inspection eats the main context window and the per-turn output format eats it again every turn — the council pushes the reading off-window so the executional phase still has room to breathe.

**Library API check.** If the plan depends on a specific third-party library / framework symbol (e.g. EF Core, Prisma, NextAuth, Stripe SDK), and the version is pinned in this repo, query `context7` for the current docs before drafting the plan. Training-data API knowledge can be a major version behind.

### Phase 3 — Plan (gate on approval)

Draft the `Plan` section as a numbered list of concrete, verifiable steps. Each step is one logical change with a clear validation method.

Then enter Plan Mode (`EnterPlanMode`) and present the plan along with the rest of the per-turn output. Call `ExitPlanMode` and **wait**. Do not write a single file until the user approves the plan.

If the user pushes back, revise and re-present. Do not partial-implement against an unapproved plan.

### Phase 4 — Execute incrementally

Walk the plan one step at a time. For each step:

0. **Re-anchor.** Re-read the `Goal` section and this step's validation criterion from `Plan` before touching anything. Thirty seconds of re-reading is what keeps turn 20 aligned with turn 1 — drift is silent and this is the only cheap defense.
1. **Make the smallest change that completes the step.** No drive-by refactors, no "while I'm here" fixes, no batched edits across multiple steps. Done means the step's criterion, nothing more — improvements you notice (missing validation, refactor opportunity, extra config) go into `Risks` as findings, not into the diff.
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

When you find new files you need to read mid-execution, add them to `Files to inspect` rather than reading silently. The list is the audit trail.

### Phase 5 — Final validation and report

When every checkbox is ticked:

- Re-run the full validation suite for the task (tests + build + any acceptance criteria from `Current understanding`).
- Emit one last full per-turn output where `Progress` is entirely `[x]`, `Assumptions` is empty (or each remaining assumption is justified as out-of-scope), and `Risks` lists anything the user should know about that wasn't part of the task.
- End with one short paragraph: what changed, what to run, what's deliberately not done.

## Anti-patterns

- ❌ Omitting sections "because nothing changed". The structure exists precisely so a future session can resume — write `_(none yet)_` instead.
- ❌ Skipping inspection because the answer "looks obvious". The cost of being wrong is much higher than the cost of one extra `Read`.
- ❌ Batching multiple plan steps into a single change and ticking them together. The validation-per-step is the discipline; collapsing it loses the value.
- ❌ Treating an unconfirmed inference as `Current understanding`. Anything you're betting on without evidence is an `Assumption` until proven.
- ❌ Drifting from the strict header set ("here's a quick update" prose-only turns). One ad-hoc turn becomes ten.
- ❌ Running this skill on a fuzzy spec. Stop and ask the user to clarify before proceeding.
- ❌ Exiting Plan Mode while the plan still has open questions or assumptions that materially change the design.
- ❌ Continuing past a failed validation. A red test is a Phase-4 stop, not a TODO for later.
- ❌ Inventing new abstractions when an existing pattern in the repo would have answered the same need. The inspection phase exists to prevent this.
- ❌ Convening the inspection council for a 3-file task. Ceremony for its own sake. Inline reads are the default — escalate only when the inspection set genuinely spans multiple layers.
- ❌ Spawning the inspection sub-agents serially instead of in parallel — one message, N `Agent` calls. Serial defeats the context-protection rationale.
- ❌ Letting a sub-agent slice overlap with another's. If two slices would re-read the same files, merge them first.
- ❌ Ticking a checkbox with claimed evidence (`tests pass`) when the command wasn't run this turn. Evidence is pasted observation, not memory or assertion.
- ❌ Retrying a failed command verbatim, or proceeding as if it succeeded. Read the error, change one thing, retry once; twice failed = `Risks` + stop.
- ❌ Gold-plating a step: extra config options, defensive layers, speculative hooks the plan didn't call for. Findings go to `Risks`; the diff stays the size of the step.
- ✅ Same six headers every turn, one step at a time, one validation per step, assumptions tracked explicitly until confirmed or killed.

## Examples

### Example 1: A concrete task with a defined scope

**User:** "/task-executor — Work on task: Add a Stripe subscriptions webhook endpoint that records subscription state changes in our existing `Subscriptions` table."

**Claude:**

1. **Phase 1 — Understand.** First turn opens with all six headers. `Goal` restates the task. `Current understanding` notes "endpoint must verify Stripe signature; state changes recorded in existing `Subscriptions` table". `Assumptions` lists "endpoint lives under `/api/webhooks/stripe`" (not yet confirmed) and "no new table needed".
2. **Phase 2 — Inspect.** Populates `Files to inspect` with `BillingService.cs`, `Subscriptions.cs` (the entity), `appsettings.json` (for the webhook secret), one existing webhook endpoint as a pattern reference. Reads them in parallel, then moves each into `Current understanding` with a one-line takeaway. Confirms the assumption about the route (or revises it).
3. **Phase 3 — Plan.** Enters Plan Mode. Plan lists: (1) add `StripeWebhookController` with signature verification, (2) extend `BillingService.HandleSubscriptionEvent`, (3) wire DI, (4) append three NUnit tests to `BillingServiceTests`, (5) run `dotnet test`, (6) run `dotnet build`. Calls `ExitPlanMode` and waits.
4. **Phase 4 — Execute.** Step (1): writes the controller, runs `dotnet build`, ticks `[x] controller scaffolded — build green`. Re-emits all six sections. Step (2): writes the service method, writes the first test, runs `dotnet test` — red for the right reason, then green after implementation, ticks. Continues one at a time.
5. **Phase 5 — Report.** Final turn shows every step `[x]`, lists files written, gives the exact command for the user to test the endpoint locally with Stripe CLI.

### Example 2: User invokes the skill on a fuzzy spec

**User:** "/task-executor — Build the subscription management area."

**Claude:** First turn opens with the six headers anyway. `Goal` restates what the user said. `Current understanding` flags that "subscription management area" is undefined (pages? roles? actions? entry point?). `Risks` lists three or four concrete ambiguities. Then a single short paragraph at the end: "This spec is too fuzzy for `task-executor` — I need a clearer definition before I can execute with discipline. Can you narrow down what 'subscription management area' means (pages, roles, actions, entry point)?"

### Example 3: A validation fails mid-execution

**User:** Mid-task. Claude has ticked steps 1–3 and just ran the tests for step 4.

**Claude:** Re-emits all six sections. `Progress` shows step 4 unchecked with a one-line note `tests failed — NullReferenceException at BillingService.cs:84`. `Risks` adds the failure. `Current understanding` notes the call site. Diagnoses in place — one targeted read, one minimal fix, re-runs. If the fix is one-line and obvious, ticks the step and continues. If the failure spreads or the cause is non-obvious, suggests pausing this skill and dropping into [`diagnose`](../diagnose/SKILL.md).

## Notes

- The six-header format is deliberately rigid. It's the part of the skill that loses value the moment you let it slip — one ad-hoc turn breaks the contract.
- If the task is small enough that the six-section output dwarfs the actual work, the task is too small for this skill. Just do it.

---
name: autopilot
description: Fully autonomous end-to-end task run with NO human gates — pulls the work item (via the azure-devops or github skill if installed, or takes an inline task description), plans against the real codebase, executes incrementally with per-increment verification, writes and runs tests, code-reviews and fixes blocking findings, then STOPS before any commit/push/PR and delivers an evidence-backed report with every assumption logged. Replaces interactive questions with a documented-assumption protocol; halts only for destructive actions, missing access, or unimplementable specs. Use this skill whenever the user says "autopilot", "/autopilot", "run task <id> autonomously", "work this task end to end without asking", "full autonomy on this", "do the whole task, skip commits and PR", or launches a headless run with a task id — even if they don't explicitly say "autopilot skill". Do not use when the user wants interactive planning gates (use task-executor) or wants commits/PRs created.
---

# Autopilot

The full loop — acquire → plan → execute → test → review → report — with the human gates replaced by an explicit contract. Built for headless/hands-off runs where nobody can answer questions mid-flight.

## When to use this skill

- "autopilot task 12345" / "run task 12345 autonomously" / "/autopilot 12345"
- "work this end to end without asking me anything, skip PR and commits"
- A headless (`claude -p`) invocation naming a work item or task description.

Do **not** use when the user is present and wants to approve the plan — that's `task-executor` territory.

## The autonomy contract

1. **No questions.** Never call `AskUserQuestion`; never enter a plan-approval gate. Every question you *would* have asked becomes an ASSUMPTIONS entry: the question, the answer chosen, why, and the blast radius if wrong. Choose the assumption that (a) matches the codebase's existing patterns, and (b) is cheapest to reverse. When those conflict, prefer reversible. "Matches the codebase" is an evidence claim, not a vibe — cite the instance you found (`file:line`); if you searched and found no precedent, say so and justify by reversibility alone.
   - ❌ "Assumed camelCase keys — matches project conventions." (no instance cited — that's a style guess wearing evidence's clothes)
   - ✅ "Assumed camelCase keys — every existing DTO in `src/api/dto/` uses them (e.g. `UserDto.ts:12`). Blast radius: one serializer config line."
2. **Hard stops only** — halt and report (do not improvise) when: the next step is destructive or hard to reverse (data deletion, force push, dropping schema objects, external side effects); required access/credentials are missing; or the task as written contradicts the codebase so fundamentally that both interpretations are expensive. The stop-vs-assume test: *would a wrong guess destroy data, publish something externally, or cost more to undo than redoing the whole task?* No → assume and log; yes → hard stop. A hard stop still produces the full report with state-so-far and the one decision needed to resume.
3. **Never commit, push, or create PRs.** The deliverable is a verified working tree plus the report. The human gets the final gate.
4. **Scope is the task, exactly.** Adjacent problems you notice go in the report's "Found along the way" list — not into the diff.
5. **All verification doctrine applies**: a result you did not observe is "not run", never "passed"; quote the evidence.

## Workflow

### Phase 0 — Acquire the task

Work item id given → pull it with the `azure-devops` or `github` skill if installed (description, comments, AND embedded screenshots — view them; acceptance criteria hide in images and comments). Inline description given → use it directly. Exit gate: restate "This task needs ___ so that ___" in one line. Can't fill the second blank → derive it from the artifacts; still can't → hard stop.

### Phase 1 — Plan (self-gated, not user-gated)

Inspect the code the task touches (use `task-executor`'s inspection discipline; spawn parallel explorers for multi-layer changes). Draft increments, each with its own verification. Then **self-grill the plan**: attack it the way `think-like-fable` §6 attacks a conclusion — what mid-plan discovery would invalidate it? Which increment is riskiest? Reorder so that increment runs first. Record the plan verbatim in the report; it replaces the approval gate as the accountability artifact.

### Phase 2 — Execute incrementally

One increment at a time; observed verification after each before the next. Before starting each increment, restate the Phase 0 one-liner — if the increment doesn't serve it, the plan has drifted: re-plan, don't push through. A mid-course finding that contradicts the plan → re-plan (log the change and reason). Track assumptions as they accumulate — an assumption load-bearing for 3+ increments gets re-verified against the code, not carried on faith, and an assumption that rests on *another* assumption multiplies both blast radii: re-verify the base one before stacking a third on top.

**Command-failure protocol (autonomous variant).** A command fails → read the full error output, change exactly one thing it names, retry once. A second failure on the same step means the approach is wrong, not the luck: re-plan the increment around it, or hard stop if there's no route — never loop retries hoping for a different result, and never continue as if it passed. With nobody watching, silent retry-thrash burns the run and confabulated success poisons the report; both are worse than an honest stop.

### Phase 3 — Test

New or changed behavior gets tests per the `write-tests` discipline if installed (risk-ranked, each proven able to fail). Run the full relevant suite; quote the summary line. Suite fails on something you didn't touch → note it as pre-existing (verify by stashing your changes and re-running if cheap).

### Phase 4 — Review, with fix authority for blockers

Run the `code-review` skill if installed (else a focused diff review). Autonomous exception to its ask-first rule: **blocking findings are fixed immediately** — that permission is inherent to this mode. Suggestions and nits are logged, NOT applied (that's scope creep in an unattended run). Re-review after fixes; loop until zero blockers or two iterations — remaining blockers after two passes go to the report as known issues, prominently.

### Phase 5 — Report (the deliverable)

In order: **Outcome** (one sentence — done / done-with-caveats / hard-stopped where). "Done" is earned only when every phase exit was observed; a single `not run`, an unexplained test failure, or a surviving blocker makes it "done-with-caveats" *with the caveat named in the same sentence* — never buried three sections down. **What changed** (files + why). **Evidence** (quoted test/build/run output per the doctrine tags: verified/inferred/assumed). **Review outcome** (findings, fixes applied, anything remaining). **ASSUMPTIONS table** (question → choice → why → blast radius). **Found along the way.** **Your move** (the commit/PR steps deliberately left to the human, ready to paste).

## Sub-agent model routing

Resolve sub-agent models from the `routing.agent_tool` chains in `~/.claude/model-inventory.json`, under the same trust gate as `goal-runner`: the file counts only if it parses, `probed` is true, and `generated_at` is under 7 days old. When it fails the gate (missing, stale, unprobed) and the `model-inventory` skill is installed, run that skill's workflow **once at kickoff** — free scan plus its own probe discipline, a handful of one-line probes costing cents at most — then route from the fresh file, logging the discovery run (what was probed, what it found) in the report. Skill not installed, or discovery fails → spawn with no model override and log one line. Hard boundaries: discovery runs at most once per run and never mid-run (mid-run model failures use the chain fallback below, not re-probing); a discovery failure is a report note, never a hard stop; the inventory file is only ever written by the model-inventory workflow itself.

- Phase 1 inspection explorers → `scout` chain; Phase 4 review sub-agents (e.g. `code-review` lenses) → `reviewer` chain; any delegated coding → `coder`, or `coder_high_risk` when the task touches auth, money, migrations, or 3+ layers.
- Take each chain's first entry not marked `unavailable`/`blocked-by-auth`/`quota-exhausted`; pass bare aliases only (`haiku`/`sonnet`/`opus`/`fable`), skipping anything else. A spawn rejected over its model falls to the next entry, then to no override — logged in the report, never a hard stop.

## Launching autonomously (harness side)

The skill removes *its* gates; the harness must not add prompts back:

- Interactive session, hands-off: run with auto-accepting permissions (e.g. `--permission-mode acceptEdits`, or the project's pre-approved allowlist).
- Headless: `claude -p "autopilot task 12345" --permission-mode acceptEdits` (elevate to `bypassPermissions`/`--dangerously-skip-permissions` only in a sandboxed or disposable environment — it removes the last safety net).
- The never-commit rule means even a fully permissive run can't publish anything; that guardrail lives in this skill, not in permissions.

## Examples

### Example 1: headless work item

**User (via `claude -p`):** "autopilot task 4711"

**Claude:** pulls #4711 with the provider skill (reads two screenshots showing the expected UI state), plans 4 increments, executes with per-increment checks, adds 3 tests (each seen red first), review finds one blocker (missing null guard) → fixed → re-review clean, reports with 2 logged assumptions and paste-ready commit commands. No commits made.

### Example 2: hard stop done right

**User:** "run task 8912 end to end without asking"

**Claude:** task says "remove the legacy sync"; inspection shows production traffic still hitting it (verified from recent log timestamps). Destructive + contradicts the spec → hard stop after Phase 1 with the evidence, state-so-far, and the single decision needed ("confirm the consumer at X is decommissioned").

## Anti-patterns

- ❌ Asking "just one quick question" mid-run — the user is not there; that's what the ASSUMPTIONS log is for.
- ❌ Committing "to save progress" or creating a draft PR "for convenience" — the human gate is the point.
- ❌ Applying suggestion-level review findings unattended — fix blockers only; log the rest.
- ❌ Soft-stopping on mere ambiguity ("the spec doesn't say which format") — choose per the contract, log it, continue.
- ❌ Reporting "done" with unobserved checks, or burying a failed suite in the middle of the report.
- ❌ Retrying a failing command verbatim until it "passes" — one change, one retry, then re-plan or stop.
- ❌ Logging an assumption as "matches codebase conventions" with no `file:line` — that's a guess with a paper trail.
- ❌ Expanding scope because the code "really needed it" — the task, exactly; the rest is a list item.
- ✅ Zero questions, zero commits, observed evidence for every claim, assumptions on the record, human decides what ships.

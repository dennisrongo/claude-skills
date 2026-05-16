---
name: diagnose
description: Disciplined diagnosis loop for hard bugs and performance regressions. Reproduce → minimise → hypothesise → instrument → fix → regression-test. On non-trivial cases, Phase 3 spawns parallel `Explore` sub-agents — each defending a distinct hypothesis with falsifiable predictions and `file:line` evidence — then a cross-examination round drops the ones whose defender couldn't find support, breaking the single-chain anchoring trap. Trivial bugs skip the council. Use this skill whenever the user says "diagnose this", "debug this", "/diagnose", reports a bug, says something is broken / throwing / failing / flaky / hanging / leaking, or describes a performance regression — even if they don't explicitly ask for a "diagnose skill".
---

# Diagnose

A discipline for hard bugs. Skip phases only when explicitly justified.

When exploring the codebase, use the project's domain glossary to get a clear mental model of the relevant modules, and check ADRs in the area you're touching.

## Contract

**Inputs:** Bug symptom / failing test / performance regression description; current repo state, recent commits, stack traces / error logs when provided.
**Outputs:** A reproduction loop (deterministic pass/fail signal), ranked hypotheses with `file:line` evidence, instrumentation tagged `[DEBUG-…]`, the fix, a regression test, and a one-line post-mortem note.
**Invokes:** `(none)`
**Invoked by:** User phrases — "diagnose this", "debug this", bug reports, "broken / failing / flaky / hanging / leaking", performance-regression descriptions, "/diagnose".

## When to use this skill

- The user runs `/diagnose` or types "diagnose this" / "debug this".
- The user reports a bug or says code is broken, throwing, failing, hanging, crashing, leaking, or producing wrong output.
- The user describes a performance regression ("got slower", "high CPU", "timeout", "p95 climbed", "memory growing").
- The user shows a stack trace, error log, or failing test and asks why.
- A test is flaky and the user wants the underlying cause, not just a retry / skip.

Do **not** use this skill for: tiny known-cause one-line fixes, typos, or questions about how code works when nothing is actually wrong.

## Phase 1 — Build a feedback loop

**This is the skill.** Everything else is mechanical. If you have a fast, deterministic, agent-runnable pass/fail signal for the bug, you will find the cause — bisection, hypothesis-testing, and instrumentation all just consume that signal. If you don't have one, no amount of staring at code will save you.

Spend disproportionate effort here. **Be aggressive. Be creative. Refuse to give up.**

### Ways to construct one — try them in roughly this order

1. **Failing test** at whatever seam reaches the bug — unit, integration, e2e.
2. **Curl / HTTP script** against a running dev server.
3. **CLI invocation** with a fixture input, diffing stdout against a known-good snapshot.
4. **Headless browser script** (Playwright / Puppeteer) — drives the UI, asserts on DOM/console/network.
5. **Replay a captured trace.** Save a real network request / payload / event log to disk; replay it through the code path in isolation.
6. **Throwaway harness.** Spin up a minimal subset of the system (one service, mocked deps) that exercises the bug code path with a single function call.
7. **Property / fuzz loop.** If the bug is "sometimes wrong output", run 1000 random inputs and look for the failure mode.
8. **Bisection harness.** If the bug appeared between two known states (commit, dataset, version), automate "boot at state X, check, repeat" so you can `git bisect run` it.
9. **Differential loop.** Run the same input through old-version vs new-version (or two configs) and diff outputs.
10. **HITL bash script.** Last resort. If a human must click, drive _them_ with a structured prompt-and-capture loop so the signal is still machine-readable. Captured output feeds back to you.

Build the right feedback loop, and the bug is 90% fixed.

### Iterate on the loop itself

Treat the loop as a product. Once you have _a_ loop, ask:

- Can I make it faster? (Cache setup, skip unrelated init, narrow the test scope.)
- Can I make the signal sharper? (Assert on the specific symptom, not "didn't crash".)
- Can I make it more deterministic? (Pin time, seed RNG, isolate filesystem, freeze network.)

A 30-second flaky loop is barely better than no loop. A 2-second deterministic loop is a debugging superpower.

### Non-deterministic bugs

The goal is not a clean repro but a **higher reproduction rate**. Loop the trigger 100×, parallelise, add stress, narrow timing windows, inject sleeps. A 50%-flake bug is debuggable; 1% is not — keep raising the rate until it's debuggable.

### When you genuinely cannot build a loop

Stop and say so explicitly. List what you tried. Ask the user for: (a) access to whatever environment reproduces it, (b) a captured artifact (HAR file, log dump, core dump, screen recording with timestamps), or (c) permission to add temporary production instrumentation. Do **not** proceed to hypothesise without a loop.

Do not proceed to Phase 2 until you have a loop you believe in.

## Phase 2 — Reproduce

Run the loop. Watch the bug appear.

Confirm:

- [ ] The loop produces the failure mode the **user** described — not a different failure that happens to be nearby. Wrong bug = wrong fix.
- [ ] The failure is reproducible across multiple runs (or, for non-deterministic bugs, reproducible at a high enough rate to debug against).
- [ ] You have captured the exact symptom (error message, wrong output, slow timing) so later phases can verify the fix actually addresses it.

Do not proceed until you reproduce the bug.

## Phase 3 — Hypothesise

Generate **3–5 ranked hypotheses** before testing any of them. Single-hypothesis generation anchors on the first plausible idea.

Each hypothesis must be **falsifiable**: state the prediction it makes.

> Format: "If <X> is the cause, then <changing Y> will make the bug disappear / <changing Z> will make it worse."

If you cannot state the prediction, the hypothesis is a vibe — discard or sharpen it.

### Decision gate: inline vs. hypothesis council

- **Inline (skip the council)** when the cause is obvious from one read: a typo in the diff that introduced the bug, a one-file change with a clear root cause, a trivial null/undefined at an obvious site. Form 1–2 hypotheses directly.
- **Run the council** when there are multiple plausible causes, the bug spans modules, the regression appeared "somehow" between releases, or your first three hypotheses all feel equally plausible. Anchoring risk is highest exactly here.

### Hypothesis council (parallel + adversarial)

1. **Seed.** Jot 3–5 candidate hypotheses as one-liners. These are *seeds*, not analyses.
2. **Spawn defenders in parallel.** Send a **single message** with N `Agent` calls (one per seed) using `subagent_type=Explore`. Each defender gets:
   - The repro details and observed failure mode (verbatim).
   - **One** hypothesis to defend.
   - Instructions: "Build the strongest case for this hypothesis against the actual codebase. State the falsifiable prediction in the format above. Cite `file:line` for every piece of supporting evidence. If you cannot find supporting evidence in the code, say so explicitly — do not invent. Report in ≤300 words."
3. **Cross-examine.** When all defenders return, read their cases side by side. For each hypothesis write:
   - 2–3 falsifying checks the next phase will run (concrete, runnable).
   - Whether the defender found real evidence or hand-waved.
4. **Rank with the survivors.** Drop hypotheses whose defender couldn't find supporting evidence. Demote ones whose prediction is weak or untestable. Promote ones with clean `file:line` evidence + sharp predictions.

The point isn't "vote by sub-agent." It's that forcing each angle to be developed *independently* against the real code prevents the chain-of-thought from anchoring on the first plausible idea.

### Then: show the ranked list to the user

**Show the ranked list to the user before testing.** They often have domain knowledge that re-ranks instantly ("we just deployed a change to #3"), or know hypotheses they've already ruled out. Cheap checkpoint, big time saver. Don't block on it — proceed with your ranking if the user is AFK.

Include, per hypothesis: the falsifiable prediction, 1–2 lines of evidence with `file:line`, and the falsifying check Phase 4 will run.

## Phase 4 — Instrument

Each probe must map to a specific prediction from Phase 3. **Change one variable at a time.**

Tool preference:

1. **Debugger / REPL inspection** if the env supports it. One breakpoint beats ten logs.
2. **Targeted logs** at the boundaries that distinguish hypotheses.
3. Never "log everything and grep".

**Tag every debug log** with a unique prefix, e.g. `[DEBUG-a4f2]`. Cleanup at the end becomes a single grep. Untagged logs survive; tagged logs die.

**Library-API bugs — check current docs before guessing.** If the hypothesis points at a third-party library's behaviour (a framework method, an ORM call, an SDK), look up the library's *current* docs before instrumenting around assumed behaviour. Use `context7` (or any docs-MCP server available in the environment): `context7__resolve-library-id` → `context7__query-docs` for the specific symbol. Training-data API knowledge can be a version behind; the bug may be a known issue or already-fixed-upstream. Skip for refactoring own code, general programming concepts, or library behaviour you've already confirmed in this session.

**Perf branch.** For performance regressions, logs are usually wrong. Instead: establish a baseline measurement (timing harness, `performance.now()`, profiler, query plan), then bisect. Measure first, fix second.

## Phase 5 — Fix + regression test

**Minimal comments.** Default to no comments in the fix or the regression test. Add one only when the *why* is non-obvious — a workaround for a specific upstream bug (with a link), a subtle invariant the code relies on, a domain rule that isn't visible from the names. Never write block headers, never restate *what* the next line does, never leave `// TODO` without an issue link. One short line max — no multi-line comment blocks. Names carry the *what*; comments earn their place only when they carry *why*.

Write the regression test **before the fix** — but only if there is a **correct seam** for it.

A correct seam is one where the test exercises the **real bug pattern** as it occurs at the call site. If the only available seam is too shallow (single-caller test when the bug needs multiple callers, unit test that can't replicate the chain that triggered the bug), a regression test there gives false confidence.

**If no correct seam exists, that itself is the finding.** Note it. The codebase architecture is preventing the bug from being locked down. Flag this for the next phase.

If a correct seam exists:

1. Turn the minimised repro into a failing test at that seam.
2. Watch it fail.
3. Apply the fix.
4. Watch it pass.
5. Re-run the Phase 1 feedback loop against the original (un-minimised) scenario.

## Phase 6 — Cleanup + post-mortem

Required before declaring done:

- [ ] Original repro no longer reproduces (re-run the Phase 1 loop)
- [ ] Regression test passes (or absence of seam is documented)
- [ ] All `[DEBUG-...]` instrumentation removed (`grep` the prefix)
- [ ] Throwaway prototypes deleted (or moved to a clearly-marked debug location)
- [ ] The hypothesis that turned out correct is stated in the commit / PR message — so the next debugger learns

**Then ask: what would have prevented this bug?** If the answer involves architectural change (no good test seam, tangled callers, hidden coupling), surface it as a follow-up recommendation with specifics. Make the recommendation **after** the fix is in, not before — you have more information now than when you started.

## Anti-patterns

- Jumping to a fix before building a feedback loop — you're guessing, not diagnosing.
- A single hypothesis becomes "the cause" without falsification — anchoring.
- Running the hypothesis council for a one-line typo bug. Ceremony for its own sake. Inline 1–2 hypotheses is fine when the cause is staring at you.
- Spawning defender sub-agents serially instead of in parallel — one message, N agents.
- A defender that returns "could not find supporting evidence" gets ranked anyway. If the code doesn't back the hypothesis, drop it.
- "Added some logs" without tagging them — they survive into production.
- Marking the bug fixed because the symptom went away once — without re-running the loop or adding a regression test, you don't know.
- Treating a flaky test as flaky-by-nature and retrying — flakes are bugs with a low reproduction rate; raise the rate.
- Skipping the post-mortem question — same class of bug returns.

## Notes

- Adapted from Matt Pocock's `diagnose` skill — same six-phase discipline (reproduce → minimise → hypothesise → instrument → fix → regression-test), with the architectural-handoff step generalised since this library doesn't ship a paired `improve-codebase-architecture` skill.

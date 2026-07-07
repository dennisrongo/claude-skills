---
name: pr-review
description: Conduct a thorough, structured code review of a local branch, grouped by task number (#NNN) referenced in commit messages. On non-trivial tasks, convenes a **per-task lens council** — parallel `Explore` sub-agents reviewing through distinct lenses (correctness / design / security / tests) — then an adversarial critique round that challenges each lens's blocking flags against context from the others, demoting false positives and surfacing contradictions for the user. Small tasks skip the council. Use this skill whenever the user asks to review a PR, asks for feedback on a diff or branch, mentions "review my changes", or pastes code asking what could be improved. Auto-detects all tasks on the branch and produces one verdict per task. Covers correctness, design, tests, security, performance, and readability in that priority order.
---

# Pull Request Review

A structured approach to reviewing local branch work that catches real issues without nitpicking style. Reviews are scoped per task (e.g. `#123`) so each unit of work gets its own verdict.

## Assumptions

- Work happens on a feature branch off `develop` (git-flow style). If a repo uses a different base, substitute accordingly.
- The branch carries one or more `#NNN` task references in its commit messages — typically one task per branch, occasionally several when work is naturally bundled.
- The review runs against the currently checked-out branch.

## Priority order

Review in this order — earlier categories matter more, and finding issues there often makes later ones moot:

1. **Correctness** — does it do what it claims?
2. **Design** — is the approach sound? Will it cause problems later?
3. **Tests** — are behaviors covered? Are tests meaningful or just for coverage?
4. **Security** — any new attack surface? Input validation? Secrets?
5. **Performance** — obvious inefficiencies? Will it scale?
6. **Readability** — naming, structure, comments where non-obvious.
7. **Style** — only mention if the project lacks a formatter/linter.

## Workflow

1. **Refresh the base branch ref.** Run `git fetch origin develop` so the diff baseline is current. Do **not** `git pull` or check out `develop` — fetching updates `origin/develop` without touching the working tree or the local `develop` branch. If there's no `origin` remote, fall back to local `develop` and note it in the output.
2. **List commits on the branch.** Run `git log origin/develop..HEAD --format="%h %s"` (substitute the actual base branch if not `develop`). This is the universe of work to review.
3. **Group commits by task number.** Scan each subject and body for `#NNN` tokens (use `git log origin/develop..HEAD --format="%H%n%B%n---"` to see full messages). Bucket commits by task:
   - A commit referencing `#123` belongs to task `#123`.
   - A commit referencing multiple tasks belongs to each (review it once, note it in both verdicts).
   - A commit with no `#NNN` goes into an `unscoped` bucket — still review it, but flag the missing task reference.
4. **For each task, read its intent first.** What is `#123` trying to accomplish? Infer from the commit subjects/bodies in that bucket. If intent is unclear, ask the user before reviewing — "is the code correct" is unanswerable without it.
5. **Get the per-task diff.** For each task, view its commits with `git show <sha>` per commit, or `git diff <first>^..<last>` if the commits are contiguous. Don't merge tasks into one combined diff — keep them scoped.
6. **Skim each task once, top to bottom.** Get a mental model of what changed before commenting on specifics.
7. **Per-task decision: single-pass vs. lens council** (see [Lens council](#lens-council-for-non-trivial-tasks)):
   - **Single-pass (inline)** when the task is small and tightly scoped — roughly: < 100 lines of task-scoped diff, < 5 files, no security-sensitive paths. Walk the priority list yourself.
   - **Lens council** otherwise. Spawn parallel `Explore` sub-agents per lens, then run a critique round before the per-task verdict.
8. **Look at the tests in each task.** Do they test the new behavior or just exercise the new lines? (The lens council's Tests agent handles this when convened.)
9. **Check what's *not* in each task's diff.** Missing error handling, missing tests for edge cases, missing migration for a schema change.

## How to phrase feedback

Categorize each comment so the author knows what's required vs optional:

- **`blocking`** — must fix before merge (bug, security issue, broken contract)
- **`suggestion`** — would improve the code, author can take or leave
- **`question`** — author may know something you don't; ask before asserting
- **`nit`** — minor style/preference; should not block merge
- **`praise`** — something done well, worth calling out

Lead with the *why*, not just the *what*. "This will deadlock if two callers hit it simultaneously" is more useful than "use a lock here".

Same finding, badly and well:

- ❌ `blocking: add error handling to fetchUser (api/user.ts:42)` — no failure scenario, no consequence; unverifiable reflex.
- ✅ `blocking: fetchUser (api/user.ts:42) rejects on 404 but ProfilePage (pages/profile.tsx:18) never catches — a deleted user's profile renders blank with an unhandled rejection. Fix: catch and render not-found.`

## Evidence rules

A claim about code you haven't opened this session is a hypothesis — verify it or label it as one.

- **Read beyond the hunk.** Before flagging anything, `Read` the full enclosing function (the whole file when small). Most false "missing null check" / "unhandled error" findings dissolve when you see the guard 10 lines above the hunk or the caller that validates. A finding based only on diff-hunk context is not reportable.
- **`blocking` carries a burden of proof:** one concrete failure-scenario sentence (*this input/state → this wrong outcome*). Can't write it? Demote to `suggestion`, or raise it as a `question`.
- **Grep before claiming absence.** "Dead code" / "unused" / "never called" / "duplicated elsewhere" require a repo-wide `Grep` for the identifier first — cite the search in the finding.
- **Quote verbatim.** Error messages, test output, and load-bearing identifiers go into findings exactly as they appear; paraphrase loses the token that matters.
- **Zero findings is a valid verdict.** A task with nothing wrong gets a clean *Approve* — never pad Blockers or Suggestions to look thorough. Thoroughness is what you checked, not what you wrote.
- **User framing is input, not conclusion.** "The backend part is fine, just look at the UI" does not exempt the backend — review every task fully.

## Scope discipline

A finding must belong to the task (`#NNN`) whose diff introduced it. Pre-existing code that's merely *visible* in the diff context is out of scope — unless the task made it worse (e.g. added a second caller to an already-unsafe function; that's in scope). If you notice a pre-existing issue worth mentioning, note it in one line outside the verdict ("pre-existing, not introduced by #123") — never block a task for code its commits didn't touch.

## What to look for

### Correctness
- Off-by-one errors in loops and slicing
- Null/undefined handling at boundaries
- Concurrent access without synchronization
- Error paths that swallow exceptions silently
- Default values that change behavior unexpectedly

### Design
- New abstractions that don't pay for themselves
- Tight coupling that will be painful to undo
- Duplication that should be unified (or unification that should be duplication)
- Public API changes that aren't backwards-compatible
- State that should live elsewhere

### Tests
- Tests that pass even when the code is broken (assertion-free, mocked too aggressively)
- Missing edge cases: empty inputs, max sizes, unicode, timezones
- Tests that are flaky by design (timing, ordering, network)

### Security
- User input flowing into shell, SQL, or HTML without escaping
- Secrets in code, logs, or error messages
- Authn/authz checks missing on new endpoints
- Crypto: hand-rolled, weak algorithms, hardcoded keys/IVs

### Performance
- N+1 queries in loops
- Unbounded memory growth (caches without eviction, accumulating arrays)
- Synchronous I/O in hot paths
- Repeated work that could be hoisted out of a loop

## Lens council (for non-trivial tasks)

A single chain of reasoning across all priority categories anchors on whatever was seen first. For non-trivial tasks, run the lenses **in parallel** per task, then critique before the verdict.

### When to convene the council (per task)

- The task's diff is ≥ ~100 lines, **or** touches ≥ 5 files, **or** edits security-sensitive paths (auth, crypto, input validation, SQL/shell/HTML sinks, file paths from user input).
- Or first-skim turned up contradictions you can't resolve from memory.

Otherwise stay single-pass for that task. Some branches have one trivial task and one huge one — convene only for the huge one.

### Lenses

Spawn one sub-agent per lens for the task being reviewed. Default set:

| Lens | Looks for |
|---|---|
| **Correctness** | Off-by-one, null/undefined at boundaries, concurrent-access bugs, swallowed exceptions, default-value behaviour shifts |
| **Design** | New abstractions that don't earn their keep, tight coupling, duplication that should unify, public-API breakage, state in the wrong place |
| **Security** | Untrusted input into sinks, secrets in code/logs/errors, missing authn/authz on new endpoints, weak/hand-rolled crypto |
| **Tests** | Assertion-free / over-mocked tests, missing edge cases, flaky-by-design tests, new behaviour in the diff with **no** new test |

Performance + Readability usually fold into Design — only spawn a dedicated lens for them if the task is genuinely perf-sensitive or the project has no linter.

### How to run it (per task)

1. **Spawn in parallel.** Send a **single message** with N `Agent` calls (`subagent_type=Explore`), one per lens. Each gets:
   - The per-task diff (commits from this `#NNN` only — not the whole branch).
   - The inferred task intent from step 4.
   - **One** lens with its checklist verbatim from [What to look for](#what-to-look-for).
   - Instructions: "Find issues only in your lens. Read the full enclosing function before flagging — hunk-only findings are not reportable. Only flag code this task's commits introduced or worsened; pre-existing issues are out of scope. Categorize each as `blocking` / `suggestion` / `question` / `nit`; a `blocking` must state a one-sentence concrete failure scenario. Cite `file:line` for every finding. Lead each with the *why*. If no findings, say 'no findings' explicitly — do not pad. Report in ≤500 words."
2. **Critique round.** Read all lenses side by side, then:
   - **Challenge every `blocking`** against context from the other lenses. Demote to `suggestion` or drop if it's defused by another lens's evidence.
   - **Surface contradictions** as `question` items the user adjudicates (e.g. Correctness flags missing null guard; Security found the caller validates).
   - **Merge near-duplicates** across lenses.
   - **Promote** any finding multiple lenses raised independently — that's a real signal.
3. **Verdict.** With the surviving findings, decide: Approve / Approve with suggestions / Request changes / Comment.

Each task gets its own council pass. Tasks remain independent — the council scope **never** crosses task boundaries.

## Output format

Produce one section per task, with comments grouped by file and line inside each. Each task gets its own verdict — tasks are independent units of work and should be approvable or blockable on their own.

```
## #123 — <inferred or stated task intent>

Commits:
- <sha> <subject>
- <sha> <subject>

Verdict: Approve with suggestions / Request changes / Comment

Strengths:
- ...

Blockers:
- ...

Suggestions:
- ...

---

## #124 — ...

(same structure)

---

## unscoped — commits without a #NNN reference

(same structure; also flag the missing task reference as a blocker or nit depending on project convention)
```

End with a one-line roll-up: e.g. `Overall: 2 approve, 1 request changes, 1 unscoped`.

## Anti-patterns

- ❌ Reviewing without understanding the goal of the change
- ❌ Reflexively requesting tests without saying what they should cover
- ❌ Drive-by style nits that derail the substantive discussion
- ❌ "I would have done it differently" without a concrete reason
- ❌ Flagging from the diff hunk alone — read the enclosing function first; the guard is often just outside the hunk
- ❌ Blocking a task for a pre-existing issue its diff didn't introduce or worsen — note it in one line, out of verdict
- ❌ A `blocking` with no concrete failure scenario — if you can't write "this input → this wrong outcome", it isn't blocking
- ❌ Padding a clean task with speculative findings — zero findings is a valid Approve
- ❌ Collapsing multiple tasks into one verdict — each `#NNN` is independent and should stand or fall on its own
- ❌ Silently ignoring commits with no task reference — surface them in the `unscoped` bucket
- ❌ Convening the lens council on a 20-line task. Single-pass it.
- ❌ Spawning lens agents serially instead of in parallel — one message, N agents, per task.
- ❌ Letting the council span tasks. Each `#NNN` is its own review — sub-agents see only that task's diff.
- ❌ Publishing the raw union of lens findings without the critique round. False-positive blockers erode trust.
- ❌ Dumping per-agent transcripts into the user's report. The council is internal deliberation — the user sees the synthesized per-task verdict.

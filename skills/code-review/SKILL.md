---
name: code-review
description: >-
    Production-readiness code review at either scope — the uncommitted working tree (default) or a committed branch grouped per `#NNN` task (references/branch-review.md). Hunts DRY violations, dead code, leaky abstractions, missing error handling; auto-detects and runs the project's tests and build; findings categorized `blocking`/`suggestion`/`question`/`nit`/`praise`, and never edits code without permission — report first, ask, then fix. Non-trivial diffs get a lens council: parallel Explore sub-agents (correctness/design/security/tests/production-readiness) plus an adversarial critique round; small diffs skip it. Use this skill whenever the user says "code review", "review my code", "review the diff", "review my PR", "review my branch", "check my uncommitted changes", "is this production ready", "DRY check", or "/code-review" — even if they don't explicitly say "code review skill". Dirty tree → working-tree scope; "branch"/"PR" or clean tree with branch commits → branch scope.
---

# Code Review

Review code changes against DRY and common software-engineering best practices, verify the project still builds and its tests still pass, and surface findings as recommendations the user can act on — **without editing code unprompted**.

## When to use this skill

- "code review" / "review my code" / "review the diff"
- "review my PR" / "review my branch" / "review my changes"
- "check my uncommitted changes" / "is this production ready" / "ready to ship"
- "DRY check" / "clean up duplication"
- `/code-review`

## Scope: working tree or branch

- **Working tree (the default):** uncommitted staged + unstaged changes. The workflow below reads in this scope.
- **Branch:** the user says "review my PR / branch", or the working tree is clean and the branch has commits ahead of its base. Same evidence rules, categories, council, and recommend-don't-refactor discipline — but commits are grouped per `#NNN` task with one verdict each, per [references/branch-review.md](references/branch-review.md).

Never blend scopes into one report. Both apply (dirty tree *and* branch commits, user said "review everything") → ask which, or run them as two clearly separated reports.

## Hard rule: recommend, don't refactor

If you find issues, **do not start editing**. Produce the findings report first. After delivering it, ask the user, per issue or per batch: *"Want me to fix #N?"* — and wait for an explicit yes before touching code. If the user pre-authorizes the whole batch ("fix them all"), proceed; otherwise default to ask-per-fix.

This rule overrides any general "be helpful, fix it" instinct. A drive-by refactor mid-review collapses the user's mental model of what changed.

## Evidence rules

A claim about code you haven't opened this session is a hypothesis — verify it or label it as one.

- **Read beyond the hunk.** Before flagging anything, `Read` the full enclosing function — and the whole file when it's small. Most false "missing null check" / "unhandled error" findings dissolve when you see the guard 10 lines above the hunk, or the caller that validates. A finding based only on diff-hunk context is not reportable.
- **Grep before claiming absence.** "Dead code", "unused", "never called", "duplicated elsewhere" each require a repo-wide `Grep` for the identifier first. Cite the search in the finding: *"no callers found (`grep -rn 'buildQuery' src/`)"*.
- **Quote, don't paraphrase.** Failing test output, error messages, and load-bearing identifiers go into findings verbatim (trimmed). A paraphrased error message loses the exact token that matters.
- **Zero findings is a valid outcome.** Never invent findings to appear thorough — thoroughness is measured by what you checked, and the report already lists that (build, tests, lenses run). An empty Blockers section with a green build is a good report.
- **User framing is input, not conclusion.** "The auth part is fine, just check the parser" does not exempt the auth part. Weight attention toward the ask, but never skip a category on the user's say-so.

## Workflow

1. **Snapshot the diff.** Run in parallel:
   - `git status --short` — see what's modified, staged, untracked.
   - `git diff` — unstaged changes.
   - `git diff --staged` — staged changes.
   - `git diff <base>...HEAD` belongs to branch scope — see [references/branch-review.md](references/branch-review.md).
2. **Understand intent.** Read the diff top-to-bottom once. If the *why* isn't obvious from context, ask the user one focused question before reviewing — "is this correct" is unanswerable without intent.
3. **Detect test + build commands.** Inspect repo manifests in parallel and infer commands:
   - `package.json` → `npm test`, `npm run build` (or `pnpm` / `yarn` if the lockfile says so)
   - `pyproject.toml` / `pytest.ini` → `pytest`, plus `python -m build` or project-specific
   - `*.csproj` / `*.sln` → `dotnet build`, `dotnet test`
   - `go.mod` → `go build ./...`, `go test ./...`
   - `Cargo.toml` → `cargo build`, `cargo test`
   - `Makefile` → check for `test` / `build` targets first
   - Monorepo (`turbo.json`, `nx.json`, `pnpm-workspace.yaml`) → use the orchestrator
4. **Run tests, then build.** Tests first (faster signal). If tests pass, run the build. Capture output. If a command doesn't exist or fails to start, note it and continue — don't fabricate a green result. A result you didn't observe is **not run** (report ⚠️ not detected), never "passed".
5. **Review.** Decide single-pass vs. lens council (see [Lens council](#lens-council-for-non-trivial-diffs)):
   - **Single-pass (inline)** when the diff is small and tightly scoped — roughly: < 100 lines changed, < 5 files, no security-sensitive paths (auth, crypto, input validation, file/SQL/shell sinks). Walk the priority list yourself; faster on trivial changes.
   - **Lens council** otherwise. Spawn parallel `Explore` sub-agents — one per lens — then run an adversarial critique round before reporting.
   Earlier categories outrank later ones — a correctness bug makes a readability nit irrelevant.
6. **Map findings to the diff.** Every finding cites `file:line` so the user can jump to it.
7. **Categorize each finding** as `blocking` / `suggestion` / `nit` / `praise` (see [Categories](#categories)).
8. **Produce the report** in the [Output format](#output-format).
9. **Offer to fix.** After the report, list the fix-able findings by number and ask which to apply. Wait for confirmation. Then fix only the approved ones, one commit-worthy change at a time, and re-run tests after. When applying fixes, follow the [Code rules when applying fixes](#code-rules-when-applying-fixes) below.

## Code rules when applying fixes

These rules govern the fix-application phase only — they don't change the report itself.

- **Minimal comments.** Default to no comments. Only add one when the *why* is non-obvious (a workaround, a non-trivial invariant, a domain rule that isn't visible from the names). Never write block headers, never restate *what* the next line does, never leave `// TODO` without an issue link. One short line max — no multi-line comment blocks, no multi-paragraph docstrings. If the fix needs a comment to be understandable, the fix probably needs better names instead.
- **No drive-by edits.** Touch only what the approved finding requires. If you spot something else worth fixing, surface it as a *new* finding in a follow-up report — don't bundle it in.
- **Match the project's formatting.** Don't reformat unrelated code in the diff.
- **No `// removed`, `// was: X` trails.** If you deleted something, delete it. Git history is the audit log.

## Categories

- **`blocking`** — must fix before ship: bug, broken contract, security hole, build/test failure, missing migration, hard-coded secret. **Burden of proof:** a `blocking` finding must include a one-sentence concrete failure scenario (*this input/state → this wrong outcome*). If you cannot write that sentence, demote to `suggestion`.
- **`suggestion`** — would improve the code; user can take or leave. DRY consolidations, dead-code removal, missing error handling on non-critical paths.
- **`question`** — the author may know something you don't; ask before asserting. Also the landing spot for lens-council contradictions the user should adjudicate.
- **`nit`** — style/preference; never blocks.
- **`praise`** — something done well, cited to a specific `file:line` (*"the retry wrapper at `http.ts:40` is exactly right for this flaky API"*). Generic filler ("nice clean code!") is worse than omitting the section. Include one only when it's genuine.

Lead each finding with the *why*. "This swallows the exception so a failure here is silently lost" beats "add error handling".

Same finding, written badly and well:

- ❌ **B1. Add error handling to `fetchUser`** — `api/user.ts:42`. *(No failure scenario, no consequence, one citation — reads as a reflex; the reviewer can't verify it or weigh it.)*
- ✅ **B1. Unhandled rejection on deleted user** — `api/user.ts:42`. **Why:** `fetchUser` rejects on 404, but `ProfilePage` (`pages/profile.tsx:18`) never catches — visiting a deleted user's profile renders a blank page with an unhandled rejection. **Fix:** catch in `ProfilePage` and render the not-found state.

The ✅ names the trigger, the concrete consequence, and both `file:line` sites — verifiable without re-deriving it.

## What to look for

Priority order — review top-to-bottom, stop wasting tokens on lower categories once a higher one is on fire.

### 1. Correctness
- Off-by-one in loops and slicing
- Null / undefined / empty-collection handling at boundaries
- Concurrent access without synchronization; race conditions in async code
- Error paths that swallow exceptions or log-and-continue when they shouldn't
- Default values that silently change behavior
- Floating-point comparisons with `==`
- Timezone / DST / locale assumptions

### 2. DRY and design
This is the user-emphasized lens — apply it explicitly.
- **Duplication that should be unified** — same logic in 2+ places, copy-pasted blocks, parallel switch/if-else ladders, the same regex written twice.
- **Premature abstraction** (the inverse trap) — a "shared helper" with one caller, configurable in ways nobody uses. **YAGNI** wins; three similar lines beats a wrong abstraction.
- **Single Responsibility** — functions doing two unrelated things, classes mixing concerns.
- **Leaky abstractions** — implementation details bleeding through an interface (e.g. ORM types in a domain API).
- **Tight coupling** that will be painful to undo; circular dependencies.
- **State that should live elsewhere** — module-level mutable state, globals smuggled in via singletons.
- **Public API changes** that aren't backwards-compatible without a migration note.
- **Magic numbers / magic strings** — name them.
- **Composition over inheritance** where inheritance is being used as code-reuse, not for "is-a".

### 3. Tests
- Tests that pass even when the code is broken (assertion-free, over-mocked, snapshot-only).
- Missing edge cases: empty inputs, max sizes, unicode, negative numbers, timezones, concurrent calls.
- Flaky-by-design tests (`sleep`, ordering assumptions, network).
- New behavior in the diff with **no new test** — call it out.
- Test names that describe *what runs* instead of *what's verified*.

### 4. Security
- User input flowing into shell, SQL, HTML, file paths, or `eval` without escaping/parameterization.
- Secrets in code, logs, error messages, or commit-able files.
- Authn / authz checks missing on new endpoints or new entry points.
- Crypto: hand-rolled, weak algos (`md5`, `sha1` for security use), hardcoded keys/IVs.
- `console.log` / `print` / `Debug.WriteLine` of PII or tokens.
- Unsafe deserialization of untrusted input.

### 5. Performance
- N+1 queries inside loops.
- Unbounded memory growth — caches without eviction, accumulating arrays, recursive growth.
- Synchronous I/O / blocking calls in hot paths or async contexts.
- Repeated work that could be hoisted out of a loop.
- O(n²) where O(n) is easy.

### 6. Production-readiness (working-tree-specific lens)
- **Debug residue** — `console.log`, `print`, `TODO: remove`, `// debug`, commented-out blocks, scratch files.
- **Logging** — new code path with no log line at all, *or* spammy logs in a hot path.
- **Observability** — new failure mode with no metric / no trace.
- **Config** — new env var without a default and without docs / `.env.example`.
- **Migrations** — schema change with no migration, or a migration without a rollback story.
- **Error messages** — user-facing errors leaking stack traces, internal paths, or DB error strings.
- **Feature flags** — new behavior shipped unflagged when the project uses flags.
- **Backward compatibility** — breaking a wire format, DB column, or public API without a deprecation path.

### 7. Readability
- Naming: variables that say *what* (`data`, `result`) instead of *what for*.
- Function length / nesting depth — extract when it stops fitting in your head.
- Comments: only when *why* is non-obvious; not narration of *what*.
- Dead code, unused imports, unused exports.

### 8. Style
Only mention if the project has no formatter / linter. Otherwise trust the tools.

## Lens council (for non-trivial diffs)

A single pass through the priority list anchors on whatever you saw first. For non-trivial diffs, run the lenses **in parallel** and then have them critique each other before publishing findings.

### When to convene the council

- Diff is ≥ ~100 lines changed, **or** touches ≥ 5 files, **or** edits security-sensitive paths (auth, crypto, input validation, SQL/shell/HTML sinks, file paths from user input).
- Or you've already spotted contradictions on first read ("this looks broken / no it's fine because…") — the council resolves them deterministically.

Otherwise stay single-pass. The council is overhead on a 20-line change.

### Lenses

Spawn one sub-agent per lens. Default set (skip lenses that don't apply — e.g. no schema changes → no migration sub-lens within prod-readiness):

| Lens | Looks for | Aligns with |
|---|---|---|
| **Correctness** | Off-by-one, null/undefined, race conditions, swallowed errors, default-value behaviour shifts, tz/locale assumptions | §1 |
| **Design / DRY** | Duplication that should unify, premature abstraction, single-responsibility violations, leaky abstractions, tight coupling, magic values, public-API breakage | §2 |
| **Security** | Untrusted input into sinks (shell/SQL/HTML/path/`eval`), secrets in code or logs, missing authn/authz, weak crypto, unsafe deserialization | §4 |
| **Tests** | Assertion-free / over-mocked / snapshot-only tests, missing edge cases, flaky-by-design tests, new behaviour with **no** test, test names that don't describe verification | §3 |
| **Production-readiness** | Debug residue, missing/spammy logging, no observability on new failure modes, undocumented env vars, schema change without migration, error messages leaking internals, missing feature flag, wire/DB breakage without deprecation | §6 |

Performance (§5), readability (§7), and style (§8) usually roll into Design — only spawn a dedicated lens for them if the diff is genuinely perf-sensitive or the project has no linter.

### How to run it

1. **Spawn in parallel.** Send a **single message** with N `Agent` calls (`subagent_type=Explore`). Each lens gets:
   - The full diff (or the slice relevant to its files when the diff is huge).
   - **One** lens with its checklist verbatim from [What to look for](#what-to-look-for).
   - Instructions: "Find issues **only in your lens.** Read the full enclosing function before flagging — hunk-only findings are not reportable. Categorize each as `blocking` / `suggestion` / `nit`; a `blocking` must state a one-sentence concrete failure scenario. Cite `file:line` for every finding. Lead each finding with the *why*. If your lens has no findings, say 'no findings' explicitly — do not pad. Report in ≤500 words."
2. **Collect findings.** Each agent returns its list. Don't publish yet.
3. **Critique round.** Read all lenses side by side, then do an adversarial pass before the report:
   - **Challenge every `blocking`** — "is this actually exploitable / actually a bug / would this actually break in production?" Demote to `suggestion` or drop if the answer is no when you read the surrounding code.
   - **Surface contradictions.** Correctness flags a missing null check, but Security found the caller validates upstream → call it out as a *question* for the user, not a flag, and link both citations.
   - **Merge near-duplicates** across lenses (e.g. Design and Tests both noticed the new branch has no coverage — merge into one finding).
   - **Promote** anything multiple lenses independently flagged. That's a real signal.
4. **Publish.** Synthesize into the [Output format](#output-format). Add a footer: `Lenses run: <list>. <N> findings raised by sub-agents, <M> dropped on critique.`

The user sees one clean report, not five agent transcripts. The transcripts stay internal — they were the deliberation.

## Output format

```
# Code review — uncommitted changes

**Files changed:** <N> (<S staged>, <U unstaged>, <X untracked>)

**Build:** ✅ passed / ❌ failed / ⚠️ not detected
**Tests:** ✅ passed (<N>/<N>) / ❌ failed (<F> failing) / ⚠️ not detected
<paste relevant failing output, trimmed>

---

## Verdict
**Ship / Fix blockers first / Build broken**

<one-paragraph summary of the change and overall state>

---

## Blockers

### B1. <short title> — `path/to/file.ext:42`
**Why:** <root cause / consequence>
**Fix:** <concrete recommendation>

### B2. ...

## Suggestions

### S1. <short title> — `path/to/file.ext:88`
**Why:** ...
**Fix:** ...

## Nits
- `path:line` — <one-liner>

## Praise
- <thing done well>

---

## Fixes I can apply

If you want, I can apply any of: B1, B2, S1, S3. Which? (or "all", or "none")
```

End with the offer. Wait for the user's choice. Apply only the approved set, then re-run tests.

## Examples

### Example 1: Working-tree review with a build failure

**User:** "do a code review on what I have so far"

**Claude:**
- Runs `git status` + `git diff` + `git diff --staged` in parallel.
- Detects `package.json` → runs `npm test` and `npm run build`.
- Build fails on a missing import → calls it out as `B1` with the file:line, doesn't try to fix it yet.
- Finds two copy-pasted validation blocks → `S1` (DRY consolidation) with a sketch of the extracted helper.
- Reports, then asks: "Want me to fix B1 and S1?"

### Example 2: Pre-existing tests, new feature with no coverage

**User:** "is this ready to ship?"

**Claude:** Reviews diff. Tests pass but the new branch in `processOrder()` has no test. Flags as `B2` (blocking — "new behavior with no test, regression risk on next refactor"). Does **not** write the test silently; offers to write it after the report.

### Example 3: User pre-authorizes fixes

**User:** "review the diff and fix anything you find"

**Claude:** Produces the full report first anyway, then applies fixes one at a time, re-running tests between batches. Pre-authorization doesn't skip the report — it only skips the per-fix confirmation.

## Anti-patterns

- ❌ Editing files during the review pass. Report first, **always**.
- ❌ Fixing without asking, even for "obvious" issues. Obviousness is not consent.
- ❌ Skipping the test/build run because "the diff looks fine".
- ❌ Reporting a green build without actually running it.
- ❌ Blending scopes — one report mixing working-tree findings with branch-commit findings. Pick the scope (or run two clearly separated reports); branch scope follows [references/branch-review.md](references/branch-review.md).
- ❌ DRY-ing prematurely — calling out three similar lines as duplication when the right call is to leave them. Note the pattern; flag only when the abstraction is clearly warranted.
- ❌ Padding the report with style nits when there are correctness blockers.
- ❌ Hand-wavy findings without `file:line`.
- ❌ Flagging from the diff hunk alone. Read the enclosing function first — the guard is often 10 lines above the hunk.
- ❌ Claiming "unused" / "dead" / "duplicated elsewhere" without a repo-wide grep for the identifier.
- ❌ A `blocking` with no concrete failure scenario. Can't write "this input → this wrong outcome"? It's a `suggestion`.
- ❌ Inventing findings on a clean diff to look thorough. Zero findings + green build is a valid, complete report.
- ❌ Convening the lens council on a 15-line diff. Single-pass it.
- ❌ Spawning the lens agents serially instead of in parallel — one message, N agents.
- ❌ Skipping the critique round and publishing the raw union of lens findings. False-positive blockers erode trust fast.
- ❌ Dumping the per-agent transcripts into the user's report. The council is internal deliberation — the user sees the synthesized report.
- ✅ Tests + build run, findings cited to lines, categorized, **report → ask → fix**.

## Notes

- If the working tree is clean, say so — and if the branch has commits ahead of its base, offer branch scope rather than silently pivoting to it.
- If tests take a long time, run them in the background and continue the static review while they run; reconcile the report once results land.
- This skill composes with [`conventional-commits`](../conventional-commits/SKILL.md): after fixes are approved and applied, hand the commit-message authoring to that skill rather than improvising one here.

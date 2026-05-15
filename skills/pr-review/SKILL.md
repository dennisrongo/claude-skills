---
name: pr-review
description: Conduct a thorough, structured code review of a local branch, grouped by task number (#NNN) referenced in commit messages. Use this skill whenever the user asks to review a PR, asks for feedback on a diff or branch, mentions "review my changes", or pastes code asking what could be improved. Auto-detects all tasks on the branch and produces one verdict per task. Covers correctness, design, tests, security, performance, and readability in that priority order.
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
7. **Re-read each task with the priority list in mind.** Note issues as you go.
8. **Look at the tests in each task.** Do they test the new behavior or just exercise the new lines?
9. **Check what's *not* in each task's diff.** Missing error handling, missing tests for edge cases, missing migration for a schema change.

## How to phrase feedback

Categorize each comment so the author knows what's required vs optional:

- **`blocking`** — must fix before merge (bug, security issue, broken contract)
- **`suggestion`** — would improve the code, author can take or leave
- **`question`** — author may know something you don't; ask before asserting
- **`nit`** — minor style/preference; should not block merge
- **`praise`** — something done well, worth calling out

Lead with the *why*, not just the *what*. "This will deadlock if two callers hit it simultaneously" is more useful than "use a lock here".

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
- ❌ Collapsing multiple tasks into one verdict — each `#NNN` is independent and should stand or fall on its own
- ❌ Silently ignoring commits with no task reference — surface them in the `unscoped` bucket

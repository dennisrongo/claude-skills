# Branch scope — committed work, grouped per `#NNN` task

How `code-review` runs when the scope is a committed branch instead of the working tree. Everything in the main SKILL.md still applies — evidence rules, categories, burden of proof, what-to-look-for checklists, the lens council mechanics, recommend-don't-refactor. This file covers only what changes: commit grouping, per-task scoping, and the per-task verdict format.

## Assumptions

- Work happens on a feature branch off `develop` (git-flow style). If the repo uses a different base (`main`, trunk), substitute it.
- The branch carries one or more `#NNN` task references in its commit messages — typically one task per branch, occasionally several.
- The review runs against the currently checked-out branch.

## Branch workflow

1. **Refresh the base branch ref.** `git fetch origin develop` so the diff baseline is current. Do **not** `git pull` or check out the base — fetching updates `origin/develop` without touching the working tree. No `origin` remote → fall back to local `develop` and note it in the output.
2. **List commits on the branch.** `git log origin/develop..HEAD --format="%h %s"` — this is the universe of work to review.
3. **Group commits by task number.** Scan subjects and bodies for `#NNN` tokens (`git log origin/develop..HEAD --format="%H%n%B%n---"`):
   - A commit referencing `#123` belongs to task `#123`.
   - A commit referencing multiple tasks belongs to each (review once, note in both verdicts).
   - A commit with no `#NNN` goes into an `unscoped` bucket — still reviewed, missing reference flagged.
4. **Read each task's intent first.** Infer from that bucket's commit subjects/bodies what `#123` is trying to accomplish. Unclear intent → ask before reviewing; "is the code correct" is unanswerable without it.
5. **Get the per-task diff.** `git show <sha>` per commit, or `git diff <first>^..<last>` when contiguous. Never merge tasks into one combined diff.
6. **Review each task** per the main SKILL.md: skim once top-to-bottom, then single-pass vs. lens council **per task** (same thresholds: ≥ ~100 lines, ≥ 5 files, or security-sensitive paths). Council sub-agents see only that task's diff plus its inferred intent — the council never crosses task boundaries. Some branches have one trivial task and one huge one; convene only for the huge one.
7. **Check what's *not* in each task's diff** — missing error handling, missing tests for the new behavior, missing migration for a schema change.

## Scope discipline (the branch-specific evidence rule)

A finding must belong to the task (`#NNN`) whose diff introduced it. Pre-existing code that's merely *visible* in diff context is out of scope — unless the task made it worse (e.g. added a second caller to an already-unsafe function; in scope). A pre-existing issue worth mentioning gets one line outside the verdict ("pre-existing, not introduced by #123") — never block a task for code its commits didn't touch.

## Output format

One section per task; each task gets its own verdict — tasks are independent units that should be approvable or blockable on their own.

```
## #123 — <inferred or stated task intent>

Commits:
- <sha> <subject>

Verdict: Approve / Approve with suggestions / Request changes / Comment

Strengths:
- ...

Blockers:
- ...

Suggestions:
- ...

---

## unscoped — commits without a #NNN reference

(same structure; flag the missing task reference as a blocker or nit per project convention)
```

End with a one-line roll-up: `Overall: 2 approve, 1 request changes, 1 unscoped`.

## Branch-specific anti-patterns

- ❌ Collapsing multiple tasks into one verdict — each `#NNN` stands or falls on its own.
- ❌ Blocking a task for a pre-existing issue its diff didn't introduce or worsen.
- ❌ Silently ignoring commits with no task reference — surface the `unscoped` bucket.
- ❌ Letting the lens council span tasks — sub-agents see only one task's diff.
- ❌ Reviewing the branch's combined diff when the commits split cleanly into tasks — per-task scoping is the point of this mode.

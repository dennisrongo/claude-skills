---
name: create-pr
description: End-to-end pull-request flow with a review gate before publishing - pushes only with approval, one PR per repo with house defaults from config, sibling PRs cross-referenced with deploy order, and every setting re-verified after creation. Detects the provider from the git remote. Use this skill whenever the user says "create a PR", "open a pull request", "publish the branch and create a PR", "PR this", "ship this branch", "create the PRs for this task", or "raise a PR" - even if they do not name the skill. For reviewing an existing branch or PR rather than creating one, use `code-review` in branch scope.
---

# Create PR

The full flow from "the branch is ready" to "verified PRs exist" — with the review gate where it belongs: **before** anyone else sees the code.

## When to use this skill

- "create a PR" / "open a pull request" / "raise a PR"
- "publish the branch and create a PR" / "ship this branch"
- "create the PRs for this task" (multi-repo)

Do **not** use for reviewing an existing PR (use `code-review` in branch scope) or for local-only git work.

## Workflow

### 0. Anchor

State in one line: work item/ticket id, branch name, and every repo the change touches. The id comes from the branch name or the commit subjects you read this session (`git log --oneline <target>..HEAD`) — never from memory of the conversation, and never a number mentioned earlier for different work. If neither carries one, ask — it drives the PR title, the work-item link, and the sibling grouping; an invented id links the PR to someone else's ticket. Multi-repo detection: a change described as one task with commits carrying the same `#<id>` across repos is ONE work item → one PR **per repo**, never one PR spanning repos and never several PRs in one repo for the same id. Enumerate candidate repos from what the session names (workspace CLAUDE.md, repos you committed to in this session, or the user's list) and check each with `git -C <repo> log --branches --not <target> --oneline --grep "#<id>"` — this finds unmerged commits carrying the id even when that repo is not checked out on the feature branch. If you cannot enumerate the workspace's repos, ask the user for the list — never silently assume single-repo for a task described as spanning repos.

### 1. Preflight

- Working tree clean? Uncommitted changes are either committed (per the project's subject convention) or explicitly left out — ask, don't guess.
- Commit subjects on the branch follow the configured pattern (e.g. `#<id> (<SCOPE>) <description>`). Fix outliers only with user approval (rewriting pushed history needs explicit consent).

### 2. Review gate — before publishing, not after

- Run the `code-review` skill in branch scope on the branch if installed (grouped by task id); otherwise run `git diff <target>...HEAD` against the **configured target** — a diff against the wrong base reviews commits that aren't yours or misses ones that are — read every hunk, and report findings in the ✅ format below — `N blocking, M suggestions`, each finding with file:line and a concrete failure scenario.
- If SQL files changed, run `sql-review` if installed; if it is not installed, include those SQL files in this same diff review and say so in the gate report.
- If the branch renames a symbol, changes a default or signature, or touches shared state (schema, config, flags, events), also run [`regression-hunt`](../regression-hunt/SKILL.md); a confirmed regression is a blocking finding.
- **Green on the exact tree you publish.** The review gate runs the suite; if anything changes after it - a blocker fix, a squash, a rebase - re-run and quote the summary line before pushing. A green run on an earlier tree proves nothing about this one.
- **Confirm the base.** The configured target branch is the default, but verify it is what this branch actually forked from (`git merge-base`, the branch's upstream, or the work item). Mismatch means ask which target is correct rather than guessing.
- **Blocking findings stop the flow** — but "blocker" carries a burden of proof: name the concrete failure scenario in one sentence ("user does X → wrong Y"). No scenario → it's a suggestion, and suggestions don't stop the flow. Each real blocker is either fixed, or explicitly waived by the user — a waiver is recorded in the PR description ("Known issue: X — accepted because Y"). Zero findings is a valid outcome; proceed.
- ❌ "Reviewed — looks good" with no findings listed and no diff quoted → that's recognition, not review.
- ✅ "code-review (branch scope): 0 blocking, 2 suggestions (deferred, listed in PR body). Proceeding."

### 3. Publish

`git push -u origin <branch>` per repo — **only with user approval; never push unasked.** One approval can cover all repos of the same work item if the user says so. A rejected push means the remote moved - fetch and investigate; **never force-push** to recover.

### 4. Create — provider detected from the remote URL

Detect from `git remote get-url origin` output you ran this session — the remote decides, not the tooling installed (`gh` being on PATH doesn't make this a GitHub repo).

- **GitHub** (`github.com`): follow the [`github`](../github/SKILL.md) skill — house defaults from `.claude/github.json` (target branch, title pattern, reviewers, auto-merge, issue link via closing keyword).
- **Any other host** (GitLab, Bitbucket, Azure DevOps, on-prem servers): if an organisation provider skill for that host is installed (check the session's skill list), use it for the create and verify mechanics — the review gate, publish approval and post-creation verification in this skill still apply unchanged. With no such skill, STOP and ask the user which provider tooling to use. Do not guess a CLI or improvise raw API calls past this gate.
- PR description template — intent, not a diff restatement. Copy-paste and fill the `<placeholders>`:

```markdown
## What & why
<one paragraph — the user-visible outcome, not a file-by-file narration>

## Work item
<id + link>

## Testing done
<!-- only observed results, quoted, e.g. "integration suite: 84 passed" -->
<!-- A check you didn't run is listed as `not run`, never omitted -->
<result / not run>

## Deploy order / coupling
<!-- multi-repo only: which PR merges/deploys first and why, e.g. DB schema before API, API before client -->
<order + reason, or "single repo — n/a">

## Sibling PRs
<!-- multi-repo only: links to the other repos' PRs for this work item -->
<links, or "single repo — n/a">
```

- Multi-repo sequencing: create all PRs first, then edit each description to add the sibling links (they don't exist until created).
- **When a push or create call fails:** read the full error, change exactly one thing it names, retry once. A second failure on the same call = stop and report the exact error — never retry verbatim, never move to the next repo as if it succeeded. A partial multi-repo state ("2 of 3 PRs created; repo X failed on: <quoted error>") is reported as exactly that, never rounded up to done.

### 5. Verify — a setting you didn't check is not set

Re-read each PR after creation: required reviewers actually marked required, work item actually linked, auto-complete actually on, target branch correct, and — for multi-repo — sibling PR links present in every PR body with the deploy order stated. Quote the verification. If any setting is missing: re-apply that one setting and re-verify once; if it is still missing, mark it FAILED in the report table and surface it — never report it as set, and never drop the check (verification doctrine failure protocol: one retry changing exactly one thing, then stop).

Then report a table:

```
| repo | PR URL | reviewers | work item | auto-complete | target | siblings |
```

Each cell value is `✓ (verified, quoted)`, `FAILED`, or `n/a`. `n/a` only when the config does not request that setting; every `✓` is an observed re-read, never an assumption.

## Examples

### Example 1: single-repo PR

**User:** "PR this"

**Claude:** anchors (id `#4711`, branch `feature/4711-rate-limits`, one repo), runs the review gate (0 blockers), asks approval to push, creates the PR with configured defaults, verifies reviewers + work-item link + auto-complete, reports the URL.

### Example 2: multi-repo work item

**User:** "publish the branches and create the PRs"

**Claude:** finds three repos with `#4711` commits, review-gates each, pushes all with one approval, creates three PRs, updates each body with the two sibling links and the deploy order (DB → API → client), verifies all three, reports a table of URLs.

### Example 3: review gate finds a blocker

**User:** "create a PR"

**Claude:** review gate flags a missing null check with a concrete failure scenario. Stops. Presents the finding: fix now, or waive? User says fix → applies the fix, re-runs the gate, then continues the flow.

## Anti-patterns

- ❌ Creating the PR first and reviewing after — the gate exists to keep unreviewed code out of reviewers' queues.
- ❌ Pushing or creating PRs without explicit approval for the push.
- ❌ One PR spanning multiple repos, or omitting configured reviewers / auto-complete / work-item link "to save time".
- ❌ Reporting "PR created with required reviewers" without re-reading the PR to confirm — creation calls can partially fail.
- ❌ Guessing the work item id from conversation memory — branch and commits are the source of truth; neither has it → ask.
- ❌ Calling a finding a blocker with no failure scenario attached — no scenario, no stop.
- ❌ Rounding a partial multi-repo result up to success — "2 of 3 created" is the honest report.
- ❌ PR bodies that narrate the diff file-by-file instead of stating intent, testing, and coupling.
- ✅ Review gate → approved push → per-repo PRs with verified house defaults → cross-referenced siblings → URL table.

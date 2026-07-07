---
name: github
description: Work with GitHub issues and pull requests via the gh CLI — query assigned/milestone issues (incl. cross-repo search and Projects v2 boards), read an issue's description AND download+view its embedded screenshots, publish branches, and create PRs with configured house defaults (reviewers, auto-merge, issue linked via closing keyword, one PR per repo). Reads reviewer/branch/title settings from `.claude/github.json` and offers to create it on first use. Use this skill whenever the user says "pull my issues", "what's assigned to me", "read issue 123", "get the screenshots from the issue", "create a PR", "publish the branch and create a PR", "link the PR to the issue", "enable auto-merge", or mentions "gh", "github issues", "github project board" — even if they don't explicitly say "github skill". Do not use for Azure DevOps orgs (use the azure-devops skill) or for local git-only operations.
---

# GitHub

Proven gh-CLI workflows for GitHub-tracked work: issue reading with image attachments, assigned-work queries, and PR creation with configured house defaults. All org-specific values come from config — never hardcode them.

## When to use this skill

- "pull my issues" / "what's assigned to me" / "issues in this milestone"
- "read issue 123" / "does the issue have screenshots?"
- "publish the branch and create a PR" / "create a PR with reviewers"
- "link the PR to the issue" / "turn on auto-merge"

## Step 0 — Resolve configuration

Verify auth first: `gh auth status` (if it fails, stop and tell the user to run `gh auth login` — don't ask for tokens). Then read `.claude/github.json` in the project root (fall back to `~/.claude/github.json`). Expected shape:

```json
{
  "targetBranch": "main",
  "reviewers": ["<github-username>"],
  "prTitlePattern": "#<id> (<SCOPE>) <description>",
  "linkKeyword": "Closes",
  "autoMerge": { "enabled": false, "strategy": "squash" },
  "project": { "owner": "<org-or-user>", "number": 0 }
}
```

If the file is missing: infer what you can (`gh repo view --json defaultBranchRef` for the target branch), ask the user once for the rest, then **offer to write the config file** so the interview never repeats. Reviewers are plain GitHub usernames — no identity-GUID dance needed.

## Workflow

### Query issues

1. Assigned in this repo: `gh issue list --assignee @me --state open --json number,title,state,milestone,labels`
2. Across repos/orgs: `gh search issues --assignee @me --state open --json repository,number,title`
3. Milestone (sprint equivalent): add `--milestone "<name>"`. Projects v2 board: `gh project item-list <number> --owner <owner> --format json` (needs the `project` scope: `gh auth refresh -s project`).

### Read an issue (text + screenshots)

1. `gh issue view <N> --json title,body,state,labels,milestone,comments` — the body is markdown.
2. Extract image URLs from the body: `https://github.com/user-attachments/assets/<uuid>` and legacy `user-images.githubusercontent.com/...` patterns (in both `![...](url)` markdown and `<img src>` HTML).
3. Download each — attachment URLs on private repos require auth, so pass the token: `curl -sL -H "Authorization: token $(gh auth token)" -o <scratchpad>/imgN.png <url>` — then Read the images to view them. Associate each image with its position in the body text when reporting.
4. Follow `--json comments` for follow-up screenshots and clarifications — acceptance criteria often live in comments, not the body.

### Publish branch + create PR (apply ALL configured house defaults)

1. `git push -u origin <branch>` (only with user approval; never push unasked).
2. One PR per repo for multi-repo work; descriptions cross-reference sibling PRs (`owner/repo#number` form — bare `#N` only resolves within the same repo) and state deploy-order coupling.
3. Create: `gh pr create --base <targetBranch> --title "<per prTitlePattern>" --body <text> --reviewer <user1>,<user2>` — include `<linkKeyword> #<id>` in the body to link the issue (use `Refs #<id>` instead when merging should NOT auto-close it — ask if unclear).
4. Auto-merge if configured: `gh pr merge <n> --auto --<strategy>`. If it fails, the repo hasn't enabled auto-merge or lacks branch protection — report that instead of retrying.
5. Verify: `gh pr view <n> --json reviewRequests,autoMergeRequest,closingIssuesReferences,baseRefName` → reviewers requested, issue actually linked, auto-merge actually armed, base correct. A setting you didn't re-read is not set.

## Examples

### Example 1: assigned work

**User:** "pull my issues for this milestone"

**Claude:** reads config, runs `gh issue list --assignee @me --milestone <name>`, presents a table of number/title/state, offers to read details of any item.

### Example 2: issue with screenshots

**User:** "read issue 123 — does it have screenshots?"

**Claude:** shows title/state/body summary, extracts attachment URLs from body and comments, downloads them with the auth token, views them, and reports what each shows in context of the issue text.

### Example 3: multi-repo PR

**User:** "publish the branches and create PRs"

**Claude:** pushes each repo's branch with approval, creates one PR per repo per the configured title pattern with reviewers and the issue linked, cross-references siblings as `owner/repo#N`, arms auto-merge if configured, verifies each via `gh pr view --json`, reports PR URLs.

## Anti-patterns

- ❌ Hardcoding owners, repos, or reviewer usernames in commands you suggest saving — everything org-specific belongs in `.claude/github.json`.
- ❌ Parsing `gh`'s human-readable output — always `--json` with explicit fields, and `--paginate` on raw `gh api` list calls.
- ❌ Fetching private-repo attachment URLs without the auth header — you get an HTML login page, not the image; check the file is actually an image before Reading it.
- ❌ Using a closing keyword (`Closes #N`) on an issue that should stay open after merge — that silently closes it; use `Refs #N`.
- ❌ Cross-referencing sibling PRs as bare `#N` across repos — it resolves to the wrong item; use `owner/repo#N`.
- ❌ Creating a single PR for a multi-repo change, or omitting configured reviewers / auto-merge / issue link.
- ✅ Config-driven values, `--json` everywhere, house PR defaults every time, verify after every mutation.

## Notes

- `gh` respects the repo of the CWD; pass `--repo <owner>/<name>` explicitly when operating outside it (e.g. cross-repo scripts).
- Scope errors ("missing required scopes") name the fix: `gh auth refresh -s <scope>` — say which scope, don't retry variants.
- GitHub has no required-reviewer flag on a PR; "required" is enforced by branch protection / CODEOWNERS. If the user asks for required reviewers, check whether CODEOWNERS covers the paths and say what actually enforces it.

---
name: conventional-commits
description: Write git commit messages following the Conventional Commits specification, with the type taken from the staged diff and the ticket carried as a `Refs:` footer when the branch name has one. Use this skill whenever the user asks to write a commit message, asks for help committing changes, or runs `git commit` — even if they don't explicitly say "conventional commits". Do NOT use when an organisation commit skill is installed, or when the project's CLAUDE.md, CONTRIBUTING.md, or commit template defines a different commit format — that convention always wins over this skill. Do NOT use for PR descriptions, release notes, or changelog entries — write those directly.
---

# Conventional Commits

Write commit messages that follow the [Conventional Commits](https://www.conventionalcommits.org/) spec. This is the generic default: where an organisation commit skill is installed, or the repo's own docs define a house subject format, that format wins and this skill stays out of the way.

## Format

```
<type>[(<scope>)][!]: <description>

[optional body]

[optional footer(s)]
```

```
fix: prevent modal z-index regression on settings page
```

## Types

- **feat** — a new feature (correlates with MINOR in semver)
- **fix** — a bug fix (correlates with PATCH in semver)
- **docs** — documentation only changes
- **style** — formatting, missing semicolons, etc; no code change
- **refactor** — code change that neither fixes a bug nor adds a feature
- **perf** — a code change that improves performance
- **test** — adding or correcting tests
- **build** — changes to the build system or external dependencies
- **ci** — changes to CI configuration files and scripts
- **chore** — other changes that don't modify src or test files
- **revert** — reverts a previous commit

## Ticket reference (from the current branch)

1. Run `git rev-parse --abbrev-ref HEAD` to get the current branch name.
2. Take the last `/`-separated segment of the branch (so `feature/12345-fix_this_bug` becomes `12345-fix_this_bug`).
3. If that segment starts with one or more digits followed by `-`, `_`, or end-of-string, those leading digits are the ticket number. Carry it as a `Refs: #<ticket>` footer.
4. If no leading numeric ID is found, **omit the footer entirely** — do not invent one, do not guess one from conversation context, do not reuse a stale number mentioned earlier in the session, and do not prompt the user for it. The branch name is the only source of truth for the ticket.

| Branch                          | Footer           |
|---------------------------------|------------------|
| `feature/12345-fix_this_bug`    | `Refs: #12345`   |
| `12345-fix_this_bug`            | `Refs: #12345`   |
| `bugfix/9-typo`                 | `Refs: #9`       |
| `main`, `release/v2`, `feature/redesign` | (none — omit) |

## Rules

1. Description must be lowercase, present tense ("add" not "added"), and under 72 characters including the `<type>(<scope>)!: ` prefix — keep it tight.
2. No period at the end of the description.
3. Breaking changes get a `!` after the type / scope (e.g., `feat(api)!: drop support for Node 16`) and a `BREAKING CHANGE:` footer.
4. `(scope)` is optional. Use it only when it adds real specificity (e.g., `fix(auth): ...`), never as filler.
5. Body explains the *why*, not the *what*. Wrap at 72 chars.
6. The description states **what changed** at the level a reader scanning a changelog needs; the *why* goes in the body. A description that only restates the type ("fix bug") carries no information — rewrite it.
   - ❌ `fix: fix bug in login`
   - ✅ `fix: reject expired refresh tokens instead of issuing new access tokens`
7. The type must match the **diff**, not the user's phrasing. The user saying "quick fix" while the staged diff adds a new endpoint means `feat`, not `fix`. Determine the type from `git diff --staged` output you actually read this session — never from the conversation summary or the user's wording alone.
8. If the staged diff contains two unrelated changes (e.g., an auth bug fix plus a new export page), say so and suggest splitting into two commits — do not paper over it with a vague umbrella description like `chore: various updates`.

## Workflow

**Hard rules:** NEVER run `git commit`, `git add`, `git commit --amend`, or `git push` unless the user explicitly asked you to commit in this session. If they did ask, commit exactly what is already staged — never stage additional files yourself, and never amend an existing commit to inject this message.

When the user asks for a commit message:

0. Check for a house format before anything else: an installed organisation commit skill, or a format defined in the repo's CLAUDE.md, CONTRIBUTING.md or commit template. If one exists, use it and stop here. Then check for commit-lint tooling (`.commitlintrc*`, `commitlint.config.*`, `semantic-release` in package.json, a `.husky/commit-msg` hook): if present, read its config and conform to its allowed types, scopes and header length. Prevents: commits rejected by the repo's own hooks.
1. Get the current branch with `git rev-parse --abbrev-ref HEAD` and extract the ticket number per the rules above.
2. Inspect the staged diff: `git diff --cached` (or `git diff` if nothing is staged). If both `git diff --cached` and `git diff` come back empty, STOP and tell the user there is nothing to commit (run `git status --short` to check for untracked files and name them). Never compose a message from conversation memory — a diff you did not read this session does not exist. Prevents: commit messages describing work that was never staged.
3. Categorize the change into one of the types — based on the diff you just read, not on how the user described the work.
4. Write a concise description.
5. Add a body when ANY of the following is true; otherwise omit it: (a) the diff changes more than one file; (b) the diff changes more than ~20 lines; (c) the header carries `!` or a `BREAKING CHANGE:` footer. The body states the *why*, wrapped at 72 chars (Rule 5).
6. Flag breaking changes explicitly.
7. Assemble the header as `<type>[(<scope>)][!]: <description>`, then the body, then the footers (`Refs:`, `BREAKING CHANGE:`).
8. Self-check before presenting — verify all three, don't eyeball them:
   - (a) header character count ≤ 72 — count it, don't eyeball it;
   - (b) the `Refs:` ticket appears verbatim in the branch name you printed this session, or the footer is omitted;
   - (c) you can point at the specific diff hunk that justifies the type.
9. Present the assembled message to the user and stop. When presenting, state the basis in one line — e.g. `type feat from the new export endpoint in src/api/export.ts (verified); ticket 12345 from branch feature/12345-x (verified)`. A branch or diff you did not observe this session is "not read", never "known".

## Examples

```
fix: prevent modal z-index regression on settings page

feat(auth): add OAuth2 PKCE flow for mobile clients

Refs: #12345

chore: add index on users.created_at for analytics query

fix: prevent race condition in cache invalidation

The previous implementation could double-invalidate when two requests
arrived within the lock window. Use a single atomic CAS.

Fixes #482

refactor(db)!: rename `user.email` column to `user.email_address`

BREAKING CHANGE: clients reading `user.email` must update to `user.email_address`.
```

## Anti-patterns to avoid

- ❌ `update stuff` (no type, vague)
- ❌ `Fix: Bug in login page.` (capitalized, trailing period)
- ❌ `feat: added the ability to export CSV files` (past tense)
- ❌ `feat: added export.` (past tense + trailing period)
- ❌ Inventing a ticket number when the branch doesn't have one — or guessing one from conversation context
- ❌ `fix: quick fix per request` when the staged diff adds a new endpoint (type from the user's phrasing, not the diff — should be `feat`)
- ❌ `chore: various updates` covering two unrelated changes — flag the split instead
- ❌ Adding a ticket or area prefix in front of the type when the repo has no such convention
- ✅ `feat: add CSV export`

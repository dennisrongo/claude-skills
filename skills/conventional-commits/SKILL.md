---
name: conventional-commits
description: Write git commit messages following the Conventional Commits specification (feat, fix, chore, docs, refactor, test, perf, build, ci, revert). Use this skill whenever the user asks to write a commit message, asks for help committing changes, runs `git commit`, or mentions writing changelog entries — even if they don't explicitly say "conventional commits".
---

# Conventional Commits

Write commit messages that follow the [Conventional Commits](https://www.conventionalcommits.org/) spec. These messages are machine-parseable, enable automated changelog generation, and make project history easy to scan.

## Format

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
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

## Rules

1. The description must be lowercase, present tense ("add" not "added"), and under 72 characters.
2. No period at the end of the description.
3. Breaking changes get a `!` after the type/scope (e.g., `feat(api)!: drop support for Node 16`) and a `BREAKING CHANGE:` footer.
4. Scope is optional but useful for monorepos or large projects (e.g., `feat(auth): ...`).
5. Body explains the *why*, not the *what*. Wrap at 72 chars.

## Workflow

When the user asks for a commit message:

1. Inspect the staged diff: `git diff --cached` (or `git diff` if nothing staged yet).
2. Categorize the change into one of the types above.
3. Identify the scope if applicable.
4. Write a concise description.
5. If the change is non-trivial, add a body explaining the rationale.
6. Flag breaking changes explicitly.

## Examples

```
feat(auth): add OAuth2 PKCE flow for mobile clients

fix: prevent race condition in cache invalidation

The previous implementation could double-invalidate when two requests
arrived within the lock window. Use a single atomic CAS.

Fixes #482

refactor(db)!: rename `user.email` column to `user.email_address`

BREAKING CHANGE: clients reading `user.email` must update to `user.email_address`.

docs: clarify install instructions for Windows

chore(deps): bump axios to 1.7.2
```

## Anti-patterns to avoid

- ❌ `update stuff` (no type, vague)
- ❌ `Fix: Bug in login page.` (capitalized, trailing period)
- ❌ `feat: added the ability to export CSV files` (past tense)
- ✅ `feat: add CSV export`

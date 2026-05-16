---
name: conventional-commits
description: Write git commit messages following the Conventional Commits specification, with an automatic ticket number pulled from the current branch and a project tag (API / CLIENT / CONSOLE / DB) when the project type can be detected from the diff. Use this skill whenever the user asks to write a commit message, asks for help committing changes, runs `git commit`, or mentions writing changelog entries — even if they don't explicitly say "conventional commits".
---

# Conventional Commits

Write commit messages that follow the [Conventional Commits](https://www.conventionalcommits.org/) spec, prefixed with the ticket number (from the current branch) and the project tag (`API` / `CLIENT` / `CONSOLE` / `DB`) when those can be determined.

## Contract

**Inputs:** Current branch name (for ticket extraction); staged diff via `git diff --cached --name-only` (fall back to unstaged) for project-tag detection.
**Outputs:** A formatted commit message string — `[#<ticket>] [(<PROJECT>)] <type>: <description>` with optional body and breaking-change footer. Does **not** execute `git commit`.
**Invokes:** `(none)`
**Invoked by:** User phrases — "write a commit message", commit-help requests, `git commit`, changelog-entry requests; called by `code-review` and `plan-and-build` after edits.

## Format

```
[#<ticket>] [(<PROJECT>)] <type>[(<scope>)][!]: <description>

[optional body]

[optional footer(s)]
```

Bracketed segments are included only when they apply (see [Branch & project context](#branch--project-context)). A fully-tagged example:

```
#12345 (CLIENT) fix: prevent modal z-index regression on settings page
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

## Branch & project context

Before composing the message, gather two pieces of context from the repo.

### Ticket number (from current branch)

1. Run `git rev-parse --abbrev-ref HEAD` to get the current branch name.
2. Take the last `/`-separated segment of the branch (so `feature/12345-fix_this_bug` becomes `12345-fix_this_bug`).
3. If that segment starts with one or more digits followed by `-`, `_`, or end-of-string, those leading digits are the ticket number.
4. If no leading numeric ID is found, **omit `#<ticket>` from the message entirely** — do not invent one and do not prompt the user for it.

Examples:

| Branch                          | Extracted ticket |
|---------------------------------|------------------|
| `feature/12345-fix_this_bug`    | `12345`          |
| `12345-fix_this_bug`            | `12345`          |
| `bugfix/9-typo`                 | `9`              |
| `main`, `release/v2`, `feature/redesign` | (none — omit `#`) |

### Project tag

Pick ONE of `API`, `CLIENT`, `CONSOLE`, or `DB` based on what was actually changed in the diff:

- **API** — backend services, REST / GraphQL endpoints, server-side handlers. Signals: paths like `api/`, `server/`, `backend/`, `services/api/`, `apps/api/`; server framework code (Express, NestJS, FastAPI, Django, Rails, Spring); OpenAPI specs.
- **CLIENT** — user-facing frontend. Signals: paths like `client/`, `web/`, `frontend/`, `apps/web/`, `apps/client/`, `ui/`; `.tsx` / `.jsx` / `.vue` / `.svelte`; React / Vue / Angular / Svelte component files; user-facing CSS / Tailwind / design assets.
- **CONSOLE** — .NET console applications (CLIs, worker services, background tools). Signals: `.csproj` files with `<OutputType>Exe</OutputType>` or `Sdk="Microsoft.NET.Sdk"` (and NOT `Microsoft.NET.Sdk.Web`); `Program.cs` without ASP.NET / web-host bootstrap; `Microsoft.Extensions.Hosting` worker or `BackgroundService` usage; CLI libraries like `System.CommandLine`, `Spectre.Console`, `CommandLineParser`, `McMaster.Extensions.CommandLineUtils`; project names ending in `.Console`, `.Cli`, `.Worker`, or `.Tool`; paths like `console/`, `apps/console/`, `tools/`, `cli/`.
- **DB** — database schema, migrations, seeds, ORM models. Signals: paths like `db/`, `migrations/`, `prisma/`, `schema.prisma`, SQL files, `alembic/`, `knex/`, model-only changes.

How to decide:

1. Run `git diff --cached --name-only` (fall back to `git diff --name-only` if nothing is staged).
2. Match the changed paths against the signals above. If all changed files cluster under one bucket, use that tag.
3. If the diff genuinely spans multiple buckets, pick the dominant one (most files or largest change) and mention the secondary in the body.
4. If none of the four buckets fit the repo (e.g., a library, a docs-only repo, a meta-tooling project), **omit `(PROJECT)`** — same fallback rule as the missing ticket.
5. If two buckets are plausibly equal and you can't break the tie from the diff, ask the user which one applies. Do not guess silently.

## Rules

1. Description must be lowercase, present tense ("add" not "added"), and under 72 characters. The `#12345 (CLIENT)` prefix counts toward the 72-char header budget — keep the description tight.
2. No period at the end of the description.
3. Breaking changes get a `!` after the type / scope (e.g., `#12345 (API) feat!: drop support for Node 16`) and a `BREAKING CHANGE:` footer.
4. Inner `type(scope)` is optional and usually redundant once `(PROJECT)` is present. Only use it when it adds real specificity beyond the project tag (e.g., `#12345 (API) fix(auth): ...` when "auth" narrows further than "API").
5. Body explains the *why*, not the *what*. Wrap at 72 chars.

## Workflow

When the user asks for a commit message:

1. Get the current branch with `git rev-parse --abbrev-ref HEAD` and extract the ticket number per the rules above.
2. Inspect the staged diff: `git diff --cached` (or `git diff` if nothing is staged).
3. From the changed file paths, determine the project tag — or decide to omit it.
4. Categorize the change into one of the types.
5. Write a concise description.
6. If the change is non-trivial, add a body explaining the rationale.
7. Flag breaking changes explicitly.
8. Assemble the header as `[#<ticket>] [(<PROJECT>)] <type>: <description>`, including only the segments that apply.

## Examples

```
#12345 (CLIENT) fix: prevent modal z-index regression on settings page

#12345 (API) feat(auth): add OAuth2 PKCE flow for mobile clients

#987 (DB) chore: add index on users.created_at for analytics query

#42 (CONSOLE) feat: add bulk-export action to billing dashboard

(API) refactor: extract token validator into shared middleware
# ^ branch had no ticket — `#` omitted

#7 fix: correct off-by-one in pagination cursor
# ^ repo doesn't fit API / CLIENT / CONSOLE / DB — `(PROJECT)` omitted

fix: prevent race condition in cache invalidation

The previous implementation could double-invalidate when two requests
arrived within the lock window. Use a single atomic CAS.

Fixes #482
# ^ no ticket in branch, no project bucket fits — both prefixes omitted

#1024 (API) refactor!: rename `user.email` column to `user.email_address`

BREAKING CHANGE: clients reading `user.email` must update to `user.email_address`.
```

## Anti-patterns to avoid

- ❌ `update stuff` (no type, vague)
- ❌ `Fix: Bug in login page.` (capitalized, trailing period)
- ❌ `feat: added the ability to export CSV files` (past tense)
- ❌ `#12345 (CLIENT) feat: added export.` (past tense + trailing period)
- ❌ Inventing a ticket number when the branch doesn't have one
- ❌ Forcing a `(PROJECT)` tag when the diff doesn't actually map to API / CLIENT / CONSOLE / DB
- ✅ `#12345 (CLIENT) feat: add CSV export`

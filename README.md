# claude-skills

The [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) skills I ([Dennis Rongo](https://github.com/dennisrongo)) use every day — not shelfware, not theory. Each one earns its place by surviving real work: shipping features, reviewing PRs, debugging production, designing architecture, and keeping commits clean.

They're small, composable, and meant to be tuned. Install the ones you want, edit them in-place, send a PR if yours sharpens mine.

> Skills are reusable bundles of instructions that Claude consults when relevant. This repo is my personal daily-driver library — grow it over time, tune the ones that misfire, install the set you want on any machine.

## Quick start

### From npm (recommended)

The package is published as [`@dennisrongo/skills`](https://www.npmjs.com/package/@dennisrongo/skills). The installed binary is `skills`.

```bash
# See what's in the library
npx @dennisrongo/skills list

# Interactive picker, global (~/.claude/skills)
npx @dennisrongo/skills install

# Interactive picker, project-scoped (./.claude/skills)
npx @dennisrongo/skills install -p

# Install specific skills globally (~/.claude/skills)
npx @dennisrongo/skills install conventional-commits pr-review

# Install specific skills into the current project
npx @dennisrongo/skills install conventional-commits pr-review -p

# Install everything into the current project (./.claude/skills)
npx @dennisrongo/skills install --all --project
```

Or install once and call it directly:

```bash
npm install -g @dennisrongo/skills
skills list
```

### From GitHub (for the latest `main`)

Useful if you want changes that haven't been released to npm yet.

```bash
npx github:dennisrongo/claude-skills list
npx github:dennisrongo/claude-skills install
```

> The interactive picker, `--all`, and named-skill installs all accept `-p` / `--project` to target `./.claude/skills` instead of the global `~/.claude/skills`. Run it from the project root.

### Shorter alias (recommended)

`npx github:dennisrongo/claude-skills` is a mouthful. Add a shell alias:

```bash
# bash / zsh — add to ~/.bashrc or ~/.zshrc
alias skills="npx --yes github:dennisrongo/claude-skills"

# fish — add to ~/.config/fish/config.fish
alias skills "npx --yes github:dennisrongo/claude-skills"
```

Then:

```bash
skills list
skills install --all
```

### Pinning a version

`npx github:...` resolves to the latest commit on `main`. To pin to a specific commit, branch, or tag:

```bash
npx github:dennisrongo/claude-skills#v0.1.0 install      # tag
npx github:dennisrongo/claude-skills#abc1234 install     # commit SHA
npx github:dennisrongo/claude-skills#some-branch install # branch
```

### Local clone (for contributors)

```bash
git clone https://github.com/dennisrongo/claude-skills.git
cd claude-skills
npm install
node bin/claude-skills.js list
```

## Available skills

| Skill | What it does |
|---|---|
| [`code-review`](./skills/code-review/SKILL.md) | Production-readiness review of **uncommitted** working-tree changes (staged + unstaged). Hunts DRY violations, dead code, leaky abstractions, premature abstraction, magic values, missing error handling, debug residue, missing migrations / flags / logs, and other common best-practice gaps — prioritized correctness → DRY/design → tests → security → performance → production-readiness → readability. Auto-detects and runs the project's tests and build (`npm`, `pytest`, `dotnet`, `go`, `cargo`, `Makefile`, monorepo orchestrators) and gates the verdict on them being green. **Never edits code unprompted** — produces a categorized report (`blocking` / `suggestion` / `nit` / `praise`) with `file:line` citations, then asks per-finding before fixing. Distinct from [`pr-review`](./skills/pr-review/SKILL.md), which scopes to committed branch work. Triggers on "code review", "review the diff", "is this production ready", "DRY check", or `/code-review`. |
| [`conventional-commits`](./skills/conventional-commits/SKILL.md) | Write git commit messages that follow the [Conventional Commits](https://www.conventionalcommits.org/) spec (`feat`, `fix`, `chore`, `docs`, …), auto-prefixed with the ticket number from the current branch (e.g. `feature/12345-...` → `#12345`) and a project tag (`API` / `CLIENT` / `CONSOLE` / `DB`) when detectable from the diff. Both prefixes are omitted when they don't apply. Triggers on commit-message requests. |
| [`diagnose`](./skills/diagnose/SKILL.md) | Disciplined diagnosis loop for hard bugs and performance regressions — reproduce → minimise → hypothesise → instrument → fix → regression-test. Forces a fast, deterministic feedback loop before any guessing, generates 3–5 ranked falsifiable hypotheses, uses tagged `[DEBUG-...]` instrumentation that's trivially cleaned up, and ends with a post-mortem on what would have prevented the bug. Triggers on "diagnose this" / "debug this" / bug reports / flaky tests / perf regressions. |
| [`dotnet-onion-api`](./skills/dotnet-onion-api/SKILL.md) | Scaffold a new .NET solution (Web API + Worker microservices) using ONION architecture and EF Core, codifying battle-tested layered patterns and explicitly removing common legacy pitfalls (sproc-centric repos with reflection, EF6 on netstandard2.1, polling console workers, mutable base-service state, missing `CancellationToken`). Three modes — full solution scaffold, add-a-feature slice, add-a-worker microservice. Resolves TFM and NuGet versions at scaffold time (not hard-coded). |
| [`grill-with-docs`](./skills/grill-with-docs/SKILL.md) | Interview-driven design review. Stress-tests a plan, RFC, or feature idea against the project's existing domain model and documented decisions — one question at a time with `AskUserQuestion`, sharpening fuzzy terminology and surfacing contradictions with the codebase. Updates `CONTEXT.md` (glossary) inline as terms resolve and writes ADRs to `docs/adr/` only when the decision is hard to reverse, non-obvious, and had real trade-offs. Writes no production code — composes with [`plan-and-build`](./skills/plan-and-build/SKILL.md) for the implementation handoff. Triggers on "grill me", "stress-test this plan", "challenge this design", "/grill-with-docs", or a pasted RFC. |
| [`handoff`](./skills/handoff/SKILL.md) | Capture a session hand-off before context runs out — writes a dated `.claude/handoffs/*.md` (objective, progress, decisions, files, open issues, ready-to-paste next-session prompt) plus a lightweight memory pointer so a fresh Claude session can resume cleanly. |
| [`improve-codebase-architecture`](./skills/improve-codebase-architecture/SKILL.md) | Surface architectural friction and propose **deepening opportunities** — refactors that collapse clusters of shallow modules into one deep module with a real seam. Walks the codebase with an Explore sub-agent, applies the **deletion test** to suspected pass-throughs, presents numbered candidates (files / problem / solution / benefits) using `CONTEXT.md` for the domain and a strict architecture glossary (module / interface / seam / depth / leverage / locality) for the structure, then drops into a grilling loop with optional parallel sub-agent interface design ("Design It Twice"). Updates `CONTEXT.md` inline as new concepts get named and offers an ADR only when a rejection is load-bearing. Composes with [`grill-with-docs`](./skills/grill-with-docs/SKILL.md) for glossary + ADR discipline and [`plan-and-build`](./skills/plan-and-build/SKILL.md) for the implementation handoff. Writes no production code. Triggers on "improve architecture", "architecture review", "find refactoring / deepening opportunities", "find shallow modules", "make this more testable", or `/improve-codebase-architecture`. |
| [`nextjs-app-router`](./skills/nextjs-app-router/SKILL.md) | Scaffold a new Next.js (App Router) **fullstack** app — TypeScript, **NextAuth (Auth.js v5)**, **Prisma + PostgreSQL**, Route Handlers as the backend, Redux Toolkit + RTK Query, Tailwind + shadcn/ui (Radix), React Hook Form + Zod. **API-driven by deliberate choice**: pages are `'use client'`, all data flows UI → RTK Query → `/api/**` Route Handlers → Prisma. No `fetch()` in server components, no Server Actions, no async `page.tsx`. Confirms the database (Postgres + Prisma) and NextAuth providers with the user before writing files. Forbids the usual pitfalls (custom JWT cookies alongside NextAuth, multiple `createApi`/`PrismaClient` instances, `serializableCheck: false`, `@ts-ignore`, mixed `moment`/`date-fns`, `styled-components` alongside Tailwind, case-sensitive folder dupes, `dangerouslySetInnerHTML` without sanitization, Route Handlers that skip `requireSession()` or trust client-sent user IDs, `prisma db push` in CI). Three modes — full project scaffold, add-a-feature slice (page + form + Route Handler + Zod schema + RTK Query endpoints + Prisma model), add-an-API-slice. Resolves package versions at scaffold time (not hard-coded). |
| [`plan-and-build`](./skills/plan-and-build/SKILL.md) | Plan-first feature builder. Grills the user about the feature (à la `grill-with-docs`) until the design is unambiguous, detects the project's stack and conventions, presents a plan, and gates on `ExitPlanMode` approval before writing any code. Builds TDD-first with NUnit when a .NET API changes — appending to the matching test class if one already exists rather than forking a parallel one — reuses existing patterns, keeps comments minimal, and generates EF Core / migration files **without ever** running `dotnet ef database update` or any DDL/SQL against the user's database. Triggers on "build/add/implement a feature", "/plan-and-build", or a pasted feature spec. |
| [`pr-review`](./skills/pr-review/SKILL.md) | Conduct a structured PR / diff review prioritized correctness → design → tests → security → performance → readability, with categorized feedback (`blocking` / `suggestion` / `question` / `nit` / `praise`). |
| [`tauri-2-app`](./skills/tauri-2-app/SKILL.md) | Scaffold a new Tauri 2 desktop app (Rust backend + TypeScript/React frontend) using a thin-frontend / rich-Rust-backend architecture with modular `commands/`, `state/`, `storage/`, `platform/` traits, `error/` macros, single-instance + updater plugins wired correctly, capability JSON per window, encrypted secrets at rest, `spawn_blocking` for sync work, and typed frontend command hooks — while forbidding common pitfalls (committed `.backup`/`.orig`/`.temp` files, plaintext API keys in `settings.json`, tokens in `localStorage`, `cfg!(target_os)` in command bodies instead of trait-based platform code, hand-rolled date math instead of `chrono`, raw `std::fs` bypassing capability checks, blocking I/O inside async commands, missing `windows_subsystem = "windows"` in `main.rs`, `devtools: true` in release, hardcoded bundle identifiers / updater pubkeys / CDN URLs). Three modes — full project scaffold, add-a-command end-to-end, add-a-Rust-module slice. Resolves Cargo + npm versions at scaffold time (not hard-coded). |
| [`write-a-skill`](./skills/write-a-skill/SKILL.md) | Author a new Claude Code skill — interview-driven scaffolding that produces a properly-structured `SKILL.md` (trigger-rich YAML description, "When to use", workflow, examples, anti-patterns), drops it in the right location (library `skills/`, project `./.claude/skills/`, or global `~/.claude/skills/`), updates the README skills table when extending this library, and runs a review checklist focused on the failure mode that matters most — under-triggering descriptions. Triggers on "create/write/add a skill", "/write-a-skill", or a pasted SKILL.md URL with "one like this". |

Run `skills list` to see this list with install status, or browse [`skills/`](./skills) directly.

## How Claude Code finds these skills

Claude Code looks for `SKILL.md` files in:

- `~/.claude/skills/<skill>/SKILL.md` — available in every session (global)
- `<project>/.claude/skills/<skill>/SKILL.md` — available only inside that project

This CLI just copies skill folders to one of those locations. Nothing magic.

## Commands

| Command | What it does |
|---|---|
| `skills list` | List skills available in the library, marking which are installed |
| `skills installed` | List skills currently installed |
| `skills install` | Interactive multi-select picker |
| `skills install <name>...` | Install one or more skills by name |
| `skills install --all` | Install every skill in the library |
| `skills remove <name>...` | Remove installed skill(s) |
| `skills remove --all` | Remove every installed skill |

## Flags

- `-g, --global` — target `~/.claude/skills` (default)
- `-p, --project` — target `./.claude/skills`
- `-f, --force` — overwrite if already installed (interactive install always overwrites selected items)
- `-h, --help` / `-v, --version`

## Adding your own skills

This library ships with a [`write-a-skill`](./skills/write-a-skill/SKILL.md) skill that scaffolds new ones for you — that's the intended path. Don't hand-edit `SKILL.md` from scratch; the skill knows the structure, writes a trigger-rich description (the part Claude actually reads), and updates the README table for you.

Install it once, globally, from npm — no clone needed to use it:

```bash
npx @dennisrongo/skills install write-a-skill
```

From there:

- **For a project skill or a global skill on your machine** — `cd` to the project (or anywhere), open Claude Code, and say `/write-a-skill`. It interviews you, picks the right location (`./.claude/skills/` for a project skill, `~/.claude/skills/` for a global one), and drops the new `SKILL.md`. Done.
- **To contribute a skill back to this library** — you do need a working tree to commit. Clone the repo, `cd` in, open Claude Code, and say `/write-a-skill`. It detects the library repo, writes to `skills/<name>/SKILL.md`, and adds the row to the table above. Commit and push to `main`; on any machine `npx --yes github:dennisrongo/claude-skills install <your-skill-name>` picks it up.

### The directory shape

The library lives in [`skills/`](./skills). Each skill is a directory containing a `SKILL.md` with YAML frontmatter.

```
skills/
├── _template/              # starting point — the leading underscore skips it from install
│   └── SKILL.md
├── conventional-commits/
│   └── SKILL.md
└── my-new-skill/
    ├── SKILL.md
    ├── references/         # optional supporting files
    └── scripts/            # optional executable helpers
```

### If you'd rather do it by hand

Copy `skills/_template/` to `skills/<your-skill-name>/`, edit the `SKILL.md`, and add a row to the skills table above. Minimum viable file:

```markdown
---
name: my-skill-name
description: One sentence describing what it does AND when to trigger it. Be specific about phrases the user might use.
---

# My Skill Name

Instructions for Claude...
```

The `description` is the single highest-leverage field — it's the only thing Claude reads when deciding whether to consult the skill. Be explicit about trigger conditions; under-triggering is the more common failure mode. (This is the part [`write-a-skill`](./skills/write-a-skill/SKILL.md) is opinionated about — using it will save you from the rookie mistake of writing "Helps with X.")

> Tip: `npx` caches the package per version spec. If you push an update to `main` and the next `npx github:dennisrongo/claude-skills ...` call doesn't seem to pick it up, run `npx --yes ...` to force a refresh, or clear the cache with `npx clear-npx-cache`.

## Fine-tuning skills you've installed

Two patterns:

**Tune in-place, then upstream:**
Edit the file at `~/.claude/skills/<name>/SKILL.md` directly while you're iterating with Claude. Once it feels right, copy the edits back into this repo's `skills/<name>/SKILL.md` and commit.

**Tune in the repo, reinstall:**
Edit `skills/<name>/SKILL.md` in your clone, then run `npx github:dennisrongo/claude-skills install <name> --force` to push it to your install location.

**Pull upstream updates (npm-global install):**
If you installed the CLI globally (`npm install -g @dennisrongo/skills`), updating is a two-step process — bumping the CLI does *not* automatically refresh the skills already copied into `~/.claude/skills/`.

```bash
# 1. Update the CLI to the latest published version
npm install -g @dennisrongo/skills@latest

# 2. Re-copy the bundled skills over your existing installs
skills install --all --force
```

- Step 1 replaces the `skills` binary and the bundled skill files inside the global node_modules.
- Step 2 overwrites everything in `~/.claude/skills/` with the new bundled versions. Without `--force` the CLI skips skills that already exist.
- Add `-p` / `--project` to step 2 if the skills live in `./.claude/skills` instead.
- To update just one skill instead of all: `skills install <name> --force`.

**Pull upstream updates (npx-from-GitHub):**
If you're using `npx github:dennisrongo/claude-skills` without a global install, force-reinstall with a cache-bust:

```bash
# Single skill
npx --yes github:dennisrongo/claude-skills install <name> --force

# All installed skills
npx --yes github:dennisrongo/claude-skills install --all --force
```

- `--yes` bypasses the `npx` cache so it re-fetches the latest commit on `main` instead of reusing an old one.
- `--force` overwrites the existing install (without it, the CLI skips skills that already exist).
- Add `-p` / `--project` if the skill lives in `./.claude/skills` instead of the global `~/.claude/skills`.

## Releasing

Releases are published to npm automatically by [`.github/workflows/publish.yml`](./.github/workflows/publish.yml) when a GitHub Release is published. The package ships with [npm provenance](https://docs.npmjs.com/generating-provenance-statements) — npm verifies it was built by this repo's Actions workflow.

One-time setup:

1. Create an automation-scoped `NPM_TOKEN` at https://www.npmjs.com/settings/<user>/tokens (use a "Granular Access Token" or "Automation" token).
2. Add it to the repo as a secret: **Settings → Secrets and variables → Actions → New repository secret**, name `NPM_TOKEN`.
3. If you ever rename the package, confirm the new name is free: `npm view <name>`. The current scoped name `@dennisrongo/skills` lives under your npm user/org — `npm publish --access public` will create it on first publish.

Cutting a release:

```bash
# Bump version (creates a commit + tag)
npm version patch   # or minor / major

# Push the commit and tag
git push --follow-tags

# Create a GitHub Release pointing at the new tag — the workflow takes over from there.
gh release create "v$(node -p "require('./package.json').version")" --generate-notes
```

The workflow checks `package.json` version matches the release tag, runs tests, then publishes with `--provenance`. After publishing both invocation forms work:

```bash
npx @dennisrongo/skills install                 # via npm
npx github:dennisrongo/claude-skills install    # still works, latest main
```

## License

[MIT](./LICENSE) © Dennis Rongo

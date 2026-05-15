# claude-skills

A curated, fine-tunable library of [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) skills. Install globally or per-project with one command.

> Skills are reusable bundles of instructions that Claude consults when relevant. This repo is a personal/team library of them — grow it over time, tune the ones that misfire, and install the set you want on any machine.

## Quick start

### From npm (recommended)

The package is published as [`@dennisrongo/skills`](https://www.npmjs.com/package/@dennisrongo/skills). The installed binary is `claude-skills`.

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
claude-skills list
```

### From GitHub (no npm publish needed)

```bash
npx github:dennisrongo/claude-skills list
npx github:dennisrongo/claude-skills install
```

> The interactive picker, `--all`, and named-skill installs all accept `-p` / `--project` to target `./.claude/skills` instead of the global `~/.claude/skills`. Run it from the project root.

### Shorter alias (recommended)

`npx github:dennisrongo/claude-skills` is a mouthful. Add a shell alias:

```bash
# bash / zsh — add to ~/.bashrc or ~/.zshrc
alias claude-skills="npx --yes github:dennisrongo/claude-skills"

# fish — add to ~/.config/fish/config.fish
alias claude-skills "npx --yes github:dennisrongo/claude-skills"
```

Then:

```bash
claude-skills list
claude-skills install --all
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
| [`conventional-commits`](./skills/conventional-commits/SKILL.md) | Write git commit messages that follow the [Conventional Commits](https://www.conventionalcommits.org/) spec (`feat`, `fix`, `chore`, `docs`, …), auto-prefixed with the ticket number from the current branch (e.g. `feature/12345-...` → `#12345`) and a project tag (`API` / `CLIENT` / `CONSOLE` / `DB`) when detectable from the diff. Both prefixes are omitted when they don't apply. Triggers on commit-message requests. |
| [`diagnose`](./skills/diagnose/SKILL.md) | Disciplined diagnosis loop for hard bugs and performance regressions — reproduce → minimise → hypothesise → instrument → fix → regression-test. Forces a fast, deterministic feedback loop before any guessing, generates 3–5 ranked falsifiable hypotheses, uses tagged `[DEBUG-...]` instrumentation that's trivially cleaned up, and ends with a post-mortem on what would have prevented the bug. Triggers on "diagnose this" / "debug this" / bug reports / flaky tests / perf regressions. |
| [`dotnet-onion-api`](./skills/dotnet-onion-api/SKILL.md) | Scaffold a new .NET solution (Web API + Worker microservices) using ONION architecture and EF Core, codifying battle-tested layered patterns and explicitly removing common legacy pitfalls (sproc-centric repos with reflection, EF6 on netstandard2.1, polling console workers, mutable base-service state, missing `CancellationToken`). Three modes — full solution scaffold, add-a-feature slice, add-a-worker microservice. Resolves TFM and NuGet versions at scaffold time (not hard-coded). |
| [`grill-with-docs`](./skills/grill-with-docs/SKILL.md) | Interview-driven design review. Stress-tests a plan, RFC, or feature idea against the project's existing domain model and documented decisions — one question at a time with `AskUserQuestion`, sharpening fuzzy terminology and surfacing contradictions with the codebase. Updates `CONTEXT.md` (glossary) inline as terms resolve and writes ADRs to `docs/adr/` only when the decision is hard to reverse, non-obvious, and had real trade-offs. Writes no production code — composes with [`plan-and-build`](./skills/plan-and-build/SKILL.md) for the implementation handoff. Triggers on "grill me", "stress-test this plan", "challenge this design", "/grill-with-docs", or a pasted RFC. |
| [`handoff`](./skills/handoff/SKILL.md) | Capture a session hand-off before context runs out — writes a dated `.claude/handoffs/*.md` (objective, progress, decisions, files, open issues, ready-to-paste next-session prompt) plus a lightweight memory pointer so a fresh Claude session can resume cleanly. |
| [`improve-codebase-architecture`](./skills/improve-codebase-architecture/SKILL.md) | Surface architectural friction and propose **deepening opportunities** — refactors that collapse clusters of shallow modules into one deep module with a real seam. Walks the codebase with an Explore sub-agent, applies the **deletion test** to suspected pass-throughs, presents numbered candidates (files / problem / solution / benefits) using `CONTEXT.md` for the domain and a strict architecture glossary (module / interface / seam / depth / leverage / locality) for the structure, then drops into a grilling loop with optional parallel sub-agent interface design ("Design It Twice"). Updates `CONTEXT.md` inline as new concepts get named and offers an ADR only when a rejection is load-bearing. Composes with [`grill-with-docs`](./skills/grill-with-docs/SKILL.md) for glossary + ADR discipline and [`plan-and-build`](./skills/plan-and-build/SKILL.md) for the implementation handoff. Writes no production code. Triggers on "improve architecture", "architecture review", "find refactoring / deepening opportunities", "find shallow modules", "make this more testable", or `/improve-codebase-architecture`. |
| [`nextjs-app-router`](./skills/nextjs-app-router/SKILL.md) | Scaffold a new Next.js (App Router) frontend with TypeScript, Redux Toolkit + RTK Query, Tailwind + shadcn/ui (Radix), and React Hook Form + Zod. Codifies route-group auth boundaries, a single injected RTK Query API, schema-driven forms with introspected defaults, server-side `middleware.ts`, and Vitest + Playwright + CI defaults — while forbidding common pitfalls (`'use client'` on root pages, `router.push` in `useEffect`, `serializableCheck: false`, `@ts-ignore`, mixed `moment`/`date-fns`, `styled-components` alongside Tailwind, case-sensitive folder dupes, `dangerouslySetInnerHTML` without sanitization, tokens outside `httpOnly` cookies). Three modes — full project scaffold, add-a-feature slice, add-an-API-slice. Resolves package versions at scaffold time (not hard-coded). |
| [`plan-and-build`](./skills/plan-and-build/SKILL.md) | Plan-first feature builder. Grills the user about the feature (à la `grill-with-docs`) until the design is unambiguous, detects the project's stack and conventions, presents a plan, and gates on `ExitPlanMode` approval before writing any code. Builds TDD-first with NUnit when a .NET API changes — appending to the matching test class if one already exists rather than forking a parallel one — reuses existing patterns, keeps comments minimal, and generates EF Core / migration files **without ever** running `dotnet ef database update` or any DDL/SQL against the user's database. Triggers on "build/add/implement a feature", "/plan-and-build", or a pasted feature spec. |
| [`pr-review`](./skills/pr-review/SKILL.md) | Conduct a structured PR / diff review prioritized correctness → design → tests → security → performance → readability, with categorized feedback (`blocking` / `suggestion` / `question` / `nit` / `praise`). |
| [`write-a-skill`](./skills/write-a-skill/SKILL.md) | Author a new Claude Code skill — interview-driven scaffolding that produces a properly-structured `SKILL.md` (trigger-rich YAML description, "When to use", workflow, examples, anti-patterns), drops it in the right location (library `skills/`, project `./.claude/skills/`, or global `~/.claude/skills/`), updates the README skills table when extending this library, and runs a review checklist focused on the failure mode that matters most — under-triggering descriptions. Triggers on "create/write/add a skill", "/write-a-skill", or a pasted SKILL.md URL with "one like this". |

Run `claude-skills list` to see this list with install status, or browse [`skills/`](./skills) directly.

## How Claude Code finds these skills

Claude Code looks for `SKILL.md` files in:

- `~/.claude/skills/<skill>/SKILL.md` — available in every session (global)
- `<project>/.claude/skills/<skill>/SKILL.md` — available only inside that project

This CLI just copies skill folders to one of those locations. Nothing magic.

## Commands

| Command | What it does |
|---|---|
| `claude-skills list` | List skills available in the library, marking which are installed |
| `claude-skills installed` | List skills currently installed |
| `claude-skills install` | Interactive multi-select picker |
| `claude-skills install <name>...` | Install one or more skills by name |
| `claude-skills install --all` | Install every skill in the library |
| `claude-skills remove <name>...` | Remove installed skill(s) |
| `claude-skills remove --all` | Remove every installed skill |

## Flags

- `-g, --global` — target `~/.claude/skills` (default)
- `-p, --project` — target `./.claude/skills`
- `-f, --force` — overwrite if already installed (interactive install always overwrites selected items)
- `-h, --help` / `-v, --version`

## Adding your own skills

The library lives in [`skills/`](./skills). Each skill is a directory containing a `SKILL.md` with YAML frontmatter.

```
skills/
├── _template/              # not installed (leading underscore skips it)
│   └── SKILL.md
├── conventional-commits/
│   └── SKILL.md
└── my-new-skill/
    ├── SKILL.md
    ├── references/         # optional supporting files
    └── scripts/            # optional executable helpers
```

### Minimal `SKILL.md`

```markdown
---
name: my-skill-name
description: One sentence describing what it does AND when to trigger it. Be specific about phrases the user might use.
---

# My Skill Name

Instructions for Claude...
```

The `description` is the most important field — it's what Claude reads to decide whether to consult the skill. Be explicit about trigger conditions; under-triggering is the more common failure mode.

To add a new skill:

1. Clone the repo: `git clone https://github.com/dennisrongo/claude-skills.git`
2. Copy `skills/_template/` to `skills/<your-skill-name>/`
3. Edit `SKILL.md`
4. Commit and push to `main`
5. On any machine: `npx github:dennisrongo/claude-skills install <your-skill-name>` — picks up the new skill immediately, no publishing step needed

> Tip: `npx` caches the package per version spec. If you push an update to `main` and the next `npx github:dennisrongo/claude-skills ...` call doesn't seem to pick it up, run `npx --yes ...` to force a refresh, or clear the cache with `npx clear-npx-cache`.

## Fine-tuning skills you've installed

Two patterns:

**Tune in-place, then upstream:**
Edit the file at `~/.claude/skills/<name>/SKILL.md` directly while you're iterating with Claude. Once it feels right, copy the edits back into this repo's `skills/<name>/SKILL.md` and commit.

**Tune in the repo, reinstall:**
Edit `skills/<name>/SKILL.md` in your clone, then run `npx github:dennisrongo/claude-skills install <name> --force` to push it to your install location.

**Pull upstream updates:**
When a skill in this library has been updated on `main` and you want the new version locally, force-reinstall with a cache-bust:

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

# claude-skills

A curated, fine-tunable library of [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) skills. Install globally or per-project with one command.

> Skills are reusable bundles of instructions that Claude consults when relevant. This repo is a personal/team library of them — grow it over time, tune the ones that misfire, and install the set you want on any machine.

## Quick start

Run directly from GitHub — no clone, no npm publish needed:

```bash
# See what's in the library
npx github:dennisrongo/claude-skills list

# Interactive picker (recommended first time)
npx github:dennisrongo/claude-skills install

# Install specific skills globally (~/.claude/skills)
npx github:dennisrongo/claude-skills install conventional-commits pr-review

# Install everything into the current project (./.claude/skills)
npx github:dennisrongo/claude-skills install --all --project
```

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

## Publishing to npm (optional)

If you eventually want the shorter `npx claude-skills` form (no `github:` prefix), publish to npm:

```bash
npm login
npm publish --access public
```

After publishing, both forms work:

```bash
npx claude-skills install                       # via npm
npx github:dennisrongo/claude-skills install    # still works, latest main
```

The package name `claude-skills` may already be taken on npm — check with `npm view claude-skills` first. If it is, rename in `package.json` (e.g., `@dennisrongo/claude-skills`) before publishing.

## License

MIT

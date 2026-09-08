# CLAUDE.md — working in this repo

This is a library of Claude Code skills (`skills/<name>/SKILL.md`) plus a small Node CLI (`bin/`, `lib/`) that installs them. The skills are the product; the CLI is plumbing.

## Commands

```bash
npm test                          # node --test test/cli.test.js test/skills.test.js — run before reporting any change done
node bin/claude-skills.js list    # what the CLI renders from skills/*/SKILL.md frontmatter
```

There is no build step and no linter. Formatting is by hand; match the surrounding file.

## Rules for skills

1. **Skills are independent.** A skill may reference another skill only if it lives in this repo's `skills/`, always as "if installed" with a complete inline fallback. Never reference, depend on, or credit third-party skill packs (superpowers, gsd, plugin skills). Grep `skills/` for external names before finishing. A skill that composes with several others (see `autopilot`) lists them in a routing table — one row per skill with an observable predicate, a probe command that decides present/absent, and the inline fallback — and its report carries a "Skills used" slot, so a present skill cannot be skipped silently: "if installed" alone was observed to let a weaker model take the fallback with the skill present.
2. **Frontmatter is real YAML.** `name:` equals the directory name. `description:` is at most 1024 characters and is written as a folded block scalar (`>-`) when it wraps; the CLI parser strips the indicator (`lib/skills.js`) and `test/skills.test.js` fails if one leaks. Validate with a real YAML parser when in doubt, not only `npm test`.
3. **Descriptions say what, never how.** Outcome and scope in the first sentence, then `Use this skill whenever the user says "…", "…", "…" — even if they don't name the skill`, then optional non-triggers naming the near-neighbor skill. No workflow steps in the description — a model that reads the steps skips the body. Three trigger phrases is the floor.
4. **Bodies are written for the weakest executing model.** Every load-bearing rule carries a ❌/✅ pair. Every assertion the skill asks for has an evidence gate. Report-producing skills state that zero findings is a valid outcome. Command-running skills state that an unobserved result is `not run`, never `passed`. Prefer a required slot in a template over a prose reminder, and a conditional on an observable predicate over a rule with exemptions.
5. **Keep `SKILL.md` near 150 lines**; long reference material goes to `skills/<name>/references/`. `_template/SKILL.template.md` at the repo root is the scaffold (it lives outside `skills/` on purpose so it is never published or installed).
6. **The `write-a-skill` skill is the authoring path.** It encodes the rules above, requires a baseline-versus-skill behavior test for discipline skills, and updates the README table. Use it rather than hand-writing.
7. **A skill change is not done until the docs match — standing rule.** Any edit under `skills/` (new skill, rename, removal, or a material change to what a skill does or how it composes with others) is finished only when, in the same change:
   - `README.md` is updated: the skill's row in the skills table (alphabetical, long-form voice, links to the skills it composes with), the "Which skill?" routing tables if the routing changed, and the "How the skills fit together" section plus `docs/skills-flow.svg` if the flow changed.
   - `CLAUDE.md` is updated if the change adds or alters a convention, a command, a file location, or the flow described here.
   - `npm test` passes — `test/skills.test.js` fails when a skill directory has no README row, so the row is enforced; the rest is on you. Before reporting done, re-read both files' affected sections and state what you updated.

## Rules for the CLI

- No new npm dependencies without a reason stated in the PR; the parser in `lib/skills.js` is deliberately hand-rolled.
- Behavior the README documents is a contract: `list`, `installed`, `install`, `remove`, the `-g/-p/-f` flags. Add a test in `test/cli.test.js` for any new flag or output.

## Git

- Commits are authored solely by Dennis Rongo. No `Co-Authored-By` trailers and no attribution to Claude.
- Do not commit, push, tag, or release unless asked. Releases follow the "Releasing" section of the README (`npm version`, push with tags, GitHub Release triggers npm publish).
- Working files created while running skills (`.claude/design-briefs/`, `.claude/goal-runner/`, `.claude/handoffs/`, `.claude/worktrees/`) are project scratch. Keep them out of commits unless deliberately promoting a brief to documentation.

## Evaluating a skill change

A skill edit is verified when a fresh sub-agent on a weaker model, given a real task in an isolated worktree, behaves differently with the skill loaded than without it, and the difference is the one the edit intended. Record what was observed. A skill you never watched change behavior is documentation.

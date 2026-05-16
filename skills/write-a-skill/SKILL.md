---
name: write-a-skill
description: Create a new Claude Code skill — scaffolds a properly-structured `SKILL.md` (with YAML frontmatter, trigger-rich description, workflow, examples, anti-patterns), drops it in the right location (this library's `skills/`, the project's `.claude/skills/`, or the global `~/.claude/skills/`), and — when adding to the `dennisrongo/claude-skills` library — also updates the README table. Use this skill whenever the user says "create a skill", "write a skill", "new skill", "add a skill", "make a skill", "/write-a-skill", or pastes a SKILL.md URL and asks for something similar — even if they don't explicitly say "skill author".
---

# Write a Skill

Author a new Claude Code skill that Claude will actually trigger when it should. The description field is the **only** thing Claude sees when deciding whether to load the skill, so most of the effort goes into making that field specific and trigger-rich — not into the body.

## Contract

**Inputs:** User request for a new skill, target location (library / project / global), trigger phrases, optional source URL to adapt from.
**Outputs:** New `SKILL.md` (and optional `scripts/`, `references/`); README skills-table row when targeting this library.
**Invokes:** `(none)`
**Invoked by:** User phrases — "create a skill", "write a skill", "new skill", "add a skill", "/write-a-skill", a pasted SKILL.md URL with "one like this".

## When to use this skill

- The user says any of: "create a skill", "write a skill", "new skill", "add a skill", "make a skill", "scaffold a skill", "/write-a-skill".
- The user pastes a URL to an existing `SKILL.md` (e.g. a GitHub link to someone else's skill) and asks for "one like this" / "similar to this" / "based on this".
- The user describes a recurring workflow ("every time I do X, I want you to Y") that should be packaged as a skill rather than dropped into `CLAUDE.md`.

Do **not** auto-trigger when the user is just *discussing* skills, asking how skills work in general, or editing an existing skill's body. Wait for an explicit author-a-new-skill cue.

## Detect the target location first

Before scaffolding anything, figure out where the new skill belongs. The CWD usually tells you:

| Signal | Target |
|---|---|
| CWD is the `dennisrongo/claude-skills` repo (has `bin/claude-skills.js` + `skills/_template/`) | `skills/<name>/SKILL.md` in this library — and update README table |
| CWD is some other project, user says "project skill" / "for this repo" | `./.claude/skills/<name>/SKILL.md` |
| User says "global" / "every project" / "all my sessions" | `~/.claude/skills/<name>/SKILL.md` |
| Ambiguous | Ask once with `AskUserQuestion` — don't guess |

If you're in the library repo, prefer that destination — the user can install it elsewhere later with `claude-skills install <name>`.

## Workflow

1. **Confirm the trigger.** Restate in one sentence what the skill is for and the phrases that should trigger it. Bail and ask if either is fuzzy.
2. **Gather requirements** with `AskUserQuestion` (one question at a time, max 3–4 total). Pull from this menu — skip ones already answered:
   - **Trigger phrases** — what does the user actually say when they want this? Collect 3+ concrete phrases / commands.
   - **Inputs** — does Claude need a file? A URL? Just a free-form description?
   - **Outputs** — files written, commands run, a structured response, a PR?
   - **Scripts / references** — does the skill need bundled executable helpers or long reference docs, or is plain `SKILL.md` enough?
   - **Anti-patterns** — what should Claude explicitly *not* do? (Most-overlooked input — ask for it.)
3. **Pick the name.** kebab-case, 2–4 words, matches what the user says. Use the leading-verb form when the skill *does* something (`write-a-skill`, `diagnose`, `handoff`); use the noun form when it *defines* something (`conventional-commits`, `pr-review`).
4. **Check for collisions.** `ls` the target skills directory. If a skill with the same name exists, stop and ask the user whether to overwrite, rename, or extend the existing one.
5. **Scaffold from `_template/`** if it exists in the destination, otherwise from the template embedded below. Create the parent directory if missing.
6. **Draft the SKILL.md** using the section structure in [Required structure](#required-structure). Write the description LAST — it depends on the body.
7. **Write the description carefully** — see [Writing the description](#writing-the-description). This is the single highest-leverage part of the file.
8. **Self-review** against the [Review checklist](#review-checklist) before showing the user.
9. **If targeting the library repo, update `README.md`** — add a row to the skills table in alphabetical order with a one-paragraph "what it does" hook matching the existing voice. Verify the row by re-reading the file after the edit.
10. **Report back**: skill path, the description verbatim, and the install command the user can run on other machines (`npx --yes github:dennisrongo/claude-skills install <name>` for library skills).

## Required structure

```markdown
---
name: <kebab-case-name>
description: <see "Writing the description">
# Optional visibility flags — see "Visibility flags" below for decision rules.
# disable-model-invocation: true
# user-invocable: false
---

# <Title Case Name>

<1–2 sentence elevator pitch — what this skill does and why it exists.>

## Contract

**Inputs:** <what the skill takes — user trigger phrase, target scope, args>
**Outputs:** <what it produces — report sections, file writes, side effects>
**Invokes:** <other skills this delegates to during its workflow, or `(none)`>
**Invoked by:** <skills that hand off here, plus the user phrases in `When to use`>

## When to use this skill

- <Concrete trigger phrase or condition>
- <Concrete trigger phrase or condition>
- <Concrete trigger phrase or condition>

<Optional: "Do **not** auto-trigger when …" — explicit non-triggers if the skill has near-neighbors.>

## Workflow

1. <Imperative step>
2. <Imperative step>
3. <Imperative step>

When the workflow delegates to another skill, announce the call inline so the topology is legible:

> Phase N — invoking `<skill-name>` with:
>   <arg>: <value>

On completion:

> `<skill-name>` returned: <one-line summary>.

## Examples

### Example 1: <scenario name>

**User:** "<exact phrasing>"

**Claude:** <what the ideal behavior looks like — 1–3 bullets, not a full transcript>

## Anti-patterns

- ❌ <Thing Claude would plausibly do that's wrong>
- ❌ <Thing Claude would plausibly do that's wrong>
- ✅ <The right thing, contrasted>

## Notes

<Caveats, edge cases, things that only matter occasionally. Optional.>
```

Skip sections that would be empty. Reorder only if there's a real reason. Keep the file under ~150 lines — split into `references/` if a section grows past that.

## Writing the description

The description is the **only** field Claude reads when deciding whether to consult the skill. Optimize it for that decision:

- **First sentence** — what the skill produces or does, named concretely (not "helps with X").
- **Second sentence** — `Use this skill whenever the user says "<phrase 1>", "<phrase 2>", "<phrase 3>", … — even if they don't explicitly say "<skill name>".`
- **Third sentence (optional)** — explicit non-triggers if there's a near-neighbor skill it could be confused with.
- **Length** — max 1024 chars. Use the budget for trigger phrases, not adjectives.
- **Voice** — third person, present tense.

**Good:**

> Capture a session hand-off so work can resume cleanly in a new Claude session before context runs out. Writes a canonical dated Markdown file (objective, progress, decisions, files, open issues, and a ready-to-paste "Next Session Prompt") AND a lightweight project-memory pointer to it. Use this skill whenever the user says "/handoff", "hand off", "handoff", "save context", "preserve context", "running out of context", …

**Bad:**

> Helps the user create handoffs.

(The bad one tells Claude nothing about *when* — it'll under-trigger and the skill effectively doesn't exist.)

The most common failure mode is **under-triggering** (Claude doesn't load the skill when it should). Err on the side of *more* trigger phrases — three is the floor, not the ceiling.

## Visibility flags

Two optional frontmatter keys control how Claude and users discover the skill. Default behavior — both flags absent — is "Claude can auto-invoke, user can run from `/menu`". Add a flag only when the default is wrong.

### `disable-model-invocation: true`

Set when the skill has **destructive external side effects** the user must consciously authorize each time. The image-prompt audit calls out three: **deploy**, **git commit**, **send messages** (Slack, email, webhooks). Anything that touches a system Claude can't easily undo qualifies.

Decision rule (strict):

- ✅ Set it when the skill executes `git commit` / `git push`, deploys an artifact, sends a message via an MCP server, or POSTs to a third party.
- ❌ Don't set it just because the skill writes files. Local file writes are reversible (revert, undo). Setting this flag too aggressively nerfs auto-invocation and pushes the skill toward shelfware.

### `user-invocable: false`

Set on **service skills** — skills that exist only to be invoked by other skills, never by the user directly. Hides them from `/menu` so users don't trip over internal machinery (e.g. a shared lens-council or stack-detector).

Decision rule:

- ✅ Set it on service / utility skills whose value is composition, not standalone use (e.g. anything other skills `Invokes:`).
- ❌ Don't set it on a normal user-facing skill, even an obscure one. If the user might ever type `/<name>`, leave the flag absent.

## When to add scripts or reference files

Default to a single `SKILL.md`. Only escalate when:

- **Scripts** (`scripts/*.{js,sh,py}`) — the operation is deterministic and Claude would otherwise regenerate the same code each call (validators, formatters, scaffolders). Scripts save tokens and improve reliability.
- **References** (`references/*.md`) — long lookup tables, exhaustive option lists, or domain glossaries that Claude only needs occasionally. Link from `SKILL.md` rather than inlining.

If you do add either, mention them by relative path from the `SKILL.md` body so Claude knows they exist.

## Review checklist

Before showing the draft to the user:

- [ ] `name:` matches the directory name exactly
- [ ] `description:` starts with what the skill does, then "Use this skill whenever the user says …"
- [ ] Description includes ≥ 3 concrete trigger phrases / commands
- [ ] Description ends with "— even if they don't explicitly say …" escape hatch
- [ ] `## Contract` section present with `Inputs / Outputs / Invokes / Invoked by`
- [ ] Visibility flags applied per the decision rules — `disable-model-invocation: true` only for destructive external side effects; `user-invocable: false` only for service skills
- [ ] If `Invokes:` is non-empty, the workflow announces each delegation with the `> Phase N — invoking <name>` format
- [ ] `## When to use this skill` lists the same triggers as bullets (so the body reinforces the description)
- [ ] Workflow steps are imperative and verifiable, not vibes ("Verify X exists", not "Be careful")
- [ ] At least one concrete example
- [ ] Anti-patterns section names plausible wrong behaviors, not strawmen
- [ ] No time-sensitive info (specific dates, "as of 2026", model version numbers) unless load-bearing
- [ ] File is under ~150 lines; longer content is split into `references/`
- [ ] If targeting the library repo, README table row is added in alphabetical order

## Examples

### Example 1: Library skill from scratch

**User:** "/write-a-skill — I want one that runs eslint --fix and stages the changes whenever I say 'lint this'"

**Claude:**
1. Confirms the trigger phrases ("lint this", "fix lint", "/lint-and-stage") via `AskUserQuestion`.
2. Names it `lint-and-stage`, scaffolds `skills/lint-and-stage/SKILL.md` from `_template/`.
3. Fills in the workflow (run `eslint --fix`, run `git add -u`, summarize changed files).
4. Writes a description with all three trigger phrases.
5. Adds a row to `README.md` skills table.
6. Reports the path and the install command.

### Example 2: "One like this" from a pasted URL

**User:** "Create a skill like https://github.com/mattpocock/skills/blob/main/skills/productivity/write-a-skill/SKILL.md but for our repo"

**Claude:**
1. Fetches the URL, reads the source skill.
2. Identifies what to keep (process, description requirements, checklist) and what to adapt (directory structure, README updates, this repo's voice).
3. Scaffolds the adapted version, gets user sign-off, writes the file.

### Example 3: Project-scoped skill

**User:** "Add a skill just for this repo that reminds me to run `pnpm changeset` before any feat/fix commit"

**Claude:**
1. Detects CWD is not the library repo → targets `./.claude/skills/changeset-reminder/SKILL.md`.
2. Creates `.claude/skills/` if missing.
3. Drafts a tiny skill keyed on `git commit` / "commit" triggers that checks for a changeset file and warns if missing.
4. Does **not** touch the library README.

## Anti-patterns

- ❌ Writing a vague description like "Helps with commits." — Claude won't trigger it. Always include explicit trigger phrases.
- ❌ Inventing trigger phrases the user didn't confirm — ask, don't guess.
- ❌ Padding `SKILL.md` with motivational prose. Every line should change Claude's behavior; if removing it changes nothing, cut it.
- ❌ Hard-coding model names, package versions, or dates that will rot. Resolve at runtime when possible.
- ❌ Putting executable behavior in `SKILL.md` prose when a 10-line script would be deterministic and cheaper.
- ❌ For library skills: drafting the SKILL.md but forgetting to update the README table — the skill is invisible to anyone browsing the repo.
- ❌ Overwriting an existing skill without confirmation when the names collide.
- ✅ Trigger-rich description, imperative workflow, one concrete example, explicit anti-patterns, under 150 lines.

## Notes

- The library repo's `_template/SKILL.md` is the canonical starting point when working inside `dennisrongo/claude-skills`. The `_` prefix excludes it from installation, so it's safe to leave as-is.
- When adapting a skill from an external source (e.g. another GitHub repo), credit the inspiration in a `## Notes` line — don't copy verbatim if the voice doesn't match this repo's existing skills.
- Skills installed to `~/.claude/skills/` are picked up by every Claude Code session globally; `.claude/skills/` in a project is scoped to that repo. The library repo's `skills/<name>/` is the *source* — not where Claude reads from at runtime.

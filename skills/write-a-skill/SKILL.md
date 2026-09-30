---
name: write-a-skill
description: Create a new Claude Code skill — scaffolds a properly-structured `SKILL.md` (with YAML frontmatter, trigger-rich description, workflow, examples, anti-patterns), drops it in the right location (this library's `skills/`, the project's `.claude/skills/`, or the global `~/.claude/skills/`), and — when adding to the `dennisrongo/claude-skills` library — also updates the README table. Use this skill whenever the user says "create a skill", "write a skill", "new skill", "add a skill", "make a skill", "/write-a-skill", or pastes a SKILL.md URL and asks for something similar — even if they don't explicitly say "skill author".
---

# Write a Skill

Author a new Claude Code skill that Claude will actually trigger when it should. The description field is the **only** thing Claude sees when deciding whether to load the skill, so most of the effort goes into making that field specific and trigger-rich — not into the body.

## When to use this skill

- The user says any of: "create a skill", "write a skill", "new skill", "add a skill", "make a skill", "scaffold a skill", "/write-a-skill".
- The user pastes a URL to an existing `SKILL.md` (e.g. a GitHub link to someone else's skill) and asks for "one like this" / "similar to this" / "based on this".
- The user describes a recurring workflow ("every time I do X, I want you to Y") that should be packaged as a skill rather than dropped into `CLAUDE.md`.

Do **not** auto-trigger when the user is just *discussing* skills, asking how skills work in general, or editing an existing skill's body. Wait for an explicit author-a-new-skill cue.

## Detect the target location first

Before scaffolding anything, figure out where the new skill belongs. The CWD usually tells you:

| Signal | Target |
| --- | --- |
| CWD is the `dennisrongo/claude-skills` repo (has `bin/claude-skills.js` + `skills/_template/`) | `skills/<name>/SKILL.md` in this library — and update README table |
| CWD is some other project, user says "project skill" / "for this repo" | `./.claude/skills/<name>/SKILL.md` |
| User says "global" / "every project" / "all my sessions" | `~/.claude/skills/<name>/SKILL.md` |
| Ambiguous | Ask once with `AskUserQuestion` — don't guess |

If you're in the library repo, prefer that destination — the user can install it elsewhere later with `claude-skills install <name>`.

## Workflow

1. **Confirm the trigger — and that a skill is the right tool.** Restate in one sentence what the skill is for and the phrases that should trigger it. Bail and ask if either is fuzzy. Don't write a skill for: a one-off solution; a project-specific convention (belongs in `CLAUDE.md`/`AGENTS.md`); or a mechanical constraint a linter, hook, or validation script could enforce (automate it — save prose for judgment calls).
   - **Baseline the failure first (discipline skills).** If the skill exists to stop a behavior ("always X before Y", "never Z"), run the tempting scenario in a fresh sub-agent *without* the skill and capture what it does and the rationalization it uses, verbatim. That transcript is the spec: the skill addresses *those* rationalizations. No baseline failure → there's nothing to fix; don't write the skill.
2. **Gather requirements** with `AskUserQuestion` (one question at a time, max 3–4 total). Pull from this menu — skip ones already answered:
   - **Trigger phrases** — what does the user actually say when they want this? Collect 3+ concrete phrases / commands.
   - **Inputs** — does Claude need a file? A URL? Just a free-form description?
   - **Outputs** — files written, commands run, a structured response, a PR?
   - **Scripts / references** — does the skill need bundled executable helpers or long reference docs, or is plain `SKILL.md` enough?
   - **Anti-patterns** — what should Claude explicitly *not* do? (Most-overlooked input — ask for it.)
3. **Pick the name.** kebab-case, 2–4 words, matches what the user says. Use the leading-verb form when the skill *does* something (`write-a-skill`, `diagnose`, `handoff`); use the noun form when it *defines* something (`conventional-commits`, `model-inventory`).
4. **Check for collisions.** `ls` the target skills directory. If a skill with the same name exists, stop and ask the user whether to overwrite, rename, or extend the existing one.
5. **Scaffold from `_template/`** if it exists in the destination, otherwise from the template embedded below. Create the parent directory if missing.
6. **Draft the SKILL.md** using the section structure in [Required structure](#required-structure). Write the description LAST — it depends on the body. **Match the form to the failure** you're fixing:

   | Baseline failure | Right form | Wrong form |
   | --- | --- | --- |
   | Knows the rule, skips it under pressure | Prohibition + rationalization table ("Excuse → Reality") + red-flags list | Soft guidance ("prefer…", "consider…") |
   | Complies, but output has the wrong shape (bloated, buried verdict) | A recipe/contract stating what the output IS — its parts, in order | A list of "don't"s (agents negotiate with prohibitions under competing incentives) |
   | Omits a required element from something it already produces | A REQUIRED slot in the template it fills in | A prose reminder near the template |
   | Behavior should depend on a condition | A conditional keyed to an observable predicate ("if `X.md` exists, …") | An unconditional rule plus exemption clauses |

   No nuance clauses ("don't X unless it matters" reopens the negotiation) — express a real exception as its own conditional on something observable.
7. **Write the description carefully** — see [Writing the description](#writing-the-description). This is the single highest-leverage part of the file.
8. **Self-review** against the [Review checklist](#review-checklist) before showing the user.
   - **Prove it works (discipline and technique skills).** Re-run the baseline scenario from step 1 in a fresh sub-agent *with* the skill loaded. Complies → done. Finds a new rationalization → add its counter to the table and re-run. A skill you never watched change behavior is documentation, not a skill. Reference-only skills skip this; test retrieval instead (can a fresh agent find the right entry?).
9. **Leave out anything sensitive — before the file is saved, not before the push.** A skill drafted against real work absorbs the details around it. Check each class and remove it: credentials, tokens and connection strings; personal data (names, email addresses, usernames, and paths that carry them); internal infrastructure (hostnames, IP ranges, database / service / repo names); organization and client names; ticket numbers; and real record or customer IDs. A shared library is a publishing surface, and git history keeps what a later edit removes. Replace with placeholders — `<org>`, `example.invalid` or `example.com` for domains, an address from the documentation range (`203.0.113.x`) rather than a private one, `<repo>`, `~/projects/<name>` — and prefer an invented example to a sanitized real one — a redacted real case still leaks its shape. The rule: **a skill should read as if anyone could have written it, anywhere.**
   - ❌ `Run the check against 203.0.113.5 with the svc_deploy token before the #4821 rollout — Dana owns that box.` — host, credential, ticket and a person, none of which help a reader.
   - ✅ `Run the check against your dev host with a deploy credential before a risky rollout.` — same instruction, nothing private.
10. **If targeting the library repo, update `README.md`** — add a row to the skills table in alphabetical order with a one-paragraph "what it does" hook matching the existing voice. Verify the row by re-reading the file after the edit.
11. **Report back**: skill path, the description verbatim, and the install command the user can run on other machines (`npx --yes github:dennisrongo/claude-skills install <name>` for library skills).

## Required structure

```markdown
---
name: <kebab-case-name>
description: <see "Writing the description">
---

# <Title Case Name>

<1–2 sentence elevator pitch — what this skill does and why it exists.>

## When to use this skill

- <Concrete trigger phrase or condition>
- <Concrete trigger phrase or condition>
- <Concrete trigger phrase or condition>

<Optional: "Do **not** auto-trigger when …" — explicit non-triggers if the skill has near-neighbors.>

## Workflow

1. <Imperative step>
2. <Imperative step>
3. <Imperative step>

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

- **First sentence** — what the skill produces or does, named concretely (not "helps with X"). **One sentence of *what*, never the *how*.** A description that summarizes the workflow ("runs X, then Y, then reviews Z") becomes a shortcut: the model follows the description and skips the body, so the two-stage step the body carefully specifies runs once. Name the outcome and the scope; leave every process step to the body.
  - ❌ `Executes plans — dispatches a sub-agent per task with a code review between tasks.` (a model reading this does one review and never opens the skill)
  - ✅ `Executes a written implementation plan task-by-task with fresh sub-agents.` (outcome + scope; the review protocol lives in the body)
- **Second sentence** — `Use this skill whenever the user says "<phrase 1>", "<phrase 2>", "<phrase 3>", … — even if they don't explicitly say "<skill name>".` Include *symptoms* as well as commands ("flaky", "hanging", "is this a breaking change") — the model searches by problem, not by skill name.
- **Third sentence (optional)** — explicit non-triggers if there's a near-neighbor skill it could be confused with.
- **Length** — max 1024 chars. Use the budget for trigger phrases, not adjectives or steps.
- **Voice** — third person, present tense.

**Good:**

> Capture a session hand-off so work can resume cleanly in a new Claude session before context runs out. Writes a canonical dated Markdown file (objective, progress, decisions, files, open issues, and a ready-to-paste "Next Session Prompt") AND a lightweight project-memory pointer to it. Use this skill whenever the user says "/handoff", "hand off", "handoff", "save context", "preserve context", "running out of context", …

**Bad:**

> Helps the user create handoffs.

(The bad one tells Claude nothing about *when* — it'll under-trigger and the skill effectively doesn't exist.)

The most common failure mode is **under-triggering** (Claude doesn't load the skill when it should). Err on the side of *more* trigger phrases — three is the floor, not the ceiling.

## Write for the weakest reader

The skill will be executed by whatever model loads it — often a smaller one. A top-tier model fills gaps with judgment; a weak one fills them with confident garbage. Encode the judgment explicitly. Preempt these predictable failure modes:

1. **Ungrounded claims.** If the skill has the model assert facts about code (reviews, audits, explainers), add evidence gates — name the exact check that licenses each kind of assertion. Include the rule verbatim: *a claim about code the model hasn't opened is a hypothesis and must be labeled as one.*
   - ❌ "Flag unused exports." — the model flags whatever it doesn't recognize.
   - ✅ "Flag an export as unused only after a repo-wide grep for its name returns no callers outside its own file. Read the whole function before judging it, not just the diff hunk."
2. **Severity inflation / padding.** Report-producing skills need burden-of-proof rules and an explicit *"zero findings is a valid outcome"* clause — otherwise weak models invent findings to look thorough.
   - ❌ "Be rigorous about severity." — everything still gets marked critical.
   - ✅ "A `blocker` must name a concrete failure scenario in one sentence (`user does X → wrong Y`). No scenario → demote to `suggestion`. Zero blockers is a valid result."
3. **Confabulated success.** Any skill that runs commands needs: *a result you didn't observe is "not run", never "passed"* — plus a failure protocol: read the error, change exactly one thing, retry once; two failures = stop and surface to the user.
   - ❌ "Run the tests and fix any failures." — the model may report "tests pass" without running them.
   - ✅ "Run the test command and quote its summary line in your report. If you did not run it, write `tests: not run`."
4. **Contrastive examples beat rules.** Weak models imitate examples more than they follow rules. Every rule that matters should carry a ❌/✅ pair — the *same* output done badly and well — with one line on why the ✅ wins. A rule without an example is a suggestion.
5. **Forking questions.** Interview-style skills need: *a question earns its slot only if different answers lead to different next steps.*
   - ❌ "Should this be robust and user-friendly?" — every answer leads to the same next step; it's filler.
   - ✅ "Postgres or SQLite?" — each answer changes the migration step that follows.
6. **Re-anchoring.** Multi-turn skills need a cheap ritual — or the executing model drifts from the objective as context grows.
   - ❌ A 9-step workflow with no checkpoint — by step 6 the model is optimizing the wrong thing.
   - ✅ "Before each step, restate the goal in one line. If the step doesn't serve it, stop."
7. **Context budget.** Every line of the skill is loaded into the executing model's window. Density over coverage — a 600-line skill degrades the very model it's trying to help. Cut before you split; split into `references/` before you exceed ~150 lines.

When reviewing a draft, simulate the weakest reader: for each instruction ask "could this be followed *wrong* while technically complying?" If yes, tighten it with a check, a threshold, or an example.

## When to add scripts or reference files

Default to a single `SKILL.md`. Only escalate when:

- **Scripts** (`scripts/*.{js,sh,py}`) — the operation is deterministic and Claude would otherwise regenerate the same code each call (validators, formatters, scaffolders). Scripts save tokens and improve reliability.
- **References** (`references/*.md`) — long lookup tables, exhaustive option lists, or domain glossaries that Claude only needs occasionally. Link from `SKILL.md` rather than inlining.

If you do add either, mention them by relative path from the `SKILL.md` body so Claude knows they exist.

## Review checklist

Before showing the draft to the user:

- [ ] `name:` matches the directory name exactly
- [ ] `description:` starts with what the skill does (outcome + scope, **no workflow steps**), then "Use this skill whenever the user says …"
- [ ] Discipline skill: baseline failure observed without the skill; compliance observed with it; rationalization table + red-flags list present
- [ ] Guidance form matches the failure type (prohibition / recipe / required slot / conditional)
- [ ] Description includes ≥ 3 concrete trigger phrases / commands
- [ ] Description ends with "— even if they don't explicitly say …" escape hatch
- [ ] `## When to use this skill` lists the same triggers as bullets (so the body reinforces the description)
- [ ] Workflow steps are imperative and verifiable, not vibes ("Verify X exists", not "Be careful")
- [ ] At least one concrete example
- [ ] Anti-patterns section names plausible wrong behaviors, not strawmen
- [ ] Each rule that matters carries a ❌/✅ pair of the same output done badly and well
- [ ] Each assertion the skill asks the model to make has an evidence gate — the exact check that licenses it
- [ ] Report-producing skills state "zero findings is a valid outcome"; command-running skills state "a result you didn't observe is 'not run', never 'passed'"
- [ ] No time-sensitive info (specific dates, "as of 2026", model version numbers) unless load-bearing
- [ ] File is under ~150 lines; longer content is split into `references/`
- [ ] Nothing sensitive survives — credentials or tokens, personal data (names, emails, usernames, paths carrying them), internal hosts or IP ranges, real repo/system/database names, organization or client names, ticket numbers, record IDs. It reads as if anyone could have written it, anywhere
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

**User:** "Create a skill like <https://github.com/mattpocock/skills/blob/main/skills/productivity/write-a-skill/SKILL.md> but for our repo"

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
- ❌ Summarizing the workflow in the description — the model follows the summary and never reads the body.
- ❌ Shipping a discipline skill without watching an agent fail without it and comply with it — you don't know what it teaches.
- ❌ Fixing a wrong-shaped output with a list of "don't"s — state what the output IS instead.
- ❌ Inventing trigger phrases the user didn't confirm — ask, don't guess.
- ❌ Padding `SKILL.md` with motivational prose. Every line should change Claude's behavior; if removing it changes nothing, cut it.
- ❌ Delegating judgment to the executing model ("use discretion", "be careful", "apply good judgment") — name the check, the threshold, and the fallback instead.
- ❌ Stating a load-bearing rule without a ❌/✅ pair — weak models imitate examples, not prose.
- ❌ Hard-coding model names, package versions, or dates that will rot. Resolve at runtime when possible.
- ❌ Putting executable behavior in `SKILL.md` prose when a 10-line script would be deterministic and cheaper.
- ❌ For library skills: drafting the SKILL.md but forgetting to update the README table — the skill is invisible to anyone browsing the repo.
- ❌ Overwriting an existing skill without confirmation when the names collide.
- ✅ Trigger-rich description, imperative workflow, one concrete example, explicit anti-patterns, under 150 lines.

## Notes

- The library repo's `_template/SKILL.template.md` is the canonical starting point when working inside `dennisrongo/claude-skills`. It lives outside `skills/` (so `clawhub sync` can't publish it and the installer can't pick it up) — copy it in as `skills/<name>/SKILL.md`.
- When adapting a skill from an external source (e.g. another GitHub repo), credit the inspiration in a `## Notes` line — don't copy verbatim if the voice doesn't match this repo's existing skills.
- Skills installed to `~/.claude/skills/` are picked up by every Claude Code session globally; `.claude/skills/` in a project is scoped to that repo. The library repo's `skills/<name>/` is the *source* — not where Claude reads from at runtime.

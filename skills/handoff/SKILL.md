---
name: handoff
description: Capture a session hand-off so work can resume cleanly in a new Claude session before context runs out. Writes a canonical dated Markdown file (objective, progress, decisions, files, open issues, and a ready-to-paste "Next Session Prompt") AND a lightweight project-memory pointer to it. Use this skill whenever the user says "/handoff", "hand off", "handoff", "save context", "preserve context", "running out of context", "wrap up for next session", "before we lose context", or otherwise asks to snapshot the current state for a fresh session — even if they don't say "skill".
---

# Handoff

Preserve everything the next Claude session needs to pick up where this one left off. The hand-off is a real artifact (a Markdown file in the repo) plus a small memory pointer so future sessions auto-discover it.

## When to use this skill

- The user runs `/handoff` or types "handoff" / "hand off".
- The user says any of: "save context", "preserve context", "running out of context", "before we lose context", "wrap up for next session", "snapshot where we are", "I need to start a new session".
- The user signals they're about to compact, switch machines, or hand the work to another teammate / another Claude session.
- You notice the conversation has accumulated significant state (many files touched, several decisions made) and the user explicitly asks to checkpoint.

Do **not** auto-trigger when the user just says "let's stop here" without asking for continuity. Wait for an explicit hand-off cue.

## Output: two artifacts

Every invocation produces BOTH:

### 1. Canonical Markdown file (the source of truth)

- **Path:** `.claude/handoffs/<YYYY-MM-DD>-<short-slug>.md` in the current project root.
  - Date is today's date, ISO format.
  - Slug is 2–4 kebab-case words describing the work (e.g. `oauth-account-linking`, `cache-invalidation-fix`).
  - If a file with that exact name already exists, append `-2`, `-3`, etc.
- **Create the parent directory if missing** (`.claude/handoffs/`).
- Use the exact section structure below.

### 2. Lightweight memory pointer (for future-session discovery)

Write a **project**-type memory entry per the auto-memory system. Keep it short — its only job is to surface the hand-off file:

```markdown
---
name: handoff-<short-slug>
description: Hand-off doc for <one-line topic> — see file for full state.
metadata:
  type: project
---

Active hand-off for <topic> at `<relative path to handoff file>`.

**Why:** Session was checkpointed on <YYYY-MM-DD> to resume work cleanly in a new context.
**How to apply:** When the user opens a new session and references this topic, read the hand-off file first before doing anything else. Remove this memory entry once the work is finished or superseded.
```

Then add the standard one-line pointer to `MEMORY.md`.

## Required sections in the hand-off file

Use these headings in this order, with this phrasing. Skip a section only if it would be empty AND irrelevant — don't pad.

```markdown
# Handoff: <topic> — <YYYY-MM-DD>

## Objective

<1–3 sentences: what are we building / fixing / investigating, and why.>

## Progress

**Completed:**
- <done item>
- <done item>

**In Progress:**
- <what's mid-flight, with enough context to resume>

**Blocked:**
- <blocker> — <on whom / what>

## Decisions

- <decision> — <why; the reasoning matters more than the choice>
- <decision> — <why>

## Important Files

- `<path>` — <one line on what changed or why it matters>
- `<path>` — <one line>

## Open Issues

- <unresolved bug, race condition, or question>
- <unresolved bug, race condition, or question>

## Next Session Prompt

> Copy-paste this into the new session.

Read `.claude/handoffs/<this-filename>.md` first.

**Goal:** <one-sentence resume goal>

**Start by reviewing:**
1. `<path>`
2. `<path>`

**Then:**
- <next concrete step>
- <next concrete step>
- <verification command, e.g. `pnpm test auth`>
```

The **Next Session Prompt** is the most important section — it's what the user pastes into the new chat to bootstrap continuity. Write it so a fresh Claude with no prior context can act on it immediately.

A prompt that survives a fresh session vs. one that doesn't:

- ❌ "**Goal:** Continue working on auth. **Then:** finish the remaining fixes." — which file? what's broken? what command shows it? Every answer lives in the dead session.
- ✅ "**Goal:** Make `linkAccount` merge OAuth identities instead of erroring. **Start by reviewing:** `src/auth/link.ts` (the `linkAccount` stub at line 42), `src/auth/__tests__/link.test.ts`. **Then:** implement the merge branch for the `existing-verified-email` case; run `pnpm vitest run src/auth -t linkAccount` — currently failing with `Error: account already exists`." — names the file, the failing test, the exact command, and the next action.

## Workflow

1. **Scan the current conversation** for: the stated objective, files you've read or edited, decisions made (and the reasoning), commands run, errors hit, and open threads.
2. **Cross-check against the repo state** — run `git status` and `git diff --stat` to confirm which files actually changed in this session. Don't trust memory alone; verify.
3. **Draft the file content** using the section template above. Pull the *why* behind each decision from the conversation, not just the *what*.
4. **Pick the filename** — today's date + short slug.
5. **Create `.claude/handoffs/` if missing**, then write the file with the Write tool.
6. **Write the memory pointer** to the auto-memory directory and index it in `MEMORY.md`.
7. **Run the zero-context self-test.** Re-read the Next Session Prompt as if you knew nothing about this conversation: does it name the exact files, the exact command to run, the current failing state, and the immediate next action? If answering any of those requires this conversation, the hand-off is not done — fix it before reporting.
8. **Report back**: tell the user the file path, the slug, and quote the Next Session Prompt so they can copy it without opening the file.

## Verifying before you write

- If you reference a file path, confirm it exists (or that you created it this session).
- If you reference a command, make sure it's the one that actually works in this repo (check `package.json`, `Makefile`, etc.).
- If a decision in the conversation was reversed later, record the final decision — not the abandoned one.
- **Exact artifacts, never paraphrases.** Commands verbatim and runnable (`pnpm vitest run src/auth -t linkAccount`, not "run the auth tests"). Failing test names copied from actual runner output. Branch name from `git branch --show-current`. Uncommitted-state description from actual `git status` output — never from memory of what you think you edited.
- If tests were failing when work stopped, re-run them now and quote the exact failure. "Some tests failing" forces the next session to rediscover which — that's the context loss this skill exists to prevent.

## Examples

### Example 1: Mid-feature checkpoint

**User:** "ok let's handoff, I'm running low on context"

**Claude:**
1. Runs `git status`, scans recent edits.
2. Writes `.claude/handoffs/2026-05-15-oauth-account-linking.md` with all six sections filled in.
3. Writes memory pointer `handoff-oauth-account-linking.md` and updates `MEMORY.md`.
4. Replies with: file path, a one-line summary, and the Next Session Prompt block ready to paste.

### Example 2: User pastes the Next Session Prompt into a fresh chat

The new session reads the referenced hand-off file first, confirms files still exist, and resumes from the **Next Session Prompt** to-do list — no rediscovery needed.

## Anti-patterns

- Writing the hand-off without checking `git status` — drift between conversation memory and actual repo state.
- Vague "next steps" like "continue the work" — write concrete actions tied to specific files.
- Recording every micro-decision — keep **Decisions** to choices that would be re-litigated otherwise.
- Dumping the entire conversation transcript — hand-off is a synthesis, not a log.
- Forgetting the memory pointer — without it, the next session won't know the hand-off exists unless the user remembers to paste the prompt.
- Skipping the **Next Session Prompt** section — that's the single highest-value piece of the doc.
- Quoting commands, test names, or branch names from memory instead of from actual output. `git status`, `git branch --show-current`, and the test runner are the sources of truth.
- Shipping a Next Session Prompt that fails the zero-context self-test — if understanding any part of it requires this conversation, it's a summary, not a hand-off.

## Notes

- Hand-off files are project-scoped and **should be git-ignored or committed deliberately** — they may contain in-progress reasoning the team doesn't want in history. Add `.claude/handoffs/` to `.gitignore` unless the project has explicitly opted in to committing them.
- Once a hand-off is superseded (work finished, or a newer hand-off written for the same topic), delete the memory pointer so it doesn't accumulate stale entries. The Markdown file can stay as historical record.
- If the project already has a different conventional location for session notes (e.g. `docs/handoffs/`, `NOTES.md`), prefer that location and tell the user you're using it.

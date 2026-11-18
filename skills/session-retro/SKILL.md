---
name: session-retro
description: >-
  Closes out a session with a sanitized retrospective: a short summary of the
  thread, an inventory of the skills that were used and how each is installed,
  and proposed skill improvements that wait for approval before any file is
  touched. Can also install opt-in session hooks so the next session offers a
  retro for the last one. Use this skill whenever the user says "/session-retro",
  "session retro", "wrap up the session", "end of session review", "what did we
  learn this session", "should any skill be updated", "install the retro hooks",
  or when a session-start notice says a retro is pending - even if they don't
  name the skill. Not for saving context to continue in a fresh session
  (handoff) and not for reviewing code.
---

# Session Retro

Skills only improve if lessons leave the transcript. This skill turns what a session taught into small, approved skill edits, and keeps anything private out of the text it shows or writes.

`RETRO` below means `node "<base directory>/scripts/retro.mjs"` (Node 20+, no packages), where the base directory is the one shown when this skill was loaded. Quote the path. State lives in `~/.claude/session-retro-pending/` (or under `CLAUDE_CONFIG_DIR`); nothing is written into a repo.

## When to use this skill

- "/session-retro", "wrap up the session", "end of session review", "what did we learn", "should any skill be updated"
- A session-start notice says a retro is pending for an earlier session
- "install the retro hooks" or "offer a retro when a session ends" (see Hooks)
- Not for carrying work into a fresh session (`handoff`); not for code review

Never run it unprompted mid-task. Never edit a skill before the user approves a row in step 7.

## Workflow

1. **Pick the session.** Same session: `RETRO inventory` and `RETRO digest` read the newest transcript for the current directory. Earlier session: `RETRO pending` lists markers; pass the chosen `transcriptPath` as `--transcript <file>`. A command that errored or was not run is reported as `inventory: not run`, never guessed.
2. **Read the digest, not the transcript.** `RETRO digest` prints user and assistant prose and tool names only, with emails, IPs and the home folder masked. Tool output is where query rows, record contents and credentials live, so never open the `.jsonl` directly.
3. **Summarize** in at most 8 lines: what was asked, decided, changed, unfinished. Each line is a fact from the digest; anything inferred is marked `(inferred)`.
4. **Classify every skill used** from the `inventory` output, one row each:

   | `kind` | Meaning | Where an edit goes |
   | --- | --- | --- |
   | `plugin-installed` | Copy in the plugin cache | The marketplace `source` printed for it, then that repo's own update loop. Editing the cache is overwritten on the next update |
   | `junctioned` | Link to a source directory | The `target` path, edited in place, then committed in that repo |
   | `standalone-copy` | Real directory, no link | Flag it as drifting from its source and offer to replace it with a link; never edit it as if it were the source |
   | `not-found` | Not in user skills, project skills or the plugin cache | Built in, removed, or scoped elsewhere. Propose nothing |

5. **Reflect, then propose.** A proposal exists only if you can cite the digest moment that motivated it. No moment, no proposal. Zero proposals is a valid result: write "No skill changes warranted" and stop. Valid reasons: the skill gave a wrong or stale instruction, lacked a step the session needed, its trigger missed or misfired, or it was skipped when it should have run.

   | Skill | Link type | Cited moment | Proposed edit | Future benefit |
   | --- | --- | --- | --- | --- |

6. **Sanitize before anything is shown or written.** Cited moments and proposed text are generic: replace person names, ids, ticket and PR numbers, usernames, emails, machine paths, hostnames, IPs, repo and database names, and any data values with placeholders (`<user>`, `<ticket>`, `<repo>`, `<host>`). Describe the failure mode, not the incident. Invent the example; a redacted real case still leaks its shape.
7. **Stop and wait.** Show the summary, the inventory and the table, and ask which rows to apply. Apply only approved rows. Commit, push or post nowhere unless the user says so.
8. **Verify each applied edit.** Re-read the edited file and quote the changed lines. For a plugin source edit also confirm the version bump and that the new cache directory holds the change. An edit you did not read back is `not done`.
9. **Close the marker.** When the user is finished with an earlier session's retro, run `RETRO clear --session <id>`.

## Sanitizing: the same proposal, badly and well

- ❌ `Step 4 failed on ticket <ticket> in <repo> when <host> returned rows for <user>.` (each placeholder stands for a real identifier that must never be written out)
- ✅ `Step 4 assumes the database is reachable; when the host is down the skill loops. Add a stop-and-ask after one failed connect.`

The ✅ keeps the lesson and drops every identifier. A lesson that cannot be stated without one is not ready for a shared skill.

## Hooks (opt-in)

A session cannot ask anything when it ends, so the hooks work in two steps. `SessionEnd` runs `hook-end`, which writes a marker (skill names, install types, counts, transcript path, never conversation text) when the session used a skill or had at least 8 of your messages (`SESSION_RETRO_MIN_TURNS` changes the 8). `SessionStart` runs `hook-start`, which tells Claude once, in one line, that a retro is pending; it stays silent after `compact`. Markers older than 14 days are pruned. Neither hook runs a model or asks anything.

Install only when the user asks:

1. Run `RETRO install-hooks`. It is a dry run: it prints the settings file and the entries it would add. Show that output.
2. On the user's yes, run `RETRO install-hooks --apply`. It backs up the file, writes it, and reads it back (`read-back: verified`). Any other read-back result is a failure; say so.
3. `--scope project` targets `.claude/settings.local.json` in the current directory instead of `~/.claude/settings.json`; `--settings <file>` targets an explicit file. `RETRO uninstall-hooks` (also a dry run until `--apply`) removes only these entries.

- ❌ Running `install-hooks --apply` because the user said "set up the hooks" and the dry run was skipped.
- ✅ Dry run first, show it, apply on yes. A settings file that is not valid JSON is refused and left untouched.

The hook commands hold the absolute path of this folder. If the skill folder is moved or reinstalled elsewhere, run `install-hooks --apply` again; it updates the path in place.

## Evidence gates

- Claim a skill was "skipped" only if the digest shows a situation its description covers and no `[tool: Skill <name>]` line for it.
- Claim a skill was "wrong" only if you can quote the instruction from the skill file you opened and show the digest moment where it failed. A skill you have not opened is a hypothesis; label it one.
- Classification comes from the `inventory` output, never from a skill's name.

## Example

**User:** "/session-retro"

**Claude:** runs `RETRO inventory` and `RETRO digest`, then reports a 6-line summary, a 3-row inventory (one junctioned, two plugin-installed), one proposal with its cited moment and benefit, and asks "Apply row 1?". Nothing is edited until the answer.

## Anti-patterns

- ❌ Editing a skill inside the plugin cache because that is the path that was loaded. ✅ Edit the marketplace source.
- ❌ Proposing a change because it "might help". ✅ Cite the moment, or drop it.
- ❌ Reading the raw transcript and quoting tool output into the summary. ✅ Use the digest.
- ❌ Padding the table so the retro looks productive. ✅ "No skill changes warranted" is a complete answer.
- ❌ Posting the retro to a tracker or channel. ✅ It stays in chat.

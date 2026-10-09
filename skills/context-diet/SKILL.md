---
name: context-diet
description: >-
  Finds the plugins, skills, agents, hooks and MCP servers that load into
  every session but are rarely or never used, judged from real usage in past
  sessions, and removes the plugins, skill folders and user-level hooks the
  user picks, reversibly, with proof from a fresh session that they are gone.
  Use this skill whenever the user says "trim my context", "clean up my
  skills", "which skills do I never use", "my context window is bloated",
  "disable unused plugins", "what is eating my context", or "/context-diet" -
  even if they don't name the skill. Not for compacting one conversation, and
  not for editing a skill's own text (write-a-skill).
---

# Context Diet

Every enabled skill, agent, MCP server and session-start hook adds text to every session before any work starts. This skill measures that cost against what past sessions actually used, offers the unused part for removal, and checks in a fresh session that the removal took effect. Everything it removes can be restored.

The tool is `scripts/diet.mjs` in this skill's folder (Node 20+, no packages). Run it as `node "<base directory>/scripts/diet.mjs" <command>`, where the base directory is the one shown when this skill was loaded; quote the path, it may contain spaces. It reads `~/.claude/projects/` (or the folder named by `CLAUDE_CONFIG_DIR`) and keeps its state, `keep.json` included, in the `context-diet/` folder inside the Claude home folder (`~/.claude/context-diet/` by default, or under the folder named by `CLAUDE_CONFIG_DIR`); it writes nothing into a repo.

## When to use this skill

- "trim my context", "clean up my skills", "which skills do I never use"
- The context window feels crowded before any work starts, or the user asks what is loaded every session
- Not for compacting a conversation, and not for editing a skill's text (`write-a-skill`)

## Workflow

1. **Scan.** Run `scan`. Run scan in the background or with a long timeout: on a large history it can take several minutes. Do not start apply until it has finished. Quote the `Coverage:` line. Exit code 2 means there is nothing it can judge (no sessions, or a transcript format it does not recognize): write `Scan: not run (<the printed message>)` and stop. Read `references/transcript-format.md` only when the message says the format is unrecognized.
2. **Show the report as printed.** Do not reorder it, drop rows, or add rows. State the thresholds it printed. If "Removal candidates" says `none`, say so and finish: zero candidates is a valid outcome.
3. **Let the user choose.** Ask which ids to remove. Never choose for them. The one exception: the user's own words say the section name "Removal candidates" (any letter case), as in "everything under Removal candidates"; then the rows in that section are their choice and you ask nothing more. Every other section name ("Rarely used", "Review by hand", "Same skill under several names", "Protected") and every paraphrase ("unused", "stale", "zero use", "dead") is not a pick: ask. Rows under "Rarely used" can be removed only when the user names their ids. Never offer a row from "Protected", and treat "Review by hand" and "Same skill under several names" as information, not suggestions. To protect something permanently the user creates or adds to `keep.json` in the `context-diet/` folder inside the Claude home folder (`~/.claude/context-diet/keep.json` by default; see `assets/keep.example.json`).
4. **Apply.** Run `apply --pick "<id,id,...>"` with the ids exactly as printed, quoted, from the directory the user works in (listings differ by project). It takes a before-snapshot, makes each change, then starts a fresh session and prints a verdict. It uses the latest scan, so scan again first if the user changed anything since. apply starts two short headless sessions (before and after) and verify starts one; each sends one tiny request to the model.
5. **Report with the slots below.** Only `Verdict: PASS` means done. If the verdict is `INCOMPLETE` and "Collateral loss" shows a line marked `unstable, rerun`, run `verify "<manifest>"` once more before you report.
6. **Undo on request.** `restore <manifest>` puts everything back. `purge <manifest> --yes` permanently deletes quarantined folders and works only after a passing verify; run it only when the user asks for it by name.

## Rules

- **Say "unused" only with the numbers.** A row is unused when `listed` is at least the printed threshold and `used` is 0. Anything else is "rarely used" or gets its numbers quoted.
  - ❌ "You never use `foo`." (listed in 4 sessions, below the printed threshold)
  - ✅ "`foo` was listed in 4 sessions and used in 0: below the printed threshold, too few to judge."
- **A request is not a pick.** A general wish is not a list of ids.
  - ❌ User: "disable unused plugins." You run `apply` with every candidate.
  - ✅ You show the report and ask which ids. You run `apply` once ids are named, or when the user's words name "Removal candidates", as in "remove everything under Removal candidates"; "remove everything under Review by hand" is still a question.
- **History is not now.** Check the `last seen` column of "MCP servers that did not connect" before suggesting action on a server; a plugin may already be fixed or disabled too, so check its row's counts.
- **A plugin is the smallest unit** for anything it supplies. Pick `plugin:<id>`, never its skills one by one; apply refuses those and prints why.
- **Protected means protected.** Anything printed under "Protected" or "Guard hooks" is never removed, even when asked. Show the printed reason and stop.
  - ❌ User: "just remove `guard-p` too." You pick `plugin:guard-p@market`.
  - ✅ "`plugin:guard-p@market` is protected: plugin supplies a PreToolUse guard. I will not remove it."
- **Done means PASS.**
  - ❌ After `apply`: "Removed the plugin, done."
  - ✅ Quote the `Verdict:` line. Anything other than PASS is not done; print the restore command shown beside it.
- **Unstable is neither damage nor a pass.** A "Collateral loss" line marked `unstable, rerun` is an MCP server outside your change that differed between the two sessions; servers can start intermittently. The verdict is `INCOMPLETE`: not `FAIL`, not yet `PASS`.
  - ❌ "Collateral loss: `example-server` was removed by the change." Or: "PASS" without rerunning.
  - ✅ Run `verify "<manifest>"` once more and report both results: "first verify INCOMPLETE (unstable mcp:x); rerun PASS". If the rerun still shows it missing, quote the line, say it is unexplained, and let the user decide; do not call it damage and do not call it PASS.
- **A step you did not run is `not run`, never `passed`.** That covers the before-snapshot (collateral check) and the fresh session (verdicts `INCOMPLETE` and `NOT-OBSERVED`).
- **Explain a failure only with what was printed.** For a `STILL PRESENT` item, quote the printed reason and stop; do not guess a cause and never suggest editing `settings.json` or a skill folder by hand.
  - ❌ "It is probably listed in settings.json; remove it there and rerun."
  - ✅ "`skill:local-dead` is STILL PRESENT: still listed from a source this tool does not manage. Nothing else changed. Restore with `restore <manifest>`, or tell me where it comes from."
- **Command errors:** for `scan` (other than exit code 2 or an unreadable keep.json or settings.json, which mean stop), `verify` and `restore`, read the message, change exactly one thing, retry once; a second failure: stop and show the user the output. After a failed or partial `apply`, never retry: quote the output and offer `restore <manifest>`.
- **Never repair keep.json or settings.json.** When scan reports that either cannot be read, show the message and stop; never delete, rewrite or repair either file yourself, because keep.json holds the user's protections.
  - ❌ "keep.json has a trailing comma, so I removed it and rescanned."
  - ✅ "scan stopped: keep.json is unreadable. I have not touched it; fix the trailing comma or tell me to."
- **Savings: quote the measured figure, never the projected one as saved.** The skill listing has a size cap, so removing skills can hand the space to the remaining ones and the measured characters may barely move. Judge success by the entries that are gone.
  - ❌ "Saved about 812 tokens per session."
  - ✅ "Projected 891 tokens/session; measured 640 tokens (2560 characters)."
- **Transcripts are private.** Never read them yourself, and never quote or summarize their content; the scan prints counts, names, sizes, dates and hook command lines only. The backups folder holds a copy of settings.json, which can contain secrets; do not paste its content, and tell the user it exists.

## Report slots (all required)

Your final message after `apply` is this block, filled in from the printed output, with at most two sentences after it. A message without the block is not a report. Write `not run` in any slot you could not fill from output you saw.

```
Coverage:    <the printed line>
Picked:      <ids>          Skipped: <id: reason, or none>
Verdict:     <PASS | FAIL | INCOMPLETE | NOT-OBSERVED>
Verified by: <per id: GONE / STILL PRESENT / NOT OBSERVED, from the fresh session>
Collateral:  <none | the lost entries | unstable, with the rerun result | not run>
Guards:      <still in place | what was lost>
Savings:     projected <n> tokens/session, measured <n | not run>
Restore:     <manifest path and the restore command>
Not run:     <anything skipped, or none>
```

## Example

**User:** "My context is bloated, what can I drop?"

**Claude:** runs `scan`, quotes the coverage line, shows the report, and asks which candidate ids to remove. The user picks two plugins. Claude runs `apply --pick "plugin:a@m,plugin:b@m"`, quotes `Verdict: PASS`, fills every slot, and gives the restore command.

## Anti-patterns

- ❌ Picking the largest rows yourself because they save the most. ✅ Present them, then ask.
- ❌ Disabling a plugin because none of its skills were used, ignoring its review note. ✅ Do not remove it; show the note and let the user decide.
- ❌ Counting usage by reading transcripts. ✅ Run `scan`.
- ❌ Deleting a skill folder or editing `settings.json` by hand. ✅ Use `apply`; it records how to undo.

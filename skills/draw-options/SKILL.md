---
name: draw-options
description: >-
  Draws the options for a decision on a tldraw offline canvas - side-by-side
  option cards with what each includes, pros and cons, plus a comparison matrix
  when scoping a feature - saved to one task-named file in a single tidy folder.
  Use this skill whenever the user says "draw the options", "diagram the
  options", "pros and cons on a canvas", "compare these options visually",
  "sketch the approaches in tldraw", "draw options", or "/draw-options" -
  even if they don't name the skill. Not for editing an existing canvas in
  general, and not for stress-testing a design by interview (grill-with-docs).
---

# Draw Options

Brainstorming options is easier to judge when each one is drawn: what it includes, what is good, what is not. This skill draws them on the user's tldraw offline desktop app through a small helper, `scripts/oc.mjs` (`<skill>` below means the directory holding this file), and keeps the files tidy.

## When to use this skill

- "draw the options" / "diagram the options for this task"
- "pros and cons on a canvas" / "compare these approaches visually"
- Scoping how a feature should behave and the choices are worth seeing side by side

## Step 0 — preflight, always first

`node <skill>/scripts/oc.mjs check` decides everything that follows:

| `state` | Meaning | Do |
| --- | --- | --- |
| `ready` | App installed and answering | Continue |
| `not-running` | Installed, server not answering | Tell the user to open tldraw offline, rerun `check` once |
| `not-installed` | App not found | Say so, give the options as a Mermaid diagram or table in chat, report `Canvas: not run` |

- ❌ Drawing "to a file" yourself, or reporting a canvas you did not see answer.
- ✅ A non-`ready` state ends the canvas path; the chat fallback still answers the question.

## Workflow

1. **Collect the options** from the conversation: 2 to 4, each with a name, `includes`, `pros`, `cons`. Items are short (120 characters or fewer, 12 or fewer per list). A con or pro you do not know is left out, never invented. Set `recommended` (an option's exact name) and the matrix `recommendation` only when the user stated or agreed to a preference; otherwise leave both out and report `Recommended option: none`.
   - ❌ `"recommended": "One-click"` because it looked simplest to you; the canvas then shows your pick as the user's.
   - ✅ No `recommended` field until the user says which option they lean toward.
2. **Pick layouts** by what you can observe:

   | Observable | Layouts |
   | --- | --- |
   | Always | `columns` |
   | The user is scoping what a feature does, or you can name 3+ criteria shared by every option | add `matrix` |
   | Choosing one option opens a follow-up decision you can name (put it in that option's `then` list) | add `tree` |

3. **Name the file** `<task#>-<short-desc>`; with no task number, `<yyyy-mm-dd>-<short-desc>`. Run `node <skill>/scripts/oc.mjs open "<name>"` and keep the returned `id`. The file is created under the right name from the start, never renamed afterwards.
4. **Draw.** Write the spec as JSON in your scratch folder, then `node <skill>/scripts/oc.mjs draw <id> columns spec.json`, and the same for `matrix` / `tree`. Layouts stack downward on one page.
5. **Finish.** `node <skill>/scripts/oc.mjs finish <id>` saves, measures the file and takes a screenshot. Read the screenshot file before reporting.

`columns` spec (formats for `matrix` and `tree` are in [references/protocol.md](references/protocol.md)):

```json
{"title": "Report export", "question": "How should users export a report?", "recommended": "Emailed",
 "options": [
  {"name": "One-click", "includes": ["Export button"], "pros": ["Fast to build"], "cons": ["Times out on big reports"]},
  {"name": "Emailed", "includes": ["Request dialog"], "pros": ["Handles big reports"], "cons": ["Needs a job queue"]}]}
```

- ❌ Placing shapes by hand with your own coordinates.
- ✅ The helper's builders: they size cards to the text and fail rather than overlap.

## Files — keep them tidy

- Files live in `~/.claude/diagrams/` (override with `--dir`), outside every repo, so nothing is committed.
- A new file opens in the app by itself. One file per task: the same task again, `open` with the same name finds the file, opens it if it was closed, and the next `draw` adds below. State `exists-not-open` means the app did not open it within 15 seconds; ask the user to open that file, then stop.
- Shapes and text only. No pasted images or screenshots on the canvas.
- Leave the user's own Untitled or other canvases alone. Never draw on a document you did not create or open here.
- `finish` prints `bytes`; if `sizeWarning` is set, tell the user.
- Cleanup: `node <skill>/scripts/oc.mjs list` shows age and size. Delete only after the user names the file, then `remove <file> --yes`. Never delete unprompted.
- Nothing sensitive on the canvas: no real names, record IDs, credentials, or personal data; generic titles.

## Failure protocol

`draw` returns `ok: false`: read `message`. `bad-spec` lists what to fix. `layout lints remain` means shorten the longest label or cell. Fix exactly that and retry once; a failed draw is rolled back, so a retry does not duplicate. A second failure: stop, report it, answer in chat.

## Report — these slots are required

```
Draw options
- Canvas: run | not run (<reason>)
- File: <path> (<bytes> bytes)
- Layouts: columns[, matrix][, tree]
- Lints: <number from finish>
- Screenshot viewed: yes | no
- Recommended option: <name> | none
```

A value you did not observe is `not run` or `no`. `File` is filled only from a successful `finish`. Zero options worth drawing is a valid outcome: say so instead of padding.

## Notes

- Verified on Windows only; elsewhere `check` looks in the usual app-data location and reports `not-installed` or `not-running` if the app is absent.
- The helper needs Node 20+ and no packages.

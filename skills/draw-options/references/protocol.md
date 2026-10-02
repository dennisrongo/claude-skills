# Helper protocol

`scripts/oc.mjs <command>`. Every command prints one JSON object and sets the exit code.

| Command | Does | Exit codes |
| --- | --- | --- |
| `check` | Preflight: app installed? server answering? token accepted? Prints `platformVerified` (true only on Windows) | 0 ready |
| `open <name> [--dir D]` | Creates `<dir>/<clean-name>.tldraw` and opens it in a new window; an existing file that is already open is returned, and one that is closed is opened through the operating system and awaited (15 s, `DRAW_OPTIONS_OPEN_WAIT`) | 0 ok, 4 exists-not-open |
| `draw <id> <columns\|matrix\|tree> <spec.json>` | Validates the spec before contacting the app, draws below existing content, lints the shapes it made, grows boxes that are too short, and fails on any remaining lint | 0 ok |
| `finish <id>` | Saves, reports bytes, lint count and a screenshot path | 0 ok, 5 doc-gone, 6 never-saved |
| `list [--dir D]` | Files with `bytes` and `ageDays`, oldest first | 0 |
| `remove <file> --yes [--dir D]` | Deletes one `.tldraw` directly inside the folder | 0 removed |

Every command that talks to the app can also exit 2 (not-installed) or 3 (not-running). Exit 1 covers usage errors, `bad-spec`, `bad-name`, `create-failed`, refusals and any failure reported by the app. `check`, `open`, `draw` and `finish` all stop at 2 or 3 before doing anything else.

Names are cleaned to `a-z 0-9 . - _` and at most 80 characters; Windows device names (`con`, `nul`, `com1`...) are refused. The default folder is `~/.claude/diagrams/`; `DRAW_OPTIONS_DIR` also sets it. `DRAW_OPTIONS_NO_LAUNCH` makes `open` skip the operating-system opener (used by the tests).

## Spec formats

`columns`: `recommended` is optional and is the exact name of one option.

```json
{"title": "Report export", "question": "How should users export a report?", "recommended": "Emailed",
 "options": [{"name": "One-click", "includes": ["Export button"], "pros": ["Fast to build"], "cons": ["Times out on big reports"]},
             {"name": "Emailed", "includes": ["Request dialog"], "pros": ["Handles big reports"], "cons": ["Needs a job queue"]}]}
```

`matrix`: option names, then criteria with one value per option.

```json
{"title": "Report export", "question": "How should users export a report?",
 "options": ["One-click", "Emailed", "Saved page"],
 "criteria": [{"name": "Build effort", "values": ["Low", "Medium", "High"]}],
 "recommendation": "Option 2: large reports are the real risk."}
```

`tree`: each pro and con becomes a leaf under its option; `then` lists follow-up decisions that choosing that option opens.

```json
{"title": "Report export", "question": "How should users export a report?",
 "options": [{"name": "One-click", "pros": ["Fast to build"], "cons": ["Times out on big reports"], "then": ["Pick a file format"]},
             {"name": "Emailed", "pros": ["Handles big reports"], "then": ["Pick a retention period"]}]}
```

Limits: 2 to 4 options; at most 8 criteria; at most 12 items per list; items of 120 characters or fewer. A key a layout does not use is an error, so a spec cannot be reused for another layout by accident.

## What the helper talks to

The app writes `server.json` (port and per-launch token) in its app-data folder and serves a local HTTP API with a bearer token. Used: `POST /api/search` (list documents, screenshots), `POST /api/docs/create` (named file in a chosen folder), `POST /api/doc/:id/exec` (draw, lint, save). Windows folder: `%APPDATA%\tldraw`. `TLDRAW_DATA_DIR` and `TLDRAW_EXE` override the locations. The port must be a plain integer and redirects are refused, so the token only goes to the local server.

A snippet that throws is rolled back by the app: a `draw` that fails on a remaining lint leaves nothing on the canvas, so a retry does not stack a second copy (observed on the Windows app).

## Reopening a closed file

Starting the app's executable while it is already running hands the file to the running window, but the short-lived second process first overwrites `server.json` with its own port and token, which are dead the moment it exits. Left alone, every later command reports `not-running`. `open` therefore snapshots `server.json` before launching and puts the original back afterwards (the running app's token never changed). `DRAW_OPTIONS_OPENER` (a Node script path) replaces the operating-system opener for tests.

## Known limits

- The app has no endpoint to open an existing file, so a closed file is opened through the operating system's file association (`start`, `open`, `xdg-open`). Only the Windows path has been run. A folder whose path contains `& | ^ % < > ( ) ! "` is not handed to the Windows opener.
- Document ids go into the URL with only `:` left unescaped; an id containing `/` or `+` has not been tried.
- Only the Windows locations are verified.

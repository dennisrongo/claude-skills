---
name: worktree-sandbox
description: >-
  Give every git worktree its own sandboxed Docker stack - its services (API, frontend dev
  server, database, whatever the project runs) plus a dedicated Chromium - so parallel sessions can run and browser-test different branches
  and API versions at the same time with no port, cookie, or profile collisions and no change
  to the application repo. Stacks are watchable live and drivable by agents over CDP. Use this
  skill whenever the user says "spin up this branch", "run each worktree separately", "sandbox
  my browser testing", "preview what's running", "which browser is mine", "wt up", or "wt ls" -
  even if they don't name the skill. Not for deciding what to test or writing e2e tests
  (e2e-verify), or for recording a test as video (record-browser-test).
---

# Worktree Sandbox

Each worktree gets a **slot** (1–20) running one Docker Compose stack. All services in a stack
share one network namespace, so the API and the dev server keep the ports the app hardcodes, and
the stack's own Chromium reaches them on `localhost` exactly as on a normal dev machine — even
when the frontend hardcodes the API's address. Stacks can't see each other. Per slot, only two
ports reach the host, both on `127.0.0.1`:

| What | Host URL |
|---|---|
| Live view of the stack's browser (noVNC, interactive) | `http://localhost:<7900+slot>/vnc.html` |
| CDP endpoint for agents (Playwright / Chrome DevTools MCP) | `http://127.0.0.1:<9220+slot>` |

The tooling ships in this skill: `scripts/wt.ps1` (PowerShell 7, runs on Linux, macOS, and
Windows/WSL2) and the browser image in `docker/browser/`. The services come from
`~/.wt/config.json` — any image, command, port, and working folder — and `wt` generates each
stack's Compose file from it. Config and per-branch state live in `~/.wt/`, never in a repo.

- Before the first `wt up` on a machine, read `references/setup.md` (prerequisites, every config
  field, private package feeds, HTTPS, file ownership).
- To write the `services` block for a stack, read `references/stacks.md` (ready-made recipes).
  Read the repo's own dev scripts and README to fill in the commands and ports; never guess a
  port the app doesn't use.

## When to use this skill

- The user wants several branches or worktrees running at once, each testable in a browser.
- An agent needs a browser pointed at *its* worktree's code while other sessions run theirs.
- The user wants to watch, or take over, what agents are doing in their browsers.

## Commands

The branch argument defaults to the current worktree's branch.

| Command | Does |
|---|---|
| `wt init` | Creates `~/.wt/config.json` from `assets/config.example.json`. Once per machine. |
| `wt up <branch> [-NoBuild]` | Creates the worktree if missing (a new branch starts from the latest `base`), refreshes shared base worktrees, assigns a slot, starts the stack, and runs `hooks.afterUp` once for a newly started stack (for example to open the live view; skip with `-NoHook`). |
| `wt ls` | Every slot: each service's health, view and CDP URLs. |
| `wt which` | Slot, ports, and URLs for the current worktree. |
| `wt logs <branch> [-Service <name>\|browser] [-Follow]` | Container logs. |
| `wt claude <branch> [-- <claude args>]` | Starts Claude Code in the worktree with MCP wired to that slot's browser. |
| `wt dashboard [-NoOpen]` | Writes and opens a page tiling every stack's live view side by side; tiles reconnect when a stack restarts. |
| `wt reload <branch>` | Reopens the start page (and `browser.extraUrls`) in the stack's browser once their services answer, replacing stale tabs. A newly started stack does this by itself. |
| `wt down <branch> [-Purge]` | Stops the stack. `-Purge` also deletes its volumes, browser profile, and slot. |
| `wt chown <branch>` | Returns ownership of container-written files in the worktree to the user. |

Always give the branch when passing claude arguments, and put them after `--`, or PowerShell
binds them to wt's own switches.

`wt` below is the alias from `references/setup.md`, which works inside a PowerShell session. From
bash or any other shell there is no alias, and `pwsh -File` rejects `--`, so call it as:

```
pwsh -NoProfile -Command "& '<skill-dir>/scripts/wt.ps1' claude <branch> -- -p 'smoke test'"
```

## Rules

### 1. The application repo is never changed

The whole point is a clean tree. `wt` writes nothing into the worktree except build output that
is already gitignored.

❌ "The frontend hardcodes port 5000, so I edited its config to read the port from an env var."
✅ "The frontend keeps calling `localhost:5000`; inside slot 3 that is slot 3's API. No repo files changed."

If something only works with a repo change, stop and tell the user what and why. Before
reporting done, run `git status --porcelain` in the worktree and quote it; any sandbox-caused
line is a failure to report, not to hide.

### 2. Use only your own slot

Run `wt which` first. Sessions started with `wt claude` have `WT_SLOT`, `WT_CDP_URL`, and
`WT_VIEW_URL` set and `playwright` / `chrome-devtools` MCP servers already pointed at the slot.
Without them, connect with Playwright's `chromium.connectOverCDP("<your CDP url>")`.

❌ "Slot 2's browser was free, so I used it." / "I restarted all stacks to pick up my change."
✅ "Slot 4 (`feat/x`): driving `http://127.0.0.1:9224`; other slots untouched."

Never stop, restart, attach to, or `-Purge` another slot's stack. `-Purge` on your own slot
only when the user asks.

### 3. Open the app inside the stack's browser, never the host's

On the host, a hardcoded API address reaches nothing, or another stack.

❌ Opening `http://localhost:3000` in the host browser or a separately launched Chrome.
✅ Navigating the stack browser (via CDP or the live view) to the app's normal dev URL.

### 4. A stack is up only when observed up

`wt up` returning is not the app running: package restores can take minutes.

❌ "Stack started, the page is working."
✅ "`wt ls`: slot 4 `api:up web:up`; the page loaded with title `<title>`."

A check you didn't run is `not run`, never `passed`. `starting` for more than a few minutes means
read `wt logs -Service <name>` and quote the first error.

### 5. Tell the user where to watch

When browser work starts, give the live-view URL so the user can watch or take over. If another
skill is driving the test (`e2e-verify`, if installed), hand it your slot's CDP URL as the
browser to use; without it, drive the pages yourself through the MCP tools.

❌ Driving the stack's browser for ten minutes and reporting only "tests passed".
✅ "Watch at `http://localhost:7904/vnc.html`; starting the checkout flow now."

## Report

End any sandbox task with this block:

```
Sandbox: slot <n> · branch <branch> · view http://localhost:<port>/vnc.html · CDP http://127.0.0.1:<port>
Health (wt ls): <service>:<up|starting|running|-> for each service
Repo clean: <quoted git status --porcelain output, or "clean (empty output)">
Not run: <checks skipped, or "none">
```

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Edits don't hot-reload | Worktree on NTFS (`/mnt/c/...`, `C:\`). Move worktrees into the WSL filesystem, or set `"polling": true` and `wt up` again. |
| Restore fails with 401 | Private package feed needs credentials in the container. `references/setup.md` §5. |
| A service container exits | Wrong image version or command for this project. Read `wt logs -Service <name>`, then fix its `image` / `command` in config. |
| A service stays `starting` | It listens on a different port than its `port` in config. Check its log for the address it printed. |
| `No free slots` | Ask the user which stopped branch to `wt down -Purge`. Never pick one yourself. |
| Worktree files owned by root | `wt chown` (also runs on `wt down`). |
| Live view blank | Chromium restarts on its own; check `wt logs -Service browser`. |
| Live view says the site can't be reached | Chromium opened the start page before the services were up and kept the error. Once `wt ls` shows the services `up`, run `wt reload <branch>`. |
| macOS over SSH: `keychain cannot be accessed ... does not allow user interaction` on pull | Docker's credential helper needs the login keychain, which an SSH session can't unlock. Run the first `wt up` from a terminal on the Mac itself so images are pulled and built there; `wt ls`, `which`, `logs` and `down` need no pull and worked over SSH. Running `wt` on the other machine with `docker.context` (`references/setup.md`) avoids this: pulls through a context worked. |

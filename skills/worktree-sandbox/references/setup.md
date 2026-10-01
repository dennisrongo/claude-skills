# Setup and configuration

## Contents
1. Prerequisites
2. First run
3. Config fields
4. Port rules inside a stack
5. Special cases (private package feeds, HTTPS, file ownership, versions)
6. How it works

## 1. Prerequisites

All platforms:
- **Docker** with Compose v2 (`docker compose version` works).
- **PowerShell 7** (`pwsh`), **git**, and **Node** (for `npx` to start the MCP servers).
- An alias for the script, e.g. in your pwsh profile: `Set-Alias wt <skill-dir>/scripts/wt.ps1`.

Windows:
- Docker Desktop with the **WSL2 backend** and Linux containers, WSL integration on for your
  distro. Keep the repo and worktrees **inside the WSL filesystem** (`~/projects/<repo>`) and run
  `wt` from the WSL shell with pwsh installed there. File-change events from NTFS (`/mnt/c/...`,
  `C:\`) don't reach Linux containers, so hot reload breaks and builds crawl.
- In Windows-side PowerShell a `wt` alias shadows Windows Terminal's `wt.exe`; pick another name
  (`wts`) if you launch Terminal that way.

macOS: Docker Desktop, OrbStack, or Colima all work. The browser image is multi-arch.

## 2. First run

```
wt init                      # writes ~/.wt/config.json
# edit ~/.wt/config.json: replace the <placeholders> (fields below; recipes in references/stacks.md)
wt up main                   # or any branch
wt ls
wt dashboard
```

The first `up` pulls your service images and builds the browser image; later stacks reuse them.
Config changes apply on the next `wt up <branch>`, which regenerates that stack's Compose file.

## 3. Config fields (`~/.wt/config.json`)

Top level:

| Field | Meaning |
|---|---|
| `repoRoot` | Main checkout. `~` is expanded. |
| `base` | Branch a brand-new task branch starts from (after a fetch), e.g. `develop`. Without it, a new branch starts from whatever the main checkout has checked out. `wt up <base>` also fast-forwards that worktree to the latest `origin/<base>` and restarts the services that mount it. Task branches are never touched. |
| `worktreeRoot` | Where `wt up` creates new worktrees, as `<repo>-wt-<branch without feature/>` siblings. With `docker.pathMap`, put it in the shared folder. |
| `browser.startUrl` | Page the stack's Chromium opens, e.g. `http://localhost:3000/`. |
| `browser.extraUrls` | Further pages to open next to `startUrl`, one tab each. Optional. |
| `browser.waitSeconds` | How long `wt up` waits for each page's service to answer before opening it (default 120). A page that is still down is skipped with a warning; `wt reload` opens it later. |
| `browser.flags` | Extra Chromium flags, space-separated, e.g. `--ignore-certificate-errors` for a self-signed dev certificate. |
| `docker.context` | Run every Docker command against this Docker context, for a daemon on another machine (`docker context create <name> --docker host=ssh://<user>@<host>`). `wt` then runs where your git repos are. |
| `docker.pathMap` | With `docker.context`: `{ "<path prefix on this machine>": "<same folder as the Docker host sees it>" }`, e.g. `{ "//Mac/Home/": "/Users/me/" }`. Bind sources are translated through it; a worktree outside every prefix is refused instead of mounting a path the daemon cannot see. |
| `hooks.afterUp` | A PowerShell command run once when a stack newly starts (not when it was already running; skip with `-NoHook`), with `WT_BRANCH`, `WT_SLOT`, `WT_VIEW_URL` and `WT_CDP_URL` set. A failing hook only warns. Typical use: open the live view, e.g. `wt dashboard`, or a launcher that first starts a port forward. |
| `polling` | `true` sets polling env vars for common watchers (chokidar, webpack, dotnet). Only for worktrees on network or NTFS paths. |
| `slots.max`, `slots.viewBase`, `slots.cdpBase` | Slot count and host port bases (view port = `viewBase + slot`). |
| `services` | One entry per container, keyed by service name (lowercase; `net` and `browser` are reserved). |

Per service:

| Field | Meaning |
|---|---|
| `image` | Any image, e.g. `node:20`, `python:3.12`, `golang:1.23`, `postgres:16`. Required. |
| `workdir` | Folder relative to the repo root the command runs in. Default: repo root. |
| `command` | A string (run with `sh -c`) or an array (exec form). Omit to use the image's default. `$` is passed through literally. |
| `port` | The port the service listens on inside the stack. Used by `wt ls` for health. Optional. |
| `env` | Environment variables. |
| `mount` | `false` to not mount the worktree (databases, caches). Default `true` at `/src`. |
| `repo` | Path to the main checkout of a different repo that holds this service. `wt up <branch>` mounts that repo's worktree for the same branch at `/src` when one exists (create it yourself with `git worktree add`). Without one, the service runs a shared detached worktree of `base`; `wt` never creates branches in this repo. |
| `base` | With `repo`: the branch the shared fallback worktree is detached at (`<repo>-wt-base`). Every `wt up` moves it to the latest `origin/<base>` and discards local changes in it, so treat it as disposable. Default `develop`. |
| `source` | Absolute path on the Docker host to mount at `/src` instead of the worktree, for a service that lives in a different repo. It is one shared checkout, not per-slot: every stack sees the same files and branch. Use `repo` for isolation. |
| `volumes` | Paths kept in a per-stack Docker volume instead of the worktree — relative to `workdir` (`node_modules`, `bin`, `.venv`) or absolute (`/var/lib/postgresql/data`). |
| `caches` | Named caches shared by **all** stacks, `{ "<name>": "<path in container>" }` — package caches such as `/root/.npm` or `/root/.cache/pip`. |

## 4. Port rules inside a stack

All services share one network namespace, so every listening port must be unique *within* a
stack (across stacks nothing collides). The sandbox reserves `5900` (VNC), `7900` (noVNC), and
`9222`/`9223` (CDP); `wt` refuses a service `port` on those. Watch for secondary ports too, such as
a dev server's live-reload or UI port.

## 5. Special cases

**Private package feeds.** Restores run inside containers, so credentials must be there. Put
additions in `~/.wt/compose.override.yml` (outside every repo; `wt` includes it automatically when
it exists) and keep tokens out of git. Examples:

```yaml
services:
  web:                      # npm: mount a registry token file
    volumes:
      - ~/.npmrc:/root/.npmrc:ro
  api:                      # any tool that reads credentials from env (NuGet, pip, Maven, ...)
    environment:
      PIP_INDEX_URL: "https://<user>:<token>@<feed host>/simple"
```

**HTTPS APIs.** Plain HTTP inside the stack is simplest. If the frontend insists on HTTPS, mount a
dev certificate via the override file and configure the server to use it; set
`"browser.flags": "--ignore-certificate-errors"` in the config for a self-signed cert.

**File ownership.** Containers run as root, so files they write into the worktree (build output,
lockfiles) are root-owned on Linux and WSL. `wt down` and `wt chown` give them back to you.

**Docker on another machine (e.g. a VM whose host runs the containers).** Keep git on the machine
with the repos, share a folder so the Docker host sees the worktrees, and set `docker.context` plus
`docker.pathMap`. Worktrees created by git on the VM record VM paths, so only the VM can run git on
them; the containers only read the files. Credentials for pulling images are resolved by the
client, so no keychain or login on the Docker host is needed.

**Watching from another machine.** The live-view and CDP ports are bound to the Docker host's
loopback only. From a second machine (or a VM on the Docker host), forward the ports you need and
open the dashboard file `wt dashboard -NoOpen` prints:

```
ssh -N -L 7901:127.0.0.1:7901 -L 7902:127.0.0.1:7902 <user>@<docker-host>
```

Forward `viewBase + slot` for each stack to watch, and `cdpBase + slot` to drive its browser from
there. Keep the forward running while you watch.

**Different versions per branch.** Services come from one config. To run a branch with different
images, point `wt` at a second config folder with the `WT_HOME` environment variable.

## 6. How it works

- `net` (alpine, `sleep infinity`) owns the namespace and publishes the view and CDP ports on
  `127.0.0.1` only.
- Each configured service joins that namespace, with the worktree bind-mounted at `/src`, its
  `volumes` in per-stack named volumes, and `caches` in shared `wt-cache-<name>` volumes.
- `browser` runs Xvfb + Chromium + x11vnc + noVNC with a persistent profile volume, forwards CDP
  from 9222 to Chromium's loopback-only 9223, and restarts Chromium if it is closed.
- Per branch, `~/.wt/stacks/<branch>/` holds `compose.json` (generated) and `mcp.json`; the slot map
  is `~/.wt/slots.json`.

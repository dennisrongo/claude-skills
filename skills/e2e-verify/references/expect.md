# Expect (millionco/expect) — mechanics

Written against **expect-cli 0.1.3** on Windows (Node 25, fnm). The install, the browser-install path, the daemon failure and its workaround, the subcommands and the artifacts below were each observed running; the `tui` invocations come from `expect tui --help` and have **not** been watched end to end. Versions move — confirm with `expect --help` and `expect tui --help`. An invocation you have not seen run is `not verified`, never "works".

## Install

```bash
npm i -g expect-cli          # inert: no postinstall script, ~12 MB unpacked, 33 deps
expect --version             # observe a version before claiming it is installed
```

The package bundles `playwright`, plus several agent CLIs (`@github/copilot`, `@google/gemini-cli`, `@zed-industries/codex-acp`). License is **FSL-1.1-MIT** — source-available with a non-compete, converting to MIT after two years. Not OSI open source; check it against whatever policy governs the machine before installing.

`npm i -g` does **not** install Playwright's browsers. Expect ships its own pinned `playwright-core`, so a system-wide `playwright install` from a different version leaves the wrong build on disk and every browser command fails. Install from the copy Expect actually loads:

```bash
node "$(npm root -g)/expect-cli/node_modules/playwright-core/cli.js" install chromium
```

## Two entry points, and only one is current

- **`/expect` via MCP (current).** `expect init` wires an MCP server into your coding agent; you then drive it from the agent, not the terminal.
- **`expect tui` (deprecated).** Still works, and prints its own deprecation banner pointing at `init`.

## What `expect init` actually does

Read out of `dist/index.js`, not from the docs. It requires an explicit yes because:

1. **Detects every agent on PATH** — claude, codex, copilot, gemini, cursor, opencode, droid, pi. It touches all of them, not just the one you are using.
2. **Writes an MCP entry** into each agent's config (for Claude Code: `~/.claude.json` `mcpServers`, and/or a project `.mcp.json`) of the form `{"command": "npx", "args": ["-y", "expect-cli@<version>", "mcp"]}`.
3. **Downloads a skill at init time** from `codeload.github.com/millionco/expect/tar.gz/main` into the agent's skill directory. Unpinned `main`, fetched fresh — this is the part that deserves the explicit yes.

❌ Running `init` because the skill routed you to Expect. ✅ Offering it with the three facts above and waiting.

## Command surface

Flags live on the **subcommand**. The top level takes only `-v` and `-h`:

```
$ expect --target branch --url http://localhost:3000 --no-cookies
error: unknown option '--target'
```

```bash
expect tui --target branch -u http://localhost:3000 --no-cookies -m "test the branch changes" -y
expect tui --ci -m "smoke test"      # headless, no cookies, auto-yes, 30-min timeout
```

`--target` takes `unstaged`, `branch`, or `changes`. Individual daemon-backed commands exist for stepwise driving: `open <url>`, `screenshot [--mode screenshot|snapshot|annotated]`, `playwright '<code>'`, `console_logs`, `network_requests`, `performance_metrics`, `accessibility_audit`, `close`. `--mode snapshot` returns an ARIA tree with refs — prefer it over an image for text and behavior.

## The daemon, and the Windows failure

Every non-TUI command talks to a background daemon the CLI spawns on demand. On Windows 0.1.3 that spawn is broken: the path is built with `path.join(path.dirname(new URL(import.meta.url).pathname), 'browser-daemon.js')`, which yields `\C:\...\browser-daemon.js` and does not exist. The spawn uses `stdio: 'ignore'`, so it fails silently and you get `Daemon failed to start within timeout` plus a large dump of minified source.

Workaround — start it yourself, then every command works:

```bash
node "$(npm root -g)/expect-cli/dist/browser-daemon.js"
```

It prints `expect daemon listening on 127.0.0.1:<port>`; `expect close` stops it. Check whether the version in front of you still has the bug before repeating this.

## Safety facts that outrank convenience

- **Cookies.** `expect tui` extracts system-browser cookies **by default** — pass `--no-cookies`. The subcommands invert it (`expect open` needs `--cookies`). Know which one you are running.
- **Video.** Sessions are recorded to an artifacts directory (`/tmp/expect-artifacts`, which on Windows lands on the current drive as `\tmp\expect-artifacts`) — multi-MB `.webm` per session, plus performance traces. On any target with regulated or personal data on screen, that file is disclosure surface: find it, and delete it when the run is done.
- **The page goes to a model.** Expect drives the browser with an agent backend (`-a claude|codex|copilot|gemini|cursor|opencode|droid|pi`). Whatever renders is sent to that provider. Choose the target and the backend deliberately.

## Reading its output

Its report is **input, not verdict** — same epistemics as any model output.

- ❌ "Ran Expect — e2e tests pass ✅"
- ✅ "Expect walked login, create, delete against localhost:3000 with `--no-cookies`; observed <quoted>. Not walked: checkout — absent from its generated plan though the diff touches it, so I walked it manually."

Diff-to-plan is lossy. Check the flows it chose against the routes the diff actually touches, and walk what it missed.

---
name: record-browser-test
description: >-
  Run a browser test as a script and record it as a captioned, replayable MP4, so the video itself proves which tests ran, what each one checked, and whether it passed. Use this skill whenever the user says "record the browser test", "can you record the browser tests", "capture a video of the test", "make an mp4 of the test", "prove what tests ran", "video proof of the test", "I want to replay the test", "show my recordings", "open the recordings library", "delete an old recording", or asks for footage or evidence of an automated browser run - even if they do not name the skill. Not for choosing what to test or driving a flow interactively (e2e-verify).
---

# Record Browser Test

A browser test you only describe is a claim. This skill turns it into evidence: the test is a script, the script runs in a real Chrome that records itself, and the video shows every step, every expected-versus-seen check, and a closing verdict, stamped with the target, commit and time. Someone who did not watch it live can replay the video and decide "this is good" from what is on screen.

## When to use this skill

- The user asks for a recording, video or MP4 of a browser test, or for proof of what tests ran.
- Any browser verification whose result someone will be asked to trust later, and a body-driven run is possible (the flow stays on one page after sign-in).

Do **not** use it for exploratory walking or for deciding which flows to test - that is `e2e-verify` (if installed), which can hand its walk to this skill.

## What a run produces

One folder per run, `~/.claude/recordings/<date>-<host>/` (outside every repo; set `RECORDINGS_DIR` to move it), holding `recording.mp4` (the video), `receipt.html` (a self-contained page: the video, every check with expected and seen values, click-to-jump timestamps and the script), `recording.steps.json` (every caption and check, machine-readable), `run.json` (which also carries the Claude session id when the runner has one, and the receipt shows it as a `session <first 8 characters>` chip, so a recording can be traced to the session whose transcript holds the command that made it), `result.json` (what the body returned, or `null`) and `body.js` (the script that ran). **Replay** means running the same command with the same body again. Pass `--out <file.mp4>` to put the files somewhere you choose instead; the receipt is then written next to it as `<name>.receipt.html`.

## Requirements and how it works

| Need | Detail |
|---|---|
| Node.js 22 or newer | Check with `node -v`. Install: `winget install OpenJS.NodeJS.LTS` (Windows), `brew install node` (macOS), or your distro's package |
| Chrome or Chromium | Found automatically in the standard install locations for Windows, macOS and Linux. Anywhere else: `--chrome <path>` or `CHROME_PATH`. Install: `winget install Google.Chrome`, `brew install --cask google-chrome`, or your distro's package |
| The skill folder | `npx --yes github:dennisrongo/claude-skills install record-browser-test` (add `-p` for one project), or link or copy `skills/record-browser-test` into `~/.claude/skills/` |
| A reachable page | Loopback by default; any other host needs `--allow-host` (step 1) |
| Git (optional) | Only read for the commit stamp; without it the stamp says so |

Nothing else is installed or downloaded: no ffmpeg, no Playwright or Puppeteer, no npm packages, no network calls. The scripts are plain Node files.

- **Control:** the runner starts a throwaway Chrome with its own empty profile and a remote-debugging port, then drives it over the Chrome DevTools Protocol through a WebSocket (`record-run.mjs`).
- **Capture:** a recorder injected into the page calls `getDisplayMedia` and `MediaRecorder` to write H.264 MP4 (`avc1`) at 2.5 Mbit/s, and draws the captions and checks into the page so they are in the video (`record-tab-mp4.js`). Screen capture is pre-accepted only in that throwaway Chrome, never in your own browser.
- **Finish:** Node patches the MP4 header to the true duration (`mp4.mjs`), writes the receipt (`receipt.mjs`) and opens it, then prints JSON. `play-check.mjs` replays the file in a headless Chrome to prove it decodes.

**Check your setup before a real run:** `node -v`, then run the step-4 command with `--rehearse`. It finds Chrome, loads the page, runs the body and prints every check without recording anything.

| Symptom | Cause and fix |
|---|---|
| `Node 22 or newer is required` | Upgrade Node |
| `no Chrome found` | Pass `--chrome <path>` or set `CHROME_PATH` |
| `refusing <host>` | Non-loopback target: check the page shows no personal data, then pass `--allow-host <host>` |
| Run ends early with a Chrome exit code | The Chrome window was closed, or the page did a full reload (see Limits) |
| Video will not play | Run `play-check.mjs`; quote its `error` |
| macOS asks for Screen Recording permission | The runner cannot answer it; grant it once in System Settings |

## Workflow

1. **Gate the target.** Local or staging only, never production; state the host in your report. The runner refuses non-loopback hosts unless you pass `--allow-host <host>` after checking the page shows no personal or regulated data. That flag is your check, not a question for the user. The recorder has no prompt to answer, so do not ask the user to approve or click anything to start a recording. Handing a one-time sign-in URL to the runner is a different matter and does need their yes: see "When a test account cannot sign in".
2. **List the tests first.** Write the numbered assertions the user wants proven, each with its expected value taken from the requirement. Then copy [references/flow-body.js](references/flow-body.js) and turn each assertion into a `rec.check(label, actual, expected)`.
   - ❌ `rec.check('rows match', rowIds(), rowIds())` - compares the page with itself and can never fail.
   - ✅ `rec.check('Alpha row ids', rowIds(), ['a1b2', 'c3d4', 'e5f6'])` - expected comes from the requirement, so a wrong page fails.
   - ❌ `rec.check('heading', title.slice(0, 44), 'Region filter lists the right rows')` - a hand-counted slice length; one character off fails a correct page.
   - ✅ `const expected = 'Region filter lists the right rows'; rec.check('heading', title.slice(0, expected.length), expected)` - the length comes from the string you compare against.
3. **Caption every action.** The body is `async rec => { ... }`. Call `rec.show({ step, doing })` before each action so the video names what is being done, and `rec.show({ saw })` to note what you observed; `rec.show({ suite })` sets the title line. `rec.check` shows `PASS`/`FAIL` with expected and seen, and accepts strings, numbers, booleans, `null`, arrays and plain objects (anything else throws). A body with no checks records footage, not a verdict.
4. **Run it.**

```bash
node <skill-dir>/references/record-run.mjs --url http://localhost:3000/screen --body my-body.js
```

`<skill-dir>` is the folder that holds this SKILL.md (for example `~/.claude/skills/record-browser-test`). Use its absolute path and run the command from the repo under test, so the stamp carries that commit; outside a repo the stamp has no commit, and the report says so.

**Rehearse first.** Run the same command with `--rehearse` added. It signs in and reaches the screen exactly as a real run does, runs the body with no capture, prints every check (with expected and seen values for each failure) and exits `0`, `3` or `1` as a real run would, in a few seconds. It writes no video and never touches an existing `--out`, `--result` or steps log. Fix the body until the rehearsal says what you expect, then record; otherwise a typo in the body costs a whole recording, and a fresh one-time URL if the app needs one. A rehearsal with `verdict none` warns that the body asserts nothing.

Needs Node 22+ and Chrome; nothing to install. The MP4 header is patched to the true duration in Node; if it cannot be (a malformed header), the file still plays but reports a wrong length (`headerPatched: false`, plus a warning on stderr that names why). It launches its own throwaway Chrome, records the tab, ends on a card listing up to 10 checks with PASS or FAIL (failures first, the rest in the steps log), closes Chrome and prints JSON. A run in the default folder is always fresh; with an explicit `--out` it deletes that path's previous video, result, steps log and receipt first, so a stale file is never reported as this run's. Its JSON names the `receipt`, whether it was `opened`, and, for a folder run, the `library` command. **The receipt opens in the user's default browser by itself the moment the run finishes**, so no follow-up is needed for them to see the result; it is skipped for `--rehearse`, `--no-open`, a `CI` environment, a session that reports itself unattended (`CLAUDE_CODE_SESSION_ATTENDED=0`) and a Linux session with no display. `opened` is `yes` (the opener process started; the operating system does not report whether a window appeared), `skipped: <why>` or `failed: <why>`.

| Need | Flag |
|---|---|
| A screen behind a login | `--profile <dir>` (a dedicated empty directory outside the repo) plus `--setup <file.js>` to sign in once with a throwaway test account. Real browser profiles are refused |
| A speed claim ("how fast does it run") | `--dwell 0`. The pace pill on the caption card says `REAL TIME`, and the captions flash too fast to read |
| A different reading pace | `--dwell <ms>`. The default is 600 ms per caption update, so every check is readable; the pace pill says `PACED` and the card's timer is not the speed of the test |
| The caption covers a control | `--corner bottom-left` |
| A run that could hang | `--timeout <s>` (default 600) |
| Chrome in an unusual place | `--chrome <path>` or the `CHROME_PATH` environment variable |
| Reaching the screen the video should open on | `--setup <file.js>` holds `async () => { ... }`. It runs once the page has loaded on the target origin and before recording starts, so nothing in it is on the video: use it to sign in or click through to the screen you want the video to open on. The runner only waits for `document.readyState`, so poll inside it for your app's own ready state (for example a menu or a route name). It must end on the target origin, which the runner checks when it returns, and it runs on every run, so make it safe to repeat |
| Blur something on screen | `--mask <css selector>` (repeat it for more). Matching elements are blurred in the picture, for a name or an account number in a header. It hides pixels only: anything you pass to `rec.show` or `rec.check` still appears in the caption and in `steps.json`, so never put masked text in either |
| Check the body before recording | `--rehearse` (see above) |
| Do not open the receipt when the run ends | `--no-open`. By default the receipt opens in the default browser automatically |
| Keep the URL's query string in the log | `--show-query`. By default the query string and fragment are replaced by `<query redacted>` in `steps.json` and in error messages, because they often carry tokens |

**When a test account cannot sign in.** Some apps sign in by handoff: a page in one app opens the target in a NEW tab with a one-time token in the URL, and the target keeps its session per tab (`sessionStorage`). `--profile` cannot carry that between runs, the runner's single tab is not the tab a handoff opens, and there may be no test account at all. The only route is to give the runner the handoff URL as `--url`, and that moves a credential from one browser to another, so get the user's explicit yes for that run; a yes for an earlier run does not carry over.
- **Capture the URL without spending it.** The token is usually consumed when the target first loads it, and a click that opens a tab spends it. In the app that launches the handoff, intercept the launch instead of clicking through: override `window.open`, or `HTMLFormElement.prototype.submit` when the app submits a hidden `target=_blank` form, so the code records where it would have gone. Read the launching app's source to see which it uses; a `window.open` override does nothing against a form submit. If a tab opened anyway, the URL is spent: close the tab and get a new one.
- **Use it once, immediately.** A failed run has spent it, so mint another before retrying.
- **Reach the right screen in `--setup`,** so the entry page (often a dashboard with personal data) is never on the video.
- **The runner redacts the query string and fragment** in `steps.json` and in its own error messages, but it cannot redact your shell history or the command line. Do not write the URL into a file, a work item or chat.

5. **Read the outcome.** Exit `0`: recorded, no check failed. Exit `3`: recorded, at least one check failed. Exit `1`: the run or recording itself failed (server down, redirected off the allowed host, Chrome closed, timeout). Exit `2`: bad arguments, a refused host or profile, or no Chrome. `verdict` in the JSON is `pass`, `fail`, `none` (nothing was asserted) or `error`; failed check labels are in `failed`. Exit `0` with `verdict none` is not a pass.
6. **Play the video to the end before you rely on it.** A file can be written and still fail to decode. Run `node <skill-dir>/references/play-check.mjs recording.mp4`: it plays the file in a headless Chrome, takes about as long as the video, and exits `0` with `"played": true` only when it reached the end with no error. Exit `0` is `played to end: yes`; exit `1` is `no` (quote its `error`); if it could not run at all, write `not run`.
7. **Hand the recording to the user.** The receipt has already opened in the user's browser (`opened: yes`); do not open it again, and if `opened` was not `yes`, print the absolute path and the open command below. A path in chat is not a download. Look in your tool list for one that sends a local file to the user (in the Claude desktop app, `SendUserFile`). If it is there, call it with `receipt.html` (it holds the video, the checks and the script, so it stands alone) and `recording.mp4`, the `Recording:` line as the caption, and the display mode left to the client. Test data on screen is not a reason to skip it. The only two reasons to send nothing are the two `Delivered:` values below: no such tool in your list, or the page showed real records. In either case print the absolute paths and one open command (`explorer /select,<path>`, `open -R <path>` or `xdg-open <folder>`).

## Browse, download and delete past recordings

`node <skill-dir>/references/library.mjs` lists every recording newest first (verdict, target, commit, time, checks, size) and, per recording, lets the user **view** the receipt, **download** the video, or **delete** it after a confirmation. Deleting is permanent and removes only that one folder. It runs on the loopback address only, puts a random token in the URL it prints, opens the user's browser (`--no-open` to skip), closes itself after 60 idle minutes (`--idle <minutes>`), and reads another folder with `--root <dir>`.
- It never starts by itself: a run only prints the command. The user can run it any time. When they ask to see or manage old recordings ("show my recordings", "open the library"), start it in the background, open the printed URL for them (in your in-app browser pane if you have one; otherwise leave off `--no-open` so it opens their browser), tell them it closes itself when idle, and stop it when they are done.
- Deleting is the user's act, on the page. Never delete a recording for them unless they ask you to.
- Recordings are never cleaned up automatically. That is why they live outside every repo.

## Report (every slot required)

```
Recording: <path> · <seconds> s (<paced N ms/update | real time>) · <host> · commit <sha> · verdict <pass|fail|none|error> · played to end: <yes|no|not run>
Delivered: <file card sent | path only - no send-file tool in this session | path only - real records on screen>
Receipt: <path to receipt.html> · opened in browser: <yes | skipped: why | failed: why> · all recordings: node <skill-dir>/references/library.mjs
Tests: <n> checks, <p> pass, <f> fail - <label of each failed check>
Not covered: <flows or paths the body did not drive>
```

No recording made: `Recording: none - <why>`. Zero failing checks is a valid outcome; `verdict none` is not a pass, report it as "walked, not asserted".

## Limits - state them, do not work around them

- **One page.** The recorder lives in the page, so a full page load during the body ends the recording. Sign in first through `--setup` or `--profile`, then drive same-page interactions.
- **Synthetic events.** `el.click()` and dispatched events are not trusted input. Handlers that check for a real user gesture, file pickers and native dialogs cannot be driven this way.
- **The video shows what the page displayed.** `check` reads the DOM. Layout and visual claims need a person watching the footage.
- The Chrome window is visible while it runs, and closing it ends the run: the error then names Chrome's exit code. The caption covers the page's top-left.
- **Platforms.** Exercised on Windows only. The macOS paths (Chrome under `/Applications` or `~/Applications`; `--use-mock-keychain` so a fresh profile never asks for keychain access; no `python` or `git` spawned where a Mac without developer tools would show an install prompt) follow Chrome's documented behaviour but have not been run on a Mac. On a Mac, check first whether tab capture asks for the system Screen Recording permission; if it does, that is a prompt the runner cannot answer.
- Recording a screen with personal or regulated data is disclosure surface: keep files local, name the host in the report, and delete them from the library when done.

## Excuses that mean stop

| Excuse | Reality |
|---|---|
| "My report lists what I checked" | A report is your claim. The video is what someone else can check. |
| "I gave them a script to paste into the console" | That replays nothing you observed and shows no run. Record the run. |
| "Everything passed, so recording is overkill" | The person who was not there has only your word without it. |
| "I'll narrate the steps in the caption" | Narration is not proof; only `rec.check` on requirement-derived values is. |
| "It's only a local file, the path is enough" | A path is not a download. If a send-file tool is in your list, send it. |

## Anti-patterns

- ❌ Self-certifying "PASSED, ready for deployment" with no video, screenshot or log. ✅ Record it, then report the verdict the video shows.
- ❌ Expected values read back from the page under test. ✅ Expected values from the requirement.
- ❌ Reporting success because the script exited 0 and a file exists. ✅ Run `play-check.mjs` and quote its result.
- ❌ Ending with a path in chat and calling the recording delivered. ✅ Send the file, or write one of the two `path only` reasons above.
- ❌ Publishing the MP4 as an artifact or uploading it anywhere. ✅ A file card in the conversation, or the path: a screen recording can carry regulated data and an upload leaves the machine.
- ❌ Asking the user to click Allow or approve a prompt to start recording. ✅ The runner has no prompt to answer.
- ❌ Clicking through a handoff to "see the URL" and then reusing it. ✅ Intercept the launch, use the URL once, and get the user's yes first.
- ❌ Recording before the body has been rehearsed. ✅ `--rehearse` until the checks say what you expect.
- ❌ Pre-accepting screen capture in the user's own browser, or pointing `--profile` at a real one. ✅ Only the throwaway Chrome the runner launches.
- ❌ Recording a multi-page flow and reporting the truncated video as the run. ✅ Say the flow is out of scope and use another engine, `Recording: none`.

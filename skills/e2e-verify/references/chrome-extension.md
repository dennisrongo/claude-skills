# Testing a Chrome extension (Manifest V3) with Playwright

Written from one real setup: Playwright 1.64 on Windows, a Vite-built MV3 extension with a new-tab override and a service worker. What was **observed** running is marked as such; what is **known from documentation** but not re-run here is marked `not re-observed`. Confirm against your own run before quoting either.

## Why the usual launch doesn't work

- Extensions load only in a **persistent context**: `chromium.launchPersistentContext(userDataDir, …)`. A plain `browser.newContext()` ignores them.
- Run **Playwright's bundled Chromium** (or Chrome for Testing), not the user's installed branded Chrome. Recent branded Chrome builds ignore `--load-extension` (not re-observed — documented by the Chromium team). The reliable path is the Chromium Playwright manages.
- **`headless: true` alone is not enough.** Playwright's default headless binary is the stripped-down headless shell, which does not load extensions: observed, the same build and flags gave a service worker with the full Chromium binary and none with the headless shell. Make the launch use full Chromium in new headless mode — `channel: 'chromium'` (documented by Playwright; not re-observed, that revision was not installed here) or an explicit `executablePath` to the full binary (observed working). With the full binary, headless ran every test.
- Do not fall back to a visible window to "make it work" — a visible window takes the user's keyboard focus (see the last section).
- Test the **built output**, not the sources. Point `--load-extension` at the build directory and build first (`build && playwright test` as one script). A stale build produces a green run of old code.

## The fixture

One context per test, a throwaway profile, the extension ID read from the service worker URL:

```ts
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const extensionPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

type Fixtures = { context: BrowserContext; extensionId: string; extensionPage: Page }

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const userDataDir = mkdtempSync(join(tmpdir(), 'ext-e2e-'))
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      channel: process.env.PW_CHROMIUM_PATH ? undefined : 'chromium',
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    })
    await use(context)
    await context.close()
    rmSync(userDataDir, { recursive: true, force: true })
  },

  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers()
    if (!worker) worker = await context.waitForEvent('serviceworker')
    await use(new URL(worker.url()).host)
  },

  extensionPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/<page>.html`)
    await use(page)
  },
})

export { expect } from '@playwright/test'
```

- `<page>.html` is whichever extension page the test is about (new tab, popup, options). Opening it by `chrome-extension://` URL was observed; navigating to `chrome://newtab` to prove the **override itself** takes over was not tried — if the override is the requirement, test that separately and say so.
- In a `"type": "module"` package `__dirname` does not exist; derive it from `import.meta.url` as above (known; the fixture avoids it rather than having observed the error).
- Assert persisted state from inside the extension page, where `chrome.storage` exists: `await page.evaluate(async () => (await chrome.storage.local.get('<key>')).<key>)` (observed). Check both the visible effect and the stored value, and reload to prove it persisted.

## Browser revision mismatch

Playwright wants one specific Chromium revision. A machine that has a different cached revision fails to launch (observed: the installed Playwright expected a newer revision than the one on disk).

✅ `npx playwright install chromium` once, or point `PW_CHROMIUM_PATH` at the cached `chrome` binary under the Playwright browser cache and keep the fixture's `executablePath` override.
❌ Pointing the fixture at the user's installed Chrome.

## Cold-start flake — report it, don't hide it

Across ten full runs of a four-test suite, three had a test time out or fail in launch or teardown after 30 s or more (the whole run took over a minute); the other seven finished in about ten seconds with every test around two seconds. It did not reproduce on demand and the cause is unknown (a leftover browser process from a timed-out run and first-launch file scanning are untested guesses).

- ✅ Rerun the suite once, quote both results, and say `flaky on cold start — cause not found`.
- ❌ Raising the test timeout to make it pass. A longer timeout hides the hang and slows every later failure.
- ❌ Reporting the second, green run alone.

## Proving no OS pointer or focus was used

Protocol-driven clicks (`locator.click()`) go to the page over the debugging protocol and never move the OS cursor, and headless opens no window to take focus. Say that only after observing it, with the skill's sampler (Windows): start it in the background for longer than the run, run the suite, read its output.

```powershell
Start-Process pwsh -ArgumentList '-NoProfile','-File','<skill-dir>/scripts/pointer-sample.ps1','-Seconds','40','-OutFile','pointer.txt' -WindowStyle Hidden
npx playwright test
Start-Sleep 40
Get-Content pointer.txt
```

One cursor position and one foreground window across the run is the evidence. The person must keep their hands off the mouse and windows for those seconds, or what they do is indistinguishable from the tool's; a sample taken only before and after the run proves nothing. Check focus as well as the cursor: a visible browser window can take the foreground without ever moving the pointer (observed with a headed recorder). The script is Windows-only; on another OS use that platform's cursor-position and active-window calls the same way.

## What protocol-level testing cannot reach

The browser toolbar, the extensions menu, the "keep this change" prompts, permission prompts and native file pickers live outside the page. Playwright cannot click them. If a requirement lives there, either test the page-level behavior behind it and list the native step under **Not walked**, or use an OS-level driver in background mode (for example Cua Driver, which posts input to the target window instead of the global queue). That path was **not tried** in the setup this file comes from — treat it as a lead, and observe it working before claiming it.

## Also out of scope here

- OAuth and `chrome.identity` sign-in flows need real accounts; they never run against real user data (see the safety gate in `SKILL.md`).
- Network calls the extension makes on load (weather, feeds, sync) hit real hosts unless the test routes them; stub them with `page.route` when a flow must be deterministic.

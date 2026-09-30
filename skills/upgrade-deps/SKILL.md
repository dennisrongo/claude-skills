---
name: upgrade-deps
description: Upgrade project dependencies safely — inventories current→target versions from the actual manifest/lockfile, reads the real changelog/release notes for every major bump (a breaking-change claim without a changelog citation is a hypothesis), greps the codebase for each breaking API before declaring it safe, upgrades one major at a time with tests+build quoted green between batches, and reports a per-package table of what changed and what evidence backs "safe". Use this skill whenever the user says "upgrade dependencies", "update packages", "bump <package>", "is it safe to upgrade", "update to the latest", "fix the npm audit", "dependabot PR review", or "/upgrade-deps" — even if they don't explicitly say "dependency skill". Do not use for adding a NEW dependency (that's a design decision — use plan-and-build) or diagnosing a breakage after an upgrade already happened (use diagnose).
---

# Upgrade Deps

Upgrade dependencies as a verification exercise, not a version-number edit. The failure mode this skill exists to prevent: bump everything, build goes green, ship — then the runtime break surfaces in production because the breaking change lived in behavior, not in types. Every "safe to upgrade" claim here is backed by a named check: the changelog actually read, the breaking API actually grepped for, the suite actually run.

## When to use this skill

- The user says "upgrade dependencies", "update packages", "bump X to latest", "is it safe to upgrade X", "handle the dependabot/renovate PRs", "fix the audit warnings", "/upgrade-deps".
- A CVE or audit finding requires moving a package (composes with `security-review`).
- A framework/runtime upgrade (Node LTS, .NET major, Next.js major) that drags dependencies with it.

Do **not** auto-trigger for adding a new dependency (a design choice — route to `plan-and-build` / `grill-with-docs` if installed, else get an explicit design decision from the user first) or for debugging an already-broken upgrade (`diagnose`). If the repo has no tests at all, say up front that upgrade safety cannot be verified beyond compile — and ask whether to proceed anyway or pin a minimal net first (`write-tests`).

## Workflow

1. **Inventory from the tools, not from memory.** Pick the outdated-check by which manifest exists: `package.json` → `npm outdated`; `*.csproj`/`*.sln` → `dotnet list package --outdated`; `pyproject.toml`/`requirements.txt` → `pip list --outdated`; `Cargo.toml` → `cargo outdated`; `go.mod` → `go list -u -m all`. If more than one manifest type is present, list them all and fold the choice into step 2's scope question — do not silently pick one. Quote the command's output. If the command errors or the subcommand isn't installed (`cargo outdated` is a third-party plugin; note that `npm outdated` exits non-zero by design when packages are stale — that exit code is output, not failure), quote the error and either query the registry directly for versions or STOP and ask — never fall back to memory. Training-data version knowledge is stale by construction: never state a "latest version" you didn't just read from a tool or registry. Note which entries are direct vs transitive: transitives usually move by bumping the parent or the lockfile, not the manifest.
2. **Confirm scope.** Everything? Security-only? One package? If the user didn't say and the outdated list has more than 5 packages or contains any major bump, ask once (`AskUserQuestion`): the plan for "patch the CVE" and "get current across the board" are different sizes. Classify the in-scope list: **patch/minor** (batchable) vs **major** (one at a time, each with its own evidence).
3. **Lock the baseline.** Full test suite (single-run mode, never watch mode) + build, summaries quoted. A result you didn't observe is "not run", never "passed". Red baseline → stop and surface: you can't attribute post-upgrade failures on a pre-broken repo.
4. **For every major bump: read the actual release notes.** Fetch the changelog / GitHub releases / migration guide for the versions being crossed (all of them — v2→v4 means reading v3's breaking changes too). Extract the breaking-change list. No changelog found → say so and downgrade confidence explicitly ("no changelog located; upgrading on test coverage alone") — and if step 5's runtime-risk mapping shows no test exercises the package either, that coverage is zero: ask before applying that major.
5. **Grep before declaring unaffected.** For each breaking change, search the repo for the removed/renamed API, changed config key, or altered default. Cite hits (each becomes a migration edit) or state the negative concretely: "no usage — repo grep for `<symbol>` returned nothing". Behavioral breaking changes (changed defaults, stricter parsing, timezone/locale changes) don't grep well — list them separately as **runtime risks** and name which test would catch each, or that none would.
   - ❌ "v5 has breaking changes but they probably don't affect us."
   - ✅ "v5 removes `parser.lenient` (changelog §2). Grep: 2 call sites — `config.ts:12`, `import.ts:88` — both need the new `strict:false` option. Also v5 changes default timezone handling (runtime risk: covered by `date-roundtrip` tests)."
6. **Upgrade in evidence-sized batches.** Patch/minor: one batch, then tests+build, quoted. Majors: strictly one package at a time — apply the bump plus its migration edits from step 5, run tests+build, quote, commit, next. Match the repo's existing commit convention: read the last ~10 subjects in `git log --oneline` first; use `conventional-commits` (`chore:`/`fix:`) only when the log already follows it or the repo has no convention — never impose it on a repo with a different house style. If the user hasn't already authorized commits, ask once before the first one. When a batch goes red: read the error, change exactly one thing, retry once; still red → revert that bump, mark the package **blocked** with the quoted error, and continue with the rest. Two failures on the same package is a report item, not a loop.
7. **Lockfile and peer hygiene.** Regenerate the lockfile with the ecosystem's tool and commit it with the manifest — never hand-edit it. Never silence resolution errors with `--force` / `--legacy-peer-deps` without surfacing what conflict is being overridden and getting a yes. For a transitive CVE with no direct bump available, prefer the ecosystem's override mechanism (`overrides` / `resolutions` / central package management) and label it as a pin to revisit.
8. **Report the table + the honest residue.** Per package: from → to, breaking changes affecting THIS repo (with the grep/changelog evidence), migration edits made, test result. Fill this skeleton verbatim (one row per package, then the three residue bullets — keep it tight):

   ```
   | Package | From → To | Breaking changes (evidence) | Migration edits | Tests |
   |---|---|---|---|---|
   | <name> | <v-old> → <v-new> | <changelog §/grep quote, or "no usage — grep for `<symbol>` empty"> | <file:line edits, or none> | <suite summary line, or "not run"> |

   **Blocked:** <package> — <quoted error>
   **Runtime risks (no test covers):** <risk> — <which test would catch it, or "none">
   **Held back deliberately:** <package> — <reason, e.g. "next stayed on 14 — the 15 migration is its own task">
   ```

   Every "breaking changes" cell is tagged per the verification doctrine — `verified` (changelog fetched + grep quoted + suite summary quoted), `inferred`, or `assumed` (e.g. "no changelog located"); the runtime-risks bullets ARE the `assumed` bucket. An untagged "safe" is a vibe. Zero-affected upgrades are a valid, common outcome — a clean table is the report, not a reason to pad. Keep every residue bullet present even when its value is "none".

   **Before reporting — tick every box or say why not:**
   - Every major row cites a changelog you actually fetched.
   - Every "unaffected" quotes its grep result.
   - Every test cell quotes a suite summary line or reads `not run`.
   - Lockfile regenerated and committed alongside the manifest.
   - Residue section present even when empty.

   Any box you cannot tick → fix it or say so in the report; never report around it.

## Examples

### Example 1: the routine sweep

**User:** "Update this project's dependencies."

**Claude:** Runs `npm outdated` (quotes it: 14 minor, 3 major), confirms scope = all, baseline green (quoted), batches the 14 minors → suite green → commit; then majors one at a time: reads `zod` v4 release notes, greps the 3 renamed APIs (7 call sites migrated), suite green, commit; `eslint` v9 flat-config migration done the same way; third major's changelog reveals a Node engine bump beyond the repo's CI version → marked **blocked** with the evidence, not forced. Final table + residue.

### Example 2: CVE-driven, transitive

**User:** "npm audit is flagging lodash under some build plugin, fix it."

**Claude:** Runs `npm audit` (quotes the advisory + path), finds it transitive under a plugin whose latest still pins the bad range, adds an `overrides` entry, regenerates the lockfile, re-runs audit (quotes: 0), runs the build to prove the override didn't break resolution, labels the override as a revisit-when-upstream-fixes pin in the report.

## Anti-patterns

- ❌ Stating a package's latest version or breaking changes from memory — versions move; only tool output and fetched changelogs count.
- ❌ Bumping all majors at once — when the suite goes red you can't attribute the failure, and the debug costs more than the sequencing saved.
- ❌ "Build passes, so the upgrade is safe" — compilation proves the typed surface only; changed runtime defaults, dynamic access, and reflection sail through. Name the runtime risks instead of implying their absence.
- ❌ `--force` / `--legacy-peer-deps` / `--ignore-engines` applied silently to make the error go away — that's deferring the break to runtime and hiding the decision from the user.
- ❌ Hand-editing the lockfile, or committing the manifest without regenerating it.
- ❌ Retrying a red upgrade in a loop with mutations until something compiles — one informed retry, then revert, block, and report.
- ❌ Sneaking unrelated "while I'm here" refactors into upgrade commits — the diff should be bump + its migration edits, nothing else.
- ✅ Tool-derived inventory → changelogs actually read → breaking APIs grepped with citations → one major per commit, suite quoted between → table + honest residue.

## Notes

- Framework majors with published codemods (Next.js, React, MUI, AngularJS→ng) — check for an official codemod before hand-migrating; run it, then diff-review its output like any other change.
- Version-pinning policy belongs to the repo (exact pins vs ranges, Renovate config) — match what's there; don't impose a policy mid-upgrade.
- Apply `think-like-fable` (when installed; the discipline stands regardless): the risk lives in the majors and the runtime-behavior changes, so that's where the effort goes; every "unaffected" is a re-derived negative (grep quoted), never a vibe; the report leads with what the user must decide (blocked items, risks), not the chronology.

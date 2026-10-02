---
name: dotnet-conventions
description: Writes new C# and .NET code to current best practice for the project's target framework while leaving existing code untouched - neighbours set structure and naming, never quality. Use this skill whenever the user says "fix this C# bug", "fix this .NET issue", "add an endpoint", "add a service", "add a repository", "review this C# diff", "review my .cs changes", or mentions "EF Core migration", "async", "dependency injection" or a background worker - even if they don't explicitly say "conventions". Not for creating a new solution from scratch (that is dotnet-onion-api).
---

# .NET Conventions

New code follows current best practice for the project's target framework, taken from Microsoft's own guidance. Existing code sets the structure (layering, naming, folder layout, data-access technology) and is never edited to meet this rule.

## When to use this skill

- "fix this C# bug" / "fix this .NET issue"
- "add an endpoint" / "add a service" / "add a repository" in an existing .NET codebase
- "review this C# diff" / "review my .cs changes"
- EF Core migration, async, dependency-injection or background-worker work

Do **not** use it to create a new solution or project from scratch - `dotnet-onion-api` (if installed) owns that.

## Workflow

1. **Detect the stack from files, then state it in one line:** the `.csproj` target (`net472`/`net48` = .NET Framework; `net6.0` or later = modern .NET), `LangVersion`, the data-access path, whether dependencies are injected, whether neighbours are sync or async, and whether a test project exists. A stack you did not read from a file is "assumed", never "detected".
2. **Use only what the target supports.** Never raise `TargetFramework` or `LangVersion`, add a package, or switch a library (serializer, ORM, test framework).
3. **Write new code to best practice; match the neighbours' structure and naming, not their quality.** Read the reference for each area your change touches:
   - `references/async-and-cancellation.md` - I/O, blocking, `CancellationToken`, `ConfigureAwait`
   - `references/errors.md` - catch, throw, rethrow, logging exceptions
   - `references/di-and-settings.md` - injection, lifetimes, options, hosted services
   - `references/data-and-http.md` - EF Core, SQL, `HttpClient`, serialization
   - `references/aspnet-request-scope.md` - `HttpContext`, request bodies, large results, background work
   - `references/security.md` - queries, authorization, input, secrets
   - `references/style-and-layout.md` - names, member order, namespaces, new files and folders, syntax forms
   - `references/dotnet-framework.md` - also read this when the target is .NET Framework (`net4x`): async policy, EF6, Web API 2 DI, `HttpClient`, language limits
   - ❌ New `ListActive` ends in `catch (Exception) { }` and returns an empty list "to match `Find`".
   - ✅ New method lets the exception propagate, like `Get` beside it; the report flags `Find`.
4. **Leave existing code alone.** Never edit an existing method to make it best practice. When new code needs a better form of something that exists only in a worse form, add a sibling beside it. The one permitted edit: an optional `CancellationToken ct = default` parameter on an existing async method your new code calls (it breaks no caller), listed under `Changed`.
   - ❌ `Get` changed from sync to `async` so the new code can await it.
   - ✅ `GetAsync(id, ct)` added beside `Get`; `Get` and its callers are unchanged.
5. **If best practice is out of reach without editing existing code,** follow the neighbour for that one point and record it under `Deviations`.
6. **Do exactly what was asked.** No new public surface (endpoint, controller, public interface) unless the task names it. Style follows `.editorconfig` and the neighbouring files. If the code needs no comment, add none. A comment is for a genuinely non-obvious *why* only, and is one short line (see `references/style-and-layout.md`).
7. **Verify** with the build and tests below, then report.

## Verify

From the repository root, audit the lines you added. Fix every real hit and rerun.

```bash
bash <this skill's directory>/scripts/audit.sh
```

It lists added `catch` blocks, blocking calls, `async void` and async methods with no `CancellationToken` (test code is ignored), in modified files and in new untracked ones. For each changed file it finds the nearest `.csproj`; on an SDK-style project targeting `net5.0` or later it builds with the analyzers on and reports only `CA1849` (blocking in async), `CA2016` (token not forwarded), `CA1031` (general catch), `CA2200` (`throw ex`) and `CA2000` (not disposed), and only on lines you added. It says why it skipped a project, for example a .NET Framework target. Every added `catch` must log or rethrow; a no-token hit is expected on .NET Framework and a defect on modern .NET.

Then build and run the tests. A project you cannot build here is `not built`, never `passed`; quote the summary line.

## Tests

- If a test project exists, add tests for the behavior you add, in its own framework and style: sibling naming, fakes and layout, no new package. Assert computed values on the happy path and cover the not-found or failure path.
- Run unit tests only. A test that needs a database or an external service runs only when the user asks. Exclude it with the filter that matches the project's tag:

| Framework | Tag | Filter |
|---|---|---|
| xUnit | `[Trait("Category", "Integration")]` | `--filter "Category!=Integration"` |
| NUnit | `[Category("Integration")]` | `--filter "TestCategory!=Integration"` |
| MSTest | `[TestCategory("Integration")]` | `--filter "TestCategory!=Integration"` |

- The `Passed` total must equal the count of non-integration tests in the source. A larger total means an integration test ran - say so.

## Report

Five slots, every one required; write `none` rather than omitting one.

```
Stack: <what you read, from which file>
Changed: <files, including each sibling or optional parameter you added>
Verified: <command + quoted summary line + names of new tests, or "not built: <why>">
Deviations: <each place the new code is not best practice, and why>
Flagged, not changed: <one line per defect you saw in existing code and left alone>
```

## Example

**User:** "Add an endpoint that returns details for an item." The repository, service and controller are sync, and the repository reads a file with `File.ReadAllText`.

**Claude:** modern .NET with sync neighbours doing blocking I/O. Adds `GetAsync(id, ct)` beside `Get`, `GetDetailsAsync(id, ct)` in the service and an async action taking `ct`; `Get` and every caller are unchanged. The service's `Find` swallows every error, so the new path does not go through it. Report: `Deviations: none`; `Flagged, not changed: ItemRepository.Get blocks on file I/O; ItemService.Find swallows all exceptions`.

## Anti-patterns

| Excuse | Reality |
|---|---|
| "It matches the surrounding code" | Match structure and naming, never quality. |
| "The neighbours are sync / carry no token" | New code on modern .NET is async with `ct`; add a sibling, do not edit the old method. |
| "Quick one" | Quick limits scope, not the verification or the test. |
| "Fixing it would change existing behaviour" | True - flag it; do not copy it and do not fix it here. |

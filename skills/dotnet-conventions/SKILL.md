---
name: dotnet-conventions
description: Keeps changes to existing C# and .NET code correct and in scope - the new code copies the surrounding structure but never its defects, carries CancellationToken through async paths, and never swallows exceptions. Use this skill whenever the user says "fix this C# bug", "fix this .NET issue", "add an endpoint", "add a service", "add a repository", "review this C# diff", "review my .cs changes", or mentions "EF Core migration", "async", "dependency injection" or a background worker - even if they don't explicitly say "conventions". Not for creating a new solution from scratch (that is dotnet-onion-api).
---

# .NET Conventions

Rules for editing existing C# and .NET code so the new code is correct and in scope, whatever state the surrounding code is in.

## When to use this skill

- "fix this C# bug" / "fix this .NET issue"
- "add an endpoint" / "add a service" / "add a repository" in an existing .NET codebase
- "review this C# diff" / "review my .cs changes"
- EF Core migration, async, dependency-injection or background-worker work

Do **not** use it to create a new solution or project from scratch - `dotnet-onion-api` (if installed) owns that.

## Workflow

1. **Detect the stack from files, then state it in one line.** Read the `.csproj` target (`net472`/`net48` = .NET Framework; `net6.0` or later = modern .NET), the data-access path (EF Core, EF6, Dapper, ADO.NET, stored procedures), whether dependencies are injected or `new`-ed, and whether neighbouring methods are sync or async. A stack you did not read from a file is "assumed", never "detected".
2. **Copy structure, not defects.** Follow the neighbouring code's layering, naming, data-access path and sync/async style. Never copy anything on the Defect list, even when the method next door does it.
   - ❌ New `ListActive` ends in `catch (Exception) { }` and returns an empty list "to match `Find`".
   - ✅ New method lets the exception propagate, like `Get` beside it; the report flags `Find` in one line.
3. **Do exactly what was asked.** No new public surface (endpoint, controller, public interface) unless the task names it. "So other code can read it" means an internal interface, not an HTTP route.
   - ❌ "Keep the latest values in memory so other code can read them" becomes a new public controller.
   - ✅ An internal reader interface; the report offers an endpoint as a suggestion.
4. **Apply the Defect list and the Cancellation rules below** to every line you add.
5. **Self-audit the added lines**, then verify with the project's own build and the Tests rules below. Quote the summary line. A project you cannot build here is `not built`, never `passed`.
6. **Report with the six slots below.** Every slot is required; write `none` rather than omitting one.

```
Stack: <what you read, from which file>
Changed: <files>
Verified: <command + quoted summary line, or "not built: <why>">
Tests: <name of each new test and the filter you ran with, or "none: no test project">
Cancellation: <for each new async method, the line that forwards `ct`, copied from the file; `n/a` only for a .NET Framework target or a method that does no I/O>
Flagged, not changed: <one line per defect you saw and left alone>
```

## Defect list

In code you write: never. In code you only touch or pass through: leave it, and name it in one line in the report. Never fix it in the same change.

- A `catch` that swallows - empty, or returning null/default/an empty list on any error. The one exception: `catch (OperationCanceledException) { }` on a shutdown path you wrote.
- Reusing an existing method that swallows. Before calling an existing method from new code, read its body. If it swallows, call the layer below it directly so the new path does not inherit the masked failure, and flag that method in the report.
  - ❌ `GetDetailsAsync` calls the service's own `GetAsync`, whose `catch { return null; }` turns a repository failure into a 404.
  - ✅ `GetDetailsAsync` calls `_repo.GetAsync(id, ct)` directly; the report flags `GetAsync`.
- SQL built by string concatenation or interpolation (pass parameters).
- Commented-out code, and new comments that restate the next line.
- `Thread.Sleep`, `.Result`, `.Wait()` or `async void` in new code.

## Cancellation (modern .NET only)

Do not add async or tokens to a .NET Framework sync stack - match the sync style there.

- Every new async method that does I/O takes `CancellationToken ct` as its last parameter and forwards it to every call that accepts one. Controller actions take `CancellationToken ct`.
- If a method on your call path takes none, add `CancellationToken ct = default` to it (optional, so no caller breaks) and list those signatures under `Changed`. A token your new method accepts but never forwards is a defect. Touch only the methods your new code actually calls, not their siblings.
  - ❌ `ct` added to `Get`, `List` and `ListAsync` (and to a commented-out line) when the new code only calls `GetAsync`.
  - ✅ `ct = default` on `GetAsync` alone, interface and implementation, listed under `Changed`.
- Worker loops run `while (!stoppingToken.IsCancellationRequested)`. Catch and log a failed iteration, and let shutdown through:

```csharp
catch (Exception ex) when (ex is not OperationCanceledException)
{
    _logger.LogWarning(ex, "Refresh failed; keeping the previous value");
}
```

- ❌ `catch (Exception ex)` around an awaited call - shutdown is logged as an error and swallowed.
- ✅ The `when` filter above - failures are logged, cancellation propagates.

## Background work and settings (modern .NET)

- A periodic job derives from `BackgroundService` and is registered with `AddHostedService<T>()`. Do not hand-write `StartAsync`/`StopAsync` plumbing or start work from `Program.cs`.
- Outbound HTTP goes through `IHttpClientFactory` or a typed client. Never build a new `HttpClient` inside a method that runs repeatedly.
- Settings the job needs are bound to an options class with `AddOptions<T>().Bind(...)` and injected as `IOptions<T>`. Do not read `IConfiguration` ad hoc, and do not put a literal URL or interval in code as a fallback.
  - ❌ `configuration["Job:ApiUrl"] ?? "https://api.example.invalid/latest"`
  - ✅ `IOptions<JobOptions>` with the URL in `appsettings.json`, validated on start.

## Tests

- If a test project exists, add tests for the behavior you add, in that project's own framework and style: copy the sibling tests' naming, fakes and layout. No new package, no new mocking library. Cover the happy path with the computed values asserted, and the not-found or failure path. A test that only asserts `NotNull` proves nothing.
  - ❌ Behavior added, test project present, no test added: "quick one".
  - ✅ `GetDetailsAsync_ExistingId_ReturnsDetails` and `GetDetailsAsync_UnknownId_ReturnsNull`, written like the existing `GetAsync_*` tests.
- Run unit tests only. A test that needs a database or an external service runs only when the user asks. Find how the project tags such tests and exclude them with the matching filter:

| Framework | Tag | Filter |
|---|---|---|
| xUnit | `[Trait("Category", "Integration")]` | `--filter "Category!=Integration"` |
| NUnit | `[Category("Integration")]` | `--filter "TestCategory!=Integration"` |
| MSTest | `[TestCategory("Integration")]` | `--filter "TestCategory!=Integration"` |

- Check the filter worked: count the non-integration tests in the source, and the `Passed` total must equal that count. A larger total means an integration test ran - say so in the report; do not call the run clean.
  - ❌ `--filter "TestCategory!=Integration"` on an xUnit project: the tag is a `Category` trait, so the integration test still runs and the total is one too high.
  - ✅ `--filter "Category!=Integration"` on xUnit, and `Passed: 5` for 3 existing + 2 new unit tests.

## Self-audit (added lines only)

```bash
git diff -U0 | grep '^+' | grep -n 'catch'
git diff -U0 | grep '^+' | grep -nE 'Thread\.Sleep|\.Result\b|\.Wait\(\)|async void'
git diff -U0 | grep '^+' | grep -nE 'async Task'
```

Every added `catch` is listed and each one logs or rethrows. Every added `async Task` signature carries a `CancellationToken` (modern .NET), and that token is passed on inside the method body - grep the parameter name; a token that appears only in the signature is a defect. Any other hit is fixed and the audit re-run; a hit is never reported as acceptable.

## Examples

### Example: add a method to a sync .NET Framework service

**User:** "Add an endpoint that lists active items for a group. Follow how the rest of the code does it."

**Claude:**
- Stack: `net472`, sync, stored procedures through the repo's data helper (read from the `.csproj` and the repository class).
- Adds controller action, service method and repository method through the existing helper, synchronous, no new package.
- The repository's `Find` swallows every error; the new method does not copy that.
- Report: `Verified: not built: .NET Framework project, no build on this machine`; `Flagged, not changed: ItemRepository.Find swallows all exceptions`.

## Anti-patterns

| Excuse | Reality |
|---|---|
| "It matches the surrounding code" | Match structure, never defects. |
| "Quick one" | Quick limits scope, not the self-audit or the test. |
| "The existing async methods carry no token" | Then they are the defect, and new code does not copy it. On modern .NET your new methods carry `ct`; add `ct = default` to the call path. |
| "The repository method takes no token, so there is nothing to forward" | That is the case the rule exists for: add `ct = default` to that method and forward it. A token accepted and never forwarded is a defect. |
| "Fixing it would change existing behaviour" | True - so flag it; do not copy it and do not fix it here. |
| "Other code can read it" | An internal interface, not a route. |

- ❌ Adding `async` and tokens to a sync .NET Framework stack because modern guidance says so.
- ❌ Fixing the neighbour's empty `catch` in the same change - that is scope creep; flag it.
- ❌ Reporting "builds" without a quoted summary line.
- ✅ Detect the stack, copy the structure, leave the defects named but untouched.

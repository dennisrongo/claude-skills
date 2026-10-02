# .NET Framework (net4x)

Read this in addition to the other references when the target is .NET Framework. Their rules still hold unless this file says otherwise, but modern-only APIs do not exist here.

Sources: async/await best practices (Cleary, 2013 archive); Using Asynchronous Methods in ASP.NET 4.5; EF6 async, performance, DbContext and related-data pages; Dependency Injection in ASP.NET Web API 2; HttpClient guidelines. Not researched: web.config transforms and secrets, Web Forms and MVC 5 beyond async, WCF.

## Async

- Async helps I/O-bound work under load and does nothing for CPU-bound or short work. Few applications need everything async, and converting a few I/O methods often gives most of the benefit.
- New I/O code is async when the whole new call path can be async without editing an existing method: a standalone path (an action calling an external API) is, and so is a path whose sync data helper gets an async sibling beside it. Stay sync, and record it under `Deviations`, only when going async would mean editing an existing method or the host cannot await (for example Web Forms page events).
- Never block on async (`.Result`, `.Wait()`). ASP.NET has a synchronization context that runs one chunk of code at a time, so the continuation waits for the thread that is blocked: a deadlock. Blocking also wraps errors in `AggregateException`.
- No `async void` except event handlers, and no async lambda passed where an `Action` is expected. In Web Forms use `RegisterAsyncTask`, not async page events (their order is not guaranteed).
- `ConfigureAwait(false)` in library and context-free code. Never where code after the `await` needs `HttpContext.Current` or builds the response, which includes the `return` of a controller action. Keep context-sensitive code thin.
- No `await` inside a `lock`; use `SemaphoreSlim.WaitAsync`. Replace `Thread.Sleep` with `await Task.Delay`, and `WaitAll` with `await Task.WhenAll`.
- New async methods still take a trailing `CancellationToken ct = default` and forward it. Web Forms async tasks receive a token when `AsyncTimeout` is set; do not invent a cancellation source for an entry point that has none.

## EF6

- The "Choosing the data path" rule in `data-and-http.md` applies: with EF6 already referenced, a simple query is LINQ on the existing context, not a new proc.
- One `DbContext` per request, disposed (`using`, or by the container that created it), never shared across threads, never held for the life of the application.
- Read-only queries: `AsNoTracking()`.
- Lazy loading is on for POCOs with `virtual` navigation properties. In new code prefer `Include` or a projection; never touch navigation properties in a loop (N+1); turn lazy loading off before serializing an entity. `Include` cannot filter, and many `Include`s in one query make a large payload, so split it.
- Parameterized queries only (also keeps the query plan cache effective). `CompiledQuery` only as a static, and only when measured.
- Async (`ToListAsync`, `SaveChangesAsync`, with `using System.Data.Entity;`) only where the async rule above allows it. Microsoft notes it often brings no benefit; measure first.
- Bulk changes: `AddRange` and `RemoveRange`. If `AutoDetectChangesEnabled` is switched off for a hot loop, switch it back on.

## Dependency injection (Web API 2)

- Controllers are created per request through `IDependencyResolver`; a container (Unity is the documented example) supplies constructor dependencies, with a per-request lifetime such as `HierarchicalLifetimeManager`. Disposing the scope disposes the dependencies.
- A hard-coded `new Repository()` in a controller is the documented defect: it cannot be swapped or tested. If the project already registers a resolver, register and inject. If an existing controller builds its own dependencies, follow its way for that point and flag it.

## HttpClient and connections

- Never one `HttpClient` per call (ports are left in `TIME_WAIT`). Microsoft's guidance for .NET Framework is `IHttpClientFactory`, which needs the `Microsoft.Extensions.Http` package. If the project does not reference it, do not add it for a feature: use one shared `HttpClient` for the application's lifetime and record under `Deviations` that DNS changes are not picked up until connections are recycled.
- If the code needs cookies, avoid the factory: pooled handlers share a `CookieContainer`.
- ASP.NET limits outbound connections per endpoint to 12 times the CPU count. Raise `ServicePointManager.DefaultConnectionLimit` in `Application_Start` only for a measured high-concurrency need.

## Language version and syntax

- Never raise `TargetFramework` or `LangVersion`, and never set `LangVersion` to `latest`; a language version newer than the target's is unsupported.
- Write only syntax the project already builds with. With no `LangVersion` set, .NET Framework projects default to C# 7.3 (from memory; confirm with `#error version`). That means no nullable reference types, switch expressions, ranges, `using` declarations, file-scoped namespaces, records, `init` or `required`, and none of `ArgumentNullException.ThrowIfNull`, `Task.WaitAsync` or `IAsyncEnumerable`.

## Everything else

- Errors, SQL parameterization, disposal and tests follow `errors.md`, `data-and-http.md` and `SKILL.md`, minus the modern-only APIs.
- Configuration and logging: use what the project uses (`appSettings`, its logging library). Do not introduce `IOptions` or `ILogger`.

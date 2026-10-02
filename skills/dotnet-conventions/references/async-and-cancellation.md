# Async and cancellation

Sources: ASP.NET Core best practices; async guidance (David Fowler); code-analysis rules CA1849, CA2016, CA2007.

## Do

- New code that does I/O is async down the whole new call path. Async is viral: mixing sync and async invites thread-pool starvation. Controller actions return `Task` or `Task<T>`.
- Every new async method that does I/O takes `CancellationToken ct` as its last parameter and forwards it to every call that accepts one (CA2016). Controller actions take `ct`; it binds to request abort.
- If a method on your call path takes no token, add `CancellationToken ct = default` to it and list that signature under `Changed`. Touch only the methods your new code calls, not their siblings.
- If the layer below has only a sync method, add an async sibling beside it. Leave the original and its callers untouched.
- Already-computed values: `Task.FromResult`. `ValueTask` only when measured.
- Timeouts: link a `CancellationTokenSource` with `CancelAfter` and dispose it, or use `Task.WaitAsync(timeout, ct)` on .NET 6+.
- Catch `OperationCanceledException`, not `TaskCanceledException`.
- `TaskCompletionSource`: pass `TaskCreationOptions.RunContinuationsAsynchronously`.
- Fire-and-forget: avoid. If unavoidable, discard explicitly (`_ =`), copy what you need first and own the exceptions. Long work belongs in a hosted service (see `aspnet-request-scope.md`).

## Don't

- `.Result`, `.Wait()`, `.GetAwaiter().GetResult()` (CA1849): thread-pool starvation, and deadlocks wherever a synchronization context exists (classic ASP.NET on .NET Framework, UI).
- `Task.Run` to make a sync API look async, or `Task.Run` followed by an immediate `await`.
- `async void`, except an event handler: an exception crashes the process.
- `Task.Run` for a long-running background loop: use a hosted service.

- ❌ `var r = _repo.Get(id);` inside an async method
- ✅ `var r = await _repo.GetAsync(id, ct);`, with `GetAsync` added beside `Get`

## ConfigureAwait

- ASP.NET Core application code has no synchronization context, so a plain `await` is right. CA2007 is a library rule; do not enable it for application code.
- Library code that can run anywhere: `ConfigureAwait(false)`.
- .NET Framework ASP.NET and UI code have a context: never block (above) and follow the neighbours' use of `ConfigureAwait`.

## Versions

- .NET Framework (`net4x`): the rules above that rely on a modern API do not apply; read `dotnet-framework.md` for the async policy, the deadlock risk and `ConfigureAwait`.
- `Task.WaitAsync` needs .NET 6 or later.

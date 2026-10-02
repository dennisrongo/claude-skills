# ASP.NET Core request scope and hot paths

Source: ASP.NET Core best practices.

## Blocking and bodies

- The request path stays async end to end, with no blocking I/O.
- Read bodies with async APIs (`ReadFormAsync`, `ReadToEndAsync`, `DeserializeAsync` on the stream). Never `Request.Form` or a sync read; Kestrel does not support sync reads.
- Never read a large request or response body into one `string` or `byte[]`: it lands on the large-object heap, and running out of memory is a denial of service. Stream it.
- `Request.ContentLength` can be null. Null means unknown, not zero, and a comparison such as `> limit` is then false.

## Results

- Return large collections in pages (page size and index) with a cap.
- Return a materialized list (`ToListAsync`) or `IAsyncEnumerable<T>`. A lazy `IEnumerable` is enumerated synchronously by the serializer.

## HttpContext

- Do not store `HttpContext`, or `IHttpContextAccessor.HttpContext`, in a field. Read it at the point of use and null-check it.
- It is not thread-safe: never touch it from parallel tasks. Copy the values you need first.
- Never use it after the request completes. An `async void` action completes the request early.
- Do not capture it, or request-scoped services such as a `DbContext`, in work that outlives the request. Copy the values and create a scope from `IServiceScopeFactory`.
- Status and headers cannot change once the body has started: check `Response.HasStarted` or use `OnStarting`. Do not call `next()` after writing the body.

## Long-running work

- Do not wait for it inside the request. Use a hosted service, a queue or an out-of-process job, and tell the client asynchronously.

## Hot paths and performance

- Keep middleware and per-request code short; no long-running tasks in middleware.
- Exceptions are rare. Do not use them for normal flow.
- Optimize only measured hot paths (caching, `ArrayPool`, pooling, compiled queries), never by default.

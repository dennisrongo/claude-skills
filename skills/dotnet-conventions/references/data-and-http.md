# Data access and HTTP

Sources: EF Core efficient querying; ASP.NET Core best practices; HttpClient guidelines; rule CA2100.

## Choosing the data path

- If the project already references Entity Framework (Core or EF6) and the query is simple, use EF with LINQ: a filter, a sort, a projection, a page, or a join of a few tables. Do not add a stored procedure or raw SQL for it.
- A stored procedure is right when the task names one, or the query is not simple: several statements, temp tables, heavy aggregation, bulk work, or set-based logic that LINQ translates badly.
- A project with no EF reference keeps its own path (ADO.NET, procs, Dapper). Never add EF to it; that is a package change.
- Leave every existing proc call as it is.
- Say which path you chose and why under `Deviations` when a task names a proc and the same data is a simple EF query.

## EF Core

- Async APIs always (`ToListAsync`, `SaveChangesAsync`). Do not mix sync and async in one app.
- Query only what you need: project with `Select`, filter, sort and aggregate in the database, and limit or page results (keyset paging for deep pages).
- Read-only queries use `AsNoTracking()`. It skips identity resolution, so one row referenced twice comes back as two instances.
- Related data: `Include` or a projection, never lazy loading (N+1). `AsSplitQuery()` when several collections are included (cartesian explosion). Never run a query inside a loop.
- Do not call `ToList()` or `ToArray()` and then keep applying LINQ: filter first, or stream with `AsEnumerable()` or `AsAsyncEnumerable()`.
- Raw SQL is a last resort: interpolated `FromSql` and `ExecuteSql` are parameterized; concatenated `FromSqlRaw` is not.
- A filter such as `EndsWith`, or an expression over a column, cannot use an index. Check the query plan for a slow query.
- Do not add compiled queries or `DbContext` pooling without a measurement.

## ADO.NET and SQL

- Parameterized commands or stored procedures. Never build command text from input by concatenation or interpolation. CA2100 can flag it but is not reliable, so check by eye.
- `using` for connections, commands and readers; async variants (`ExecuteReaderAsync`) on modern .NET.

## HttpClient

- Never create and dispose an `HttpClient` per request: sockets are left in `TIME_WAIT` and can run out.
- Modern .NET: `IHttpClientFactory` (prefer a typed client), or one long-lived or static client with `SocketsHttpHandler.PooledConnectionLifetime` set so DNS changes are picked up. .NET Framework: `IHttpClientFactory`.
- If the code needs cookies, avoid the factory: pooled handlers share a `CookieContainer`.
- Pass `ct`, set a timeout, and use the project's existing resilience approach. Add no package for retries.

## Serialization

- ASP.NET Core defaults to System.Text.Json. Do not introduce another serializer. If one that only supports sync reads is already in use, buffer the data asynchronously first.

# Dependency injection and settings

Sources: Dependency injection guidelines; ASP.NET Core best practices.

## Design

- Constructor injection. No `new` of a service you can inject, no service locator (`GetService` to fetch a dependency), no injected factory that resolves dependencies at runtime, no static access to services, no `BuildServiceProvider` while registering (use the overload that hands you the `IServiceProvider`).
- Small, focused services. Many constructor dependencies signal too many responsibilities.
- No static mutable state; use a singleton service instead.

## Lifetimes

- Default to transient. Scoped means per request or unit of work (a `DbContext`). Singleton only for a service with its own expensive or globally shared state, and it must be thread-safe.
- A longer-lived service must never hold a shorter-lived one (captive dependency): a singleton taking a scoped service is a bug. Turn on scope validation in development.
- Never resolve scoped or transient disposables from the root provider.
- The container disposes what it creates. Never dispose an injected service. Do not register `IDisposable` as transient; use a factory. An instance you create yourself and register (`AddSingleton(new X())`) is yours to dispose.
- No async constructors or async factories; blocking inside a factory deadlocks. Resolve synchronously, then call an async method.

## Settings

- Options pattern: an options class, `AddOptions<T>().Bind(section).ValidateDataAnnotations().ValidateOnStart()`, injected as `IOptions<T>` (`IOptionsMonitor<T>` when values reload).
- No literal URL, interval or key in code, and no fallback literal for a missing key.
- Never read `IConfiguration` ad hoc inside a service, and never put configuration or data in the container.
- Secrets never go in committed config: environment, user secrets or a vault.

- ❌ `configuration["Job:ApiUrl"] ?? "https://api.example.invalid/latest"`
- ✅ `IOptions<JobOptions>` with the URL in `appsettings.json`, validated on start.

## Hosted services

- Derive from `BackgroundService` and register with `AddHostedService<T>()`. Do not hand-write start and stop plumbing or start work from `Program.cs`.
- A hosted service is a singleton. Create a scope per unit of work with `IServiceScopeFactory.CreateAsyncScope()` to use scoped services such as a `DbContext`.
- Loop on `stoppingToken`, catch and log a failed iteration, and let shutdown through (see `errors.md`).

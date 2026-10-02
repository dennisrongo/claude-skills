# Errors

Sources: Best practices for exceptions; .NET coding conventions; rules CA1031, CA2200, CA2201, CA1510 to CA1513, CA2219, CA2254.

## Catch

- Catch only what you can handle, most specific type first. If you cannot recover, do not catch; let a caller do it.
- Never an empty `catch`. Never catch to return null, default or an empty list for every failure: it hides outages, for example a repository failure that surfaces as "not found".
- A general `catch (Exception)` needs an exception filter or a rethrow as its last statement (CA1031 flags the rest).
- Returning null for an expected not-found is fine. The defect is turning an exception into null.
- Do not use exceptions for routine control flow: check the condition first, or use a `Try*` method.
- Clean up with `using` or `await using`. Use `finally` only for things that are not disposable.
- Before calling an existing method, read its body. If it swallows, call the layer below it and flag it.

## Rethrow

- `throw;` inside the catch, never `throw ex;` (CA2200 resets the stack trace).
- Outside a catch block: `ExceptionDispatchInfo.Capture(ex).Throw()`.
- Wrapping: a new exception with the original as its inner exception.

## Throw

- Use predefined types: `InvalidOperationException` for bad state, the `ArgumentException` family for arguments. Never the reserved ones, such as `NullReferenceException` or `IndexOutOfRangeException` (CA2201).
- In a Task-returning method, validate arguments before the async part so the exception is thrown synchronously. Use `ArgumentNullException.ThrowIfNull` and the related throw helpers where the target has them (CA1510 to CA1513), and `ct.ThrowIfCancellationRequested()`.
- Never throw from `finally` (CA2219), `Equals`, `GetHashCode`, `ToString` or a static constructor.
- A custom exception only when no predefined one fits: the name ends in `Exception`, with constructors `()`, `(string)` and `(string, Exception)`, and extra properties only for programmatic use.
- Messages are clear sentences ending with a period.

## Logging an exception

- Message template plus the exception object: `_logger.LogError(ex, "Refresh of {Source} failed", source)`. Never an interpolated or concatenated template (CA2254). Never log secrets.

## Worker loop

Catch and log a failed iteration, and let shutdown through:

```csharp
catch (Exception ex) when (ex is not OperationCanceledException)
{
    _logger.LogWarning(ex, "Refresh failed; keeping the previous value");
}
```

- ❌ `catch (Exception ex)` around an awaited call: shutdown is logged as an error and swallowed.
- ✅ The `when` filter above: failures are logged, cancellation propagates.

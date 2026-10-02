# Security baseline

Deliberately thin. The items here come from the Microsoft pages named in the other references plus common guidance. A security design question goes to the user; it never becomes a new mechanism in a feature change.

- Queries: parameters or the ORM, never concatenated input. Order of preference for input that must reach a query: stored procedure, parameterized command, validated input (CA2100 guidance).
- Authorization: a new endpoint carries the same authorization attributes or policies as its sibling endpoints. If the siblings have none, say so under `Flagged, not changed`. Never widen access to make a call work.
- Input: validate at the boundary with the framework's validation attributes, check sizes before allocating, and treat `ContentLength` as unknown (see `aspnet-request-scope.md`).
- Secrets: none in code, committed config or logs. Environment, user secrets or a vault, read through `IOptions`.
- Logging: no secrets, tokens or personal data in messages. Message templates, not interpolation.
- Cryptography and hashing: framework APIs only, never hand-written.
- Add no authentication scheme, authorization policy, CORS or TLS setting as a side effect of a feature.

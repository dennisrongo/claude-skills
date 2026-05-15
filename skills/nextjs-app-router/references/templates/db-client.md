# Prisma client (singleton)

## `src/lib/db.ts`

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
```

## Why a singleton

Next.js dev hot-reload re-evaluates modules on every change. Without the global cache, each reload constructs a fresh `PrismaClient`, opens a new connection pool, and never closes the old one — within minutes of editing you exhaust your Postgres `max_connections` and start seeing `FATAL: sorry, too many clients already`.

The pattern above:
- In **production**, behaves like a normal module-scoped singleton (one client per process).
- In **dev**, attaches the client to `globalThis` so hot-reloads reuse it.

## Forbidden

- `import { PrismaClient } from '@prisma/client'; const prisma = new PrismaClient()` anywhere outside this file. Every consumer imports `db` from `@/lib/db`.
- Importing `db` from `src/auth.config.ts` (Edge runtime — can't import Prisma).
- Importing `db` from any `src/app/**` file outside `route.ts` files. Server pages and layouts do not touch the database.
- Calling `db.$connect()` / `db.$disconnect()` manually in handlers. Prisma manages the pool. The only place a manual `$disconnect()` is appropriate is at the bottom of `prisma/seed.ts`.

## Where `db` is allowed to be imported

| File pattern | Allowed? |
|---|---|
| `src/app/api/**/route.ts` | ✅ Yes |
| `src/auth.ts` | ✅ Yes (Credentials `authorize` reads user table) |
| `prisma/seed.ts` | ✅ Yes (uses `new PrismaClient()` directly; doesn't share with the app) |
| `src/lib/*.ts` (server-only helpers) | ✅ Yes |
| `src/auth.config.ts` | ❌ No — Edge runtime |
| `middleware.ts` | ❌ No — Edge runtime |
| `src/app/**/page.tsx` / `layout.tsx` (any non-`route.ts`) | ❌ No — pages/layouts don't fetch data; RTK Query → /api → db |
| `src/redux/**` | ❌ No — Redux runs in the browser |
| `src/components/**` | ❌ No |

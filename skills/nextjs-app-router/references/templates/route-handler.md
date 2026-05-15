# Route Handler template

Route Handlers under `src/app/api/**/route.ts` are the backend. Every one (except `/api/auth/[...nextauth]` and explicit public endpoints like `/api/health`) authenticates with `requireSession()`, validates inputs with the feature's Zod schema, and accesses the DB through the Prisma singleton.

## `src/app/api/{{feature}}s/route.ts` — list + create

```ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, withApiErrors } from '@/lib/api-auth';
import { {{feature}}Schema } from '@/app/(app)/{{feature}}s/schema';

export const GET = withApiErrors(async () => {
  const session = await requireSession();

  const rows = await db.{{feature}}.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(rows);
});

export const POST = withApiErrors(async (req: Request) => {
  const session = await requireSession();

  const body = await req.json().catch(() => null);
  const parsed = {{feature}}Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const created = await db.{{feature}}.create({
    data: {
      ...parsed.data,
      userId: session.user.id,
    },
  });

  return NextResponse.json(created, { status: 201 });
});
```

## `src/app/api/{{feature}}s/[id]/route.ts` — get + update + delete

```ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, withApiErrors, assertOwnership } from '@/lib/api-auth';
import { {{feature}}Schema } from '@/app/(app)/{{feature}}s/schema';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withApiErrors(async (_req: Request, ctx: RouteContext) => {
  const session = await requireSession();
  const { id } = await ctx.params;

  const row = await db.{{feature}}.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(row);
});

export const PATCH = withApiErrors(async (req: Request, ctx: RouteContext) => {
  const session = await requireSession();
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = {{feature}}Schema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Ownership check via findFirst + userId predicate.
  const existing = await db.{{feature}}.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await db.{{feature}}.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(updated);
});

export const DELETE = withApiErrors(async (_req: Request, ctx: RouteContext) => {
  const session = await requireSession();
  const { id } = await ctx.params;

  const existing = await db.{{feature}}.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.{{feature}}.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
});
```

## Public handlers (e.g. health check)

The matcher in `middleware.ts` already excludes `/api/auth/*`. Other `/api/*` routes aren't redirected by middleware (they run their own `requireSession()`). A public handler simply omits the session check:

```ts
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
export const GET = () => NextResponse.json({ ok: true });
```

Comment in the file so the absence of `requireSession()` is intentional, not an oversight.

## Forbidden

- **No `requireSession()` call** in any handler outside `/api/auth/*` and explicitly-public ones (and the public ones must comment why).
- **Trusting `userId` from the request body.** Always read it from the session: `session.user.id`.
- **Returning the full record on POST/PATCH without checking ownership first** on updates — the `where: { id, userId }` predicate is the gate.
- **`prisma.$queryRaw` with string concatenation.** Use parameterized template literals (`prisma.$queryRaw\`... ${value} ...\``) or stick to the typed query builder.
- **Catching and re-throwing without logging.** `withApiErrors` logs unexpected errors; if you write your own try/catch, log unexpected ones at least once.
- **Returning 500 with the raw error message.** Leaks stack traces. `withApiErrors` returns a generic message; if you write your own, do the same.
- **Long-running work in a handler.** Route Handlers run per-request. For background work, dispatch to a queue (the skill doesn't ship one — ask the user to pick).
- **`Set-Cookie` headers writing your own session cookie.** NextAuth owns the session cookie; setting a parallel one is the "custom JWT alongside NextAuth" anti-pattern.

## Why we import the schema from the feature folder

The form (`_components/{{Feature}}Form.tsx`) and the handler validate the same shape. If the handler had its own schema, drift would silently let the form post payloads the handler accepts but the form's UI hasn't accounted for — or vice versa. One Zod schema in `(app)/{{feature}}s/schema.ts` is the contract; both sides import it.

## Handler test (optional but recommended)

```ts
// tests/unit/{{feature}}.handler.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db', () => ({
  db: { {{feature}}: { findMany: vi.fn(), create: vi.fn() } },
}));

import { GET, POST } from '@/app/api/{{feature}}s/route';
import { auth } from '@/auth';
import { db } from '@/lib/db';

describe('GET /api/{{feature}}s', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401s when unauthenticated', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns the current user's rows', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: { id: 'u1' } });
    (db.{{feature}}.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ id: 'r1', userId: 'u1' }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 'r1', userId: 'u1' }]);
  });
});
```

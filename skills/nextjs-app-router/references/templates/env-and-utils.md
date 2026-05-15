# Env validation, `cn()`, shared utils

## `src/config/env.ts` (runtime-validated env)

```ts
import { z } from 'zod';

const envSchema = z.object({
  // NextAuth — required.
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 chars. Generate with: openssl rand -base64 32'),
  AUTH_URL: z.string().url().optional(), // required in prod, derived locally

  // Database — required.
  DATABASE_URL: z.string().url(),

  // OAuth providers — required ONLY if the matching provider is enabled in auth.config.ts.
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration. See .env.example for required variables.');
  }
  return parsed.data;
}

export const env = loadEnv();
```

**Why:** misconfiguration (missing `AUTH_SECRET`, malformed `DATABASE_URL`) blows up at startup with a clear error, not via a confusing 500 on the first auth check or DB query.

## `.env.example` (committed — NO secret values)

```dotenv
# ---- NextAuth ----
# Generate with: openssl rand -base64 32  (or `npx auth secret`)
# REQUIRED. Do NOT commit a real value.
AUTH_SECRET=

# Public URL of the app. Required in production. Optional locally (Auth.js derives from the request).
# AUTH_URL=https://example.com

# ---- Database ----
# Required. For local Docker: postgresql://postgres:postgres@localhost:5432/{{project_db}}
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/{{project_db}}

# ---- OAuth providers (only if enabled in src/auth.config.ts) ----
# AUTH_GITHUB_ID=
# AUTH_GITHUB_SECRET=
# AUTH_GOOGLE_ID=
# AUTH_GOOGLE_SECRET=
```

`.env`, `.env.local`, `.env.*.local` go in `.gitignore`. Only `.env.example` is committed. **`AUTH_SECRET` must never have a real value in `.env.example`** — leave it empty with a comment showing how to generate one.

## `src/lib/utils.ts`

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

That's the entire file. No bag of unrelated helpers — those go in `src/lib/formatters/` or feature-local utility files.

## `src/lib/api-auth.ts` (Route Handler auth helper)

```ts
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export class HttpError extends Error {
  constructor(public status: number, public body: unknown) {
    super(typeof body === 'string' ? body : JSON.stringify(body));
  }
}

/**
 * Returns the current session, or throws an HttpError(401) that the wrapping
 * handler converts to a 401 JSON response. Use inside Route Handlers.
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new HttpError(401, { error: 'Unauthorized' });
  }
  return session as typeof session & { user: { id: string; email: string; role?: string } };
}

/**
 * Wraps a Route Handler so that thrown HttpErrors become JSON responses.
 * Optional — handlers can also try/catch themselves.
 */
export function withApiErrors<T extends (...args: never[]) => Promise<Response | NextResponse>>(
  fn: T,
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json(err.body, { status: err.status });
      }
      console.error('Unhandled handler error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }) as T;
}

/**
 * Asserts that a fetched row belongs to the current user. Returns the row.
 */
export function assertOwnership<T extends { userId: string }>(row: T | null, userId: string): T {
  if (!row || row.userId !== userId) {
    throw new HttpError(404, { error: 'Not found' });
  }
  return row;
}
```

## `src/lib/formatters/date.ts`

```ts
import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function formatDate(value: string | Date, pattern = 'PP'): string {
  const d = typeof value === 'string' ? parseISO(value) : value;
  return format(d, pattern);
}

export function formatRelative(value: string | Date): string {
  const d = typeof value === 'string' ? parseISO(value) : value;
  return formatDistanceToNow(d, { addSuffix: true });
}
```

**No `moment`. Anywhere. Ever.** ESLint's `no-restricted-imports` blocks new imports of it.

## `src/components/UnsavedChangesWarning.tsx`

```tsx
'use client';

import { useEffect } from 'react';

interface Props {
  when: boolean;
  message?: string;
}

export function UnsavedChangesWarning({ when, message = 'You have unsaved changes. Leave anyway?' }: Props) {
  useEffect(() => {
    if (!when) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [when, message]);

  // Next App Router does not yet expose a stable router-events API for intercepting client-side navigation.
  // Verify at scaffold time via context7 whether a stable hook has landed; if so, use it here in addition to beforeunload.

  return null;
}
```

# Env validation, `cn()`, and shared utils

## `src/config/env.ts` (runtime-validated env)

```ts
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  // Add more vars here as needed. Keep client-readable ones prefixed with NEXT_PUBLIC_.
});

function loadEnv() {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  });
  if (!parsed.success) {
    // Fail fast at module load.
    console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration. See .env.example for required variables.');
  }
  return parsed.data;
}

export const env = loadEnv();
```

**Why:** misconfiguration (`NEXT_PUBLIC_API_BASE_URL` undefined, typo'd) blows up at startup with a clear error, not via a confusing 404 on the first network request.

## `.env.example` (committed)

```
# Backend API base URL. Required.
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000

# Optional: real-time
# NEXT_PUBLIC_PUSHER_KEY=
# NEXT_PUBLIC_PUSHER_CLUSTER=

# Server-only: JWT verification key (only for Variant B middleware).
# JWT_VERIFY_KEY=
```

`.env`, `.env.local`, `.env.*.local` go in `.gitignore`. Only `.env.example` is committed.

## `src/lib/utils.ts`

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

That's the entire file. No bag of unrelated helpers — those go in `src/lib/formatters/` or feature-local utility files.

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

  // Next's App Router does not yet expose a stable router-events API for intercepting client-side navigation.
  // The pattern below (overriding history.pushState) is a workaround — review and adjust per the Next version
  // resolved at scaffold time (use context7 to check whether the official `useBeforeUnload` / `unstable_*` API has landed).

  return null;
}
```

**Adjust at scaffold time:** if the Next.js version resolved in Step 1 exposes a stable navigation-intercept hook, use it instead of the `beforeunload`-only fallback. Verify via context7.

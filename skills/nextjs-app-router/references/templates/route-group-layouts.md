# Route group layouts

Group layouts are **server components** that render zero data — they just delegate to a `'use client'` shell. Pages inside the group are `'use client'`.

## `src/app/(public)/layout.tsx` (SERVER, zero data)

```tsx
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
```

## `src/app/(app)/layout.tsx` (SERVER, renders client shell)

```tsx
import { AppShell } from './_components/AppShell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Server-side session check is done in middleware.ts — by the time we render here,
  // the user is authenticated. We do NOT call `await auth()` here; the gate is the middleware.
  return <AppShell>{children}</AppShell>;
}
```

**No `await auth()` here.** The middleware already gated the request. Calling `auth()` again from this layout adds a round-trip and doesn't change the outcome.

## `src/app/(app)/_components/AppShell.tsx` (CLIENT, holds interactive UI state)

```tsx
'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} />
      <div className="flex flex-1 flex-col">
        <Header onToggleSidebar={() => setSidebarOpen((s) => !s)} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

## `src/app/(app)/_components/UserMenu.tsx` (CLIENT — uses NextAuth)

```tsx
'use client';

import { signOut, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === 'loading') return null;
  if (!session?.user) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">{session.user.email}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => signOut({ callbackUrl: '/auth/login', redirect: true })}
      >
        Sign out
      </Button>
    </div>
  );
}
```

## `src/app/(app)/loading.tsx` (CLIENT — Suspense fallback)

```tsx
'use client';

export default function Loading() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
    </div>
  );
}
```

## `src/app/(app)/error.tsx` (CLIENT — Next requires it)

```tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <h2 className="text-xl font-semibold">Couldn't load this page</h2>
      <p className="text-muted-foreground">{error.message}</p>
      <Button onClick={reset}>Retry</Button>
    </div>
  );
}
```

## `src/app/(admin)/layout.tsx` (OPTIONAL, SERVER)

Same shape as `(app)/layout.tsx`. The role check happens in `middleware.ts` (Variant B in [`middleware.md`](middleware.md)); this layout just renders an admin-flavored shell.

## Forbidden in any layout

- `await auth()` — duplicates middleware's job.
- `await db.*` — server data fetching is banned.
- `'use client'` directly on a `layout.tsx` — push interactive chrome into a client child.
- `redirect()` — middleware handles all redirects.

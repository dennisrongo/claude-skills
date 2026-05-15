# Route group layouts

Layouts are **server components** by default. Push interactive chrome into `'use client'` children.

## `src/app/(public)/layout.tsx` (SERVER)

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
  // Server-side session check happens in middleware.ts.
  // This layout assumes the request reached here because the user is authenticated.
  return <AppShell>{children}</AppShell>;
}
```

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

## `src/app/(app)/loading.tsx` (SERVER)

```tsx
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

Same shape as `(app)/layout.tsx`. The role check happens in `middleware.ts`; this layout just renders an admin-flavored shell.

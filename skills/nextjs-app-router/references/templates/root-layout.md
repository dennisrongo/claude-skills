# Root layout, error/not-found, login page

## `src/app/layout.tsx` (SERVER component — the only one)

```tsx
import '@/app/globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/redux/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '{{Project Title}}',
  description: '{{Project description}}',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**NO `'use client'`. NO data fetching. NO `await db.*`.** This is the only server component in the app and its job is to render `<Providers>`.

## No `src/app/page.tsx` by default

`middleware.ts` handles `/`:
- Signed-in users → `/app/dashboard` (302).
- Signed-out users → `/auth/login` (302).

Don't create an `app/page.tsx` unless the project has a public landing page. If it does, the page is `'use client'`:

```tsx
// src/app/page.tsx — ONLY if a marketing landing is needed
'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">{{Project Title}}</h1>
      <Button asChild>
        <Link href="/auth/login">Sign in</Link>
      </Button>
    </main>
  );
}
```

**Forbidden** (do not generate):

```tsx
// ❌ server page doing a redirect
import { redirect } from 'next/navigation';
export default function Home() { redirect('/dashboard'); }

// ❌ server page doing data fetching
export default async function Home() {
  const session = await auth();
  const data = await db.x.findMany();
  return <Dashboard data={data} session={session} />;
}
```

The middleware handles redirects. RTK Query handles data.

## `src/app/error.tsx` (CLIENT — Next requires it)

```tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Wire to your error tracker (Sentry, etc.) if configured.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

## `src/app/not-found.tsx` (CLIENT, since no SSR)

```tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-semibold">404 — Page not found</h1>
      <Button asChild>
        <Link href="/">Go home</Link>
      </Button>
    </div>
  );
}
```

## `src/app/(public)/auth/login/page.tsx` (CLIENT, calls NextAuth `signIn`)

```tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { FormInputField } from '@/components/forms/FormInputField';
import { FormPasswordField } from '@/components/forms/FormPasswordField';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get('returnTo') ?? '/app/dashboard';
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setError(null);
    const res = await signIn('credentials', { ...values, redirect: false });
    if (res?.error) {
      setError('Invalid email or password.');
      return;
    }
    router.replace(returnTo);
    router.refresh();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <h1 className="text-xl font-semibold">Sign in</h1>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <FormInputField form={form} schema={loginSchema} fieldName="email" label="Email" type="email" autoComplete="email" />
        <FormPasswordField form={form} schema={loginSchema} fieldName="password" label="Password" autoComplete="current-password" />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Form>
  );
}
```

## `src/app/globals.css` (Tailwind + shadcn tokens)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 240 5.9% 10%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    /* ... dark counterparts ... */
  }

  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

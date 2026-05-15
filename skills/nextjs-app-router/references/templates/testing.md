# Testing setup (Vitest + RTL + Playwright)

A new project ships with a small set of real tests: a Zod schema test, a Route Handler test, a component test, and an E2E auth spec. Just enough to make CI meaningful.

## `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    css: false,
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

## `tests/setup.ts`

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

## `tests/unit/customer.schema.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { customerSchema } from '@/app/(app)/customers/schema';

describe('customerSchema', () => {
  it('accepts a valid payload', () => {
    expect(customerSchema.safeParse({ name: 'Acme', email: 'ops@acme.test' }).success).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(customerSchema.safeParse({ name: '', email: 'ops@acme.test' }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(customerSchema.safeParse({ name: 'Acme', email: 'nope' }).success).toBe(false);
  });
});
```

This is the test that pays for itself most often. The same schema validates form input *and* the Route Handler's request body, so regressions on either side fail here.

## `tests/unit/customers.handler.test.ts` (Route Handler test with mocked `auth` + `db`)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db', () => ({
  db: {
    customer: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { GET, POST } from '@/app/api/customers/route';
import { auth } from '@/auth';
import { db } from '@/lib/db';

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockFindMany = db.customer.findMany as ReturnType<typeof vi.fn>;
const mockCreate = db.customer.create as ReturnType<typeof vi.fn>;

describe('GET /api/customers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401s when unauthenticated', async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns the current user\'s customers', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1' } });
    mockFindMany.mockResolvedValueOnce([{ id: 'c1', userId: 'u1', name: 'Acme' }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 'c1', userId: 'u1', name: 'Acme' }]);
  });
});

describe('POST /api/customers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('400s on an invalid payload', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1' } });
    const req = new Request('http://x/api/customers', {
      method: 'POST',
      body: JSON.stringify({ name: '', email: 'nope' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('attaches the session userId to the created row', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1' } });
    mockCreate.mockResolvedValueOnce({ id: 'c2', userId: 'u1', name: 'Acme', email: 'ops@acme.test' });
    const req = new Request('http://x/api/customers', {
      method: 'POST',
      body: JSON.stringify({ name: 'Acme', email: 'ops@acme.test' }),
    });
    await POST(req);
    expect(mockCreate).toHaveBeenCalledWith({
      data: { name: 'Acme', email: 'ops@acme.test', userId: 'u1' },
    });
  });
});
```

This test catches three common regressions: missing `requireSession`, body validation that silently accepts garbage, and userId tampering.

## `tests/unit/login-form.test.tsx`

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/app/(public)/auth/login/_components/LoginForm';

vi.mock('next-auth/react', () => ({
  signIn: vi.fn().mockResolvedValue({ ok: true, error: null }),
}));

describe('<LoginForm />', () => {
  it('shows a validation error when fields are empty', async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/required|invalid/i)).toBeInTheDocument();
  });
});
```

Mocking `next-auth/react` lets the form test run in isolation — we're testing the form, not NextAuth.

## `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

## `tests/e2e/auth.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test('unauthenticated user is redirected to login', async ({ page }) => {
  await page.goto('/app/dashboard');
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
});

// Requires `pnpm db:seed` to have run — provides test@example.com / test1234.
test('seeded user can sign in and land on the dashboard', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill('test@example.com');
  await page.getByLabel(/password/i).fill('test1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/);
});
```

Together those two specs validate: middleware fires, the login page renders, NextAuth's Credentials provider works against the seeded user, and the route-group split holds.

**Notes:**

- Do not include Playwright in the default `pnpm test` script — keep it as `pnpm test:e2e`.
- The seed-then-login test requires the CI workflow's `pnpm db:seed` step (see [`ci-and-hooks.md`](ci-and-hooks.md)).
- Real backend mocking (MSW) is *not* in the default scaffold. Add only if the user asks.
- **Forbidden:** an `authSlice.test.ts`. There is no `authSlice` in this project — NextAuth owns session state. If you see a test importing `@/redux/features/authSlice`, delete it.

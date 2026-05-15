# Testing setup (Vitest + RTL + Playwright)

A new project ships with three real tests: a reducer test, a component test, and an E2E auth spec. Three is enough to make CI meaningful; the user adds more as features grow.

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

## `tests/unit/auth.slice.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { authSlice, logout, setUser } from '@/redux/features/authSlice';

const initial = authSlice.getInitialState();

describe('authSlice', () => {
  it('starts logged out', () => {
    expect(initial.user).toBeNull();
    expect(initial.token).toBeNull();
  });

  it('sets the user', () => {
    const state = authSlice.reducer(initial, setUser({ id: '1', email: 'a@b.c', name: 'A', roles: [] }));
    expect(state.user?.id).toBe('1');
  });

  it('logout resets state', () => {
    const seeded = { ...initial, user: { id: '1', email: 'a@b.c', name: 'A', roles: [] } };
    expect(authSlice.reducer(seeded, logout())).toEqual(initial);
  });
});
```

## `tests/unit/login-form.test.tsx`

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { api } from '@/redux/api/api';
import { authSlice } from '@/redux/features/authSlice';
import { LoginForm } from '@/app/(public)/auth/login/_components/LoginForm';

function renderWithStore(ui: React.ReactElement) {
  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer, auth: authSlice.reducer },
    middleware: (gdm) => gdm().concat(api.middleware),
  });
  return render(<Provider store={store}>{ui}</Provider>);
}

describe('<LoginForm />', () => {
  it('shows a validation error for an empty email', async () => {
    renderWithStore(<LoginForm />);
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/required|invalid/i)).toBeInTheDocument();
  });
});
```

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
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
});
```

That spec alone validates: middleware fires, the login page renders, the route group split works. If any of those regress, this test breaks.

**Notes:**
- Do not include Playwright in the default `pnpm test` script — keep it as `pnpm test:e2e` so CI can run Vitest fast and Playwright separately (or in a different job).
- Real backend mocking (MSW) is *not* in the default scaffold. Add only if the user asks.

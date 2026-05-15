# CI workflow + Husky + lint-staged

## `.github/workflows/ci.yml`

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: {{project_db}}_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/{{project_db}}_test
      AUTH_SECRET: ci-only-secret-replace-in-prod-1234567890abcdef
      AUTH_URL: http://localhost:3000

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # Apply committed migrations against the CI Postgres. Never `prisma db push` here.
      - run: pnpm exec prisma migrate deploy
      - run: pnpm exec prisma generate

      - run: pnpm lint --max-warnings=0
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build

  # Optional separate job for E2E — only run on push to main to save CI minutes.
  e2e:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: build

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: {{project_db}}_e2e
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/{{project_db}}_e2e
      AUTH_SECRET: ci-only-secret-replace-in-prod-1234567890abcdef
      AUTH_URL: http://localhost:3000

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec prisma migrate deploy
      - run: pnpm exec prisma generate
      - run: pnpm db:seed
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
```

**Notes:**

- `--frozen-lockfile` ensures the lockfile is honored — CI fails if `package.json` and lockfile drift.
- `--max-warnings=0` on lint means even warnings fail CI. On a fresh scaffold there are none; this catches regressions early.
- `AUTH_SECRET` in CI is a throwaway. **Do not** reuse it in production. The placeholder above is long enough to satisfy the `z.string().min(32)` check in `src/config/env.ts`.
- `prisma migrate deploy` applies committed migrations. **Never** `prisma db push` in CI — it bypasses the migration history.
- `prisma generate` runs after `migrate deploy` so `@prisma/client` matches the schema. (`migrate deploy` does not regenerate the client; `migrate dev` does, but `migrate dev` is interactive and not for CI.)
- The E2E job seeds a test user via `pnpm db:seed` so the Credentials login flow has something to authenticate against.
- E2E is gated on `github.event_name == 'push'` so PRs stay fast.

## Husky + lint-staged

After `pnpm install`, run:

```bash
pnpm exec husky init
```

Then write `.husky/pre-commit`:

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm exec lint-staged
```

The `lint-staged` config lives in `package.json` (see [`package.md`](package.md)):

```jsonc
"lint-staged": {
  "*.{ts,tsx}": ["prettier --write", "eslint --fix"],
  "*.{json,md,css,yml,yaml,prisma}": ["prettier --write"]
}
```

**Notes:**

- Do not put `tsc --noEmit` in lint-staged — it's per-staged-file and TypeScript is project-wide; let CI handle it.
- Do not skip hooks (`--no-verify`) as a workflow. If a hook is annoying, fix the underlying issue.
- `prettier-plugin-prisma` (auto-loaded when present in deps) formats `schema.prisma` on commit.

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

      - run: pnpm lint --max-warnings=0
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
        env:
          NEXT_PUBLIC_API_BASE_URL: http://localhost:5000

  # Optional separate job for E2E — only run on push to main to save CI minutes.
  e2e:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: build
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
        env:
          NEXT_PUBLIC_API_BASE_URL: http://localhost:5000
```

**Notes:**
- `--frozen-lockfile` ensures the lockfile is honored — CI fails if `package.json` and lockfile drift.
- `--max-warnings=0` on lint means even warnings fail CI. On a fresh scaffold there are none; this catches regressions early.
- E2E is split into its own job behind `if: github.event_name == 'push'` so PRs stay fast.

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
  "*.{json,md,css,yml,yaml}": ["prettier --write"]
}
```

**Notes:**
- Do not put `tsc --noEmit` in lint-staged — it's per-staged-file and TypeScript is project-wide; let CI handle it.
- Do not skip hooks (`--no-verify`) as a workflow. If a hook is annoying, fix the underlying issue.

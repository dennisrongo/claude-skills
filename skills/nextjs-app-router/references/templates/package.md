# `package.json` template

Resolve **every** version via context7 at scaffold time. Versions below are placeholders (`"^x.y.z"`) — replace with the latest stable resolved at scaffold time and quote the resolved versions back to the user.

```jsonc
{
  "name": "{{project-name}}",
  "version": "0.1.0",
  "private": true,
  "packageManager": "{{pnpm|npm|yarn}}@x.y.z",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "prepare": "husky"
  },
  "dependencies": {
    "next": "^x.y.z",
    "react": "^x.y.z",
    "react-dom": "^x.y.z",

    "@reduxjs/toolkit": "^x.y.z",
    "react-redux": "^x.y.z",

    "react-hook-form": "^x.y.z",
    "@hookform/resolvers": "^x.y.z",
    "zod": "^x.y.z",

    "@radix-ui/react-dialog": "^x.y.z",
    "@radix-ui/react-dropdown-menu": "^x.y.z",
    "@radix-ui/react-label": "^x.y.z",
    "@radix-ui/react-popover": "^x.y.z",
    "@radix-ui/react-select": "^x.y.z",
    "@radix-ui/react-slot": "^x.y.z",
    "@radix-ui/react-toast": "^x.y.z",
    "class-variance-authority": "^x.y.z",
    "clsx": "^x.y.z",
    "tailwind-merge": "^x.y.z",
    "tailwindcss-animate": "^x.y.z",
    "lucide-react": "^x.y.z",

    "date-fns": "^x.y.z",
    "next-nprogress-bar": "^x.y.z"
  },
  "devDependencies": {
    "typescript": "^x.y.z",
    "@types/node": "^x.y.z",
    "@types/react": "^x.y.z",
    "@types/react-dom": "^x.y.z",

    "tailwindcss": "^x.y.z",
    "postcss": "^x.y.z",
    "autoprefixer": "^x.y.z",

    "eslint": "^x.y.z",
    "eslint-config-next": "^x.y.z",
    "@typescript-eslint/eslint-plugin": "^x.y.z",
    "@typescript-eslint/parser": "^x.y.z",
    "eslint-plugin-react-hooks": "^x.y.z",
    "eslint-plugin-jsx-a11y": "^x.y.z",
    "prettier": "^x.y.z",
    "prettier-plugin-tailwindcss": "^x.y.z",

    "husky": "^x.y.z",
    "lint-staged": "^x.y.z",

    "vitest": "^x.y.z",
    "@vitejs/plugin-react": "^x.y.z",
    "@testing-library/react": "^x.y.z",
    "@testing-library/jest-dom": "^x.y.z",
    "@testing-library/user-event": "^x.y.z",
    "jsdom": "^x.y.z",
    "@playwright/test": "^x.y.z"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["prettier --write", "eslint --fix"],
    "*.{json,md,css,yml,yaml}": ["prettier --write"]
  }
}
```

**Do NOT include:**
- `moment` (use `date-fns`)
- `styled-components` / `@emotion/*` (project is Tailwind-only)
- `nprogress` (use `next-nprogress-bar`)
- A `proxy` library at the application layer (use Next.js `rewrites()` in `next.config.ts`)

**Add only if the user opted in during Step 2:**
- `pusher-js` (real-time)
- Storybook packages
- `next-intl` / `next-i18next` (i18n)
- `@sentry/nextjs` (error tracking)

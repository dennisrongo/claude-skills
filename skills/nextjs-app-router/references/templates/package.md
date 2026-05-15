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
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:studio": "prisma studio",
    "db:seed": "tsx prisma/seed.ts",
    "prepare": "husky"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "next": "^x.y.z",
    "react": "^x.y.z",
    "react-dom": "^x.y.z",

    "next-auth": "^x.y.z",
    "@auth/prisma-adapter": "^x.y.z",
    "bcryptjs": "^x.y.z",

    "@prisma/client": "^x.y.z",

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
    "@types/bcryptjs": "^x.y.z",

    "prisma": "^x.y.z",
    "tsx": "^x.y.z",

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
    "*.{json,md,css,yml,yaml,prisma}": ["prettier --write"]
  }
}
```

## Notes on version resolution

- **`next-auth`**: Auth.js v5 (the version with the `handlers`/`auth`/`signIn`/`signOut` exports). Check context7 for the current version line — at certain points this is published under a `@beta` tag. Quote the resolved version back to the user before installing.
- **`bcryptjs` vs `bcrypt` vs `@node-rs/argon2`**: pure-JS `bcryptjs` is the safest default — it works on every Node version and in serverless without native bindings. Switch to `@node-rs/argon2` only if the user explicitly asks for Argon2 and confirms their deploy target supports native bindings.
- **`tsx`** is for running `prisma/seed.ts` and any TypeScript scripts without a build step.

## Do NOT include

- `moment` (use `date-fns`)
- `styled-components` / `@emotion/*` (Tailwind only)
- `nprogress` (use `next-nprogress-bar`)
- `jsonwebtoken` or `jose` for the application layer — NextAuth handles JWT signing/verification internally
- `js-cookie` — NextAuth manages the session cookie
- A second auth library (`Clerk`, `Lucia`, `Iron Session`, etc.) alongside NextAuth
- A second ORM (`Drizzle`, `Kysely`, `TypeORM`) alongside Prisma

## Add only if the user opted in during Step 2

- `pusher-js` (real-time)
- Storybook packages
- `next-intl` / `next-i18next` (i18n)
- `@sentry/nextjs` (error tracking)
- `@auth/core` providers not in the default install (e.g. specific OAuth providers shipped separately)

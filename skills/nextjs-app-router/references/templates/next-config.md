# `next.config.ts` template

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // The backend is in-app under src/app/api/**/route.ts. No rewrites are needed.
  // (Do not add a rewrite forwarding /api/* to an external host — this project is fullstack.)

  images: {
    remotePatterns: [
      // Add allowed external image hosts here. Leave empty by default.
    ],
  },

  experimental: {
    // Enable on a case-by-case basis only.
  },
};

export default nextConfig;
```

**Notes:**
- The app is fullstack: `/api/*` routes are Route Handlers in `src/app/api/**/route.ts`, not proxies to an external backend. **Do not** add a `rewrites()` entry forwarding `/api/*` to another host — that breaks NextAuth (which expects `/api/auth/*` to land on the in-app handlers) and removes the same-origin guarantee RTK Query relies on for `credentials: 'include'`.
- Do not enable `output: 'standalone'` by default; only when the user is deploying to a container.
- Do not enable `output: 'export'` (static export) — it disables middleware, Route Handlers, and image optimization. The skill's whole architecture depends on those.
- `reactStrictMode: true` is non-negotiable for a new project.
- `poweredByHeader: false` removes the `X-Powered-By` header.

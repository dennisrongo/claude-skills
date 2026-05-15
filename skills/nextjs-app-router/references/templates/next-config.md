# `next.config.ts` template

```ts
import type { NextConfig } from 'next';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Forward /api/* to the backend in production; in dev, hit the backend directly via NEXT_PUBLIC_API_BASE_URL.
  // Configure only if the user opted into the rewrite pattern in Step 2.
  async rewrites() {
    if (!apiBase) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/:path*`,
      },
    ];
  },

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
- Do not enable `output: 'standalone'` by default; only when the user is deploying to a container.
- Do not enable `output: 'export'` (static export) unless the user explicitly asks — it disables middleware, server components data fetching, and image optimization.
- `reactStrictMode: true` is non-negotiable for a new project.
- `poweredByHeader: false` removes the `X-Powered-By` header.

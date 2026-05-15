# `tsconfig.json` template

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "incremental": true,

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true,

    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": false,

    "noEmit": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts", "tests/**/*.ts", "tests/**/*.tsx"],
  "exclude": ["node_modules", ".next", "out", "dist"]
}
```

**Rationale for the non-default flags:**
- `noUncheckedIndexedAccess: true` — accessing an array index or object key by string now returns `T | undefined`. Catches a whole class of "looks fine, crashes at runtime" bugs.
- `forceConsistentCasingInFileNames: true` — surfaces the duplicate-by-case folder bug at compile time, before Linux production does.
- `noImplicitOverride: true` — requires `override` on subclass methods.
- `allowJs: false` — the project is TypeScript-only; no surprise `.js` files leaking in.

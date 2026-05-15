# `components.json` template (shadcn config)

```jsonc
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/lib/hooks"
  }
}
```

**Initial components to generate** (only what the scaffolded templates actually import — add more on demand via `pnpm dlx shadcn@latest add <name>`):

- `button`
- `input`
- `label`
- `form` (the RHF-aware wrapper)
- `dialog`
- `dropdown-menu`
- `select`
- `popover`
- `calendar` (only if forms need a date picker)
- `toast` + `toaster` + `use-toast`
- `card`
- `separator`

**Do not** bulk-install every shadcn primitive at scaffold time. Each one is owned code that needs to be reviewed and maintained.

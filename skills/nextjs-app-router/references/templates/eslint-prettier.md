# ESLint + Prettier templates

## `.eslintrc.json`

```jsonc
{
  "root": true,
  "extends": [
    "next/core-web-vitals",
    "next/typescript",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "prettier"
  ],
  "plugins": ["@typescript-eslint", "react-hooks", "jsx-a11y"],
  "rules": {
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    "@typescript-eslint/consistent-type-imports": ["error", { "prefer": "type-imports" }],
    "react-hooks/exhaustive-deps": "error",
    "prefer-const": "error",
    "eqeqeq": ["error", "always", { "null": "ignore" }],
    "no-restricted-imports": [
      "error",
      {
        "paths": [
          { "name": "moment", "message": "Use date-fns. moment is in maintenance mode." },
          { "name": "styled-components", "message": "This project uses Tailwind. Do not add CSS-in-JS." },
          { "name": "lodash", "message": "Import the specific lodash function: 'lodash/debounce'. Or write a one-line helper." }
        ]
      }
    ]
  },
  "overrides": [
    {
      "files": ["tests/**/*", "**/*.test.{ts,tsx}"],
      "rules": {
        "@typescript-eslint/no-explicit-any": "off",
        "no-console": "off"
      }
    }
  ]
}
```

## `.prettierrc`

```jsonc
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

## `.prettierignore`

```
.next/
node_modules/
out/
dist/
build/
coverage/
playwright-report/
test-results/
*.lock
*.lockb
pnpm-lock.yaml
package-lock.json
yarn.lock
```

**Notes:**
- `prettier-plugin-tailwindcss` sorts Tailwind class names automatically — keep class lists alphabetized without bikeshedding.
- The `no-restricted-imports` rule is the scaffolder's enforcement of the date library / styling system choices. Removing these rules requires a discussion, not a unilateral edit.
- Keep ESLint warnings *off* a fresh scaffold; warnings only show up after the project adds something that triggers them. CI runs `--max-warnings=0` so they fail loud.

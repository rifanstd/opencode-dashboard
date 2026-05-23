# AGENTS.md — opencode-dashboard

## Commands

```bash
npm run dev      # Start Vite dev server
npm run build    # Type-check (tsc -b) then Vite build
npm run lint     # ESLint over entire project
npm run preview  # Preview production build locally
```

## TypeScript quirks

- **Project references**: `tsconfig.json` is a solution file with two projects:
  - `tsconfig.app.json` — application code (`src/`)
  - `tsconfig.node.json` — Vite config (`vite.config.ts`)
- **`verbatimModuleSyntax: true`** — only emit `import`/`export`. Use `import type` for type-only imports.
- **`erasableSyntaxOnly: true`** — avoid `enum`, `namespace`, parameter properties, etc.
- **`noUnusedLocals` / `noUnusedParameters: true`** — unused variables fail the build.
- **`noFallthroughCasesInSwitch: true`** — switch fallthroughs are errors.
- Build runs `tsc -b` first; type errors block the Vite build.

## Lint

- ESLint flat config in `eslint.config.js` (ESM, uses `defineConfig`/`globalIgnores` from `eslint/config`).
- Uses `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`.
- `dist/` is ignored.

## Project structure

- Entry: `index.html` → `src/main.tsx`
- Source lives in `src/` only.
- `package.json` sets `"type": "module"` (ESM-only).
- No test runner, no CI config, no environment files.

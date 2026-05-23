# AGENTS.md — opencode-dashboard

## Commands

```bash
npm run dev      # Start Vite dev server (includes /api/sync endpoint)
npm run build    # Type-check (tsc -b) then Vite build
npm run lint     # ESLint over entire project
npm run preview  # Preview production build locally
npm run sync     # Export opencode data to public/data/ JSON files
```

**Build order matters:** `tsc -b` runs first; type errors block the Vite build.

## Data Architecture

This is a **client-side dashboard** that reads opencode usage analytics. It uses a **hybrid approach**:

1. **Node.js sync script** (`scripts/sync-opencode-data.js`) reads the local opencode SQLite database and config files, then exports everything as JSON to `public/data/`.
2. **Dashboard** loads JSON via standard `fetch()` — no backend server, no File System Access API.
3. **"Sync" button** in the UI triggers `/api/sync` (Vite dev server middleware) which re-runs the script, then reloads the page.

**Critical:** `public/data/` is in `.gitignore`. Never commit generated JSON files — they contain user-specific data.

### First-time setup

```bash
npm install
npm run sync   # Creates public/data/*.json from local opencode data
npm run dev    # Starts dashboard
```

### Production build

```bash
npm run sync   # Must run before build to generate JSON files
npm run build
```

## TypeScript Quirks

- **Project references**: `tsconfig.json` is a solution file with two projects:
  - `tsconfig.app.json` — application code (`src/`)
  - `tsconfig.node.json` — Vite config (`vite.config.ts`)
- **`verbatimModuleSyntax: true`** — only emit `import`/`export`. Use `import type` for type-only imports.
- **`erasableSyntaxOnly: true`** — avoid `enum`, `namespace`, parameter properties, etc.
- **`noUnusedLocals` / `noUnusedParameters: true`** — unused variables fail the build.
- **`noFallthroughCasesInSwitch: true`** — switch fallthroughs are errors.

## Lint

- ESLint flat config in `eslint.config.js` (ESM, uses `defineConfig`/`globalIgnores` from `eslint/config`).
- Uses `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`.
- `dist/` is ignored.

## Project Structure

- Entry: `index.html` → `src/main.tsx`
- Source lives in `src/` only.
- `package.json` sets `"type": "module"` (ESM-only).
- **No test runner**, no CI config, no environment files.

### Key directories

- `src/pages/` — Route components (Overview, TokenUsage, SessionsList, etc.)
- `src/components/` — Shared UI components
- `src/utils/` — Data loaders (`dataLoader.ts`), cost calculator, sync handler
- `src/stores/` — Zustand stores (`appStore.ts`)
- `src/types/` — TypeScript interfaces
- `scripts/` — Node.js sync script (runs outside the build)

## Framework Stack

- React 19 + TypeScript + Vite
- React Router v7 (`BrowserRouter` in `App.tsx`)
- Zustand for state management (`useAppStore`)
- Recharts for data visualization
- `sqlite3` (dev dependency) for reading opencode.db during sync

## Sync Script Details

`scripts/sync-opencode-data.js`:
- Auto-detects opencode data folders on Windows (`%USERPROFILE%/.local/share/opencode`, `%APPDATA%`, etc.)
- Reads `opencode.db` (SQLite) and exports: sessions, messages, parts, projects, overview stats, token usage
- Reads config files: `auth.json` (providers), `models.json`, `agents/*.md`, `skills-lock.json`, `log/*.log`
- Outputs 11 JSON files to `public/data/`
- Can be overridden via `OPENCODE_DATA_PATH` env var or CLI args (`--local`, `--cache`, `--config`)

## Important Constraints

- **Client-side only** — no backend API. All data comes from static JSON.
- **Data is loaded on-demand** by each page via `dataLoader.ts` functions.
- The `workers/` directory exists but is empty (legacy from previous sql.js implementation).
- Do not add server-side code to the Vite build — the `/api/sync` middleware only works in dev mode.

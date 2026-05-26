# AGENTS.md — opencode-dashboard

## Commands

```bash
npm run dev      # Start Vite dev server (serves /api/sync endpoint)
npm run build    # Type-check (tsc -b) then Vite build — types block on failure
npm run lint     # ESLint (flat config) across entire project
npm run preview  # Preview production build locally
npm run sync     # Export opencode data → public/data/*.json
```

**Build order matters:** `tsc -b` runs first; type errors block the Vite build.

## Data Architecture

**Client-side dashboard** — all data comes from static JSON in `public/data/`. No backend, no File System Access API.

1. `scripts/sync-opencode-data.js` reads the local opencode SQLite DB + config, exports 11 JSON files to `public/data/`
2. Pages load data on-demand via `src/utils/dataLoader.ts` → `fetch('/data/*.json')`
3. "Sync" button in the UI → `fetch('/api/sync')` (Vite middleware spawns `node scripts/sync-opencode-data.js`) → page reloads

**Critical:** `public/data/` is in `.gitignore`. Never commit generated JSON — it contains user-specific data.

### First-time setup

```bash
npm install
npm run sync   # Required — creates public/data/ JSON files
npm run dev
```

### Production build

```bash
npm run sync   # Required before build
npm run build
```

## Sync output (11 JSON files)

The sync script produces exactly these files in `public/data/`:

- `sessions.json`, `projects.json`, `messages.json`, `parts.json` — from SQLite
- `overview.json`, `token-usage.json` — computed aggregates from DB
- `providers.json` — from `auth.json` (local + config fallback)
- `models.json` — from `models.json` in cache dir
- `agents.json` — from `agents/*.md` in config dir
- `skills.json` — from `skills-lock.json` in config dir
- `logs.json` — from `log/*.log` in local dir

The sync script auto-detects opencode paths on Windows. Override via `OPENCODE_DATA_PATH` env var or `--local`, `--cache`, `--config` CLI args.

## TypeScript strictness

- **Project references**: `tsconfig.json` solution → `tsconfig.app.json` (`src/`) + `tsconfig.node.json` (`vite.config.ts`)
- **`verbatimModuleSyntax: true`** — use `import type` for type-only imports or the build fails
- **`erasableSyntaxOnly: true`** — no `enum`, `namespace`, parameter properties
- **`noUnusedLocals` / `noUnusedParameters: true`** — unused imports/vars block `tsc -b`
- **`noFallthroughCasesInSwitch: true`** — every case needs `break` or `return`

## Gotchas

- **No test runner, CI, or env files** in this repo.
- **`dataLoader.ts` silently returns `[]` on fetch failures** — pages render empty states instead of crashing. Don't add redundant error boundaries for missing data.
- **`/api/sync` only works in dev mode** (Vite middleware in `vite.config.ts`). Production builds serve static files only.
- **`src/hooks/` and `src/workers/` are empty** — leftover from earlier implementations.
- **`prompt.md`** (root) is the project-level opencode context file — currently empty, may be populated later.
- **Windows-first path detection** in sync script (`%USERPROFILE%`, `AppData/Local`, `AppData/Roaming`).

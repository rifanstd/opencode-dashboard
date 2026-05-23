You are the Programmer agent. Implement the hybrid sync approach for the Opencode Dashboard.

## IMPORTANT CONTEXT

This is a MAJOR architectural change to an existing implementation. The dashboard currently uses File System Access API + sql.js to read local opencode files. You need to CONVERT it to a hybrid approach:

1. A Node.js script auto-detects opencode folders and exports data to JSON
2. The dashboard reads JSON files via HTTP
3. A "Sync" button triggers the script to re-export

## Input Documents

1. **Updated Plan**: `D:\projects\opencode-dashboard\.knowledge\sessions\opencode-dashboard-20260523-1208\plan-v2.md`
2. **Updated Requirements**: `D:\projects\opencode-dashboard\.knowledge\sessions\opencode-dashboard-20260523-1208\requirements.md`

## Project Location
`D:\projects\opencode-dashboard` — existing React 19 + TypeScript + Vite project

## What Already Exists (from previous implementation)

The project currently has:
- React Router + Zustand + Recharts setup
- File System Access API code (needs to be REMOVED)
- sql.js Web Worker code (needs to be REMOVED)
- IndexedDB persistence code (needs to be REMOVED)
- Pages: Overview, TokenUsage, SessionsList, SessionDetail, Providers, Models, Agents, Skills, Logs
- Components: Layout, Sidebar, TopBar, LoadingOverlay, SummaryCard, DataTable, TokenChart, ErrorBoundary, ErrorMessage
- Dark theme CSS

## What You Need To Do

### Phase 1: Clean up old architecture
1. Remove `sql.js` from dependencies
2. Remove `scripts/copy-wasm.mjs` 
3. Remove `public/sql-wasm.wasm` if exists
4. Remove `src/workers/sqlWorker.ts`
5. Remove `src/hooks/useSqlWorker.ts`
6. Remove `src/utils/indexedDb.ts`
7. Remove `src/utils/dbInit.ts`
8. Remove `src/utils/queries.ts`
9. Remove `src/utils/validation.ts`
10. Remove `src/utils/refresh.ts`
11. Remove `src/components/BrowserWarning.tsx`
12. Remove `src/components/DirectoryPicker.tsx`
13. Remove File System Access API code from all components/pages

### Phase 2: Install new dependencies
- `better-sqlite3` (dev dependency for the sync script)

### Phase 3: Create Node.js sync script
Create `scripts/sync-opencode-data.js` that:
1. Auto-detects opencode data folders:
   - Windows: `%USERPROFILE%\.local\share\opencode\`, `%USERPROFILE%\.cache\opencode\`, `%USERPROFILE%\.config\opencode\`
   - Also check `OPENCODE_DATA_PATH` env var
   - Accept CLI arguments for manual paths
2. Reads `opencode.db` using `better-sqlite3`
3. Exports data to JSON files in `public/data/`:
   - `sessions.json` — all sessions with token data
   - `projects.json` — all projects
   - `messages.json` — all messages
   - `parts.json` — all parts
   - `providers.json` — parsed auth.json
   - `models.json` — model definitions
   - `agents.json` — parsed agent markdowns
   - `skills.json` — parsed skills-lock.json
   - `logs.json` — parsed log entries
   - `overview.json` — pre-computed overview stats
   - `token-usage.json` — pre-computed token usage aggregations
4. Creates `public/data/` directory if it doesn't exist
5. Handles missing files gracefully

### Phase 4: Add Vite middleware
Modify `vite.config.ts` to add a `/api/sync` endpoint that:
1. Spawns `node scripts/sync-opencode-data.js`
2. Returns `{ success: true/false, message: string }`

### Phase 5: Create JSON data loader utilities
Create `src/utils/dataLoader.ts` with functions to load each JSON file via `fetch()`:
- `loadSessions()`, `loadProjects()`, `loadMessages()`, `loadParts()`
- `loadProviders()`, `loadModels()`, `loadAgents()`, `loadSkills()`, `loadLogs()`
- `loadOverviewStats()`, `loadTokenUsage()`

### Phase 6: Update Zustand store
Modify `src/stores/appStore.ts`:
- Remove: `directoryHandles`, `isDbReady`, `loadingProgress`
- Add: `isSyncing`
- Update actions accordingly

### Phase 7: Update App.tsx
- Remove all File System Access API initialization code
- Load JSON data on mount via `useEffect`
- Add sync handler

### Phase 8: Update TopBar.tsx
- Add "Sync" button that calls `/api/sync`
- Show sync loading state

### Phase 9: Update all pages
Convert each page to use JSON data loaders instead of sql.js queries:
- **Overview.tsx**: Use `loadOverviewStats()` and `loadModels()`
- **TokenUsage.tsx**: Use `loadTokenUsage()`
- **SessionsList.tsx**: Use `loadSessions()`, filter client-side
- **SessionDetail.tsx**: Use `loadSessions()`, `loadMessages()`, `loadParts()`
- **Providers.tsx**: Use `loadProviders()`
- **Models.tsx**: Use `loadModels()`
- **Agents.tsx**: Use `loadAgents()`
- **Skills.tsx**: Use `loadSkills()`
- **Logs.tsx**: Use `loadLogs()`

### Phase 10: Update cost calculator
Modify `src/utils/costCalculator.ts` to work with JSON-loaded data

### Phase 11: Update package.json scripts
- Add `"sync": "node scripts/sync-opencode-data.js"`
- Remove `"postinstall": "node scripts/copy-wasm.mjs"`

### Phase 12: Build verification
- Run `npm run build` — must pass with zero errors
- Run `npm run lint` — must pass with zero errors

## Critical Constraints

- **TypeScript Strict**: `verbatimModuleSyntax: true` — use `import type` for type-only imports
- **Erasable Syntax**: `erasableSyntaxOnly: true` — NO `enum`, NO `namespace`
- **Build Strictness**: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` all `true`
- **ESM Only**: `"type": "module"` in package.json

## Verification Steps

After implementing:
1. Run `npm run sync` — script should auto-detect folders and export JSON
2. Run `npm run dev` — dashboard should load and display data
3. Click "Sync" button — should re-export data and refresh dashboard
4. Run `npm run build` — must pass with zero errors
5. Run `npm run lint` — must pass with zero errors

## Report Back

When complete, report:
1. Which files were created/modified/deleted
2. Build and lint verification output
3. Any issues encountered
4. Confirmation that the Sync button works

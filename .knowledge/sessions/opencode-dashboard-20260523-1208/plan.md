# Implementation Plan: Opencode Dashboard

## Reference
- Requirements: `.knowledge/sessions/opencode-dashboard-20260523-1208/requirements.md` v1
- Project Context: Existing React 19 + TypeScript + Vite project at `D:\projects\opencode-dashboard`
- Session Status: `.knowledge/sessions/opencode-dashboard-20260523-1208/status.md`

## Architecture

The dashboard is a single-page application (SPA) with client-side routing and a persistent sidebar navigation. Data is provided by a companion Node.js script that auto-detects opencode data folders, reads the SQLite database and other files, and exports them as JSON to `public/data/`. The dashboard reads these JSON files via standard HTTP requests. Zustand manages UI state. Pages render results with Recharts for analytics and plain React for tables and lists.

**Data Flow:**
1. User runs `npm run sync` (or script auto-runs on `npm run dev`) → Node.js script auto-detects opencode data folders
2. Script reads SQLite database using native `better-sqlite3` and exports all data to JSON files in `public/data/`
3. Script also exports `auth.json`, `models.json`, agents, skills, and logs as JSON
4. Dashboard loads JSON files via `fetch()` on app mount
5. User clicks "Sync" button → triggers script to re-export → dashboard reloads JSON files

**State Management:**
- **Zustand** (`src/stores/appStore.ts`) for UI state: loading flags, error messages, current route, and filter/sort state for the Sessions list
- No IndexedDB or File System Access API needed

**Routing:**
- React Router v7 with a `BrowserRouter` (hash-free, since this runs locally via Vite)
- Routes: `/` (Overview), `/tokens` (Token Usage), `/sessions` (Sessions List), `/sessions/:id` (Session Detail), `/providers`, `/models`, `/agents`, `/skills`, `/logs`

## Decision Points

- [x] **OQ-01 Layout Architecture**: Single-page layout with persistent sidebar + React Router v7 route-based navigation. Sidebar collapses on smaller desktop widths.
- [x] **OQ-02 Auto-Detect Strategy**: Node.js script checks common paths first (`~/.local/share/opencode/`, `~/.cache/opencode/`, `~/.config/opencode/` on Unix; `%USERPROFILE%\.local\share\opencode\` on Windows). If not found, checks `OPENCODE_DATA_PATH` environment variable. If still not found, accepts manual path arguments via CLI.
- [x] **OQ-03 Sync Mechanism**: Vite dev server middleware (`vite.config.ts`) exposes an endpoint `/api/sync` that executes the Node.js script via `child_process.spawn`. The "Sync" button in the dashboard fetches this endpoint, which re-exports data and returns success/failure.
- [x] **OQ-04 Charting Library**: Recharts. Justification: native React components, excellent TypeScript definitions, tree-shakeable, and sufficient for bar/line/area charts required for token analytics.
- [x] **OQ-05 State Management**: Zustand for UI state. No Redux/Jotai needed given the scope. No IndexedDB needed since data is loaded from JSON files.
- [x] **OQ-06 Data Refresh**: "Sync" button triggers `/api/sync` endpoint, then reloads JSON data. No polling.
- [x] **OQ-07 Cost Calculation Precision**: USD only, displayed with 4 decimal places when < $1.00, otherwise 2 decimal places. Standard rounding (`Math.round(value * 10000) / 10000`).
- [x] **OQ-08 Agent Markdown Parsing**: Extract the first H1 heading as the agent name and the first non-empty, non-heading paragraph as the description. Full content is not rendered; only name + description are shown in the list.

## Task Breakdown

### Task 1: Install dependencies and configure build tooling
- **Description**: Add runtime and dev dependencies required by the dashboard. Configure Vite to handle the sql.js WASM asset and update `index.html` title.
- **Files affected**:
  - `package.json` — add `react-router-dom`, `zustand`, `sql.js`, `recharts`, `date-fns`
  - `vite.config.ts` — ensure worker imports are supported (Vite handles `?worker` out of the box; no extra config needed)
  - `index.html` — change `<title>` to `Opencode Dashboard`
  - Create `scripts/copy-wasm.mjs` — Node ESM script that copies `node_modules/sql.js/dist/sql-wasm.wasm` into `public/sql-wasm.wasm`
  - `package.json` — add `"postinstall": "node scripts/copy-wasm.mjs"` script
- **Dependency**: None (first task)
- **Definition of Done**:
  - `npm install` completes without errors
  - `npm run postinstall` copies `sql-wasm.wasm` into `public/`
  - `npm run build` passes type-check and Vite build
- **Complexity**: low

### Task 2: Create global types and database schema interfaces
- **Description**: Define shared TypeScript interfaces for all domain entities. Since the exact SQLite schema is not fully known, base the initial types on the requirements and plan for runtime schema inspection. Use `type` aliases (not `enum` or `namespace`) to satisfy `erasableSyntaxOnly`.
- **Files affected**:
  - Create `src/types/index.ts` with:
    - `Session`, `Project`, `Message`, `Part`, `ModelInfo`, `ProviderInfo`, `AgentInfo`, `SkillInfo`, `LogEntry`, `TokenBreakdown`, `CostEstimate`
    - Worker message types: `WorkerRequest`, `WorkerResponse`
    - Directory handle types: `DirectoryType = 'local' | 'cache' | 'config'`
- **Dependency**: None
- **Definition of Done**:
  - All types compile with `tsc -b`
  - No `enum` or `namespace` usage
  - Type-only imports use `import type`
- **Complexity**: medium

### Task 3: Implement IndexedDB persistence for directory handles
- **Description**: Create a small wrapper around IndexedDB to save and restore the three `FileSystemDirectoryHandle` objects. Handles are stored as-is (the File System Access API spec allows this).
- **Files affected**:
  - Create `src/utils/indexedDb.ts` with:
    - `openDb(): Promise<IDBDatabase>`
    - `saveHandles(handles: Record<DirectoryType, FileSystemDirectoryHandle>): Promise<void>`
    - `loadHandles(): Promise<Partial<Record<DirectoryType, FileSystemDirectoryHandle>> | null>`
    - `clearHandles(): Promise<void>`
- **Dependency**: Task 2
- **Definition of Done**:
  - Handles can be saved and loaded across page reloads in Chrome/Edge
  - Gracefully returns `null` when no handles have been stored
- **Complexity**: medium

### Task 4: Implement browser support check and fallback overlay
- **Description**: Detect whether the browser supports the File System Access API (`showDirectoryPicker` in `window`). If not, render a full-page overlay explaining the requirement.
- **Files affected**:
  - Create `src/components/BrowserWarning.tsx` — full-screen centered card with message: "This dashboard requires Chrome or Edge because it reads local files directly from your computer."
  - Modify `src/App.tsx` — wrap router in a check: if unsupported, render `<BrowserWarning />`; otherwise render the app layout
- **Dependency**: None
- **Definition of Done**:
  - Opening the app in Firefox/Safari shows the warning and no other UI
  - Opening in Chrome/Edge proceeds to the normal app
- **Complexity**: low

### Task 5: Implement Zustand store and app layout shell
- **Description**: Set up the Zustand store for UI state and create the persistent layout with sidebar navigation and top bar.
- **Files affected**:
  - Create `src/stores/appStore.ts`:
    - State: `isLoading`, `loadingProgress` (0–100), `loadingMessage`, `error`, `directoryHandles: Partial<Record<DirectoryType, FileSystemDirectoryHandle>>`, `isDbReady`
    - Actions: `setDirectoryHandle`, `setLoading`, `setError`, `setDbReady`, `clearError`
  - Create `src/components/Layout.tsx` — flex container with sidebar (200px fixed) and main content area
  - Create `src/components/Sidebar.tsx` — list of `NavLink` items from `react-router-dom` for each page
  - Create `src/components/TopBar.tsx` — shows app title, refresh button, and "Settings" button to re-open directory picker
  - Modify `src/App.tsx` — replace starter content with `<BrowserRouter>`, `<Layout>`, and `<Routes>`
  - Modify `src/index.css` — replace Vite starter styles with dashboard base styles. Define CSS custom properties for the opencode-inspired dark theme: deep navy/black backgrounds (`--bg-primary: #0f172a`, `--bg-secondary: #1e293b`), subtle borders (`--border: #334155`), text colors (`--text-primary: #f1f5f9`, `--text-secondary: #94a3b8`), accent colors (`--accent: #6366f1`, `--accent-hover: #4f46e5`), chart colors, sidebar width, content padding. No light mode toggle needed.
- **Dependency**: Task 2, Task 3, Task 4
- **Definition of Done**:
  - Sidebar renders with working navigation links
  - Active route is highlighted
  - Top bar is visible on all routes
  - Store state changes trigger re-renders correctly
- **Complexity**: medium

### Task 6: Implement directory picker UI and setup flow
- **Description**: Create a setup/welcome screen that guides the user to select the three required directories sequentially using `showDirectoryPicker()`. Validate that each directory contains expected files (e.g., `opencode.db` in local, `models.json` in cache, `skills-lock.json` or `agents/` in config).
- **Files affected**:
  - Create `src/components/DirectoryPicker.tsx` — wizard with 3 steps, each with a button triggering `showDirectoryPicker()` and showing the selected path
  - Create `src/utils/validation.ts` — `async function validateDirectory(handle: FileSystemDirectoryHandle, type: DirectoryType): Promise<boolean>` that checks for at least one expected file/subdirectory
  - Modify `src/App.tsx` — if `directoryHandles` in store is incomplete, render `<DirectoryPicker />` instead of the layout
- **Dependency**: Task 3, Task 5
- **Definition of Done**:
  - User can select all three directories in sequence
  - Validation shows an inline error if the wrong directory is picked
  - Completed handles are saved to IndexedDB and the store
  - On reload, handles are restored and the app skips the picker (if permissions are granted)
- **Complexity**: medium

### Task 7: Implement file reading utilities
- **Description**: Create helpers to read text and binary files from persisted directory handles, and to list files matching a pattern.
- **Files affected**:
  - Create `src/utils/fileSystem.ts`:
    - `readTextFile(handle: FileSystemDirectoryHandle, relativePath: string): Promise<string | null>`
    - `readBinaryFile(handle: FileSystemDirectoryHandle, relativePath: string): Promise<ArrayBuffer | null>`
    - `listTextFiles(handle: FileSystemDirectoryHandle, subDir?: string, extension?: string): Promise<{ name: string; content: string }[]>`
  - All functions catch errors and return `null` / empty array for missing files (NFR-05)
- **Dependency**: Task 2
- **Definition of Done**:
  - Can read `auth.json` from the local directory handle
  - Can list all `.md` files in `agents/` subdirectory
  - Missing files return `null` without throwing
- **Complexity**: low

### Task 8: Implement sql.js Web Worker and database initialization flow
- **Description**: Build the Web Worker that hosts sql.js, the main-thread hook that communicates with it, and the orchestrated initialization sequence (stream-read DB file → transfer to worker → await ready signal).
- **Files affected**:
  - Create `src/workers/sqlWorker.ts`:
    - Imports `initSqlJs` from `sql.js`
    - Listens for `init` message with `ArrayBuffer`, initializes `Database`, posts `init` response
    - Listens for `query` message: prepares statement, binds optional params, collects rows via `getAsObject()`, frees statement, posts results
    - Listens for `exec` message: runs DDL/DML, posts confirmation
    - Uses `locateFile: (file) => \`/${file}\`` to load `sql-wasm.wasm` from the domain root (`public/`)
  - Create `src/hooks/useSqlWorker.ts`:
    - `initDb(buffer: ArrayBuffer): Promise<void>` — creates worker via `new SqlWorker()`, sends buffer, awaits `init` response
    - `query<T>(sql: string, params?: (string | number | null)[]): Promise<T[]>` — sends `query` message, awaits typed results
    - `exec(sql: string): Promise<void>` — sends `exec` message
    - Cleans up worker on unmount
  - Create `src/utils/dbInit.ts`:
    - `streamReadFile(file: File, onProgress: (pct: number) => void): Promise<Uint8Array>` — uses `file.stream().getReader()` to read chunks, report progress, and concatenate into a single `Uint8Array`
    - `initializeDatabase(localHandle: FileSystemDirectoryHandle, onProgress: (stage: string, pct: number) => void): Promise<void>` — gets `opencode.db` handle, streams it, transfers buffer to worker via `useSqlWorker`
- **Dependency**: Task 1, Task 2, Task 7
- **Definition of Done**:
  - Worker compiles and loads `sql-wasm.wasm` successfully
  - `streamReadFile` reports accurate percentage progress for a large file
  - `initializeDatabase` completes without blocking the UI (main thread remains responsive)
  - A sample `SELECT 1` query returns `[{ '1': 1 }]`
- **Complexity**: high

### Task 9: Define SQL query helpers and inspect runtime schema
- **Description**: Create a module of parameterized SQL queries for each dashboard feature. Include an initial schema-discovery query so the app can verify table names and adjust if needed.
- **Files affected**:
  - Create `src/utils/queries.ts`:
    - `getTables()` — `SELECT name FROM sqlite_master WHERE type='table'`
    - `getOverviewStats()` — aggregations for total sessions, token sums, project count, top model
    - `getSessions({ search, project, model, dateFrom, dateTo, sortBy, sortOrder, limit, offset })` — filtered, sorted, paginated session list
    - `getSessionById(id: string)` — session row
    - `getSessionMessages(sessionId: string)` — messages for a session
    - `getSessionParts(messageId: string)` — parts for a message
    - `getTokenUsageByModel()` — grouped bar chart data
    - `getTokenUsageByProvider()` — grouped bar chart data
    - `getTokenUsageByProject()` — grouped bar chart data
    - `getTokenUsageOverTime(granularity: 'day' | 'week' | 'month')` — time-series line chart data using `strftime()`
  - All query functions accept the worker `query` function as an argument so they remain pure
- **Dependency**: Task 2, Task 8
- **Definition of Done**:
  - All query strings are syntactically valid SQLite
  - Query helpers compile with strict TypeScript
  - Schema discovery query runs successfully against the actual database
- **Complexity**: high

### Task 10: Implement cost calculation utility
- **Description**: Build a pure function that calculates session cost from token counts and per-model pricing loaded from `models.json`.
- **Files affected**:
  - Create `src/utils/costCalculator.ts`:
    - `interface Pricing { input: number; output: number; reasoning?: number; cache?: number }`
    - `function calculateCost(tokens: TokenBreakdown, pricing: Pricing): number`
    - `function formatCost(value: number): string` — returns `$0.1234` or `$1.23` based on magnitude
    - `function loadPricing(modelsJson: unknown): Map<string, Pricing>` — parses `models.json` into a lookup map by model ID
  - Create `src/utils/__tests__/` (out of scope per constraints, but document expected behavior in comments)
- **Dependency**: Task 2
- **Definition of Done**:
  - `calculateCost({ input: 1000, output: 500 }, { input: 0.00001, output: 0.00002 })` returns `0.02`
  - `formatCost(0.12345)` returns `'$0.1235'`
  - `formatCost(12.345)` returns `'$12.35'`
- **Complexity**: low

### Task 11: Implement loading overlay component
- **Description**: Create a reusable full-screen overlay that shows a progress bar and status message during database initialization.
- **Files affected**:
  - Create `src/components/LoadingOverlay.tsx` — accepts `progress: number` (0–100) and `message: string`; renders a centered card with a `<progress>` element and text
  - Modify `src/App.tsx` — when `isLoading` is true in the store, render `<LoadingOverlay />` above the layout
- **Dependency**: Task 5
- **Definition of Done**:
  - Overlay blocks interaction with the main UI while visible
  - Progress bar updates smoothly as `streamReadFile` reports percentages
  - Message text changes from "Reading database file…" to "Initializing SQLite engine…"
- **Complexity**: low

### Task 12: Implement Overview Dashboard page
- **Description**: Build the landing page with summary cards displaying aggregated metrics from the database.
- **Files affected**:
  - Create `src/components/SummaryCard.tsx` — reusable card showing a label, big number, and optional sub-label
  - Create `src/pages/Overview.tsx`:
    - Fetches overview stats via `getOverviewStats()` on mount
    - Displays cards: Total Sessions, Total Input Tokens, Total Output Tokens, Total Reasoning Tokens, Total Cache Tokens, Total Estimated Cost, Most Used Model, Active Projects
    - Cost is calculated by joining session token data with pricing from `models.json` (loaded via `fileSystem.ts` and parsed by `costCalculator.ts`)
    - Uses `useEffect` + `useState` for data fetching; shows spinner while loading
  - Modify `src/components/Sidebar.tsx` — ensure Overview is the default/active route
- **Dependency**: Task 5, Task 8, Task 9, Task 10, Task 11
- **Definition of Done**:
  - All 8 summary cards render with real data from the local database
  - Cost card uses the pricing utility
  - Page handles missing `models.json` gracefully (shows "N/A" for cost)
- **Complexity**: medium

### Task 13: Implement Sessions List and Session Detail pages
- **Description**: Create a sortable, filterable, searchable table of all sessions and a drill-down detail view.
- **Files affected**:
  - Create `src/components/DataTable.tsx` — generic table with clickable sortable headers. Props: `columns`, `data`, `sortKey`, `sortOrder`, `onSort`, `keyExtractor`
  - Create `src/pages/SessionsList.tsx`:
    - State: `search` (text), `projectFilter`, `modelFilter`, `dateFrom`, `dateTo`, `sortBy`, `sortOrder`, `page`, `pageSize`
    - Fetches sessions via `getSessions()` with all filters
    - Renders `DataTable` with columns: Title, Project, Model, Tokens, Cost, Date
    - Search input, project/model `<select>` filters, date inputs, and pagination controls
    - Clicking a row navigates to `/sessions/:id`
  - Create `src/pages/SessionDetail.tsx`:
    - Reads `id` from `useParams()`
    - Fetches session, messages, and parts via query helpers
    - Displays session metadata, message list (role, content preview), expandable parts with tool-call details, and a token breakdown bar chart (using Recharts `BarChart` with a single data point or a simple horizontal bar)
    - "Back to sessions" link
- **Dependency**: Task 5, Task 8, Task 9, Task 10
- **Definition of Done**:
  - Sessions list supports text search, project/model filters, date range, and sorting by date/cost/tokens
  - Pagination works (default 50 rows per page)
  - Session detail shows messages, parts, and token breakdown
  - Navigation from list to detail and back works via router
- **Complexity**: high

### Task 14: Implement Token Usage Analytics page
- **Description**: Build the analytics page with interactive charts for token consumption breakdowns.
- **Files affected**:
  - Create `src/pages/TokenUsage.tsx`:
    - State: `breakdown` (`'model' | 'provider' | 'project' | 'time'`), `timeGranularity` (`'day' | 'week' | 'month'`)
    - When breakdown is `'time'`, show a `<select>` for granularity
    - Fetches data via appropriate query helper based on state
    - For model/provider/project: renders `BarChart` (stacked bars for input/output/reasoning/cache)
    - For time: renders `AreaChart` or `LineChart` with time on X-axis and stacked areas for token types
    - All charts wrapped in `ResponsiveContainer` for responsiveness
    - Summary stats below charts: total tokens in current view, average per day, peak day
  - Create `src/components/TokenChart.tsx` — thin wrapper around Recharts chart types to reduce duplication
- **Dependency**: Task 5, Task 8, Task 9
- **Definition of Done**:
  - Switching breakdown type updates the chart data
  - Time granularity switcher works for time-based view
  - Charts are readable at 1280px and 1920px widths
  - Tooltip shows exact token counts
- **Complexity**: high

### Task 15: Implement Providers page
- **Description**: Read `auth.json` from the local directory and display connected API providers with masked API keys.
- **Files affected**:
  - Create `src/pages/Providers.tsx`:
    - Uses `readTextFile(localHandle, 'auth.json')` and `JSON.parse`
    - Renders a list/card for each provider entry
    - Masks API keys: show first 3 chars + `...` + last 4 chars (e.g., `sk-...xxxx`)
    - Shows connection state if determinable from the JSON structure (e.g., presence of `apiKey` implies configured)
    - Handles missing or malformed `auth.json` with a friendly message
- **Dependency**: Task 5, Task 7
- **Definition of Done**:
  - Provider list renders with masked keys
  - Missing file shows "No auth.json found" instead of crashing
- **Complexity**: low

### Task 16: Implement Models page
- **Description**: Read `models.json` from the cache directory and display available models with capabilities, pricing, and context window.
- **Files affected**:
  - Create `src/pages/Models.tsx`:
    - Uses `readTextFile(cacheHandle, 'models.json')` and `JSON.parse`
    - Renders a table or card grid: Model ID, Provider, Capabilities (comma list), Input Price, Output Price, Context Window
    - Sortable by model ID or provider
    - Handles missing `models.json`
- **Dependency**: Task 5, Task 7
- **Definition of Done**:
  - All models from `models.json` are displayed
  - Pricing shown in standard per-million-token units (or as-is from JSON, with `$` prefix)
- **Complexity**: low

### Task 17: Implement Agents page
- **Description**: Read all `*.md` files from the agents directory and display agent names and descriptions.
- **Files affected**:
  - Create `src/utils/markdownParser.ts`:
    - `extractAgentInfo(content: string): { name: string; description: string }`
    - Name: first H1 match (`/^#\s+(.+)$/m`)
    - Description: first non-empty line that is not a heading and not inside a code block
  - Create `src/pages/Agents.tsx`:
    - Uses `listTextFiles(configHandle, 'agents', '.md')`
    - Maps over results, parses each with `extractAgentInfo`
    - Renders a list: agent name (bold) + description
    - Handles missing `agents/` directory
- **Dependency**: Task 5, Task 7
- **Definition of Done**:
  - Each agent shows a name and a one-line description
  - Missing directory shows "No agents found"
- **Complexity**: low

### Task 18: Implement Skills page
- **Description**: Read `skills-lock.json` from the config directory and display installed skills.
- **Files affected**:
  - Create `src/pages/Skills.tsx`:
    - Uses `readTextFile(configHandle, 'skills-lock.json')` and `JSON.parse`
    - Renders a table: Skill Name, Version, Source/Origin
    - Handles missing or malformed JSON
- **Dependency**: Task 5, Task 7
- **Definition of Done**:
  - Skills list renders correctly
  - Missing file shows friendly error
- **Complexity**: low

### Task 19: Implement Logs/Activity page
- **Description**: Read log files from the log directory, parse entries, and display with filtering.
- **Files affected**:
  - Create `src/utils/logParser.ts`:
    - `parseLogFile(content: string): LogEntry[]`
    - Supports common log formats: ISO timestamp + level + message
    - Falls back to treating each line as a plain message if parsing fails
  - Create `src/pages/Logs.tsx`:
    - Uses `listTextFiles(localHandle, 'log', '.log')`
    - State: `levelFilter` (`'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'`), `dateFrom`, `dateTo`, `search`
    - Parses all log files, combines into a single array, sorts by timestamp descending
    - Filters by level, date range, and text search
    - Renders a table: Timestamp, Level (color-coded badge), Message
    - Shows filename source for each entry
- **Dependency**: Task 5, Task 7
- **Definition of Done**:
  - Log entries are parsed and sorted by time
  - Level filter works correctly
  - Date range filter works
  - Search filters message text
  - Color coding: INFO = blue, WARN = yellow, ERROR = red, DEBUG = gray
- **Complexity**: medium

### Task 20: Implement error handling and resilience
- **Description**: Add error boundaries, graceful fallbacks for missing files, and user-friendly error messages.
- **Files affected**:
  - Create `src/components/ErrorBoundary.tsx` — class component implementing `componentDidCatch`, renders fallback UI with error message and "Reload" button
  - Create `src/components/ErrorMessage.tsx` — inline banner for non-fatal errors (e.g., "Failed to load models.json")
  - Modify `src/App.tsx` — wrap `<Routes>` in `<ErrorBoundary>`
  - Modify each page component — wrap file reads and queries in `try/catch`, render `<ErrorMessage>` on failure
  - Modify `src/stores/appStore.ts` — add `error` and `clearError` actions
- **Dependency**: Task 5
- **Definition of Done**:
  - A JavaScript error in any page does not crash the entire app
  - Missing `auth.json` on the Providers page shows a banner, not a white screen
  - SQL query errors are caught and displayed
- **Complexity**: medium

### Task 21: Implement manual data refresh
- **Description**: Wire the refresh button in the top bar to re-read all files and re-initialize the database worker.
- **Files affected**:
  - Modify `src/components/TopBar.tsx` — refresh button calls a `refreshData()` callback
  - Create `src/utils/refresh.ts` — `async function refreshData()` that:
    1. Sets `isLoading` true in store
    2. Terminates existing worker
    3. Re-runs `initializeDatabase()`
    4. Re-fetches `models.json`, `auth.json`, etc.
    5. Sets `isLoading` false
  - Modify `src/App.tsx` or `src/stores/appStore.ts` — expose refresh action
- **Dependency**: Task 8, Task 11
- **Definition of Done**:
  - Clicking refresh shows the loading overlay
  - Database is re-initialized with current file contents
  - All pages update with fresh data after refresh completes
- **Complexity**: medium

### Task 22: Final styling, responsiveness, and dark theme polish
- **Description**: Ensure the dashboard is usable from 1280px to 1920px, the opencode-inspired dark theme is applied consistently across all components, and all visual elements have proper spacing and typography.
- **Files affected**:
  - `src/index.css` — verify all CSS custom properties are used consistently; add media queries for sidebar collapse at < 1400px; adjust font sizes; ensure tables scroll horizontally if needed
  - `src/components/Layout.tsx` — make sidebar collapsible on narrow widths (optional hamburger button)
  - All page components — ensure tables use `overflow-x: auto` wrappers; verify card backgrounds, borders, and text colors match the dark theme
  - All chart components — ensure `ResponsiveContainer` has a defined parent height; verify chart colors are visible on dark backgrounds (use bright, saturated colors with good contrast)
  - `src/App.css` — delete or repurpose; remove unused Vite starter styles
- **Dependency**: All previous tasks
- **Definition of Done**:
  - No horizontal scrollbars at 1280px unless table content genuinely overflows
  - Dark theme (deep navy/black base with blue/purple accents) is consistent across all pages and components
  - Chart colors are clearly visible against dark backgrounds
  - All unused CSS is removed (build passes `noUnusedLocals` for CSS modules if used; plain CSS is fine)
- **Complexity**: medium

### Task 23: Self-review and build verification
- **Description**: Run the full build, check for TypeScript errors, lint errors, and verify all requirements are addressed.
- **Files affected**: None (verification only)
- **Dependency**: All previous tasks
- **Definition of Done**:
  - `npm run build` completes with zero errors
  - `npm run lint` passes with zero errors
  - Every FR from requirements.md can be traced to at least one task in this plan
  - No placeholder text ("TODO", "TBD", "implement later") remains in the plan
- **Complexity**: low

## File / Directory Structure for New Code

```
src/
  main.tsx                     (entry — already exists, may need router wrapper)
  App.tsx                      (replace starter content with router + layout)
  index.css                    (replace starter styles with dashboard base)
  App.css                      (delete or repurpose)
  types/
    index.ts                   (all shared TypeScript interfaces)
  stores/
    appStore.ts                (Zustand store)
  workers/
    sqlWorker.ts               (sql.js Web Worker)
  hooks/
    useSqlWorker.ts            (main-thread worker communication)
  utils/
    indexedDb.ts               (IndexedDB wrapper for handles)
    fileSystem.ts              (read files from directory handles)
    dbInit.ts                  (stream-read DB + initialize worker)
    queries.ts                 (parameterized SQL query builders)
    costCalculator.ts          (cost math + formatting)
    markdownParser.ts          (agent description extraction)
    logParser.ts               (log entry parsing)
    validation.ts              (directory validation)
    refresh.ts                 (manual refresh orchestration)
  components/
    Layout.tsx                 (sidebar + main area shell)
    Sidebar.tsx                (navigation links)
    TopBar.tsx                 (title, refresh, settings)
    BrowserWarning.tsx         (unsupported browser overlay)
    DirectoryPicker.tsx        (3-step folder selection wizard)
    LoadingOverlay.tsx         (progress bar + message)
    SummaryCard.tsx            (metric card for Overview)
    DataTable.tsx              (sortable table component)
    TokenChart.tsx             (Recharts wrapper)
    ErrorBoundary.tsx          (React error boundary)
    ErrorMessage.tsx           (inline error banner)
  pages/
    Overview.tsx               (FR-01)
    TokenUsage.tsx             (FR-02)
    SessionsList.tsx           (FR-03)
    SessionDetail.tsx          (FR-04)
    Providers.tsx              (FR-05)
    Models.tsx                 (FR-06)
    Agents.tsx                 (FR-07)
    Skills.tsx                 (FR-08)
    Logs.tsx                   (FR-09)
scripts/
  copy-wasm.mjs                (postinstall script to copy sql-wasm.wasm)
public/
  sql-wasm.wasm                (copied by postinstall from sql.js)
```

## Dependencies to Install

| Package | Version | Justification |
|---------|---------|---------------|
| `react-router-dom` | ^7.x | Client-side routing for 9 distinct views; standard React solution with excellent TypeScript support |
| `zustand` | ^5.x | Lightweight state management (~1kB). No providers needed. Handles non-serializable objects (Worker, handles) easily when combined with IndexedDB persistence |
| `sql.js` | ^1.x | SQLite compiled to WASM; required by constraints to read `opencode.db` in the browser |
| `recharts` | ^2.x | React-native charting library. Tree-shakeable. Covers bar, line, area, and pie charts needed for token analytics |
| `date-fns` | ^4.x | Date manipulation for time-series grouping and log filtering. Smaller and more tree-shakeable than Moment.js |

**No additional dev dependencies** are required. Vite already supports `?worker` imports and ESM.

## Error Handling Strategy

1. **Browser Unsupported**: Full-page `<BrowserWarning>` blocks all interaction. No fallback upload path (per constraints).
2. **Missing Files**: Every `readTextFile` / `readBinaryFile` call returns `null` on error. Pages check for `null` and render `<ErrorMessage>` with a contextual message (e.g., "Could not find auth.json in the selected directory").
3. **Corrupted Database**: If `sql.js` fails to open the buffer, the worker posts an `init` error. The main thread catches this, sets `error` in the store, and shows a retry button in `<LoadingOverlay>`.
4. **SQL Errors**: Worker catches query exceptions and returns them in the response payload. `useSqlWorker` throws, and calling pages catch and render `<ErrorMessage>`.
5. **Runtime Errors**: A single `<ErrorBoundary>` around `<Routes>` prevents any page crash from tearing down the whole app.
6. **Permission Loss**: On reload, if IndexedDB restores handles but the user has revoked permission, `requestPermission()` is attempted. If denied, the app falls back to the `<DirectoryPicker>`.

## Performance Considerations for Large SQLite File

1. **Web Worker Isolation**: The sql.js `Database` instance and all query execution live in `src/workers/sqlWorker.ts`. The main thread never parses SQL or holds the 196MB buffer after transfer.
2. **Streaming File Read**: `streamReadFile` uses `ReadableStreamDefaultReader` to read the `opencode.db` `File` in chunks. This yields to the event loop between chunks, keeping the UI responsive and allowing accurate progress reporting.
3. **Transferable Objects**: The `Uint8Array` buffer is transferred to the worker via `worker.postMessage({ buffer }, [buffer.buffer])` so the main thread releases the memory.
4. **Query Pagination**: `getSessions()` always uses `LIMIT` / `OFFSET` in SQL. The Sessions list never loads all rows into React state at once.
5. **Memoization**: Pages that run heavy aggregations (Overview, Token Usage) store results in local `useState` and only re-fetch on explicit refresh or filter change. `React.memo` is applied to `DataTable` rows and chart components.
6. **No Polling**: Data does not auto-refresh. A manual refresh button prevents repeated 196MB reads.
7. **Chart Responsiveness**: All Recharts are wrapped in `<ResponsiveContainer>` with a fixed parent height (e.g., `h-80` or `300px`) to avoid layout thrashing.

## Risks & Alternatives

- **Risk**: `sql.js` WASM file (~1MB) + 196MB database may exceed browser memory limits on machines with < 8GB RAM | **Mitigation**: Document that the dashboard targets developer workstations. The streaming read uses chunked transfer and the worker holds only one copy of the DB. If crashes occur, investigate sql.js `createDatabase` from a smaller subset or use an OPFS-backed SQLite build (much harder).
- **Risk**: File System Access API permission is not persistent across browser restarts in all cases | **Mitigation**: Store handles in IndexedDB and call `handle.requestPermission()` on startup. If denied, gracefully redirect to the directory picker with an explanatory toast.
- **Risk**: Recharts bundle size is non-trivial (~400kB gzipped) | **Mitigation**: Import only the specific chart components needed (`BarChart`, `LineChart`, `AreaChart`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`, `ResponsiveContainer`). Tree-shaking should eliminate unused code. **Alternative**: If bundle size becomes problematic, switch to `chart.js` + `react-chartjs-2` which is slightly smaller, but this requires a migration task.
- **Risk**: Exact SQLite schema may differ from assumptions in `src/types/index.ts` and `src/utils/queries.ts` | **Mitigation**: Task 9 includes a schema-discovery query. If the actual schema differs, the programmer must adjust types and queries before proceeding to dependent tasks. This risk is flagged as a potential blocker after Task 9.
- **Risk**: `date-fns` or `recharts` may have type issues with `verbatimModuleSyntax` | **Mitigation**: Use `import type` for any type-only imports from these libraries. Both packages are well-maintained and ESM-compatible.

## Dependency Order

```
Task 1  →  Task 2  →  Task 3
                ↓
Task 4  →  Task 5  →  Task 6  →  Task 7  →  Task 8  →  Task 9  →  Task 10
                                                              ↓
                                                    (parallel after Task 9)
                                                    Task 11  →  Task 12
                                                    Task 13  →  Task 14
                                                    Task 15
                                                    Task 16
                                                    Task 17
                                                    Task 18
                                                    Task 19
                                                              ↓
                                                    Task 20  →  Task 21  →  Task 22  →  Task 23
```

**Critical path**: 1 → 2 → 3 → 5 → 6 → 7 → 8 → 9 → 12 (Overview is the landing page and validates the full data pipeline).

**Parallelizable after Task 9**: Tasks 12–19 can be implemented in any order once the query helpers and cost calculator exist.

---

**Version**: 1 | **Author**: planner | **Ref**: requirements v1 | **Date**: 2026-05-23

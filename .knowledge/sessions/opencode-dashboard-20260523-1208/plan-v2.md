# Implementation Plan: Opencode Dashboard (Hybrid Sync Approach)

## Reference
- Requirements: `.knowledge/sessions/opencode-dashboard-20260523-1208/requirements.md` v2
- Project Context: Existing React 19 + TypeScript + Vite project at `D:\projects\opencode-dashboard`
- Session Status: `.knowledge/sessions/opencode-dashboard-20260523-1208/status.md`

## Architecture

The dashboard is a single-page application (SPA) with client-side routing and a persistent sidebar navigation. Data is provided by a companion Node.js script that auto-detects opencode data folders, reads the SQLite database and other files, and exports them as JSON to `public/data/`. The dashboard reads these JSON files via standard HTTP requests. Zustand manages UI state. Pages render results with Recharts for analytics and plain React for tables and lists.

**Data Flow:**
1. User runs `npm run sync` (or script auto-runs on `npm run dev`) → Node.js script auto-detects opencode data folders
2. Script reads SQLite database using native `better-sqlite3` and exports all data to JSON files in `public/data/`
3. Script also exports `auth.json`, `models.json`, agents, skills, and logs as JSON
4. Dashboard loads JSON files via `fetch()` on app mount
5. User clicks "Sync" button → triggers `/api/sync` endpoint → script re-exports → dashboard reloads JSON files

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
- **Description**: Add runtime and dev dependencies required by the dashboard and the Node.js sync script. Update `index.html` title.
- **Files affected**:
  - `package.json` — add `react-router-dom`, `zustand`, `recharts` (remove `sql.js`, `date-fns` if present); add `better-sqlite3` as dev dependency for the sync script
  - `index.html` — change `<title>` to `Opencode Dashboard`
  - `vite.config.ts` — add Vite plugin/middleware for `/api/sync` endpoint
- **Dependency**: None (first task)
- **Definition of Done**:
  - `npm install` completes without errors
  - `npm run build` passes type-check and Vite build
- **Complexity**: low

### Task 2: Create global types and interfaces
- **Description**: Define shared TypeScript interfaces for all domain entities. Use `type` aliases (not `enum` or `namespace`) to satisfy `erasableSyntaxOnly`.
- **Files affected**:
  - Create `src/types/index.ts` with:
    - `Session`, `Project`, `Message`, `Part`, `ModelInfo`, `ProviderInfo`, `AgentInfo`, `SkillInfo`, `LogEntry`, `TokenBreakdown`, `CostEstimate`
    - `SyncStatus` type for sync state
- **Dependency**: None
- **Definition of Done**:
  - All types compile with `tsc -b`
  - No `enum` or `namespace` usage
  - Type-only imports use `import type`
- **Complexity**: medium

### Task 3: Implement Node.js sync script (auto-detect + export)
- **Description**: Create a Node.js script that auto-detects opencode data folders and exports all data to JSON files in `public/data/`.
- **Files affected**:
  - Create `scripts/sync-opencode-data.js`:
    - `detectOpencodePaths()` — checks common paths and environment variables
    - `exportDatabase(dbPath)` — reads SQLite using `better-sqlite3`, exports sessions, messages, parts, projects, token aggregations
    - `exportJsonFiles(paths)` — exports auth.json, models.json, skills-lock.json, agents, logs
    - `main()` — orchestrates detection and export
  - Create `public/data/` directory for exported JSON files
- **Dependency**: Task 2
- **Definition of Done**:
  - Script auto-detects opencode folders on Windows
  - Script exports all required data to JSON files
  - Script handles missing files gracefully
  - `node scripts/sync-opencode-data.js` runs successfully
- **Complexity**: high

### Task 4: Implement Vite middleware for sync endpoint
- **Description**: Add a Vite plugin that exposes `/api/sync` endpoint to trigger the Node.js script from the browser.
- **Files affected**:
  - Modify `vite.config.ts` — add `configureServer` middleware:
    - Endpoint: `/api/sync`
    - Spawns `node scripts/sync-opencode-data.js` via `child_process.spawn`
    - Returns JSON response: `{ success: boolean, message: string }`
- **Dependency**: Task 3
- **Definition of Done**:
  - `curl http://localhost:5173/api/sync` triggers the script
  - Endpoint returns success/failure response
  - No CORS issues
- **Complexity**: medium

### Task 5: Implement Zustand store and app layout shell
- **Description**: Set up the Zustand store for UI state and create the persistent layout with sidebar navigation and top bar.
- **Files affected**:
  - Create `src/stores/appStore.ts`:
    - State: `isLoading`, `isSyncing`, `error`, `currentRoute`
    - Actions: `setLoading`, `setSyncing`, `setError`, `clearError`
  - Create `src/components/Layout.tsx` — flex container with sidebar (200px fixed) and main content area
  - Create `src/components/Sidebar.tsx` — list of `NavLink` items from `react-router-dom` for each page
  - Create `src/components/TopBar.tsx` — shows app title, sync button, and refresh button
  - Modify `src/App.tsx` — replace starter content with `<BrowserRouter>`, `<Layout>`, and `<Routes>`
  - Modify `src/index.css` — replace Vite starter styles with dashboard base styles (CSS variables for dark theme)
- **Dependency**: Task 2
- **Definition of Done**:
  - Sidebar renders with working navigation links
  - Active route is highlighted
  - Top bar is visible on all routes with sync button
  - Store state changes trigger re-renders correctly
- **Complexity**: medium

### Task 6: Implement JSON data loading utilities
- **Description**: Create helpers to load JSON data files exported by the sync script.
- **Files affected**:
  - Create `src/utils/dataLoader.ts`:
    - `loadSessions(): Promise<Session[]>` — fetches `/data/sessions.json`
    - `loadProjects(): Promise<Project[]>` — fetches `/data/projects.json`
    - `loadMessages(): Promise<Message[]>` — fetches `/data/messages.json`
    - `loadParts(): Promise<Part[]>` — fetches `/data/parts.json`
    - `loadProviders(): Promise<ProviderInfo[]>` — fetches `/data/providers.json`
    - `loadModels(): Promise<ModelInfo[]>` — fetches `/data/models.json`
    - `loadAgents(): Promise<AgentInfo[]>` — fetches `/data/agents.json`
    - `loadSkills(): Promise<SkillInfo[]>` — fetches `/data/skills.json`
    - `loadLogs(): Promise<LogEntry[]>` — fetches `/data/logs.json`
    - `loadOverviewStats(): Promise<OverviewStats>` — fetches `/data/overview.json`
    - `loadTokenUsage(): Promise<TokenUsageData>` — fetches `/data/token-usage.json`
  - All functions catch errors and return empty arrays/objects for missing files
- **Dependency**: Task 2
- **Definition of Done**:
  - Can load all JSON data files
  - Missing files return empty data without throwing
  - All functions compile with strict TypeScript
- **Complexity**: medium

### Task 7: Implement sync button and loading state
- **Description**: Wire the sync button in the top bar to call the `/api/sync` endpoint and reload data.
- **Files affected**:
  - Modify `src/components/TopBar.tsx` — sync button calls `handleSync()`
  - Create `src/utils/sync.ts` — `async function handleSync()` that:
    1. Sets `isSyncing` true in store
    2. Fetches `/api/sync`
    3. On success, reloads all JSON data
    4. Sets `isSyncing` false
  - Modify `src/App.tsx` — load data on mount and after sync
- **Dependency**: Task 4, Task 5, Task 6
- **Definition of Done**:
  - Clicking sync shows loading state
  - Data is refreshed after sync completes
  - Error handling for failed sync
- **Complexity**: medium

### Task 8: Implement cost calculation utility
- **Description**: Build a pure function that calculates session cost from token counts and per-model pricing loaded from JSON.
- **Files affected**:
  - Create `src/utils/costCalculator.ts`:
    - `interface Pricing { input: number; output: number; reasoning?: number; cache?: number }`
    - `function calculateCost(tokens: TokenBreakdown, pricing: Pricing): number`
    - `function formatCost(value: number): string` — returns `$0.1234` or `$1.23` based on magnitude
    - `function loadPricing(modelsJson: unknown): Map<string, Pricing>` — parses models data into a lookup map by model ID
- **Dependency**: Task 2
- **Definition of Done**:
  - `calculateCost({ input: 1000, output: 500 }, { input: 0.00001, output: 0.00002 })` returns `0.02`
  - `formatCost(0.12345)` returns `'$0.1235'`
  - `formatCost(12.345)` returns `'$12.35'`
- **Complexity**: low

### Task 9: Implement loading overlay component
- **Description**: Create a reusable loading indicator for data loading and sync operations.
- **Files affected**:
  - Create `src/components/LoadingOverlay.tsx` — accepts `message: string`; renders a centered spinner with text
  - Modify `src/App.tsx` — when `isLoading` or `isSyncing` is true in the store, render `<LoadingOverlay />`
- **Dependency**: Task 5
- **Definition of Done**:
  - Overlay blocks interaction with the main UI while visible
  - Message text changes based on operation ("Loading data…", "Syncing…")
- **Complexity**: low

### Task 10: Implement Overview Dashboard page
- **Description**: Build the landing page with summary cards displaying aggregated metrics from JSON data.
- **Files affected**:
  - Create `src/components/SummaryCard.tsx` — reusable card showing a label, big number, and optional sub-label
  - Create `src/pages/Overview.tsx`:
    - Fetches overview stats via `loadOverviewStats()` on mount
    - Displays cards: Total Sessions, Total Input Tokens, Total Output Tokens, Total Reasoning Tokens, Total Cache Tokens, Total Estimated Cost, Most Used Model, Active Projects
    - Cost is calculated by joining session token data with pricing from models JSON
    - Uses `useEffect` + `useState` for data fetching; shows spinner while loading
  - Modify `src/components/Sidebar.tsx` — ensure Overview is the default/active route
- **Dependency**: Task 5, Task 6, Task 8, Task 9
- **Definition of Done**:
  - All 8 summary cards render with real data from JSON files
  - Cost card uses the pricing utility
  - Page handles missing data gracefully (shows "N/A" for cost)
- **Complexity**: medium

### Task 11: Implement Sessions List and Session Detail pages
- **Description**: Create a sortable, filterable, searchable table of all sessions and a drill-down detail view.
- **Files affected**:
  - Create `src/components/DataTable.tsx` — generic table with clickable sortable headers. Props: `columns`, `data`, `sortKey`, `sortOrder`, `onSort`, `keyExtractor`
  - Create `src/pages/SessionsList.tsx`:
    - State: `search` (text), `projectFilter`, `modelFilter`, `dateFrom`, `dateTo`, `sortBy`, `sortOrder`, `page`, `pageSize`
    - Fetches sessions via `loadSessions()` and filters client-side
    - Renders `DataTable` with columns: Title, Project, Model, Tokens, Cost, Date
    - Search input, project/model `<select>` filters, date inputs, and pagination controls
    - Clicking a row navigates to `/sessions/:id`
  - Create `src/pages/SessionDetail.tsx`:
    - Reads `id` from `useParams()`
    - Fetches session, messages, and parts from JSON
    - Displays session metadata, message list (role, content preview), expandable parts with tool-call details, and a token breakdown bar chart (using Recharts)
    - "Back to sessions" link
- **Dependency**: Task 5, Task 6, Task 8
- **Definition of Done**:
  - Sessions list supports text search, project/model filters, date range, and sorting by date/cost/tokens
  - Pagination works (default 50 rows per page)
  - Session detail shows messages, parts, and token breakdown
  - Navigation from list to detail and back works via router
- **Complexity**: high

### Task 12: Implement Token Usage Analytics page
- **Description**: Build the analytics page with interactive charts for token consumption breakdowns.
- **Files affected**:
  - Create `src/pages/TokenUsage.tsx`:
    - State: `breakdown` (`'model' | 'provider' | 'project' | 'time'`), `timeGranularity` (`'day' | 'week' | 'month'`)
    - When breakdown is `'time'`, show a `<select>` for granularity
    - Fetches data via `loadTokenUsage()`
    - For model/provider/project: renders `BarChart` (stacked bars for input/output/reasoning/cache)
    - For time: renders `AreaChart` or `LineChart` with time on X-axis and stacked areas for token types
    - All charts wrapped in `ResponsiveContainer` for responsiveness
    - Summary stats below charts: total tokens in current view, average per day, peak day
  - Create `src/components/TokenChart.tsx` — thin wrapper around Recharts chart types to reduce duplication
- **Dependency**: Task 5, Task 6
- **Definition of Done**:
  - Switching breakdown type updates the chart data
  - Time granularity switcher works for time-based view
  - Charts are readable at 1280px and 1920px widths
  - Tooltip shows exact token counts
- **Complexity**: high

### Task 13: Implement Providers page
- **Description**: Read providers from JSON and display connected API providers with masked API keys.
- **Files affected**:
  - Create `src/pages/Providers.tsx`:
    - Uses `loadProviders()`
    - Renders a list/card for each provider entry
    - Masks API keys: show first 3 chars + `...` + last 4 chars (e.g., `sk-...xxxx`)
    - Shows connection state if determinable from the JSON structure
    - Handles missing data with a friendly message
- **Dependency**: Task 5, Task 6
- **Definition of Done**:
  - Provider list renders with masked keys
  - Missing data shows "No providers found" instead of crashing
- **Complexity**: low

### Task 14: Implement Models page
- **Description**: Read models from JSON and display available models with capabilities, pricing, and context window.
- **Files affected**:
  - Create `src/pages/Models.tsx`:
    - Uses `loadModels()`
    - Renders a table or card grid: Model ID, Provider, Capabilities (comma list), Input Price, Output Price, Context Window
    - Sortable by model ID or provider
    - Handles missing data
- **Dependency**: Task 5, Task 6
- **Definition of Done**:
  - All models are displayed
  - Pricing shown in standard per-million-token units (or as-is from JSON, with `$` prefix)
- **Complexity**: low

### Task 15: Implement Agents page
- **Description**: Read agents from JSON and display agent names and descriptions.
- **Files affected**:
  - Create `src/utils/markdownParser.ts`:
    - `extractAgentInfo(content: string): { name: string; description: string }`
    - Name: first H1 match (`/^#\s+(.+)$/m`)
    - Description: first non-empty line that is not a heading and not inside a code block
  - Create `src/pages/Agents.tsx`:
    - Uses `loadAgents()`
    - Maps over results, parses each with `extractAgentInfo`
    - Renders a list: agent name (bold) + description
    - Handles missing data
- **Dependency**: Task 5, Task 6
- **Definition of Done**:
  - Each agent shows a name and a one-line description
  - Missing data shows "No agents found"
- **Complexity**: low

### Task 16: Implement Skills page
- **Description**: Read skills from JSON and display installed skills.
- **Files affected**:
  - Create `src/pages/Skills.tsx`:
    - Uses `loadSkills()`
    - Renders a table: Skill Name, Version, Source/Origin
    - Handles missing or malformed JSON
- **Dependency**: Task 5, Task 6
- **Definition of Done**:
  - Skills list renders correctly
  - Missing data shows friendly error
- **Complexity**: low

### Task 17: Implement Logs/Activity page
- **Description**: Read logs from JSON, parse entries, and display with filtering.
- **Files affected**:
  - Create `src/utils/logParser.ts`:
    - `parseLogFile(content: string): LogEntry[]`
    - Supports common log formats: ISO timestamp + level + message
    - Falls back to treating each line as a plain message if parsing fails
  - Create `src/pages/Logs.tsx`:
    - Uses `loadLogs()`
    - State: `levelFilter` (`'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'`), `dateFrom`, `dateTo`, `search`
    - Parses all log entries, combines into a single array, sorts by timestamp descending
    - Filters by level, date range, and text search
    - Renders a table: Timestamp, Level (color-coded badge), Message
    - Shows filename source for each entry
- **Dependency**: Task 5, Task 6
- **Definition of Done**:
  - Log entries are parsed and sorted by time
  - Level filter works correctly
  - Date range filter works
  - Search filters message text
  - Color coding: INFO = blue, WARN = yellow, ERROR = red, DEBUG = gray
- **Complexity**: medium

### Task 18: Implement error handling and resilience
- **Description**: Add error boundaries, graceful fallbacks for missing files, and user-friendly error messages.
- **Files affected**:
  - Create `src/components/ErrorBoundary.tsx` — class component implementing `componentDidCatch`, renders fallback UI with error message and "Reload" button
  - Create `src/components/ErrorMessage.tsx` — inline banner for non-fatal errors (e.g., "Failed to load models data")
  - Modify `src/App.tsx` — wrap `<Routes>` in `<ErrorBoundary>`
  - Modify each page component — wrap data loading in `try/catch`, render `<ErrorMessage>` on failure
  - Modify `src/stores/appStore.ts` — add `error` and `clearError` actions
- **Dependency**: Task 5
- **Definition of Done**:
  - A JavaScript error in any page does not crash the entire app
  - Missing data on any page shows a banner, not a white screen
  - JSON loading errors are caught and displayed
- **Complexity**: medium

### Task 19: Final styling, responsiveness, and dark theme polish
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

### Task 20: Self-review and build verification
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
  App.tsx                      (replace starter content with router + layout + data loading)
  index.css                    (replace starter styles with dashboard base styles)
  App.css                      (delete or repurpose)
  types/
    index.ts                   (all shared TypeScript interfaces)
  stores/
    appStore.ts                (Zustand store)
  utils/
    dataLoader.ts              (load JSON data files)
    costCalculator.ts          (cost math + formatting)
    markdownParser.ts          (agent description extraction)
    logParser.ts               (log entry parsing)
    sync.ts                    (sync button handler)
  components/
    Layout.tsx                 (sidebar + main area shell)
    Sidebar.tsx                (navigation links)
    TopBar.tsx                 (title, sync button, refresh button)
    LoadingOverlay.tsx         (spinner + message)
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
  sync-opencode-data.js        (Node.js script to export opencode data to JSON)
public/
  data/                        (exported JSON files — created by sync script)
    sessions.json
    projects.json
    messages.json
    parts.json
    providers.json
    models.json
    agents.json
    skills.json
    logs.json
    overview.json
    token-usage.json
```

## Dependencies to Install

| Package | Version | Justification |
|---------|---------|---------------|
| `react-router-dom` | ^7.x | Client-side routing for 9 distinct views; standard React solution with excellent TypeScript support |
| `zustand` | ^5.x | Lightweight state management (~1kB). No providers needed. |
| `recharts` | ^2.x | React-native charting library. Tree-shakeable. Covers bar, line, area, and pie charts needed for token analytics |
| `better-sqlite3` | ^11.x | Native SQLite library for Node.js. Used by the sync script to read `opencode.db` efficiently. Faster than `sqlite3` for read-heavy operations. |

**Removed dependencies** (from previous plan):
- `sql.js` — no longer needed (SQLite is read by Node.js script, not browser)
- `date-fns` — no longer needed (dates can be handled with native `Date`)

## Error Handling Strategy

1. **Missing Data Files**: Every `loadXxx()` function returns empty array/object on error. Pages check for empty data and render `<ErrorMessage>` with a contextual message (e.g., "Could not load sessions data. Run `npm run sync` to export data.")
2. **Sync Failure**: If `/api/sync` fails, the dashboard shows an error message and suggests running the script manually.
3. **Runtime Errors**: A single `<ErrorBoundary>` around `<Routes>` prevents any page crash from tearing down the whole app.
4. **Auto-Detect Failure**: If the sync script cannot auto-detect opencode folders, it prints instructions to the console explaining how to set `OPENCODE_DATA_PATH` or pass paths as arguments.

## Performance Considerations

1. **JSON Loading**: Data is loaded once on app mount and cached in component state. No repeated fetches unless user clicks "Sync".
2. **Query Pagination**: `SessionsList` uses client-side pagination. Default 50 rows per page.
3. **Memoization**: Pages that run heavy aggregations store results in local `useState` and only re-fetch on explicit sync. `React.memo` is applied to `DataTable` rows and chart components.
4. **No Polling**: Data does not auto-refresh. The "Sync" button prevents unnecessary re-exports.
5. **Chart Responsiveness**: All Recharts are wrapped in `<ResponsiveContainer>` with a fixed parent height (e.g., `h-80` or `300px`) to avoid layout thrashing.

## Risks & Alternatives

- **Risk**: `better-sqlite3` requires native compilation (node-gyp) which may fail on some machines | **Mitigation**: Document that Python and a C++ compiler are required. Provide pre-built binaries if possible. Alternative: use `sqlite3` package which has prebuilt binaries.
- **Risk**: Exported JSON files may be large (sessions + messages + parts could be 10-50MB) | **Mitigation**: Export aggregated data (overview, token-usage) separately so the dashboard doesn't need to load raw messages/parts unless on Session Detail page.
- **Risk**: Vite dev server middleware only works in dev mode, not in production build | **Mitigation**: Document that `npm run sync` must be run before `npm run build` for production. The dashboard reads static JSON files in production.
- **Risk**: `recharts` bundle size is non-trivial (~400kB gzipped) | **Mitigation**: Import only the specific chart components needed. Tree-shaking should eliminate unused code.

## Dependency Order

```
Task 1  →  Task 2  →  Task 3
                 ↓
Task 4  →  Task 5  →  Task 6  →  Task 7  →  Task 8  →  Task 9
                                                               ↓
                                                     (parallel after Task 9)
                                                     Task 10  →  Task 11
                                                     Task 12
                                                     Task 13
                                                     Task 14
                                                     Task 15
                                                     Task 16
                                                     Task 17
                                                               ↓
                                                     Task 18  →  Task 19  →  Task 20
```

**Critical path**: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 (Overview is the landing page and validates the full data pipeline).

**Parallelizable after Task 9**: Tasks 10-17 can be implemented in any order once the data loader and cost calculator exist.

---

**Version**: 2 | **Author**: planner | **Ref**: requirements v2 | **Date**: 2026-05-23

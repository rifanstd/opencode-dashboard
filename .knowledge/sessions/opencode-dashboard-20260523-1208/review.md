# Code Review: Opencode Dashboard

## Reference
- Plan: `.knowledge/sessions/opencode-dashboard-20260523-1208/plan.md` v1
- Requirements: `.knowledge/sessions/opencode-dashboard-20260523-1208/requirements.md` v1

## Verdict: FAIL

## Summary
The implementation is comprehensive and closely follows the approved plan, covering all 14 functional requirements and the dark theme design. However, static analysis identified a TypeScript build blocker (`noUnusedLocals` violation) and a functional bug where `models.json` is read from the wrong directory handle, breaking cost estimation (FR-10). Additionally, there are performance issues (double database initialization after refresh, sequential async fetching, missing Zustand selectors) and minor plan deviations (sidebar collapse, chart CSS variables). Build and lint verification could not be executed due to environment restrictions, but the identified `tsc` error is definitive.

## Issues

### Warning
- [W-01] `src/hooks/useSqlWorker.ts:65` — `workerRef` is declared but never read, and the `useRef` import is only used to create the unused variable. With `noUnusedLocals: true`, this causes `tsc -b` to fail. | Fix: Remove `workerRef`, the `useRef` import, and the `useEffect` that assigns to it. The global worker singleton already handles lifecycle.
- [W-02] `src/pages/Overview.tsx:27`, `src/pages/SessionsList.tsx:51`, `src/pages/SessionDetail.tsx:49` — `models.json` is read via `readTextFile(localHandle, 'models.json')`, but per the requirements the file lives in `~/.cache/opencode/` (the `cache` directory handle). Cost estimation therefore cannot find pricing data and will always display `$0.0000` or `—`. | Fix: Read `models.json` from `directoryHandles.cache` in all three files.
- [W-03] `src/App.tsx:73-92` + `src/utils/refresh.ts:6-30` — `refreshData` sets `isLoading` to `false` in its `finally` block. `App.tsx`'s initialization `useEffect` lists `isLoading` in its dependency array, so when `refreshData` finishes, the effect re-runs and initializes the database a second time. | Fix: Remove `isLoading` from the effect dependency array and instead gate on `!isDbReady` (or introduce an explicit `refreshInProgress` flag).
- [W-04] `src/utils/dbInit.ts:45` + `src/hooks/useSqlWorker.ts:42` — `dbInit.ts` slices the `Uint8Array` buffer (creating a copy), then `sendMessage` posts it to the worker without a transfer list (creating another copy). At least two copies of the ~196 MB database remain in main-thread memory, violating the plan's performance strategy. | Fix: Transfer the buffer via `worker.postMessage(request, [request.buffer])` and avoid unnecessary slicing.
- [W-05] `src/pages/SessionDetail.tsx:72-76` — Message parts are fetched sequentially inside a `for...of` loop. For sessions with many messages this adds significant latency. | Fix: Use `Promise.all(msgs.map(async (msg) => { ... }))` to fetch parts in parallel.
- [W-06] `src/pages/Overview.tsx:12`, `src/pages/SessionsList.tsx:14`, `src/pages/SessionDetail.tsx:14`, `src/pages/Providers.tsx:20`, `src/pages/Models.tsx:17`, `src/pages/Agents.tsx:14`, `src/pages/Skills.tsx:13`, `src/pages/Logs.tsx:16`, `src/components/TopBar.tsx:9`, `src/App.tsx:27-36` — Most components call `useAppStore()` without a selector, subscribing to the entire Zustand state. Any store update (e.g., `loadingProgress` ticks) triggers re-renders in all pages. | Fix: Use granular selectors, e.g., `const directoryHandles = useAppStore((s) => s.directoryHandles)`.

### Suggestion
- [S-01] `src/pages/Overview.tsx:32-53` — The Overview page loads every session row into main-thread memory (`SELECT model_id, input_tokens, ... FROM session`) to calculate total cost client-side. For large databases this is inefficient. | Fix: Move cost aggregation into a SQL query or compute it inside the Web Worker.
- [S-02] `src/components/TokenChart.tsx:22-27` — Chart colors are hardcoded hex strings (`#6366f1`, etc.) instead of referencing the CSS custom properties (`--chart-1` through `--chart-7`) defined in `index.css`. | Fix: Read chart colors from CSS variables or at least define them in one place.
- [S-03] `src/index.css:153` + `src/components/Sidebar.tsx` — The plan (Task 22) specifies sidebar collapse below 1400px. The current media query only reduces `font-size`; the sidebar remains fixed at 200px. | Fix: Add a collapsible sidebar toggle or hamburger button for narrow desktop widths.
- [S-04] `src/utils/queries.ts:91` — The `ORDER BY` clause in `getSessions` is built via string interpolation (`ORDER BY ${orderBy} ${order}`). While `sortBy` is currently controlled, this pattern is brittle. | Fix: Maintain a whitelist of allowed sort columns and map them safely.

## Plan Adherence
- [x] Task 1: Dependencies installed, `copy-wasm.mjs` works, `index.html` title updated.
- [x] Task 2: Global types created, no `enum`/`namespace`, `import type` used correctly.
- [x] Task 3: IndexedDB persistence implemented.
- [x] Task 4: Browser support check and `BrowserWarning` overlay implemented.
- [x] Task 5: Zustand store, `Layout`, `Sidebar`, `TopBar`, and CSS variables implemented.
- [x] Task 6: `DirectoryPicker` with 3-step flow and validation implemented.
- [x] Task 7: `fileSystem.ts` utilities implemented.
- [x] Task 8: Web Worker, `useSqlWorker`, and streaming DB init implemented (deviation: buffer not transferred).
- [x] Task 9: SQL query helpers implemented.
- [x] Task 10: `costCalculator.ts` implemented.
- [x] Task 11: `LoadingOverlay` implemented.
- [x] Task 12: `Overview` page implemented (deviation: reads `models.json` from wrong handle).
- [x] Task 13: `SessionsList` and `SessionDetail` implemented (deviation: sequential parts fetching).
- [x] Task 14: `TokenUsage` page with charts implemented.
- [x] Task 15: `Providers` page implemented.
- [x] Task 16: `Models` page implemented.
- [x] Task 17: `Agents` page and `markdownParser` implemented.
- [x] Task 18: `Skills` page implemented.
- [x] Task 19: `Logs` page and `logParser` implemented.
- [x] Task 20: `ErrorBoundary` and `ErrorMessage` implemented, pages wrapped in try/catch.
- [x] Task 21: Manual refresh implemented (deviation: double-init bug).
- [ ] Task 22: Sidebar collapse and chart color polish missing.
- [ ] Task 23: Build verification not completed; static analysis found a `tsc` error.

## Requirements Coverage
- [x] FR-01 Overview Dashboard: Implemented with summary cards.
- [x] FR-02 Token Usage Analytics: Implemented with bar/area charts and granularity switcher.
- [x] FR-03 Sessions List: Implemented with search, filters, sorting, and pagination.
- [x] FR-04 Session Detail: Implemented with messages, parts, tool calls, and token breakdown.
- [x] FR-05 Providers: Implemented with masked API keys and status badges.
- [x] FR-06 Models: Implemented with capabilities, pricing, and context window.
- [x] FR-07 Agents: Implemented with name and description extraction.
- [x] FR-08 Skills: Implemented with version and source.
- [x] FR-09 Logs/Activity: Implemented with level/date/search filtering and color-coded badges.
- [ ] FR-10 Cost Estimation: Logic exists but `models.json` is read from the `local` handle instead of `cache`, so pricing data is never found and costs are incorrect.
- [x] FR-11 Folder Selection UX: Implemented with sequential picker and IndexedDB persistence.
- [x] FR-12 Data Loading & Progress: Implemented with streaming read and progress overlay.
- [x] FR-13 Unsupported Browser Handling: Implemented with full-page overlay.
- [x] FR-14 Dark Theme Design: Implemented consistently across components.
- [x] NFR-01 Privacy: All data remains client-side.
- [x] NFR-02 Performance: Partial — streaming and worker isolation are present, but buffer duplication and missing selectors degrade performance.
- [x] NFR-03 Browser Support: Chrome/Edge targeted correctly.
- [x] NFR-04 Responsiveness: Usable at 1280px–1920px, though sidebar doesn't collapse.
- [x] NFR-05 Error Resilience: Missing files handled gracefully with `ErrorMessage`.
- [ ] NFR-06 Maintainability: TypeScript strictness is mostly followed, but the unused local (`workerRef`) will fail the build.
- [x] NFR-07 Visual Design Consistency: CSS custom properties used; chart colors are hardcoded.

## Build/Lint Status
- **Build**: Could not be verified via `npm run build` due to environment tool restrictions. Static analysis indicates `tsc -b` will fail because of the unused local `workerRef` in `src/hooks/useSqlWorker.ts` (`noUnusedLocals: true`).
- **Lint**: Could not be verified via `npm run lint` due to environment tool restrictions.

## Recommendations
1. **Fix the build blocker first** — remove the unused `workerRef` in `useSqlWorker.ts`.
2. **Fix the cost calculation bug** — change `directoryHandles.local` to `directoryHandles.cache` when reading `models.json` in `Overview.tsx`, `SessionsList.tsx`, and `SessionDetail.tsx`.
3. **Fix the double-initialization on refresh** — decouple `App.tsx`'s init effect from the global `isLoading` flag.
4. **Transfer the database buffer** to the worker to avoid memory duplication.
5. **Parallelize part fetching** in `SessionDetail.tsx`.
6. **Add Zustand selectors** across all components to prevent unnecessary re-renders.
7. **Address Task 22 gaps** — make the sidebar collapsible and use CSS variables for chart colors.

---
Author: reviewer | Date: 2026-05-23 | Iteration: 1

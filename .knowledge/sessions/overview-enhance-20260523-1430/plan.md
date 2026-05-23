# Implementation Plan: Overview Page Enhancement

## Reference
- Requirements: `.knowledge/sessions/overview-enhance-20260523-1430/requirements.md` v2
- Project Context: `AGENTS.md` (project conventions documented in agent instructions)

## Architecture

The enhanced Overview page will be restructured from a simple 8-card grid into a **4-section composite dashboard**:

1. **Key Metrics** — Responsive grid of 8 summary cards with period-over-period sub-labels
2. **Trends** — 2-column grid (stackable on mobile) containing Daily Activity (stacked area) and Cost Trend (area)
3. **Breakdowns** — 2–3 column grid containing Token Composition (donut), Top Models (horizontal bar), and Project Activity (vertical bar)
4. **Recent Activity** — Full-width Activity Heatmap (day × hour) and Recent Sessions list

**Data Flow:**
```
Raw JSON (dataLoader.ts)
  → Parallel fetch in Overview.tsx (Promise.all)
  → Pure computation in overviewDataProcessor.ts
  → useMemo-cached derived data
  → Section components receive pre-computed props
```

All computation happens client-side in the browser. No sync script changes. No new backend endpoints.

## Decision Points

- [x] **Heatmap implementation**: Custom CSS grid (not Recharts) for precise day×hour matrix control and smaller bundle footprint.
- [x] **Chart component strategy**: Create dedicated chart components per section rather than extending the generic `TokenChart`. `TokenChart` is too rigid (hardcodes 4 series) for donut, single-series cost, and horizontal bars.
- [x] **Data computation location**: Pure utility module (`overviewDataProcessor.ts`) rather than a custom hook. Keeps components declarative and makes computation logic testable in isolation.
- [x] **Period comparison windows**: 7-day cards compare vs previous 7 days; 30-day cards compare vs previous 30 days. Absolute difference for counts, percentage for tokens/cost.

## Task Breakdown

### Task 1: Extend TypeScript types
- **Description:** Add shared types for time ranges, computed metrics, chart data shapes, and heatmap cells to `src/types/index.ts`.
- **Files affected:** `src/types/index.ts`
- **Dependency:** None (first task)
- **Definition of Done:**
  - `TimeRange` union type: `'7d' | '30d' | '90d' | 'all'`
  - `MetricCardData` interface: `{ label, value, subLabel?, trend?: 'up' | 'down' | 'neutral' }`
  - `DonutSegment` interface: `{ name, value, color }`
  - `DailyCostPoint` interface: `{ date: string; cost: number }`
  - `ModelBreakdownItem` interface: `{ label, input, output, reasoning, cache, totalTokens, totalCost }`
  - `ProjectBreakdownItem` interface: `{ label, input, output, reasoning, cache, totalTokens }`
  - `RecentSessionRow` interface: `{ id, title, model_id, total_tokens, computedCost, created_at }`
  - `HeatmapData` type: `number[][]` (7 rows × 24 columns)
  - Build passes `tsc -b` with zero errors.
- **Complexity:** low

### Task 2: Create overview data computation utility
- **Description:** Implement `src/utils/overviewDataProcessor.ts` with pure functions that transform raw loaded data into component-ready shapes. This is the computational core of the enhancement.
- **Files affected:** `src/utils/overviewDataProcessor.ts` (new)
- **Dependency:** Task 1
- **Definition of Done:**
  - `filterByTimeRange<T extends { date: string }>(data: T[], range: TimeRange): T[]` — filters array by date window
  - `computeKeyMetrics(sessions, messages, parts, models, overview, tokenUsage, pricingMap)` → returns `MetricCardData[]` for all 8 cards including period-over-period sub-labels
  - `computeTokenComposition(tokenUsage)` → `DonutSegment[]` with percentages
  - `computeDailyActivity(tokenUsage, range)` → `TimeSeriesData[]` filtered by range
  - `computeDailyCost(sessions, pricingMap, range)` → `DailyCostPoint[]` grouped by date string `YYYY-MM-DD`
  - `computeTopModels(tokenUsage, pricingMap, sortBy: 'tokens' | 'cost')` → top 5 `ModelBreakdownItem[]`
  - `computeTopProjects(tokenUsage)` → top 5 `ProjectBreakdownItem[]` excluding zero-session projects
  - `computeRecentSessions(sessions, pricingMap, limit = 10)` → `RecentSessionRow[]` sorted by `created_at` desc
  - `computeActivityHeatmap(messages)` → `HeatmapData` (7×24 grid of message counts)
  - `computeToolCallMetrics(parts)` → `{ total: number; last7Days: number }`
  - All functions are pure (no side effects), fully typed, and handle empty inputs gracefully.
- **Complexity:** high

### Task 3: Create TimeRangeSelector component
- **Description:** Reusable segmented control for selecting 7d / 30d / 90d / all time.
- **Files affected:** `src/components/TimeRangeSelector.tsx` (new)
- **Dependency:** Task 1
- **Definition of Done:**
  - Props: `{ value: TimeRange; onChange: (range: TimeRange) => void }`
  - Renders as a horizontal button group with active state styling using CSS variables (`--accent`, `--bg-secondary`, `--border`)
  - Accessible: buttons have `aria-pressed` for active state
  - No external dependencies beyond React
- **Complexity:** low

### Task 4: Create TokenCompositionChart component
- **Description:** Donut chart showing proportional breakdown of input, output, reasoning, cache tokens.
- **Files affected:** `src/components/TokenCompositionChart.tsx` (new)
- **Dependency:** Task 1, Task 2
- **Definition of Done:**
  - Props: `{ data: DonutSegment[] }`
  - Uses Recharts `PieChart`, `Pie`, `Cell`, `Tooltip`, `ResponsiveContainer`
  - `innerRadius` and `outerRadius` create donut appearance
  - Tooltip shows segment name, raw token count, and percentage
  - Chart height: 320px
  - Includes `aria-label` describing the chart
- **Complexity:** medium

### Task 5: Create DailyActivityChart component
- **Description:** Stacked area chart for daily token usage with time range filtering.
- **Files affected:** `src/components/DailyActivityChart.tsx` (new)
- **Dependency:** Task 1, Task 2
- **Definition of Done:**
  - Props: `{ data: TimeSeriesData[]; range: TimeRange; onRangeChange: (range: TimeRange) => void }`
  - Embeds `TimeRangeSelector`
  - Uses Recharts `AreaChart` with 4 stacked areas (input, output, reasoning, cache) using CSS variable colors
  - X-axis shows dates formatted as `MMM dd` (or `MMM yyyy` for 90d/all)
  - Tooltip shows precise token counts per type and total
  - Chart height: 320px
  - Responsive container with no horizontal scroll
- **Complexity:** medium

### Task 6: Create CostTrendChart component
- **Description:** Area chart showing estimated daily cost over time.
- **Files affected:** `src/components/CostTrendChart.tsx` (new)
- **Dependency:** Task 1, Task 2
- **Definition of Done:**
  - Props: `{ data: DailyCostPoint[]; range: TimeRange; onRangeChange: (range: TimeRange) => void }`
  - Embeds `TimeRangeSelector`
  - Uses Recharts `AreaChart` with single area series in `var(--chart-5)` or `var(--accent)`
  - Y-axis tick formatter shows cost in `$0.00` format
  - Tooltip shows formatted cost per day
  - Chart height: 320px
- **Complexity:** medium

### Task 7: Create TopModelsChart component
- **Description:** Horizontal bar chart for top 5 models with cost/token toggle.
- **Files affected:** `src/components/TopModelsChart.tsx` (new)
- **Dependency:** Task 1, Task 2
- **Definition of Done:**
  - Props: `{ data: ModelBreakdownItem[]; sortBy: 'tokens' | 'cost'; onSortChange: (sortBy: 'tokens' | 'cost') => void }`
  - Toggle buttons for "By Tokens" / "By Cost"
  - Uses Recharts `BarChart` with `layout="vertical"`
  - Bars are segmented by token type (input, output, reasoning, cache) using stacked bars
  - Chart height: 320px
  - Tooltip shows model name, segment breakdown, and total
- **Complexity:** medium

### Task 8: Create ProjectActivityChart component
- **Description:** Vertical bar chart for top 5 projects by total token count.
- **Files affected:** `src/components/ProjectActivityChart.tsx` (new)
- **Dependency:** Task 1, Task 2
- **Definition of Done:**
  - Props: `{ data: ProjectBreakdownItem[] }`
  - Uses Recharts `BarChart` (vertical layout) with stacked bars by token type
  - Chart height: 320px
  - Projects with zero total tokens are excluded
  - Tooltip shows project name and token breakdown
- **Complexity:** medium

### Task 9: Create ActivityHeatmap component
- **Description:** Day-of-week × hour-of-day heatmap using message timestamps.
- **Files affected:** `src/components/ActivityHeatmap.tsx` (new)
- **Dependency:** Task 1, Task 2
- **Definition of Done:**
  - Props: `{ data: HeatmapData }`
  - Renders as a CSS grid: 7 rows (Mon–Sun) × 24 columns (00–23)
  - Row labels on the left show abbreviated day names
  - Column labels show every 4th hour (00, 04, 08, 12, 16, 20)
  - Cell color intensity scales with message count using opacity of `var(--accent)` or `var(--chart-1)`
  - Tooltip on hover (using `title` attribute or simple hover overlay) showing exact count
  - Container is horizontally scrollable on mobile if needed
  - Includes `aria-label` describing the heatmap
- **Complexity:** medium

### Task 10: Create RecentSessionsList component
- **Description:** Clickable list of 10 most recent sessions.
- **Files affected:** `src/components/RecentSessionsList.tsx` (new)
- **Dependency:** Task 1, Task 2
- **Definition of Done:**
  - Props: `{ sessions: RecentSessionRow[] }`
  - Renders as a table with columns: Title, Model, Total Tokens, Estimated Cost, Created Date
  - Each row is clickable and navigates to `/sessions/:id` using `useNavigate` from react-router-dom
  - Rows have visible hover state (`cursor: pointer`, background change)
  - Empty state shows "No recent sessions" message
  - Accessible: table uses semantic `<table>`, `<thead>`, `<tbody>`
- **Complexity:** low

### Task 11: Rewrite Overview page
- **Description:** Complete rewrite of `src/pages/Overview.tsx` to integrate all sections, data loading, computation, loading states, error handling, and responsive layout.
- **Files affected:** `src/pages/Overview.tsx`
- **Dependency:** Tasks 1–10
- **Definition of Done:**
  - Fetches in parallel: `loadOverviewStats`, `loadTokenUsage`, `loadSessions`, `loadMessages`, `loadParts`, `loadModels`
  - Creates pricing map via `loadPricing(models)`
  - Uses `useMemo` to cache all computed data with correct dependency arrays
  - Displays loading indicator while any data is loading
  - Displays `ErrorMessage` if any required fetch fails; does not render partial broken state
  - Layout structure follows FR-10:
    - Section 1: Key Metrics (responsive grid, 4 columns on desktop, 2 on tablet, 1 on mobile)
    - Section 2: Trends (2-column grid: DailyActivity + CostTrend)
    - Section 3: Breakdowns (2–3 column grid: TokenComposition + TopModels + ProjectActivity)
    - Section 4: Recent Activity (full-width: ActivityHeatmap + RecentSessionsList)
  - Each section has an `<h2>` heading per accessibility requirements
  - Responsive: sections collapse to single column below 768px using CSS grid `gridTemplateColumns`
  - All chart containers have uniform height (320px) and consistent border/background styling
  - No TypeScript errors; `tsc -b` passes
- **Complexity:** high

### Task 12: Build verification and responsive testing
- **Description:** Run full build, verify all 16 functional requirements manually, and test responsive behavior.
- **Files affected:** None (verification only)
- **Dependency:** Task 11
- **Definition of Done:**
  - `npm run build` completes with zero errors
  - `npm run lint` passes with zero errors
  - Manual checklist verified:
    - [ ] FR-01: 8 summary cards visible with correct values and sub-labels
    - [ ] FR-02: Donut chart shows 4 token segments with percentages
    - [ ] FR-03: Daily activity area chart with 7d/30d/90d/all selector; default 30d
    - [ ] FR-04: Cost trend chart with time range selector; default 30d
    - [ ] FR-05: Top 5 models horizontal bar chart with cost/token toggle
    - [ ] FR-06: Top 5 projects vertical bar chart
    - [ ] FR-07: 10 recent sessions listed, clickable, navigate to detail
    - [ ] FR-08: Activity summary stats (sessions 7d/30d, avg tokens/session) visible
    - [ ] FR-09: No sync script changes; all data from existing loaders
    - [ ] FR-10: 4 clearly separated sections with responsive grid
    - [ ] FR-11: Consistent chart heights (320px), CSS variable colors, matching tooltips
    - [ ] FR-12: Loading state shown during fetch; error state shown on failure
    - [ ] FR-13: Layout collapses to single column below 768px; no horizontal scroll
    - [ ] FR-14: Tool call frequency card visible with total and last-7-days sub-label
    - [ ] FR-15: Activity heatmap renders 7×24 grid with color intensity
    - [ ] FR-16: Period-over-period comparisons visible on applicable cards
  - Responsive tested at: 320px, 768px, 1440px
- **Complexity:** low

## Dependency Order

```
Task 1 (types)
  → Task 2 (data processor)
    → Tasks 3–10 (components) [parallel]
      → Task 11 (Overview page integration)
        → Task 12 (verification)
```

## Risks & Alternatives

| Risk | Mitigation | Alternative |
|------|-----------|-------------|
| **Performance degradation** with 10K+ sessions: computing daily cost by iterating all sessions and calculating cost per session could exceed NFR-01 (2s render budget). | Pre-aggregate daily cost using `tokenUsage.byDay` combined with average model pricing where model breakdown is unavailable; use `useMemo` with stable deps; profile with Chrome DevTools. | If profiling shows >500ms computation, move heavy work into a Web Worker (though this adds complexity). |
| **Recharts PieChart import increases bundle** beyond NFR-05 (15KB gzipped). | Recharts v3 is tree-shakeable; only imported components are bundled. PieChart + Cell + Tooltip should add <8KB gzipped. | If bundle exceeds limit, replace donut chart with a custom SVG component. |
| **TypeScript strict errors** (`noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`) blocking build. | Use `import type` for all type-only imports; avoid destructuring unused values; use `_` prefix for intentionally unused params. | None — must comply with project config. |
| **Date timezone inconsistencies** when filtering by time range. | Always parse dates as UTC (from SQLite ISO strings) and compare using `YYYY-MM-DD` date strings to avoid local timezone drift. | If UTC comparison causes off-by-one errors, use start-of-day in local timezone. |
| **Heatmap unreadable on mobile** (24 columns too wide). | Make heatmap container `overflow-x: auto` on mobile; reduce cell size to `min-width: 12px`; show every 4th hour label. | If still unreadable, render heatmap as 7 vertical bars (one per day) with hour distribution on mobile. |
| **Period-over-period logic confusion** (inclusive vs exclusive date boundaries). | Define clear rules: "last 7 days" = today minus 6 days through today (inclusive); "previous 7 days" = 7 days before that window. Document in code comments. | Use date-fns library — **not allowed** by constraints (no new dependencies). |

## Verification Steps per Feature

- **Metrics (FR-01, FR-08, FR-14, FR-16):** Verify each card value matches computed expectation. Cross-check total tokens = input + output + reasoning + cache. Verify sub-labels show correct differences.
- **Token Composition (FR-02):** Hover each segment; tooltip should sum to 100% (±0.1% rounding).
- **Daily Activity (FR-03):** Switch time ranges; verify X-axis label density changes and data points match expected window.
- **Cost Trend (FR-04):** Compare daily cost sum against total estimated cost card (should be close, depending on range).
- **Top Models (FR-05):** Toggle sort; verify bar order changes. Check that bar segments sum to total.
- **Project Activity (FR-06):** Verify only top 5 shown. Check projects with zero sessions are absent.
- **Recent Sessions (FR-07):** Click each row; confirm navigation to `/sessions/:id`. Verify sort is newest first.
- **Heatmap (FR-15):** Cross-check a specific cell by manually counting messages in that day/hour window from raw data.
- **Responsive (FR-13):** Resize browser to 375px width; confirm all charts remain readable and no horizontal page scroll.

---

Version: 1 | Author: planner | Ref: requirements v2 | Date: 2026-05-23

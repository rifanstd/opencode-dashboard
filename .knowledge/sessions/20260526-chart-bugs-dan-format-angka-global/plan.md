# Implementation Plan: Chart Bugs, Project Column, Global Number Formatting

> **For the Orchestrator:** The Orchestrator delegates this plan to the Programmer for execution. After implementation, the Orchestrator delegates to the Reviewer for code review. Do NOT dispatch subagents directly — the Orchestrator manages the multi-agent pipeline.

**Goal:** Fix chart axis visibility bugs and hover artifacts, display human-readable project names in SessionList/SessionDetail, and globally standardize number/currency formatting to K/M/B with max 2 decimal places and trailing-zero stripping.

**Architecture:** Foundational utility functions (`formatNumber`, `formatCost`) are updated first in `costCalculator.ts` — all UI components depend on these. Remaining changes fan out to component/pages: toLocaleString replacements, chart axis restoration, project name lookups, and tooltip styling fix. All changes stay within `src/`; no JSON files or sync script modified.

**Tech Stack:** React 18 + TypeScript 5 + Recharts + Vite. No new npm dependencies.

**Reference:** Requirements: .knowledge/sessions/20260526-chart-bugs-dan-format-angka-global/requirements.md v2

---

## Decision Points

- [x] **DP-01: formatNumber decimal places** — USE option B: 2dp with trailing-zero strip (`.toFixed(2)` + regex strip). Resolved per C-01.
- [x] **DP-02: formatCost for sub-$1000 values** — USE option B: `$X.XX`, strip `.00` → `$12`, `$0.50`. Resolved per C-02.
- [x] **DP-03: formatCost K/M/B decimal places** — USE option B: 2dp, strip trailing zero. `$1.5K` not `$1.50K`. Resolved per C-03.
- [x] **DP-04: Resources page pricing** — NO CHANGE. Keep `$0.00000250/Mt` format. Resolved per R-01.
- [x] **DP-05: Chart axis style** — USE `var(--text-secondary)`, fontSize 11, rotate -45° on X-axis for ModelUsageChart labels > 15 chars. Resolved per A-01.
- [x] **DP-06: SessionDetail project field** — YES, change to project name. Resolved per S-01.
- [x] **DP-07: TokenCompositionChart** — NO CHANGE needed; verified safe. Resolved per T-01.

---

## File Structure

| File | Role |
|------|------|
| `src/utils/costCalculator.ts` | Core formatting functions: `formatNumber()`, `formatCost()`, `formatDateTick()` |
| `src/components/TopBar.tsx` | Nav bar stats strip — sessions count + token/cost summary |
| `src/pages/Overview.tsx` | Overview dashboard — summary strip + chart containers |
| `src/components/TokenUsageChart.tsx` | 5-line token usage chart (Recharts `LineChart`) |
| `src/components/CostChart.tsx` | Cost line chart with area fill (Recharts `LineChart`) |
| `src/components/ModelUsageChart.tsx` | Top-model bar chart (Recharts `BarChart`) |
| `src/pages/SessionsList.tsx` | Paginated sessions table with search/filter/sort |
| `src/pages/SessionDetail.tsx` | Single session detail with token breakdown + messages |
| `src/utils/dataLoader.ts` | Already has `loadProjects()` — no changes needed |
| `src/types/index.ts` | Already has `Project` interface — no changes needed |

---

## Task Breakdown

### Task 1: Update `formatNumber()` — 2 decimal places with trailing-zero strip

- **Description:** Change the `formatNumber()` function in `costCalculator.ts` from `.toFixed(1)` to `.toFixed(2)` across all three threshold branches (K, M, B), then strip trailing zeros from the result. The logic: compute `value / divisor`, call `.toFixed(2)`, then use regex `\.?0+$` to remove trailing zeros including a trailing decimal point.
- **Files affected:** `src/utils/costCalculator.ts` (lines 34-50)
- **Dependency:** None (foundational — must complete first)
- **Definition of Done:**
  - `formatNumber(1500)` returns `"1.5K"` (was `"1.5K"` — same for simple values)
  - `formatNumber(1250)` returns `"1.25K"` (was `"1.2K"` before — now shows 2dp)
  - `formatNumber(1500000)` returns `"1.5M"`
  - `formatNumber(1250000)` returns `"1.25M"`
  - `formatNumber(1000000000)` returns `"1B"`
  - `formatNumber(1000)` returns `"1K"` (not `"1.00K"` — trailing zeros stripped)
  - `formatNumber(2000000)` returns `"2M"` (not `"2.00M"` — trailing zeros stripped)
  - `formatNumber(42)` returns `"42"` (unchanged — sub-1000 uses `Math.round().toLocaleString()`)
  - `formatNumber(NaN)` returns `"0"` (unchanged — non-finite guard)
  - TypeScript: `tsc -b` passes with no errors
- **Complexity:** low

<details>
<summary>Implementation detail</summary>

Current `formatNumber()` uses `.toFixed(1)` and `endsWith('.0')` in each branch. Replace with `.toFixed(2)` + regex strip:

```ts
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (value < 1000) return Math.round(value).toLocaleString()
  
  const strip = (n: string) => n.includes('.') ? n.replace(/\.?0+$/, '') : n
  
  if (value < 1000000) {
    return strip((value / 1000).toFixed(2)) + 'K'
  }
  if (value < 1000000000) {
    return strip((value / 1000000).toFixed(2)) + 'M'
  }
  return strip((value / 1000000000).toFixed(2)) + 'B'
}
```

The regex `\.?0+$`:
- `"1.50"` → `.50` matched → `"1.5"` ✓
- `"1.25"` → no match → `"1.25"` ✓
- `"2.00"` → `.00` matched → `"2"` ✓
- `"10.10"` → `0` at end matched → `"10.1"` ✓

</details>

---

### Task 2: Update `formatCost()` — add K/M/B logic + $ prefix + 2dp strip

- **Description:** Rewrite `formatCost()` to handle all value ranges with `$` prefix and K/M/B suffixes. For values >= 1000, delegate to the updated `formatNumber()` and prefix with `$`. For values < 1000, use `.toFixed(2)` + the same trailing-zero strip pattern, then prefix `$`. Handle zero and non-finite gracefully.
- **Files affected:** `src/utils/costCalculator.ts` (lines 22-25)
- **Dependency:** Task 1 (must complete first — `formatCost` for >= 1000 delegates to `formatNumber`)
- **Definition of Done:**
  - `formatCost(0)` returns `"$0"`
  - `formatCost(0.5)` returns `"$0.50"` (trailing `.50` kept — not `.00`)
  - `formatCost(12.00)` returns `"$12"` (trailing `.00` stripped)
  - `formatCost(12.34)` returns `"$12.34"`
  - `formatCost(1250)` returns `"$1.25K"` (delegates to `formatNumber` after this task)
  - `formatCost(1500)` returns `"$1.5K"`
  - `formatCost(2500000)` returns `"$2.5M"`
  - `formatCost(1000000000)` returns `"$1B"`
  - `formatCost(NaN)` returns `"$0"`
  - `formatCost(Infinity)` returns `"$0"`
  - Signature unchanged: `(value: number): string`
  - TypeScript: `tsc -b` passes
- **Complexity:** low

<details>
<summary>Implementation detail</summary>

```ts
export function formatCost(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0'
  
  if (value >= 1000) {
    return '$' + formatNumber(value)
  }
  
  // value < 1000: format with 2dp, strip trailing zeros
  const formatted = value.toFixed(2)
  const stripped = formatted.includes('.') ? formatted.replace(/\.?0+$/, '') : formatted
  return '$' + stripped
}
```

This keeps the function simple: for >= 1000, `formatNumber()` handles the K/M/B logic; for sub-1000, apply 2dp + strip. All existing callers (`SessionsList.tsx`, `SessionDetail.tsx`, `TopBar.tsx`, `CostChart.tsx`, `overviewDataProcessor.ts`) benefit automatically — no caller changes needed in this task.

</details>

---

### Task 3: Replace all `.toLocaleString()` numeric calls with `formatNumber()`

- **Description:** Replace every numeric `.toLocaleString()` call across 4 files with `formatNumber()`. Date `.toLocaleString()` / `.toLocaleDateString()` calls (e.g., `new Date(...).toLocaleString()`) are NOT changed — only numeric formatting. Import `formatNumber` where not already imported.
- **Files affected:**
  - `src/pages/Overview.tsx` lines 224, 230
  - `src/pages/SessionsList.tsx` line 217
  - `src/pages/SessionDetail.tsx` lines 340, 380
  - `src/components/TopBar.tsx` lines 49, 159, 178
- **Dependency:** Task 1 (formatNumber must have the new 2dp behavior)
- **Definition of Done:**
  - Overview.tsx line 224: `overview.totalSessions.toLocaleString()` → `formatNumber(overview.totalSessions)` (need to import `formatNumber`)
  - Overview.tsx line 230: `summaryTokens.toLocaleString()` → `formatNumber(summaryTokens)`
  - SessionsList.tsx line 217: `s.total_tokens.toLocaleString()` → `formatNumber(s.total_tokens)` (need to import `formatNumber`)
  - SessionDetail.tsx line 340: `bar.value.toLocaleString()` → `formatNumber(bar.value)` (need to import `formatNumber`)
  - SessionDetail.tsx line 380: `session.total_tokens.toLocaleString()` → `formatNumber(session.total_tokens)`
  - TopBar.tsx line 49: `quickStats.totalSessions.toLocaleString()` → `formatNumber(quickStats.totalSessions)` (already imports `formatNumber` — no import change needed)
  - TopBar.tsx lines 159, 178: `quickStats.totalSessions.toLocaleString()` → `formatNumber(quickStats.totalSessions)`
  - Date formatting calls (`.toLocaleDateString()`, `.toLocaleString()` on Date objects, `.toLocaleTimeString()`) remain UNCHANGED
  - TypeScript: `tsc -b` passes with `noUnusedLocals` / `noUnusedParameters` strict
  - ESLint: `npm run lint` passes
- **Complexity:** medium (touch 4 files, must add 3 new imports, verify 0 date-related false positives)

<details>
<summary>Import additions by file</summary>

**Overview.tsx** — add `formatNumber` to existing import? No, Overview.tsx currently does NOT import from `costCalculator.ts`. Add new import:

```ts
import { formatNumber } from '../utils/costCalculator.ts'
```

**SessionsList.tsx** — currently imports `formatCost` but not `formatNumber` (line 5). Change line 5:

```ts
// Before:
import { loadPricing, calculateCost, formatCost } from '../utils/costCalculator.ts'
// After:
import { loadPricing, calculateCost, formatCost, formatNumber } from '../utils/costCalculator.ts'
```

**SessionDetail.tsx** — currently imports `formatCost` but not `formatNumber` (line 4). Change line 4:

```ts
// Before:
import { loadPricing, calculateCost, formatCost } from '../utils/costCalculator.ts'
// After:
import { loadPricing, calculateCost, formatCost, formatNumber } from '../utils/costCalculator.ts'
```

**TopBar.tsx** — already imports `formatNumber` and `formatCost` (line 5). No import change needed.

</details>

---

### Task 4: Replace raw cost formatting with `formatCost()` in Overview.tsx

- **Description:** The Overview summary strip at line 236 uses raw string interpolation `` `$${overview.totalCost.toFixed(2)}` `` instead of the shared `formatCost()` utility. Replace with `formatCost(overview.totalCost)`. Also add the import for `formatCost` to Overview.tsx (bundle with the `formatNumber` import from Task 3, or add separately if Task 3 hasn't run yet — but at plan time, both imports can be added to the same line).
- **Files affected:** `src/pages/Overview.tsx` (line 236 + import line)
- **Dependency:** Task 2 (formatCost must have the new K/M/B behavior)
- **Definition of Done:**
  - Overview.tsx line 236: `` `$${overview.totalCost.toFixed(2)}` `` → `{overview ? formatCost(overview.totalCost) : '—'}`
  - Import added: `import { formatNumber, formatCost } from '../utils/costCalculator.ts'` (combined with Task 3's formatNumber import)
  - If `overview.totalCost` is a large number (>= 1000), it now shows `$1.5K` format instead of `$1500.00`
  - TypeScript: `tsc -b` passes
- **Complexity:** low

<details>
<summary>Implementation detail</summary>

Import (add at top of Overview.tsx, or alongside Task 3's changes):
```ts
import { formatNumber, formatCost } from '../utils/costCalculator.ts'
```

Line 236 change:
```tsx
// Before:
· {overview ? `$${overview.totalCost.toFixed(2)}` : '—'}

// After:
· {overview ? formatCost(overview.totalCost) : '—'}
```

</details>

---

### Task 5: Fix ModelUsageChart white background on hover

- **Description:** The `ModelUsageChart` `BarChart` shows a white background rectangle when hovering over bars. Root cause: Recharts `BarChart` default cursor overlay uses white fill, and the default tooltip content style has white background. Fix by setting `cursor={{ fill: 'transparent' }}` on `<BarChart>` and `contentStyle={{ background: 'none', border: 'none', padding: 0 }}` on `<Tooltip>`. Also check whether `TokenUsageChart` and `CostChart` need the same fix, but since they use `LineChart` (different cursor behavior), apply only to `ModelUsageChart`.
- **Files affected:** `src/components/ModelUsageChart.tsx` (lines 71, 75)
- **Dependency:** None (independent — but does touch ModelUsageChart.tsx which Task 6 also modifies; Task 5 runs before Task 6 to avoid conflicts)
- **Definition of Done:**
  - `<BarChart>` has `cursor={{ fill: 'transparent' }}` prop
  - `<Tooltip>` has `contentStyle={{ background: 'none', border: 'none', padding: 0 }}` prop
  - Existing `CustomTooltip` div (background `#1c2128`) still renders correctly — its own inline styles take precedence
  - When hovering on bars: only custom dark tooltip appears, no white background flash
  - TokenUsageChart and CostChart are checked; if they also show white hover backgrounds, same fix applied — otherwise left unchanged (LineChart cursor behavior differs)
  - TypeScript: `tsc -b` passes
- **Complexity:** low

<details>
<summary>Implementation detail</summary>

Two targeted line changes in `ModelUsageChart.tsx`:

**Line 71 (BarChart):**
```tsx
// Before:
<BarChart data={data} margin={{ left: 0, right: 8, top: 5, bottom: 5 }}>
// After:
<BarChart data={data} margin={{ left: 0, right: 8, top: 5, bottom: 5 }} cursor={{ fill: 'transparent' }}>
```

Note: The `cursor` prop type on `BarChart` accepts `{ fill: string }` — this is a valid Recharts prop for controlling the cursor overlay rectangle.

**Line 75 (Tooltip):**
```tsx
// Before:
<Tooltip content={CustomTooltip} />
// After:
<Tooltip content={CustomTooltip} contentStyle={{ background: 'none', border: 'none', padding: 0 }} />
```

The `contentStyle` prop sets the wrapper div style that Recharts renders around the custom content. Setting `background: 'none'` prevents the default white. The `CustomTooltip` component's own `<div>` with `background: '#1c2128'` still renders inside.

</details>

---

### Task 6: Fix chart axis labels — remove `hide`, add proper styling and tick formatters

- **Description:** All three charts (`TokenUsageChart`, `CostChart`, `ModelUsageChart`) currently set `hide` on both `XAxis` and `YAxis` — a bug contradicting the design spec. Remove `hide`, add tick formatters and dark-theme styling via CSS variables. Time-series charts (TokenUsage, Cost) format X-axis dates with `formatDateTick()`. ModelUsageChart formats Y-axis tokens with `formatNumber()`. CostChart formats Y-axis costs with `formatCost()`. Apply consistent axis styling: `stroke: var(--text-secondary)`, `fontSize: 11`, `tickLine: false`. For ModelUsageChart X-axis, if any model label exceeds 15 characters, rotate labels -45° with `textAnchor: 'end'` and `height: 60`.
- **Files affected:**
  - `src/components/TokenUsageChart.tsx` (lines 119-120)
  - `src/components/CostChart.tsx` (lines 120-121)
  - `src/components/ModelUsageChart.tsx` (lines 73-74)
- **Dependency:** Task 1 + Task 2 (formatNumber and formatCost must be updated for Y-axis tick formatters)
- **Definition of Done:**
  - **TokenUsageChart:** XAxis shows dates formatted via `formatDateTick(granularity)`, YAxis shows token counts formatted via `formatNumber`. Both axes visible with `var(--text-secondary)` stroke, fontSize 11.
  - **CostChart:** XAxis shows dates via `formatDateTick(granularity)`, YAxis shows `$` values via `formatCost`. Both axes visible.
  - **ModelUsageChart:** XAxis shows model name labels (rotate -45° if any label > 15 chars, else horizontal). YAxis shows token counts via `formatNumber`. Both axes visible.
  - Grid lines remain consistent with dark theme (`#21262d`), tick lines removed.
  - Chart margins adjusted to accommodate visible axis labels (increase `margin={{ left: 0, ... }}` to `margin={{ left: 8, right: 8, top: 5, bottom: 20 }}`).
  - TypeScript: `tsc -b` passes with strict mode
- **Complexity:** medium (touch 3 chart files, need correct Recharts axis API usage, granularity forwarding for tick formatters)

<details>
<summary>Implementation detail</summary>

### TokenUsageChart.tsx

**Lines 119-120 — replace `hide` with full XAxis/YAxis:**
```tsx
// Before:
<XAxis dataKey="date" hide />
<YAxis hide />

// After:
<XAxis
  dataKey="date"
  tickFormatter={(d: string) => formatDateTick(d, granularity)}
  stroke="var(--text-secondary)"
  fontSize={11}
  tickLine={false}
  axisLine={{ stroke: 'var(--border)' }}
  dy={8}
/>
<YAxis
  tickFormatter={(v: number) => formatNumber(v)}
  stroke="var(--text-secondary)"
  fontSize={11}
  tickLine={false}
  axisLine={false}
  width={60}
/>
```

**Line 111 — adjust margin for axis labels:**
```tsx
// Before:
<LineChart data={data} margin={{ left: 0, right: 8, top: 5, bottom: 5 }}>
// After:
<LineChart data={data} margin={{ left: 8, right: 8, top: 5, bottom: 20 }}>
```

Note: `formatDateTick` is already imported at line 11. `formatNumber` is already imported at line 11. No new imports needed.

### CostChart.tsx

**Lines 120-121 — replace `hide` with full XAxis/YAxis:**
```tsx
// Before:
<XAxis dataKey="date" hide />
<YAxis hide />

// After:
<XAxis
  dataKey="date"
  tickFormatter={(d: string) => formatDateTick(d, granularity)}
  stroke="var(--text-secondary)"
  fontSize={11}
  tickLine={false}
  axisLine={{ stroke: 'var(--border)' }}
  dy={8}
/>
<YAxis
  tickFormatter={(v: number) => formatCost(v)}
  stroke="var(--text-secondary)"
  fontSize={11}
  tickLine={false}
  axisLine={false}
  width={60}
/>
```

**Line 112 — adjust margin:**
```tsx
// Before:
<LineChart data={data} margin={{ left: 0, right: 8, top: 5, bottom: 5 }}>
// After:
<LineChart data={data} margin={{ left: 8, right: 8, top: 5, bottom: 20 }}>
```

`formatDateTick` and `formatCost` already imported at line 12. No new imports.

### ModelUsageChart.tsx

**Lines 73-74 — replace `hide` with full XAxis/YAxis:**

First, determine if any model label exceeds 15 characters (computed once in the component body before the JSX):
```tsx
const hasLongLabels = data.some((d) => d.label.length > 15)
```

**XAxis:**
```tsx
// Before:
<XAxis dataKey="label" hide />

// After:
<XAxis
  dataKey="label"
  stroke="var(--text-secondary)"
  fontSize={11}
  tickLine={false}
  axisLine={{ stroke: 'var(--border)' }}
  angle={hasLongLabels ? -45 : 0}
  textAnchor={hasLongLabels ? 'end' : 'middle'}
  height={hasLongLabels ? 60 : undefined}
  dy={hasLongLabels ? -4 : 8}
/>
```

**YAxis:**
```tsx
// Before:
<YAxis hide />

// After:
<YAxis
  tickFormatter={(v: number) => formatNumber(v)}
  stroke="var(--text-secondary)"
  fontSize={11}
  tickLine={false}
  axisLine={false}
  width={60}
/>
```

**Line 71 — adjust margin (also apply Task 5's cursor fix from previous line):**
```tsx
// After both Task 5 and Task 6:
<BarChart data={data} margin={{ left: 8, right: 8, top: 5, bottom: hasLongLabels ? 40 : 20 }} cursor={{ fill: 'transparent' }}>
```

`formatNumber` already imported at line 11. No new imports.

### NFR-05 Compliance

All axis colors use CSS variables (`var(--text-secondary)`, `var(--border)`) — no hardcoded colors. This ensures consistency when the theme changes.

</details>

---

### Task 7: Load projects and display project name in SessionsList.tsx Project column

- **Description:** The SessionsList `Project` column currently displays `s.project_id` (a UUID hash). Load `projects.json` via the existing `loadProjects()` function, build a `Map<string, string>` (project ID → project name) for O(1) lookup, and display the project name instead. Also update the search and project filter to match against project names, not IDs. Follow NFR-02: use `useMemo` to build the map once, use `Map.get()` for O(1) lookup, never `.find()` in a loop.
- **Files affected:** `src/pages/SessionsList.tsx` (lines 1-5 import, 26-60 fetch, 62-106 filtered, 215 render)
- **Dependency:** None (independent of formatting/chart tasks)
- **Definition of Done:**
  - `loadProjects` imported from `dataLoader.ts`
  - `Project` type imported from `types/index.ts`
  - Projects fetched in `useEffect` alongside sessions/models (added to `Promise.all`)
  - `projectNameMap` built via `useMemo`: `new Map<string, string>()` mapping project ID → name
  - Column render (line 215): `projectNameMap.get(s.project_id ?? '') ?? s.project_id ?? '—'`
  - Search filter (lines 66-72): also matches against project name via the map
  - Project filter (lines 75-77): matches against project name via the map, not `project_id`
  - If project not found in projects.json, fallback to displaying the raw `project_id` (hash)
  - Performance: O(n) build of map, O(1) per-lookup, no `.find()` in filter loops
  - TypeScript: `tsc -b` passes — `Project` type import uses `import type` per `verbatimModuleSyntax`
  - ESLint: `npm run lint` passes
- **Complexity:** medium (adds async data dependency, modifies filter logic, careful import hygiene)

<details>
<summary>Implementation detail</summary>

### Step 1: Add imports (line 1-5)

```tsx
// Before (line 4):
import { loadSessions, loadModels } from '../utils/dataLoader.ts'
// After:
import { loadSessions, loadModels, loadProjects } from '../utils/dataLoader.ts'

// Before (line 8):
import type { Session } from '../types/index.ts'
// After:
import type { Session, Project } from '../types/index.ts'
```

### Step 2: Add projects state (after line 12)

```tsx
const [allSessions, setAllSessions] = useState<Session[]>([])
const [projects, setProjects] = useState<Project[]>([])  // NEW
const [loading, setLoading] = useState(true)
```

### Step 3: Fetch projects in useEffect (lines 26-60)

Add `loadProjects()` to the `Promise.all` and extract results:

```tsx
// Before (line 31):
const [sessions, models] = await Promise.all([loadSessions(), loadModels()])
// After:
const [sessions, models, projects] = await Promise.all([loadSessions(), loadModels(), loadProjects()])

// After setAllSessions(sessionsWithCost) (line 51), add:
setProjects(projects)
```

### Step 4: Build project name lookup map (new useMemo, after line 51-area)

```tsx
const projectNameMap = useMemo(() => {
  const map = new Map<string, string>()
  for (const p of projects) {
    map.set(p.id, p.name)
  }
  return map
}, [projects])
```

### Step 5: Update search filter (lines 66-72)

```tsx
// Before:
if (search) {
  const q = search.toLowerCase()
  result = result.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      (s.project_id?.toLowerCase().includes(q) ?? false) ||
      (s.model_id?.toLowerCase().includes(q) ?? false)
  )
}
// After:
if (search) {
  const q = search.toLowerCase()
  result = result.filter((s) => {
    const projectName = s.project_id ? (projectNameMap.get(s.project_id) ?? s.project_id) : ''
    return (
      s.title.toLowerCase().includes(q) ||
      projectName.toLowerCase().includes(q) ||
      (s.model_id?.toLowerCase().includes(q) ?? false)
    )
  })
}
```

### Step 6: Update project filter (lines 75-77)

```tsx
// Before:
if (projectFilter) {
  result = result.filter((s) => s.project_id?.toLowerCase().includes(projectFilter.toLowerCase()))
}
// After:
if (projectFilter) {
  const pf = projectFilter.toLowerCase()
  result = result.filter((s) => {
    const projectName = s.project_id ? (projectNameMap.get(s.project_id) ?? '') : ''
    return projectName.toLowerCase().includes(pf)
  })
}
```

### Step 7: Update Project column render (line 215)

```tsx
// Before:
{ key: 'project_id', header: 'Project', render: (s) => s.project_id ?? '—' },
// After:
{ key: 'project_id', header: 'Project', render: (s) => projectNameMap.get(s.project_id ?? '') ?? s.project_id ?? '—' },
```

### Step 8: Add `projectNameMap` to `filtered` useMemo dependencies (line 106)

```tsx
// Before:
}, [allSessions, search, projectFilter, modelFilter, dateFrom, dateTo, sortBy, sortOrder])
// After:
}, [allSessions, search, projectFilter, modelFilter, dateFrom, dateTo, sortBy, sortOrder, projectNameMap])
```

</details>

---

### Task 8: Display project name in SessionDetail.tsx info bar and detail cards

- **Description:** SessionDetail.tsx displays `session.project_id` (UUID hash) in two places: the info bar (line 250) and the Project detail card (line 268). Load projects via `loadProjects()`, build a lookup map using the same pattern as Task 7, and replace both displays with the human-readable project name.
- **Files affected:** `src/pages/SessionDetail.tsx` (lines 1-5 imports, 136-189 fetch, 250 info bar, 268 detail card)
- **Dependency:** Task 7 (same pattern — should follow to ensure consistent approach)
- **Definition of Done:**
  - `loadProjects` imported from `dataLoader.ts`
  - `Project` type imported from `types/index.ts` (with `import type`)
  - Projects fetched in the existing `useEffect` (added to `Promise.all`)
  - `projectNameMap` built (same `Map<string, string>` pattern as Task 7)
  - Line 250 info bar: `session.project_id ?? '—'` → `projectName ?? '—'`
  - Line 268 detail card: `session.project_id ?? '—'` → `projectName ?? '—'`
  - Fallback: if project not found in map, display `project_id` raw
  - TypeScript: `tsc -b` passes
  - ESLint: `npm run lint` passes
- **Complexity:** low (follows exact same pattern as Task 7, fewer lines)

<details>
<summary>Implementation detail</summary>

### Step 1: Add imports (lines 3-6)

```tsx
// Before (line 3):
import { loadSessions, loadMessages, loadParts, loadModels } from '../utils/dataLoader.ts'
// After:
import { loadSessions, loadMessages, loadParts, loadModels, loadProjects } from '../utils/dataLoader.ts'

// Before (line 6):
import type { Message, Part } from '../types/index.ts'
// After:
import type { Message, Part, Project } from '../types/index.ts'
```

### Step 2: Add projects state (after line 133)

```tsx
const [partsMap, setPartsMap] = useState<Record<string, Part[]>>({})
const [projects, setProjects] = useState<Project[]>([])  // NEW
const [loading, setLoading] = useState(true)
```

### Step 3: Fetch projects in useEffect (lines 143-148)

```tsx
// Before:
const [sessions, allMessages, allParts, models] = await Promise.all([
  loadSessions(),
  loadMessages(),
  loadParts(),
  loadModels(),
])
// After:
const [sessions, allMessages, allParts, models, projects] = await Promise.all([
  loadSessions(),
  loadMessages(),
  loadParts(),
  loadModels(),
  loadProjects(),
])
```

After loading, store projects:

```tsx
setProjects(projects)
```

### Step 4: Build project name lookup (before the return statement, after the fetch useEffect)

```tsx
const projectNameMap = useMemo(() => {
  const map = new Map<string, string>()
  for (const p of projects) {
    map.set(p.id, p.name)
  }
  return map
}, [projects])
```

### Step 5: Compute project name (same area — before the return, after projectNameMap)

```tsx
const projectName = session
  ? (session.project_id ? (projectNameMap.get(session.project_id) ?? session.project_id) : null)
  : null
```

### Step 6: Replace displays (lines 250, 268)

**Line 250 (info bar):**
```tsx
// Before:
{session.project_id ?? '—'} · {session.model_id ?? '—'} · {new Date(session.created_at).toLocaleString()}
// After:
{projectName ?? '—'} · {session.model_id ?? '—'} · {new Date(session.created_at).toLocaleString()}
```

**Line 268 (Project card):**
```tsx
// Before:
<div style={cardValueStyle}>{session.project_id ?? '—'}</div>
// After:
<div style={cardValueStyle}>{projectName ?? '—'}</div>
```

</details>

---

## Dependency Order

```
Task 1 (formatNumber 2dp) ──┐
                              ├── Task 2 (formatCost K/M/B) ──┬── Task 3 (replace .toLocaleString) ──┐
                              │                                ├── Task 4 (Overview cost formatCost) ──┤
                              │                                └── Task 6 (chart axis labels) ─────────┤
                              │                                                                        │
                              ├── Task 5 (ModelUsageChart hover fix) ─────────────────────────────────┤
                              │                                                                        │
                              └── Task 7 (SessionsList project names) ── Task 8 (SessionDetail project)
```

**Notes:**
- Tasks 3, 4, and 6 all depend on Task 2. They can run in parallel after Task 2.
- Task 5 is fully independent — can run in parallel with tasks 1-4.
- Task 7 is independent — can run in parallel with tasks 1-6.
- Task 8 depends on Task 7 (same project name lookup pattern).
- If Task 6 runs before Task 5, the programmer must merge both changes to `ModelUsageChart.tsx` (the plan shows them additively — no conflicts).

---

## Risks & Alternatives

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `formatNumber` regex `\.?0+$` strips `.00` from `"0.00"` → `"0"`, which is correct but may surprise callers expecting a decimal | Low | `formatNumber` already returns integer strings for sub-1000 values (`Math.round().toLocaleString()`); no caller parses the result as float |
| Changing `margin` on charts causes layout shift or clipping on mobile viewport | Medium | Use responsive margin values: `bottom` already accommodates axis labels; test on 375px viewport width |
| `BarChart` `cursor` prop type may not accept `{ fill: string }` in Recharts v2 types | Low | Verified — Recharts `CursorProps` includes `fill`; if type error, use `cursor={false}` as fallback (disables cursor overlay entirely) |
| Long model names (> 15 chars) with -45° rotation may overlap other UI elements | Low | `height={60}` on XAxis provides vertical space; `textAnchor="end"` prevents overlap with bars |
| `projectNameMap` in `filtered` useMemo dependency array causes extra filter runs when projects load asynchronously | Low | Projects load once at mount alongside sessions; `useMemo` correctly re-runs only on data change — performance impact negligible |
| Existing `overviewDataProcessor.ts` line 266 conditional `totalCost < 1000 ? formatCost(totalCost) : '$' + formatNumber(totalCost)` becomes redundant after Task 2 | Low | Requirement says to preserve existing logic; functionally identical result either way — no behavioral regression |

**Alternatives:**
- If `BarChart` cursor overlay cannot be made transparent via `cursor={{ fill }}`, use `cursor={false}` to disable the overlay rectangle entirely. The custom tooltip still appears on hover.
- If axis labels cause overcrowding on mobile, reduce `fontSize` to 10 and/or increase chart height to 350px.

---

## Verification Checklist (post-implementation)

1. **`npm run sync`** — regenerate JSON data (run from project root)
2. **`npm run dev`** — start dev server
3. **`tsc -b`** — type-check must pass with zero errors
4. **`npm run lint`** — ESLint must pass
5. **Manual UI checks:**
   - [ ] **All pages**: numbers display in K/M/B format (not comma-separated thousands)
   - [ ] **All pages**: costs display with `$` prefix + appropriate suffix (`$12.34`, `$1.25K`, `$2.5M`)
   - [ ] **Overview charts**: X and Y axis labels visible, styled with dark theme colors
   - [ ] **ModelUsageChart hover**: no white background; only dark custom tooltip
   - [ ] **SessionsList Project column**: shows project name (e.g., `opencode-dashboard`), not UUID hash
   - [ ] **SessionDetail info bar + Project card**: shows project name
   - [ ] **Resources page**: pricing unchanged (`$0.00000250/Mt` format)
   - [ ] **TokenCompositionChart**: unchanged (verified per T-01)
   - [ ] **TopBar stats strip**: sessions count uses `formatNumber()`, not `toLocaleString()`

---

Version: 1 | Author: planner | Ref: requirements v2 | Date: 2026-05-26

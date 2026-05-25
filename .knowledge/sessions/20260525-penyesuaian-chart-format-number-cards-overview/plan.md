# Implementation Plan: Penyesuaian Chart, Format Number, dan Cards Key Metrics Overview

> **For the Orchestrator:** The Orchestrator delegates this plan to the Programmer for execution. After implementation, the Orchestrator delegates to the Reviewer for code review. Do NOT dispatch subagents directly — the Orchestrator manages the multi-agent pipeline.

**Goal:** Restructure the Overview page: extend number/cost formatters, reorder key metric cards, replace all existing charts with 3 new charts (Token Usage 5-line, Model Usage top-4 bar, Cost line), add `byYear` aggregation to the sync script, and share a single `Daily | Weekly | Monthly | Year | All` granularity filter across Token Usage and Cost charts.

**Architecture:** Utility-first (format functions → sync script → types), then shared UI (GranularityFilter → data processors → chart components), then final assembly (Overview.tsx cleanup + wiring). All chart data processing stays in `overviewDataProcessor.ts` using `useMemo`; chart components are pure presentation. No new npm dependencies.

**Tech Stack:** React 19, TypeScript 5.x, Recharts, Vite, Zustand (unchanged), existing CSS custom properties.

**Reference:** Requirements: .knowledge/sessions/20260525-penyesuaian-chart-format-number-cards-overview/requirements.md v2

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/utils/costCalculator.ts` | Modify | `formatNumber()` (add B suffix), `formatCost()` (always 2 decimals) |
| `scripts/sync-opencode-data.js` | Modify | Add `byYear` aggregation alongside `byDay`/`byWeek`/`byMonth` |
| `src/utils/dataLoader.ts` | Modify | Add `byYear` array to `TokenUsageData` interface |
| `src/types/index.ts` | Modify | Add `Granularity` type, `TokenUsageChartPoint` and `ModelUsageBarItem` types |
| `src/components/GranularityFilter.tsx` | **Create** | Shared `Daily\|Weekly\|Monthly\|Year\|All` button group |
| `src/utils/overviewDataProcessor.ts` | Modify | Reorder cards; add `aggregateTokenUsageForChart()`, `aggregateCostForChart()`, `computeTopModelsForBar()`; remove unused exports |
| `src/components/TokenUsageChart.tsx` | **Create** | 5-line `<LineChart>` with smooth curves |
| `src/components/ModelUsageChart.tsx` | **Create** | Top-4 `<BarChart>`, one bar per model |
| `src/components/CostChart.tsx` | **Create** | Single-line `<LineChart>` for cost |
| `src/pages/Overview.tsx` | Modify | Remove old sections; import/use new charts; remove unused state/memos/imports |

---

## Task 1: Extend `formatNumber()` with billions (B) suffix

**Files:**
- Modify: `src/utils/costCalculator.ts`

**Dependencies:** None

- [ ] **Step 1: Add billions branch to `formatNumber()`**

After the existing millions branch (line 43–45), add a new branch for `value >= 1_000_000_000`:

```typescript
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (value < 1000) return Math.round(value).toLocaleString()
  if (value < 1_000_000) {
    const k = value / 1000
    const formatted = k.toFixed(1)
    return formatted.endsWith('.0') ? formatted.slice(0, -2) + 'K' : formatted + 'K'
  }
  if (value < 1_000_000_000) {
    const m = value / 1_000_000
    const formatted = m.toFixed(1)
    return formatted.endsWith('.0') ? formatted.slice(0, -2) + 'M' : formatted + 'M'
  }
  // BILLIONS
  const b = value / 1_000_000_000
  const formatted = b.toFixed(1)
  return formatted.endsWith('.0') ? formatted.slice(0, -2) + 'B' : formatted + 'B'
}
```

- [ ] **Step 2: Update JSDoc comment**

Update the JSDoc above `formatNumber()` (lines 29–34) to list all four ranges: `< 1000` → raw, `< 1M` → K, `< 1B` → M, `>= 1B` → B.

- [ ] **Step 3: Run type check**

Run: `npx tsc -b`
Expected: No type errors.

**Definition of Done:**
- `formatNumber(2_500_000_000)` returns `"2.5B"`
- `formatNumber(1_000_000_000)` returns `"1B"`
- `formatNumber(999_999_999)` returns `"999M"` (not affected)
- `formatNumber(0)` returns `"0"`
- `formatNumber(NaN)` returns `"0"`

---

## Task 2: Fix `formatCost()` — always 2 decimal places

**Files:**
- Modify: `src/utils/costCalculator.ts`

**Dependencies:** None

- [ ] **Step 1: Remove the `< 1` special case**

Replace the body of `formatCost()`:

```typescript
export function formatCost(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0.00'
  return `$${value.toFixed(2)}`
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc -b`
Expected: No type errors.

**Definition of Done:**
- `formatCost(0.2345)` returns `"$0.23"` (not `"$0.2345"`)
- `formatCost(0.235)` returns `"$0.24"` (standard rounding)
- `formatCost(0.001)` returns `"$0.00"`
- `formatCost(1234.567)` returns `"$1234.57"`
- `formatCost(0)` returns `"$0.00"`
- `formatCost(NaN)` returns `"$0.00"`

---

## Task 3: Add `byYear` aggregation to sync script

**Files:**
- Modify: `scripts/sync-opencode-data.js`

**Dependencies:** None

- [ ] **Step 1: Add `yearMap` in the time aggregation loop**

In `scripts/sync-opencode-data.js`, in the token-usage-over-time section (around line 341), add a `yearMap` object alongside existing `dayMap`, `weekMap`, `monthMap`:

```javascript
// Token usage over time
const dayMap = {}
const weekMap = {}
const monthMap = {}
const yearMap = {}           // <-- ADD THIS
for (const s of sessions) {
  const date = new Date(s.created_at)
  if (isNaN(date.getTime())) continue

  const dayKey = date.toISOString().slice(0, 10)
  const weekKey = `${date.getFullYear()}-W${String(getWeek(date)).padStart(2, '0')}`
  const monthKey = date.toISOString().slice(0, 7)
  const yearKey = String(date.getFullYear())   // <-- ADD THIS

  for (const [map, key] of [[dayMap, dayKey], [weekMap, weekKey], [monthMap, monthKey], [yearMap, yearKey]]) {
    if (!map[key]) {
      map[key] = { date: key, input: 0, output: 0, reasoning: 0, cache: 0 }
    }
    map[key].input += s.input_tokens
    map[key].output += s.output_tokens
    map[key].reasoning += s.reasoning_tokens
    map[key].cache += s.cache_tokens
  }
}
```

- [ ] **Step 2: Sort and export `byYear`**

After the existing sort lines (around line 371–373), add:

```javascript
const byYear = Object.values(yearMap).sort((a, b) => a.date.localeCompare(b.date))
```

- [ ] **Step 3: Include `byYear` in the returned `tokenUsage` object**

In the return statement of `exportDatabase()` (line 381–388), add `byYear`:

```javascript
tokenUsage: {
  byModel,
  byProvider,
  byProject,
  byDay,
  byWeek,
  byMonth,
  byYear,        // <-- ADD THIS
},
```

- [ ] **Step 4: Verify JSON output**

Run: `npm run sync`
Expected: Command completes without errors. Check that `public/data/token-usage.json` contains a `byYear` array with entries shaped like `{ date: "2026", input: N, output: N, reasoning: N, cache: N }`, sorted chronologically.

**Definition of Done:**
- `token-usage.json` contains `byYear` array
- Each entry has `{ date, input, output, reasoning, cache }` shape
- `byYear` is sorted ascending by `date`
- All existing JSON files are unchanged in structure (only `token-usage.json` gains `byYear`)

---

## Task 4: Add `byYear` to TypeScript types

**Files:**
- Modify: `src/utils/dataLoader.ts`
- Modify: `src/types/index.ts`

**Dependencies:** Task 3 (sync script produces `byYear`; not a hard block but types must match)

- [ ] **Step 1: Add `byYear` to `TokenUsageData` in `dataLoader.ts`**

Add after the `byMonth` block (lines 50–56):

```typescript
  byYear: Array<{
    date: string
    input: number
    output: number
    reasoning: number
    cache: number
  }>
```

- [ ] **Step 2: Add new shared types to `src/types/index.ts`**

Add the following interfaces after the existing `TimeRange` type (line 142):

```typescript
/** Granularity for time-based chart filtering */
export type Granularity = 'daily' | 'weekly' | 'monthly' | 'year' | 'all'

/** Single data point for the 5-line Token Usage chart */
export interface TokenUsageChartPoint {
  date: string
  inputTotal: number    // input + cache (all tokens sent)
  cacheRead: number     // cache field only
  cacheMiss: number     // input field only
  output: number        // output field only
  reasoning: number     // reasoning field only
}

/** Single bar for the Model Usage chart */
export interface ModelUsageBarItem {
  label: string
  totalTokens: number
}
```

- [ ] **Step 3: Run type check**

Run: `npx tsc -b`
Expected: No type errors. If `TokenUsageData` in `types/index.ts` conflicts, that file has a separate `TokenUsageData` (line 126–132) used for individual breakdown entries. Verify no name collision — the one in `dataLoader.ts` is imported separately.

**Definition of Done:**
- `tsc -b` passes
- `byYear` is accessible on `TokenUsageData` objects loaded from JSON
- New types (`Granularity`, `TokenUsageChartPoint`, `ModelUsageBarItem`) are exportable from `src/types/index.ts`

---

## Task 5: Create shared `GranularityFilter` component

**Files:**
- Create: `src/components/GranularityFilter.tsx`

**Dependencies:** Task 4 (for `Granularity` type)

- [ ] **Step 1: Create the component**

Create `src/components/GranularityFilter.tsx` with the following content:

```typescript
import type { Granularity } from '../types/index.ts'

const options: { value: Granularity; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' },
]

interface GranularityFilterProps {
  value: Granularity
  onChange: (g: Granularity) => void
}

export default function GranularityFilter({ value, onChange }: GranularityFilterProps) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: value === opt.value ? 'var(--accent)' : 'var(--bg-secondary)',
            color: value === opt.value ? '#fff' : 'var(--text-secondary)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc -b`
Expected: No type errors.

**Definition of Done:**
- Component renders 5 buttons: Daily, Weekly, Monthly, Year, All
- Active button uses `var(--accent)` background with white text
- All buttons have `aria-pressed` attribute reflecting selection state
- Matches `TimeRangeSelector` visual style (same padding, border-radius, font-size)

---

## Task 6: Add chart data processing functions to `overviewDataProcessor.ts`

**Files:**
- Modify: `src/utils/overviewDataProcessor.ts`

**Dependencies:** Tasks 1–4 (utilities and types must exist)

- [ ] **Step 1: Add imports for new types**

At the top of the file, add to the import from `../types/index.ts`:

```typescript
import type {
  // ... existing imports ...
  Granularity,
  TokenUsageChartPoint,
  ModelUsageBarItem,
} from '../types/index.ts'
```

- [ ] **Step 2: Add `aggregateTokenUsageForChart()` function**

Add this function after the `filterByTimeRange()` function (around line 64):

```typescript
/**
 * Select the correct pre-aggregated array and transform into 5-line chart format.
 * - inputTotal = input + cache (all tokens sent to model)
 * - cacheRead = cache tokens only
 * - cacheMiss = input tokens only
 * - output = output tokens only
 * - reasoning = reasoning tokens only
 */
export function aggregateTokenUsageForChart(
  tokenUsage: TokenUsageData,
  granularity: Granularity
): TokenUsageChartPoint[] {
  let source: typeof tokenUsage.byDay

  switch (granularity) {
    case 'weekly':
      source = tokenUsage.byWeek
      break
    case 'monthly':
      source = tokenUsage.byMonth
      break
    case 'year':
      source = tokenUsage.byYear
      break
    case 'daily':
    case 'all':
    default:
      source = tokenUsage.byDay
      break
  }

  return source.map((d) => ({
    date: d.date,
    inputTotal: d.input + d.cache,
    cacheRead: d.cache,
    cacheMiss: d.input,
    output: d.output,
    reasoning: d.reasoning,
  }))
}
```

- [ ] **Step 3: Add `aggregateCostForChart()` function**

Add after the `aggregateTokenUsageForChart` function:

```typescript
/**
 * Aggregate session costs by time granularity for the Cost chart.
 * Cost is computed client-side from sessions because cost data is not in token-usage.json.
 */
export function aggregateCostForChart(
  sessions: Session[],
  pricingMap: Map<string, Pricing>,
  granularity: Granularity
): DailyCostPoint[] {
  const map = new Map<string, number>()

  for (const s of sessions) {
    const date = new Date(s.created_at)
    if (isNaN(date.getTime())) continue

    let key: string
    switch (granularity) {
      case 'weekly':
        key = getISOWeekKey(date)
        break
      case 'monthly':
        key = date.toISOString().slice(0, 7) // "YYYY-MM"
        break
      case 'year':
        key = String(date.getFullYear()) // "YYYY"
        break
      case 'daily':
      case 'all':
      default:
        key = date.toISOString().slice(0, 10) // "YYYY-MM-DD"
        break
    }

    let cost = 0
    if (s.model_id && pricingMap.has(s.model_id)) {
      const pricing = pricingMap.get(s.model_id)!
      cost = calculateCost(
        {
          input: s.input_tokens,
          output: s.output_tokens,
          reasoning: s.reasoning_tokens,
          cache: s.cache_tokens,
        },
        pricing
      )
    }
    map.set(key, (map.get(key) ?? 0) + cost)
  }

  const result: DailyCostPoint[] = []
  for (const [date, cost] of map.entries()) {
    result.push({ date, cost })
  }
  result.sort((a, b) => a.date.localeCompare(b.date))
  return result
}

/** Helper: compute ISO week key "YYYY-Www" for a Date */
function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
```

- [ ] **Step 4: Add `computeTopModelsForBar()` function**

Add after `aggregateCostForChart`:

```typescript
/**
 * Get top 4 models by total token count for the Model Usage bar chart.
 */
export function computeTopModelsForBar(
  tokenUsage: TokenUsageData
): ModelUsageBarItem[] {
  const items = tokenUsage.byModel.map((m) => ({
    label: m.label,
    totalTokens: m.input + m.output + m.reasoning + m.cache,
  }))

  items.sort((a, b) => b.totalTokens - a.totalTokens)
  return items.slice(0, 4)
}
```

- [ ] **Step 5: Run type check**

Run: `npx tsc -b`
Expected: No type errors. (Note: `TokenUsageData` should resolve from the import at line 16; the aggregate function uses `byYear` which was added in Task 4.)

**Definition of Done:**
- `aggregateTokenUsageForChart()` returns `TokenUsageChartPoint[]` with 5 computed fields
- `aggregateCostForChart()` returns `DailyCostPoint[]` for any granularity
- `computeTopModelsForBar()` returns at most 4 `ModelUsageBarItem[]`
- All three functions handle empty data (return `[]`)

---

## Task 7: Reorder Key Metrics cards

**Files:**
- Modify: `src/utils/overviewDataProcessor.ts`

**Dependencies:** Tasks 1 and 2 (format functions updated)

- [ ] **Step 1: Reorder the `cards` array in `computeKeyMetrics()`**

Replace the cards array (lines 111–157) with the new order. The new order is:

1. Total Tokens
2. Input Tokens
3. Cache Miss
4. Cache Read
5. Output Tokens
6. Total Sessions
7. Providers
8. Models
9. Estimated Costs

```typescript
  const cards: MetricCardData[] = [
    {
      label: 'Total Tokens',
      value: formatNumber(totalTokens),
      subLabel: 'All tokens across sessions',
    },
    {
      label: 'Input Tokens',
      value: formatNumber(totalInputTokens + totalCacheTokens),
      subLabel: 'Prompt + cache tokens',
    },
    {
      label: 'Cache Miss',
      value: formatNumber(totalCacheMissTokens),
      subLabel: 'Sent to models (not cached)',
    },
    {
      label: 'Cache Read',
      value: formatNumber(totalCacheTokens),
      subLabel: 'Served from prompt cache',
    },
    {
      label: 'Output Tokens',
      value: formatNumber(totalOutputTokens),
      subLabel: 'Generated by models',
    },
    {
      label: 'Total Sessions',
      value: formatNumber(overview.totalSessions),
      subLabel: 'Global sessions',
    },
    {
      label: 'Providers',
      value: formatNumber(providersCount),
      subLabel: 'Connected providers',
    },
    {
      label: 'Models',
      value: formatNumber(modelsCount),
      subLabel: 'From configured providers',
    },
    {
      label: 'Estimated Cost',
      value: totalCost < 1000 ? formatCost(totalCost) : '$' + formatNumber(totalCost),
      subLabel: 'Based on token pricing',
    },
  ]
```

- [ ] **Step 2: Run type check**

Run: `npx tsc -b`
Expected: No type errors.

**Definition of Done:**
- Cards render in order: Total Tokens → Input Tokens → Cache Miss → Cache Read → Output Tokens → Total Sessions → Providers → Models → Estimated Cost
- Each card retains its original `label`, `value` (formatted), `subLabel`
- Removing unused `computeDailyCost` export is NOT done here (still used by existing code) — will be cleaned up in Task 11

---

## Task 8: Create `TokenUsageChart` component

**Files:**
- Create: `src/components/TokenUsageChart.tsx`

**Dependencies:** Tasks 1, 4, 5, 6 (formatNumber, Granularity type, GranularityFilter, chart data)

- [ ] **Step 1: Create the component**

Create `src/components/TokenUsageChart.tsx`:

```typescript
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { Granularity, TokenUsageChartPoint } from '../types/index.ts'
import GranularityFilter from './GranularityFilter.tsx'
import { formatNumber } from '../utils/costCalculator.ts'

interface TokenUsageChartProps {
  data: TokenUsageChartPoint[]
  granularity: Granularity
  onGranularityChange: (g: Granularity) => void
}

const lineConfigs = [
  { dataKey: 'inputTotal', name: 'Input Tokens',   stroke: 'var(--chart-1)' },
  { dataKey: 'cacheRead',  name: 'Cache Read',      stroke: 'var(--chart-4)' },
  { dataKey: 'cacheMiss',  name: 'Cache Miss',      stroke: 'var(--chart-5)' },
  { dataKey: 'output',     name: 'Output Tokens',   stroke: 'var(--chart-2)' },
  { dataKey: 'reasoning',  name: 'Reasoning',       stroke: 'var(--chart-3)' },
]

function formatDateTick(dateStr: string, granularity: Granularity): string {
  const d = new Date(dateStr.length === 4 ? dateStr + '-01-01T00:00:00.000Z' : dateStr + 'T00:00:00.000Z')
  if (isNaN(d.getTime())) return dateStr
  const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  const day = d.getUTCDate()
  const year = d.getUTCFullYear()

  switch (granularity) {
    case 'year':
      return String(year)
    case 'monthly':
      return `${month} ${year}`
    case 'weekly':
    case 'daily':
      return `${month} ${day}`
    case 'all':
    default:
      return `${month} ${day}`
  }
}

export default function TokenUsageChart({
  data,
  granularity,
  onGranularityChange,
}: TokenUsageChartProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>Token Usage</h3>
        <GranularityFilter value={granularity} onChange={onGranularityChange} />
      </div>
      <div style={{ width: '100%', height: 320 }} aria-label="Token usage line chart with 5 series">
        {data.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            No data available
          </div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                stroke="var(--text-secondary)"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => formatDateTick(v, granularity)}
              />
              <YAxis
                stroke="var(--text-secondary)"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => formatNumber(v)}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                }}
                formatter={(value, name) => [
                  formatNumber(typeof value === 'number' ? value : 0),
                  String(name),
                ]}
                labelFormatter={(label) => formatDateTick(String(label), granularity)}
              />
              <Legend />
              {lineConfigs.map((cfg) => (
                <Line
                  key={cfg.dataKey}
                  type="monotone"
                  dataKey={cfg.dataKey}
                  name={cfg.name}
                  stroke={cfg.stroke}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc -b`
Expected: No type errors.

**Definition of Done:**
- 5 lines rendered with distinct colors: chart-1 (Input), chart-4 (Cache Read), chart-5 (Cache Miss), chart-2 (Output), chart-3 (Reasoning)
- Legend identifies each line by name
- Granularity filter shows Daily/Weekly/Monthly/Year/All buttons
- X-axis labels format correctly per granularity
- Y-axis uses `formatNumber()` (K/M/B)
- Tooltip shows formatted date, line name, and formatted token count
- Empty data shows "No data available" message
- Smooth `type="monotone"` curves on all lines

---

## Task 9: Create `ModelUsageChart` component

**Files:**
- Create: `src/components/ModelUsageChart.tsx`

**Dependencies:** Tasks 1, 4, 6 (formatNumber, ModelUsageBarItem, computeTopModelsForBar)

- [ ] **Step 1: Create the component**

Create `src/components/ModelUsageChart.tsx`:

```typescript
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { ModelUsageBarItem } from '../types/index.ts'
import { formatNumber } from '../utils/costCalculator.ts'

interface ModelUsageChartProps {
  data: ModelUsageBarItem[]
}

const modelColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
]

export default function ModelUsageChart({ data }: ModelUsageChartProps) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>Model Usage</h3>
      </div>
      <div style={{ width: '100%', height: 320 }} aria-label="Model usage vertical bar chart">
        {data.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            No data available
          </div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="label"
                stroke="var(--text-secondary)"
                tick={{ fontSize: 11 }}
              />
              <YAxis
                stroke="var(--text-secondary)"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => formatNumber(v)}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                }}
                formatter={(value: number | string) => [
                  formatNumber(typeof value === 'number' ? value : 0),
                  'Total Tokens',
                ]}
                labelFormatter={(label) => String(label)}
              />
              <Legend />
              {data.map((item, index) => (
                <Bar
                  key={item.label}
                  dataKey="totalTokens"
                  name={item.label}
                  fill={modelColors[index % modelColors.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc -b`
Expected: No type errors. If the `<Bar>` with `dataKey="totalTokens"` but only one bar per entry causes Recharts to render all bars with the same data key, verify the approach works: each bar has the same `dataKey` but a unique `name`. Recharts `<Legend>` and tooltip will use the `name` prop.

**Definition of Done:**
- At most 4 vertical bars, one per model
- Each bar has distinct color from `modelColors` array
- X-axis shows model names
- Y-axis uses `formatNumber()` (K/M/B)
- Legend identifies each bar by model name
- Tooltip shows model name + formatted total tokens
- Empty data shows "No data available"
- Single model shows 1 bar (not 4)

---

## Task 10: Create `CostChart` component

**Files:**
- Create: `src/components/CostChart.tsx`

**Dependencies:** Tasks 1, 2, 4, 5, 6 (formatNumber, formatCost, Granularity type, GranularityFilter, chart data)

- [ ] **Step 1: Create the component**

Create `src/components/CostChart.tsx`:

```typescript
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { Granularity, DailyCostPoint } from '../types/index.ts'
import GranularityFilter from './GranularityFilter.tsx'
import { formatNumber, formatCost } from '../utils/costCalculator.ts'

interface CostChartProps {
  data: DailyCostPoint[]
  granularity: Granularity
  onGranularityChange: (g: Granularity) => void
}

function formatDateTick(dateStr: string, granularity: Granularity): string {
  const d = new Date(dateStr.length === 4 ? dateStr + '-01-01T00:00:00.000Z' : dateStr + 'T00:00:00.000Z')
  if (isNaN(d.getTime())) return dateStr
  const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  const day = d.getUTCDate()
  const year = d.getUTCFullYear()

  switch (granularity) {
    case 'year':
      return String(year)
    case 'monthly':
      return `${month} ${year}`
    case 'weekly':
    case 'daily':
      return `${month} ${day}`
    case 'all':
    default:
      return `${month} ${day}`
  }
}

export default function CostChart({
  data,
  granularity,
  onGranularityChange,
}: CostChartProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>Cost</h3>
        <GranularityFilter value={granularity} onChange={onGranularityChange} />
      </div>
      <div style={{ width: '100%', height: 320 }} aria-label="Cost line chart">
        {data.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            No cost data
          </div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                stroke="var(--text-secondary)"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => formatDateTick(v, granularity)}
              />
              <YAxis
                stroke="var(--text-secondary)"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => '$' + formatNumber(v)}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                }}
                formatter={(value) => [
                  formatCost(typeof value === 'number' ? value : 0),
                  'Cost',
                ]}
                labelFormatter={(label) => formatDateTick(String(label), granularity)}
              />
              <Line
                type="monotone"
                dataKey="cost"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc -b`
Expected: No type errors.

**Definition of Done:**
- Single smooth line for cost, `var(--accent)` color
- Granularity filter with Daily/Weekly/Monthly/Year/All
- X-axis date formatting matches TokenUsageChart (shared logic)
- Y-axis uses `'$' + formatNumber(v)` (e.g., `$1.2K`, `$500`, `$3M`)
- Tooltip shows `formatCost()` with `$` prefix and 2 decimal places
- Empty data shows "No cost data"
- No crash when pricing data is missing (treats as $0)

---

## Task 11: Rewire `Overview.tsx` — remove old sections, wire new charts

**Files:**
- Modify: `src/pages/Overview.tsx`

**Dependencies:** All preceding tasks (1–10)

- [ ] **Step 1: Update imports**

Replace the imports section (lines 1–31) with:

```typescript
import { useEffect, useState, useMemo } from 'react'
import {
  loadOverviewStats,
  loadTokenUsage,
  loadSessions,
  loadModels,
  loadProviders,
} from '../utils/dataLoader.ts'
import {
  buildPricingMap,
  computeKeyMetrics,
  aggregateTokenUsageForChart,
  aggregateCostForChart,
  computeTopModelsForBar,
} from '../utils/overviewDataProcessor.ts'
import SummaryCard from '../components/SummaryCard.tsx'
import ErrorMessage from '../components/ErrorMessage.tsx'
import TokenUsageChart from '../components/TokenUsageChart.tsx'
import ModelUsageChart from '../components/ModelUsageChart.tsx'
import CostChart from '../components/CostChart.tsx'
import type { OverviewStats, Session, ModelInfo, ProviderInfo, Granularity } from '../types/index.ts'
import type { TokenUsageData } from '../utils/dataLoader.ts'
```

- [ ] **Step 2: Remove unused state variables and replace with new ones**

In the component body, remove:
```typescript
const [activityRange, setActivityRange] = useState<TimeRange>('30d')
const [costRange, setCostRange] = useState<TimeRange>('30d')
const [modelSortBy, setModelSortBy] = useState<'tokens' | 'cost'>('tokens')
```

Add:
```typescript
const [tokenGranularity, setTokenGranularity] = useState<Granularity>('daily')
const [costGranularity, setCostGranularity] = useState<Granularity>('daily')
```

- [ ] **Step 3: Remove unused `useMemo` computations**

Remove these `useMemo` blocks (lines 133–163):
- `tokenComposition`
- `dailyActivity`
- `dailyCost`
- `topModels`
- `topProjects`
- `recentSessions`
- `heatmapData`

Also remove the now-unused `loadMessages` import from `dataLoader.ts` and the `messages` state (line 67). The `useViewportWidth` hook on line 33 can stay.

- [ ] **Step 4: Add new `useMemo` computations**

After the `metrics` useMemo (around line 128–131), add:

```typescript
const tokenUsageChartData = useMemo(() => {
  if (!tokenUsage) return []
  return aggregateTokenUsageForChart(tokenUsage, tokenGranularity)
}, [tokenUsage, tokenGranularity])

const costChartData = useMemo(() => {
  return aggregateCostForChart(sessions, pricingMap, costGranularity)
}, [sessions, pricingMap, costGranularity])

const modelUsageData = useMemo(() => {
  if (!tokenUsage) return []
  return computeTopModelsForBar(tokenUsage)
}, [tokenUsage])
```

- [ ] **Step 5: Replace the JSX sections**

Remove Sections 2 (Trends, lines 217–242), 3 (Breakdowns, lines 244–268), and 4 (Recent Activity, lines 270–281).

Replace with three new sections:

```tsx
{/* Section 2: Charts */}
<section style={{ marginBottom: 32 }}>
  <h2 style={{ fontSize: 18, marginBottom: 16 }}>Charts</h2>
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(360px, 1fr))',
      gap: 16,
    }}
  >
    <div style={chartContainerStyle}>
      <TokenUsageChart
        data={tokenUsageChartData}
        granularity={tokenGranularity}
        onGranularityChange={setTokenGranularity}
      />
    </div>
    <div style={chartContainerStyle}>
      <CostChart
        data={costChartData}
        granularity={costGranularity}
        onGranularityChange={setCostGranularity}
      />
    </div>
    <div style={chartContainerStyle}>
      <ModelUsageChart data={modelUsageData} />
    </div>
  </div>
</section>
```

- [ ] **Step 6: Run type check and lint**

Run: `npx tsc -b`
Expected: No type errors.

Run: `npm run lint`
Expected: No lint warnings or errors.

- [ ] **Step 7: Verify data synchronization (FR-08)**

Confirm by code review:
- Total Tokens card: `tokenUsage.byDay.reduce((sum, d) => sum + d.input + d.output + d.cache, 0)` — same data source as Token Usage chart when granularity is `all` (`byDay`).
- Estimated Cost card: computed from `sessions` (line 96–109) — same source as `aggregateCostForChart()`.
- All token cards use `tokenUsage.byDay` — consistent with Token Usage chart.
- Model count on Models card = `models.filter(m => configuredProviderIds.has(m.provider)).length` — this is all models, which is ≥ top 4. This is correct per requirements (card shows total, chart shows top 4).

**Definition of Done:**
- Overview page renders with Key Metrics section (9 cards in order) + Charts section (3 charts)
- No references to `TokenCompositionChart`, `DailyActivityChart`, `CostTrendChart`, `TopModelsChart`, `ProjectActivityChart`, `ActivityHeatmap`, `RecentSessionsList`
- No unused `useMemo` blocks (no `tokenComposition`, `dailyActivity`, `dailyCost`, `topModels`, `topProjects`, `recentSessions`, `heatmapData`)
- No unused state variables (`activityRange`, `costRange`, `modelSortBy`)
- No unused `loadMessages` import
- `tsc -b` passes with `noUnusedLocals: true`
- `npm run lint` passes
- Three charts render side-by-side on desktop, stacked on mobile
- Granularity knob on Token Usage and Cost charts works independently
- Empty states: charts show "No data available" / "No cost data" when data is empty
- Total Tokens card value equals sum of all token chart data (All / daily granularity)

---

## Dependency Order

```
1 ─┬─ 2 ─┬─ 3 ─ 4 ─ 5 ─ 6 ─ 7 ─ 8 ─ 9 ─ 10 ─ 11
  │      │                        │        │
  └──────┴────────────────────────┴────────┘
         (format utilities needed by nearly all later tasks)
```

- Tasks 1 and 2 are independent foundational utilities
- Task 3 (sync script) can be done in parallel with 1, 2
- Task 4 (types) depends on 3 producing `byYear`
- Task 5 (GranularityFilter) depends on 4 for `Granularity` type
- Task 6 (data processors) depends on 1, 2, 4 (utilities + types)
- Task 7 (card reorder) depends on 1, 2 (format functions)
- Task 8 (TokenUsageChart) depends on 1, 4, 5, 6
- Task 9 (ModelUsageChart) depends on 1, 4, 6
- Task 10 (CostChart) depends on 1, 2, 4, 5, 6
- Task 11 (Overview rewiring) depends on ALL (1–10)

In practice: 1 → 2 → 3 → 4 → 5 → 6 → (7 || 8 || 9 || 10 in any order) → 11

---

## Risks & Alternatives

| Risk | Mitigation |
|------|------------|
| **Recharts `<Bar>` with same `dataKey` for multiple `<Bar>` elements** — in ModelUsageChart, all bars share `dataKey="totalTokens"`. Recharts may collapse them. | **Mitigation:** Use a single `<Bar>` and map data to individual entries with `fill` set per-entry. **Alternative:** If collapsing occurs, restructure data as `[{ label, totalTokens, fill }]` and use a single `<Bar dataKey="totalTokens">` with `fill` derived from the entry via Recharts `cell` approach or accept that bars share the same key but unique names handle legend/tooltip. |
| **`byYear` aggregation assumes `created_at` timestamps are valid** — malformed dates would produce `NaN` year keys. | **Mitigation:** The `isNaN(date.getTime())` guard already exists in the loop; it skips invalid dates for all maps including `yearMap`. |
| **Cost chart computes cost client-side from sessions** — large session counts (>10k) could cause performance issues on slow devices. | **Mitigation:** The `useMemo` hook caches results; re-aggregation only happens when sessions, pricingMap, or granularity change. **Alternative:** If perf degradation is observed, add pre-aggregated cost arrays to the sync script in a future iteration. |
| **Model Usage chart shows fewer than 4 bars** — by design per FR-06b (if fewer than 4 models have data). This is correct, not a bug. | No action needed. |
| **`TokenUsageData` name collision** between `types/index.ts` (line 126) and `dataLoader.ts` (line 14). | **Mitigation:** They live in different modules and are imported with different paths. Overview.tsx imports the one from `dataLoader.ts`. No collision occurs. |
| **Removing `/api/sync` dependency** — the sync script is for local development only; production builds use pre-generated JSON. | No action needed; existing pattern is maintained. |

---

## Self-Review Checklist

### 1. Spec Coverage
- [x] **FR-01 (formatNumber B suffix):** Task 1
- [x] **FR-02 (formatCost 2 decimals):** Task 2
- [x] **FR-03 (card reorder):** Task 7
- [x] **FR-04 (remove old sections):** Task 11
- [x] **FR-05 (Token Usage chart):** Task 8
- [x] **FR-06 (Model Usage chart):** Task 9
- [x] **FR-07 (Cost chart):** Task 10
- [x] **FR-08 (data sync):** Task 11 Step 7
- [x] **FR-09 (empty/error states):** Tasks 8, 9, 10 (inline empty state handling)
- [x] **FR-10 (byYear sync script):** Tasks 3, 4
- [x] **NFR-01 (useMemo):** Task 11 (new useMemos)
- [x] **NFR-02 (ResponsiveContainer):** Tasks 8, 9, 10 (all use ResponsiveContainer)
- [x] **NFR-03 (aria-labels):** Tasks 5 (aria-pressed), 8, 9, 10 (aria-label on chart containers)
- [x] **NFR-04 (visual consistency):** Tasks 8, 9, 10 use chartContainerStyle from Overview (bg-secondary, borderRadius 10, padding 16, border)
- [x] **NFR-05 (reusable filter):** Task 5 (GranularityFilter component)
- [x] **NFR-06 (type safety):** Task 4 (types in index.ts), Tasks 6, 8, 9, 10 use `import type`
- [x] **NFR-07 (no new deps):** No npm install commands in any task
- [x] **C-01 to C-08 (constraints):** All addressed

### 2. Placeholder Scan
- No "TBD", "TODO", "implement later", or "fill in details" found in any task step
- No "Add appropriate error handling" without actual code
- All code steps contain complete, compilable TypeScript/JavaScript
- No references to types not defined in a prior task

### 3. Type Consistency
- `Granularity`: defined in Task 4, used in Tasks 5, 6, 8, 10, 11 — consistent
- `TokenUsageChartPoint`: defined in Task 4, used in Tasks 6, 8 — consistent
- `ModelUsageBarItem`: defined in Task 4, used in Tasks 6, 9 — consistent
- `aggregateTokenUsageForChart()`: defined in Task 6, imported in Task 11 — signature matches
- `aggregateCostForChart()`: defined in Task 6, imported in Task 11 — signature matches
- `computeTopModelsForBar()`: defined in Task 6, imported in Task 11 — signature matches
- `GranularityFilter`: defined in Task 5, imported in Tasks 8, 10 — props interface matches
- `formatNumber()`: extended in Task 1, used in Tasks 6, 7, 8, 9, 10 — consistent
- `formatCost()`: modified in Task 2, used in Tasks 7, 10 — consistent

---
Version: 1 | Author: planner | Ref: requirements v2 | Date: 2026-05-25

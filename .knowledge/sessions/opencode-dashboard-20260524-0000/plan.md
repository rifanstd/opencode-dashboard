# Overview Page Key Metrics Restructuring — Implementation Plan

> **For the Orchestrator:** The Orchestrator delegates this plan to the Programmer for execution. After implementation, the Orchestrator delegates to the Reviewer for code review. Do NOT dispatch subagents directly — the Orchestrator manages the multi-agent pipeline.

**Goal:** Restructure the Overview page Key Metrics section: replace 7 existing metric cards with 4 new ones, change Total Tokens formula to exclude reasoning, apply K/M number formatting across all cards, add providers data loading, and remove reasoning tokens from the TokenComposition donut chart and TopModels bar chart.

**Architecture:** All changes are within the existing client-side React dashboard. A new `formatNumber` utility in `costCalculator.ts` handles K/M formatting. `computeKeyMetrics()` in `overviewDataProcessor.ts` is refactored to produce the new card set with a reduced parameter list. `Overview.tsx` gains a providers data fetch and passes models/providers counts into `computeKeyMetrics`. Chart components lose reasoning segments/bars but the underlying data types are unchanged.

**Tech Stack:** React 19, TypeScript (verbatimModuleSyntax, erasableSyntaxOnly), Zustand, Recharts, Vite

**Reference:** Requirements: `.knowledge/sessions/opencode-dashboard-20260524-0000/requirements.md` v1

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/utils/costCalculator.ts` | **Modify** | Add `formatNumber()` utility for K/M formatting |
| `src/utils/overviewDataProcessor.ts` | **Modify** | Refactor `computeKeyMetrics()` (remove/add cards, new params, dead code cleanup), remove reasoning from `computeTokenComposition()` |
| `src/components/TopModelsChart.tsx` | **Modify** | Remove reasoning `<Bar>` from the stacked bar chart |
| `src/pages/Overview.tsx` | **Modify** | Add `loadProviders()` fetch, `ProviderInfo[]` state, update `computeKeyMetrics()` call signature |

---

## Task Breakdown

### Task 1: Add `formatNumber()` utility to costCalculator.ts

**Files:**
- Modify: `src/utils/costCalculator.ts`

**Dependency:** None (first task)

**Complexity:** Low

- [ ] **Step 1: Read the current file**

Read `src/utils/costCalculator.ts` to confirm the module structure. The file exports `Pricing`, `calculateCost`, `formatCost`, and `loadPricing`.

- [ ] **Step 2: Add the `formatNumber` function**

Insert the following function after the existing `formatCost` export (after line 24):

```typescript
/**
 * Formats a number with K/M suffix for compact display.
 * - < 1000: standard locale formatting (e.g., "999")
 * - >= 1000 and < 1000000: X.XK with trailing ".0" stripped (e.g., 1500 → "1.5K", 1000 → "1K")
 * - >= 1000000: X.XM with trailing ".0" stripped (e.g., 2500000 → "2.5M", 2000000 → "2M")
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (value < 1000) return Math.round(value).toLocaleString()
  if (value < 1000000) {
    const k = value / 1000
    const formatted = k.toFixed(1)
    return formatted.endsWith('.0') ? formatted.slice(0, -2) + 'K' : formatted + 'K'
  }
  const m = value / 1000000
  const formatted = m.toFixed(1)
  return formatted.endsWith('.0') ? formatted.slice(0, -2) + 'M' : formatted + 'M'
}
```

- [ ] **Step 3: Verify type-checking**

Run: `npx tsc -b --noEmit`
Expected: No errors related to `costCalculator.ts`. The new export must be valid under `verbatimModuleSyntax` (it is a value export, so correct).

---

### Task 2: Refactor `computeKeyMetrics()` and `computeTokenComposition()` in overviewDataProcessor.ts

**Files:**
- Modify: `src/utils/overviewDataProcessor.ts`

**Dependency:** Task 1 (uses `formatNumber`)

**Complexity:** High

This task makes three categories of changes in a single file:
1. Refactor `computeKeyMetrics()` — remove 7 cards, add 4 cards, change Total Tokens formula, remove dead code, update signature
2. Refactor `computeTokenComposition()` — remove reasoning from donut segments

- [ ] **Step 1: Read the current file state**

Read `src/utils/overviewDataProcessor.ts` to confirm no unexpected changes since the plan was written.

- [ ] **Step 2: Update imports**

**Change line 18**, replacing the `formatCost` import with both `formatCost` and `formatNumber`:

```typescript
import { calculateCost, formatCost, formatNumber } from './costCalculator.ts'
```

- [ ] **Step 3: Add a helper function for field-specific token range sums**

Insert the following function **after** the existing `sumTokensInRange` function (after line 70), before `computeCostInRange`:

```typescript
function sumTokenFieldInRange<T extends { created_at: string }>(
  items: T[],
  field: (item: T) => number,
  start: string,
  end: string
): number {
  let sum = 0
  for (const item of items) {
    const d = item.created_at.slice(0, 10)
    if (d >= start && d <= end) sum += field(item)
  }
  return sum
}
```

- [ ] **Step 4: Replace the `computeKeyMetrics` function signature**

**Replace lines 121–129** (the function signature block) with the new signature that removes unused params (`messages`, `parts`, `_models`) and adds `modelsCount` and `providersCount`:

```typescript
export function computeKeyMetrics(
  sessions: Session[],
  overview: OverviewStats,
  tokenUsage: TokenUsageData,
  pricingMap: Map<string, Pricing>,
  modelsCount: number,
  providersCount: number
): MetricCardData[] {
```

- [ ] **Step 5: Update the Total Tokens formula**

**Replace lines 133–134** (the `totalTokens` computation that currently sums `input + output + reasoning + cache`) with the new formula that excludes reasoning:

```typescript
  // Totals
  const totalTokens =
    tokenUsage.byDay.reduce((sum, d) => sum + d.input + d.output + d.cache, 0)

  // Total input tokens from byDay (for Input Tokens card)
  const totalInputTokens =
    tokenUsage.byDay.reduce((sum, d) => sum + d.input, 0)

  // Total cache tokens from byDay (for Cache card)
  const totalCacheTokens =
    tokenUsage.byDay.reduce((sum, d) => sum + d.cache, 0)
```

- [ ] **Step 6: Keep the total cost computation**

Keep lines 136–151 (the total cost loop) unchanged.

- [ ] **Step 7: Keep the period window date calculations**

Keep lines 153–159 (last7Start, prev7Start, etc.) unchanged.

- [ ] **Step 8: Replace comparison calculations — keep what's needed, add what's new**

**Replace lines 161–196** (from `sessions7d` through the `avgTokensPerSession` calculation) with only the needed comparisons:

```typescript
  // Comparisons
  const sessions30d = countInDateRange(sessions, last30Start, today)
  const sessionsPrev30d = countInDateRange(sessions, prev30Start, prev30End)
  const sessions30dDiff = sessions30d - sessionsPrev30d

  const tokens7d = sumTokensInRange(sessions, last7Start, today)
  const tokensPrev7d = sumTokensInRange(sessions, prev7Start, prev7End)
  const tokensPct = tokensPrev7d > 0 ? Math.round(((tokens7d - tokensPrev7d) / tokensPrev7d) * 100) : 0

  const inputTokens7d = sumTokenFieldInRange(sessions, (s) => s.input_tokens, last7Start, today)
  const inputTokensPrev7d = sumTokenFieldInRange(sessions, (s) => s.input_tokens, prev7Start, prev7End)
  const inputTokensPct = inputTokensPrev7d > 0
    ? Math.round(((inputTokens7d - inputTokensPrev7d) / inputTokensPrev7d) * 100)
    : 0

  const cacheTokens7d = sumTokenFieldInRange(sessions, (s) => s.cache_tokens, last7Start, today)
  const cacheTokensPrev7d = sumTokenFieldInRange(sessions, (s) => s.cache_tokens, prev7Start, prev7End)
  const cacheTokensPct = cacheTokensPrev7d > 0
    ? Math.round(((cacheTokens7d - cacheTokensPrev7d) / cacheTokensPrev7d) * 100)
    : 0

  const cost7d = computeCostInRange(sessions, pricingMap, last7Start, today)
  const costPrev7d = computeCostInRange(sessions, pricingMap, prev7Start, prev7End)
  const costPct = costPrev7d > 0 ? Math.round(((cost7d - costPrev7d) / costPrev7d) * 100) : 0
```

- [ ] **Step 9: Replace the cards array**

**Replace lines 198–253** (the `const cards: MetricCardData[] = [...]` block) with the new 7-card array:

```typescript
  const cards: MetricCardData[] = [
    {
      label: 'Total Sessions',
      value: formatNumber(overview.totalSessions),
      subLabel: sessions30dDiff !== 0 ? `${sessions30dDiff > 0 ? '+' : ''}${sessions30dDiff} vs last 30 days` : undefined,
      trend: sessions30dDiff > 0 ? 'up' : sessions30dDiff < 0 ? 'down' : 'neutral',
    },
    {
      label: 'Total Tokens',
      value: formatNumber(totalTokens),
      subLabel: tokensPct !== 0 ? `${tokensPct > 0 ? '+' : ''}${tokensPct}% vs last 7 days` : undefined,
      trend: tokensPct > 0 ? 'up' : tokensPct < 0 ? 'down' : 'neutral',
    },
    {
      label: 'Input Tokens',
      value: formatNumber(totalInputTokens),
      subLabel: inputTokensPct !== 0 ? `${inputTokensPct > 0 ? '+' : ''}${inputTokensPct}% vs last 7 days` : undefined,
      trend: inputTokensPct > 0 ? 'up' : inputTokensPct < 0 ? 'down' : 'neutral',
    },
    {
      label: 'Cache',
      value: formatNumber(totalCacheTokens),
      subLabel: cacheTokensPct !== 0 ? `${cacheTokensPct > 0 ? '+' : ''}${cacheTokensPct}% vs last 7 days` : undefined,
      trend: cacheTokensPct > 0 ? 'up' : cacheTokensPct < 0 ? 'down' : 'neutral',
    },
    {
      label: 'Models',
      value: formatNumber(modelsCount),
      subLabel: 'Available models from all providers',
    },
    {
      label: 'Providers',
      value: formatNumber(providersCount),
      subLabel: 'Connected providers',
    },
    {
      label: 'Estimated Cost',
      value: totalCost < 1000 ? formatCost(totalCost) : '$' + formatNumber(totalCost),
      subLabel: costPct !== 0 ? `${costPct > 0 ? '+' : ''}${costPct}% vs last 7 days` : undefined,
      trend: costPct > 0 ? 'up' : costPct < 0 ? 'down' : 'neutral',
    },
  ]
```

- [ ] **Step 10: Remove the dead `computeToolCallMetrics` call — cleanup imports**

Remove the unused `Part` import from the type imports at the top of the file. **Change lines 1–6**:

```typescript
import type {
  Session,
  ModelInfo,
  OverviewStats,
  TimeRange,
  MetricCardData,
  DonutSegment,
  DailyCostPoint,
  ModelBreakdownItem,
  ProjectBreakdownItem,
  RecentSessionRow,
  HeatmapData,
  TimeSeriesData,
} from '../types/index.ts'
```

(Remove `Message` and `Part` from the import. `ModelInfo` is still needed for `buildPricingMap` and its signature.)

- [ ] **Step 11: Refactor `computeTokenComposition()` — remove reasoning segment**

**Replace lines 256–280** (the `computeTokenComposition` function) with the version that excludes reasoning:

```typescript
export function computeTokenComposition(tokenUsage: TokenUsageData): DonutSegment[] {
  const input = tokenUsage.byDay.reduce((sum, d) => sum + d.input, 0)
  const output = tokenUsage.byDay.reduce((sum, d) => sum + d.output, 0)
  const cache = tokenUsage.byDay.reduce((sum, d) => sum + d.cache, 0)
  const total = input + output + cache

  if (total === 0) {
    return [
      { name: 'Input', value: 0, color: 'var(--chart-1)' },
      { name: 'Output', value: 0, color: 'var(--chart-2)' },
      { name: 'Cache', value: 0, color: 'var(--chart-4)' },
    ]
  }

  return [
    { name: 'Input', value: input, color: 'var(--chart-1)' },
    { name: 'Output', value: output, color: 'var(--chart-2)' },
    { name: 'Cache', value: cache, color: 'var(--chart-4)' },
  ]
}
```

Note: The segments keep their original CSS variable colors — Input stays `chart-1`, Output stays `chart-2`, Cache stays `chart-4`. `chart-3` (formerly Reasoning) goes unused by this chart. No color remapping is needed.

- [ ] **Step 12: Verify type-checking**

Run: `npx tsc -b --noEmit`
Expected: Zero type errors. The `computeKeyMetrics` signature change will cause an error in `Overview.tsx` if the call site isn't updated — that's expected and will be fixed in Task 5.

---

### Task 3: Remove reasoning bar from TopModelsChart

**Files:**
- Modify: `src/components/TopModelsChart.tsx`

**Dependency:** None (independent of Tasks 1–2)

**Complexity:** Low

- [ ] **Step 1: Read the current file state**

Read `src/components/TopModelsChart.tsx` to confirm the file content matches the plan assumptions.

- [ ] **Step 2: Remove the reasoning `<Bar>` element**

**Delete line 93** (the reasoning bar):
```tsx
             <Bar dataKey="reasoning" stackId="a" fill={colors.reasoning} />
```

This line sits between the output bar (line 92) and the cache bar (line 94). After removal, the file should have exactly three `<Bar>` elements: `input`, `output`, and `cache`.

- [ ] **Step 3: Verify type-checking**

Run: `npx tsc -b --noEmit`
Expected: No errors. The `ModelBreakdownItem` type still has a `reasoning` field, but since we're just removing a rendered element (not accessing the field), TypeScript has no issue.

---

### Task 4: (Optional cleanup) Remove unused `reasoning` color from TopModelsChart

**Files:**
- Modify: `src/components/TopModelsChart.tsx`

**Dependency:** Task 3

**Complexity:** Low

This is an optional cleanup step. The `reasoning` color key in the `colors` object is now orphaned but causes no runtime issues. Remove it for cleanliness.

- [ ] **Step 1: Remove the `reasoning` entry from the colors object**

**Change lines 19–24** from:

```typescript
const colors = {
  input: 'var(--chart-1)',
  output: 'var(--chart-2)',
  reasoning: 'var(--chart-3)',
  cache: 'var(--chart-4)',
}
```

To:

```typescript
const colors = {
  input: 'var(--chart-1)',
  output: 'var(--chart-2)',
  cache: 'var(--chart-4)',
}
```

- [ ] **Step 2: Verify type-checking**

Run: `npx tsc -b --noEmit`
Expected: No errors.

---

### Task 5: Update Overview.tsx — add providers loading and update computeKeyMetrics call

**Files:**
- Modify: `src/pages/Overview.tsx`

**Dependency:** Task 2 (needs the new `computeKeyMetrics` signature)

**Complexity:** Medium

- [ ] **Step 1: Read the current file state**

Read `src/pages/Overview.tsx` to confirm no changes since the plan was written.

- [ ] **Step 2: Add `loadProviders` to imports**

**Change lines 2–9** (the import from dataLoader) to include `loadProviders`:

```typescript
import {
  loadOverviewStats,
  loadTokenUsage,
  loadSessions,
  loadMessages,
  loadParts,
  loadModels,
  loadProviders,
} from '../utils/dataLoader.ts'
```

- [ ] **Step 3: Add `ProviderInfo` to type imports**

**Change line 30** (the type import) to include `ProviderInfo`:

```typescript
import type { OverviewStats, TimeRange, Session, Message, Part, ModelInfo, ProviderInfo } from '../types/index.ts'
```

- [ ] **Step 4: Add `providers` state**

**Add a new line after line 69** (after the `models` state declaration):

In `Overview.tsx`, after:
```typescript
  const [models, setModels] = useState<ModelInfo[]>([])
```
Add:
```typescript
  const [providers, setProviders] = useState<ProviderInfo[]>([])
```

- [ ] **Step 5: Add `loadProviders()` to the fetch `Promise.all`**

**Change lines 82–89** to include `loadProviders()`:

```typescript
        const [ov, tu, ses, msg, prt, mod, prov] = await Promise.all([
          loadOverviewStats(),
          loadTokenUsage(),
          loadSessions(),
          loadMessages(),
          loadParts(),
          loadModels(),
          loadProviders(),
        ])
```

And add the providers state setter **after line 103** (`setModels(Array.isArray(mod) ? mod : [])`):

```typescript
        setProviders(Array.isArray(prov) ? prov : [])
```

- [ ] **Step 6: Update the `computeKeyMetrics` call in useMemo**

**Change lines 116–119** (the `metrics` useMemo) to use the new signature. Replace:

```typescript
  const metrics = useMemo(() => {
    if (!overview || !tokenUsage) return []
    return computeKeyMetrics(sessions, messages, parts, models, overview, tokenUsage, pricingMap)
  }, [sessions, messages, parts, models, overview, tokenUsage, pricingMap])
```

With:

```typescript
  const modelsCount = models.length
  const providersCount = providers.filter((p) => p.configured).length

  const metrics = useMemo(() => {
    if (!overview || !tokenUsage) return []
    return computeKeyMetrics(sessions, overview, tokenUsage, pricingMap, modelsCount, providersCount)
  }, [sessions, overview, tokenUsage, pricingMap, modelsCount, providersCount])
```

Note: `modelsCount` and `providersCount` are computed outside `useMemo` so they update when the arrays change. The `providersCount` filters to only `configured: true` per Q-002 resolution.

- [ ] **Step 7: Verify with type-checking**

Run: `npx tsc -b --noEmit`
Expected: Zero type errors across the entire project. This confirms the signature change in Task 2 and the call site change in Task 5 are consistent.

- [ ] **Step 8: Verify with dev server**

Run: `npm run dev`
Then open the dashboard in a browser. Verify:
- Key Metrics section shows exactly 7 cards in order: Total Sessions, Total Tokens, Input Tokens, Cache, Models, Providers, Estimated Cost
- Values use K/M formatting (e.g., "1.5K" not "1,500")
- Total Tokens excludes reasoning (value should be smaller than before)
- Input Tokens card shows a comparison subLabel with trend indicator
- Cache card shows a comparison subLabel with trend indicator
- Models card shows static subLabel "Available models from all providers"
- Providers card shows static subLabel "Connected providers"
- Estimated Cost uses K/M formatting for values ≥ $1000
- Token Composition donut chart shows only 3 segments (Input, Output, Cache)
- Top Models bar chart shows 3 stacked bar segments per model (Input, Output, Cache)

---

## Dependency Order

```
Task 1 (formatNumber) ──→ Task 2 (computeKeyMetrics + computeTokenComposition) ──→ Task 5 (Overview.tsx)
                         Task 3 (TopModelsChart reasoning bar) ──→ Task 4 (TopModelsChart colors cleanup)
```

Task 5 requires Task 2. Tasks 3 and 4 are independent of Tasks 1–2 and can run in parallel.

Recommended execution order: **1 → 2 → 5 → 3 → 4**

---

## Risks & Alternatives

- **Risk:** Changing `computeKeyMetrics` signature (removing `messages`, `parts`, `_models` params) could break undiscovered call sites. | **Mitigation:** Grep confirmed `computeKeyMetrics` is only called from `Overview.tsx`. The type-check step will catch any missed call sites.
- **Risk:** The `formatCost` function is used by multiple components (RecentSessionsList, CostTrendChart, SessionsList, SessionDetail). Changing `formatCost` globally could regress those. | **Mitigation:** This plan does NOT change `formatCost`. The Cost card in `computeKeyMetrics` applies K/M formatting only for values ≥ $1000 by calling `formatNumber` directly, falling back to `formatCost` for values under $1000.
- **Risk:** Removing reasoning from `computeTokenComposition` changes the donut chart total and segment count. The `TokenCompositionChart` component expects an array of `DonutSegment[]` — it renders whatever it receives, so no component changes are needed. | **Mitigation:** Verified the chart component is data-agnostic.
- **Alternative (if color gap in charts is jarring):** Remap CSS variables so Cache uses `chart-3` instead of `chart-4`. This would require changing both `computeTokenComposition` and `TopModelsChart`. Current plan leaves Cache at `chart-4` to minimize changes.

---

## Self-Review Checklist

### 1. Spec Coverage

| Requirement | Task | Status |
|---|---|---|
| FR-01: Total Sessions with updated formatting | Task 2 Step 9 | ✓ |
| FR-02: Total Tokens formula excludes reasoning | Task 2 Step 5 | ✓ |
| FR-03: Input Tokens card with comparison subLabel | Task 2 Steps 8–9 | ✓ |
| FR-04: Cache card with comparison subLabel | Task 2 Steps 8–9 | ✓ |
| FR-05: Models card with static subLabel | Task 2 Step 9 | ✓ |
| FR-06: Providers card with static subLabel | Task 2 Step 9 | ✓ |
| FR-07: Remove 7 existing cards | Task 2 Step 9 (replacement) | ✓ |
| FR-08: formatNumber() utility | Task 1 Steps 2–3 | ✓ |
| FR-09: Cost K/M formatting | Task 2 Step 9 (Cost card logic) | ✓ |
| FR-10: Dead code cleanup | Task 2 Steps 8, 10 | ✓ |
| FR-11: Providers data loading in Overview | Task 5 Steps 2–5 | ✓ |
| FR-12: Remove reasoning from charts | Task 2 Step 11 (donut), Task 3 (bar) | ✓ |
| NFR-01: TypeScript safety | All tasks include `tsc -b` verification | ✓ |
| NFR-04: Fallback handling | Model/Provider counts default to 0 (from empty state init) | ✓ |

### 2. Placeholder Scan

- No "TBD", "TODO", "implement later", or "fill in details" found.
- No "add appropriate error handling" without specifics.
- All code blocks contain real executable code.
- No references to types or functions not defined in a task.

### 3. Type Consistency

- `formatNumber(value: number): string` — defined in Task 1, consumed in Task 2 Steps 9
- `computeKeyMetrics(sessions, overview, tokenUsage, pricingMap, modelsCount, providersCount)` — defined in Task 2 Step 4, called in Task 5 Step 6 with matching args
- `sumTokenFieldInRange` — defined in Task 2 Step 3, called in Task 2 Step 8
- `DonutSegment[]` — produced by updated `computeTokenComposition` in Task 2 Step 11, consumed by `TokenCompositionChart` (unchanged)
- `ProviderInfo` — imported in Task 5 Step 3, used in state declaration Task 5 Step 4
- All CSS variable references (`var(--chart-1)`, etc.) consistent between donut and bar charts

---

Version: 1 | Author: planner | Ref: requirements v1 | Date: 2026-05-24

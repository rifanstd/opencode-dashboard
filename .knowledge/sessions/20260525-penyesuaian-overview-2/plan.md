# Overview Page Enhancements v2 Implementation Plan

> **For the Orchestrator:** The Orchestrator delegates this plan to the Programmer for execution. After implementation, the Orchestrator delegates to the Reviewer for code review. Do NOT dispatch subagents directly — the Orchestrator manages the multi-agent pipeline.

**Goal:** Add lucide-react icons to 9 metric cards, create a 5-segment token composition donut chart, constrain the chart grid to 2 columns on desktop, and fix chart horizontal alignment across all 4 charts.

**Architecture:** Five targeted changes: (1) SummaryCard gains an optional `icon` prop with flexbox side-by-side layout, (2) `computeTokenComposition` expands from 3 to 5 segments, (3) existing `TokenCompositionChart` is enhanced with legend, center label, edge cases, and margin fix, (4) `Overview.tsx` wires icons via a label-keyed map and adds the 4th chart with a `1fr 1fr` grid, (5) all 4 chart components receive symmetric `margin` props for horizontal centering. The `MetricCardData` type remains unchanged — the icon mapping is purely a presentation concern in `Overview.tsx`.

**Tech Stack:** React 19, TypeScript 5, Vite, Recharts, lucide-react (new dependency)

**Reference:** Requirements: `.knowledge/sessions/20260525-penyesuaian-overview-2/requirements.md` v2

---

## Decision Points

- [ ] **DP-01: Remove "Charts" section title?** The requirements note: "Keep or remove — the 4 individual chart titles are self-describing." The plan below removes the `<h2>Charts</h2>` heading. If the Orchestrator prefers to keep it, skip the removal step in Task 5.

---

## File Manifest

| Action | File | Purpose |
|--------|------|---------|
| **Modify** | `src/components/SummaryCard.tsx` | Add `icon` prop, restructure to flex row layout |
| **Modify** | `src/utils/overviewDataProcessor.ts` | Expand `computeTokenComposition` from 3 to 5 segments (add Input, Reasoning) |
| **Enhance** | `src/components/TokenCompositionChart.tsx` | Add legend, center label, edge cases, margin fix, `formatNumber` |
| **Modify** | `src/pages/Overview.tsx` | Wire icons, add donut chart, change grid to `1fr 1fr`, remove section title |
| **Modify** | `src/components/TokenUsageChart.tsx` | Add `margin={{ left: 0, right: 8, top: 5, bottom: 5 }}` |
| **Modify** | `src/components/CostChart.tsx` | Add `margin={{ left: 0, right: 8, top: 5, bottom: 5 }}` |
| **Modify** | `src/components/ModelUsageChart.tsx` | Add `margin={{ left: 0, right: 8, top: 5, bottom: 5 }}` |
| *(none)* | `src/types/index.ts` | **Not modified** — `DonutSegment`, `MetricCardData` already support all needed fields |
| *(none)* | `package.json` | `lucide-react` added as dependency via `npm install` |

---

## Task 1: Install lucide-react

**Files:** `package.json` (auto-updated by npm), `package-lock.json` (auto-updated by npm)

**Dependencies:** None (first task)

- [ ] **Step 1.1: Install the dependency**

```bash
npm install lucide-react
```

**Expected:** Command succeeds. `package.json` now lists `"lucide-react"` under `dependencies` with a version like `^0.400.0`.

- [ ] **Step 1.2: Verify installation**

```bash
npx tsc -b --noEmit 2>&1 | head -5
```

**Expected:** No new type errors. (The package is installed but not yet imported — no impact on the build.)

---

## Task 2: Add Icon Prop to SummaryCard and Restructure Layout

**Files:**
- Modify: `src/components/SummaryCard.tsx` (all 49 lines)

**Dependencies:** Task 1 (lucide-react must be available, though the component doesn't import it directly — it accepts `React.ReactNode`)

- [ ] **Step 2.1: Update the props interface**

Change lines 1–6 from:

```tsx
interface SummaryCardProps {
  label: string
  value: string | number
  subLabel?: string
  trend?: 'up' | 'down' | 'neutral'
}
```

To:

```tsx
import type { ReactNode } from 'react'

interface SummaryCardProps {
  label: string
  value: string | number
  subLabel?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: ReactNode
}
```

- [ ] **Step 2.2: Restructure the card layout for icon support**

Change lines 20–48 (the entire component function body) from the current single `flexDirection: 'column'` div to a flex row with `justifyContent: 'space-between'`. The text group (label, value, subLabel) stays in a column on the left; the icon sits in a wrapper on the right.

Replace the function body with:

```tsx
export default function SummaryCard({ label, value, subLabel, trend, icon }: SummaryCardProps) {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 10,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
          {value}
        </div>
        {subLabel && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            {trend && trend !== 'neutral' && (
              <span style={{ color: trendColors[trend], fontWeight: 700 }}>{trendSymbols[trend]}</span>
            )}
            <span>{subLabel}</span>
          </div>
        )}
      </div>
      {icon && (
        <div
          style={{
            opacity: 0.6,
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginLeft: 12,
          }}
        >
          {icon}
        </div>
      )}
    </div>
  )
}
```

Key changes:
- Outer div: `flexDirection` removed (defaults to row), `alignItems: 'center'` for vertical centering, `justifyContent: 'space-between'` pushes icon to right.
- Text group wrapped in column flex div with `flex: 1, minWidth: 0` to prevent overflow.
- Icon conditionally rendered in a wrapper with `opacity: 0.6`, `color: var(--text-secondary)`, `flexShrink: 0`, `marginLeft: 12`.

- [ ] **Step 2.3: Type-check**

```bash
npx tsc -b
```

**Expected:** Zero errors. The `icon` prop is optional — existing callers without `icon` compile unchanged.

---

## Task 3: Expand computeTokenComposition to 5 Segments

**Files:**
- Modify: `src/utils/overviewDataProcessor.ts` lines 288–308

**Dependencies:** None (type `DonutSegment` already supports `{ name, value, color }` with no changes needed)

- [ ] **Step 3.1: Replace the computeTokenComposition function**

Replace lines 288–308 with:

```tsx
export function computeTokenComposition(tokenUsage: TokenUsageData): DonutSegment[] {
  const input = tokenUsage.byDay.reduce((sum, d) => sum + d.input, 0)
  const output = tokenUsage.byDay.reduce((sum, d) => sum + d.output, 0)
  const reasoning = tokenUsage.byDay.reduce((sum, d) => sum + d.reasoning, 0)
  const cache = tokenUsage.byDay.reduce((sum, d) => sum + d.cache, 0)
  const cacheMiss = input // same value as Input per FR-05c
  const total = input + output + reasoning + cache

  if (total === 0) {
    return [
      { name: 'Input',      value: 0, color: 'var(--chart-1)' },
      { name: 'Output',     value: 0, color: 'var(--chart-2)' },
      { name: 'Reasoning',  value: 0, color: 'var(--chart-3)' },
      { name: 'Cache Read', value: 0, color: 'var(--chart-4)' },
      { name: 'Cache Miss', value: 0, color: 'var(--chart-5)' },
    ]
  }

  return [
    { name: 'Input',      value: input,     color: 'var(--chart-1)' },
    { name: 'Output',     value: output,    color: 'var(--chart-2)' },
    { name: 'Reasoning',  value: reasoning, color: 'var(--chart-3)' },
    { name: 'Cache Read', value: cache,     color: 'var(--chart-4)' },
    { name: 'Cache Miss', value: cacheMiss, color: 'var(--chart-5)' },
  ]
}
```

Changes from current (3-segment) version:
- Added `reasoning` aggregation var (line with `.reasoning` reduce).
- `total` now includes `reasoning`.
- Both branches return 5 segments instead of 3, with ordering: Input, Output, Reasoning, Cache Read, Cache Miss.
- Colors follow the established palette: `--chart-1` through `--chart-5`.

- [ ] **Step 3.2: Type-check**

```bash
npx tsc -b
```

**Expected:** Zero errors. The return type `DonutSegment[]` is unchanged — only the array length differs.

---

## Task 4: Enhance TokenCompositionChart (Legend, Center Label, Edge Cases, Margin)

**Files:**
- Modify: `src/components/TokenCompositionChart.tsx` (currently 53 lines)

**Dependencies:** Task 3 (the data shape is 5 segments, but the component interface `DonutSegment[]` is unchanged — this task can technically run before Task 3)

- [ ] **Step 4.1: Replace the entire file**

Replace the entire contents of `src/components/TokenCompositionChart.tsx` with:

```tsx
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { DonutSegment } from '../types/index.ts'
import { formatNumber } from '../utils/costCalculator.ts'

interface TokenCompositionChartProps {
  data: DonutSegment[]
}

export default function TokenCompositionChart({ data }: TokenCompositionChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const hasData = total > 0

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>Token Composition</h3>
      </div>
      <div style={{ width: '100%', height: 320 }} aria-label="Token composition donut chart">
        {!hasData ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            No data available
          </div>
        ) : (
          <ResponsiveContainer>
            <PieChart margin={{ left: 0, right: 8, top: 5, bottom: 5 }}>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="80%"
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                stroke="var(--bg-secondary)"
                strokeWidth={2}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                }}
                formatter={(val, name) => {
                  const num = typeof val === 'number' ? val : 0
                  const pct = total > 0 ? ((num / total) * 100).toFixed(1) : '0.0'
                  return [`${formatNumber(num)} (${pct}%)`, String(name)]
                }}
              />
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                formatter={(value: string) => {
                  const segment = data.find((d) => d.name === value)
                  if (!segment) return value
                  const pct = total > 0 ? ((segment.value / total) * 100).toFixed(1) : '0.0'
                  return `${value} — ${formatNumber(segment.value)} (${pct}%)`
                }}
                wrapperStyle={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  paddingTop: 8,
                }}
              />
              {/* Center total label */}
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="central"
                style={{ fontSize: 20, fontWeight: 700, fill: 'var(--text-primary)' }}
              >
                {formatNumber(total)}
              </text>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
```

Key changes from the existing implementation:
- **Import `Legends`** from recharts and `formatNumber` from costCalculator.
- **`outerRadius` changed** from `"85%"` to `"80%"` per FR-04a.
- **`margin` prop added** to `<PieChart>`: `{{ left: 0, right: 8, top: 5, bottom: 5 }}` per FR-03b/FR-04a.
- **`<Legend>` added** below the donut (horizontal, bottom-aligned). Each legend entry shows `name — count (percentage)` using `formatNumber()`, matching FR-04e.
- **Center `<text>` added** displaying the total token count via `formatNumber()`, matching FR-04f.
- **Tooltip formatter** now uses `formatNumber()` instead of `toLocaleString()`, matching FR-04g.
- **Edge case handling**: when `total === 0`, renders "No data available" centered text instead of the chart, matching FR-04i.

- [ ] **Step 4.2: Type-check**

```bash
npx tsc -b
```

**Expected:** Zero errors. The `<text>` element is a valid SVG child of `<PieChart>` in Recharts (rendered as an overlay).

---

## Task 5: Modify Overview.tsx — Wire Icons, Donut Chart, Grid, and Section Title

**Files:**
- Modify: `src/pages/Overview.tsx` (currently 217 lines)

**Dependencies:** Tasks 2, 3, and 4 (SummaryCard with icon prop, 5-segment data processor, enhanced TokenCompositionChart)

- [ ] **Step 5.1: Add new imports**

Add the lucide-react icon imports after the existing React imports (after line 1). Insert after line 1:

```tsx
import {
  Coins,
  ArrowDownToLine,
  DatabaseZap,
  HardDrive,
  ArrowUpFromLine,
  ScrollText,
  Server,
  Cpu,
  DollarSign,
} from 'lucide-react'
```

Add `computeTokenComposition` to the import from `overviewDataProcessor.ts` on line 11. Change line 11 from:

```tsx
  computeTopModelsForBar,
```

To:

```tsx
  computeTokenComposition,
  computeTopModelsForBar,
```

Add `TokenCompositionChart` import after the existing chart imports. Insert after line 20 (`import CostChart from '../components/CostChart.tsx'`):

```tsx
import TokenCompositionChart from '../components/TokenCompositionChart.tsx'
```

- [ ] **Step 5.2: Add the icon mapping object**

Insert the icon mapping constant inside the `Overview` component function, right after the `viewportWidth` declaration (after line 64). This maps the 9 metric card labels to their corresponding lucide-react icon components (sized at 28px per FR-01b):

```tsx
  const iconMap: Record<string, React.ReactNode> = {
    'Total Tokens':    <Coins size={28} />,
    'Input Tokens':     <ArrowDownToLine size={28} />,
    'Cache Miss':       <DatabaseZap size={28} />,
    'Cache Read':       <HardDrive size={28} />,
    'Output Tokens':    <ArrowUpFromLine size={28} />,
    'Total Sessions':   <ScrollText size={28} />,
    'Providers':        <Server size={28} />,
    'Models':           <Cpu size={28} />,
    'Estimated Cost':   <DollarSign size={28} />,
  }
```

- [ ] **Step 5.3: Add donut data useMemo**

Insert after the `modelUsageData` useMemo block (after line 132). Add:

```tsx
  const donutData = useMemo(() => {
    if (!tokenUsage) return []
    return computeTokenComposition(tokenUsage)
  }, [tokenUsage])
```

- [ ] **Step 5.4: Pass icon prop to SummaryCard**

Change the SummaryCard rendering block. The current code at lines 174–182 is:

```tsx
          {metrics.map((m) => (
            <SummaryCard
              key={m.label}
              label={m.label}
              value={m.value}
              subLabel={m.subLabel}
              trend={m.trend}
            />
          ))}
```

Change to (adding the `icon` prop):

```tsx
          {metrics.map((m) => (
            <SummaryCard
              key={m.label}
              label={m.label}
              value={m.value}
              subLabel={m.subLabel}
              trend={m.trend}
              icon={iconMap[m.label]}
            />
          ))}
```

- [ ] **Step 5.5: Change chart grid to fixed 2-column on desktop**

Change the chart section grid style. The current code at lines 189–194 is:

```tsx
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 16,
          }}
        >
```

Change to (replacing `repeat(auto-fit, minmax(360px, 1fr))` with `1fr 1fr`):

```tsx
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 16,
          }}
        >
```

- [ ] **Step 5.6: Add TokenCompositionChart to the grid (4th chart, 2x2 layout)**

Insert the TokenCompositionChart wrapper div after the ModelUsageChart div (after line 213). Add:

```tsx
          <div style={chartContainerStyle}>
            <TokenCompositionChart data={donutData} />
          </div>
```

The resulting grid now has 4 children in this order:
1. TokenUsageChart (top-left)
2. CostChart (top-right)
3. ModelUsageChart (bottom-left)
4. TokenCompositionChart (bottom-right)

This satisfies FR-02c (2x2 arrangement on desktop).

- [ ] **Step 5.7: [Decision Point DP-01] Remove the "Charts" section title**

Remove the `<h2>Charts</h2>` heading if the Orchestrator approves DP-01. Change lines 187–188 from:

```tsx
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Charts</h2>
```

To:

```tsx
      <section style={{ marginBottom: 32 }}>
```

If the Orchestrator decides to KEEP the "Charts" heading, skip this step.

- [ ] **Step 5.8: Type-check**

```bash
npx tsc -b
```

**Expected:** Zero errors. All new imports (`lucide-react`, `computeTokenComposition`, `TokenCompositionChart`) are valid, `icon` prop on `SummaryCard` is optional, and `donutData` matches `DonutSegment[]`.

---

## Task 6: Fix Chart Margins on Existing 3 Chart Components

**Files:**
- Modify: `src/components/TokenUsageChart.tsx` line 47
- Modify: `src/components/CostChart.tsx` line 38
- Modify: `src/components/ModelUsageChart.tsx` line 38

**Dependencies:** None (independent cleanup task). TokenCompositionChart already has the correct margin from Task 4.

- [ ] **Step 6.1: Fix TokenUsageChart margin**

In `src/components/TokenUsageChart.tsx`, change line 47 from:

```tsx
            <LineChart data={data}>
```

To:

```tsx
            <LineChart data={data} margin={{ left: 0, right: 8, top: 5, bottom: 5 }}>
```

- [ ] **Step 6.2: Fix CostChart margin**

In `src/components/CostChart.tsx`, change line 38 from:

```tsx
            <LineChart data={data}>
```

To:

```tsx
            <LineChart data={data} margin={{ left: 0, right: 8, top: 5, bottom: 5 }}>
```

- [ ] **Step 6.3: Fix ModelUsageChart margin**

In `src/components/ModelUsageChart.tsx`, change line 38 from:

```tsx
            <BarChart data={data}>
```

To:

```tsx
            <BarChart data={data} margin={{ left: 0, right: 8, top: 5, bottom: 5 }}>
```

- [ ] **Step 6.4: Type-check**

```bash
npx tsc -b
```

**Expected:** Zero errors. `margin` is a standard Recharts prop on all chart components.

---

## Dependency Order

```
1 (install lucide-react)
  └─► 2 (SummaryCard icon prop)
        └─► 5 (Overview.tsx wiring)
               └─► depends on 3, 4 too

3 (computeTokenComposition 5-seg) ─┐
                                    ├─► 5 (Overview.tsx wiring)
4 (TokenCompositionChart enhance) ─┘

6 (chart margin fix) — independent, run last for clean verification
```

Full order: **1 → 2 → 3 → 4 → 5 → 6**

Tasks 3 and 4 can be done in parallel (or 4 before 3) since they don't share a compiler dependency — only the runtime data contract is shared, and that's already defined by the `DonutSegment` type.

---

## Acceptance Criteria (Verify After All Tasks)

1. **Run `npm run build`** — must pass with zero type errors and produce a successful Vite build.
2. **Run `npm run sync && npm run dev`** — open the Overview page.
3. **Visual check: Metric cards** — each of the 9 cards shows its lucide-react icon on the right side, with 0.6 opacity, muted color, 28px size, vertically centered. Icons don't wrap text.
4. **Visual check: Chart grid** — desktop shows exactly 2 columns (`1fr 1fr`), mobile shows single column. All 4 charts visible: Token Usage (top-left), Cost (top-right), Model Usage (bottom-left), Token Composition (bottom-right).
5. **Visual check: Donut chart** — 5 colored segments (Input, Output, Reasoning, Cache Read, Cache Miss). Legend below shows each segment name + token count + percentage. Center shows total token count. Tooltip shows formatted count + percentage.
6. **Visual check: Chart alignment** — all 4 charts appear horizontally centered within their containers (symmetric left/right padding).
7. **Verify backward compatibility** — navigate to any other page using `SummaryCard` (e.g., Sessions, Models, Projects). Cards render unchanged (no icon, no layout shift).
8. **Edge case: zero data** — if `tokenUsage.byDay` is all zeros, the donut shows "No data available" (not a blank chart).

---

## Risks & Alternatives

| Risk | Mitigation | Alternative |
|------|-----------|-------------|
| **lucide-react version mismatch** — icon names may differ across versions | Install latest stable; all 9 icons (`Coins`, `ArrowDownToLine`, `DatabaseZap`, `HardDrive`, `ArrowUpFromLine`, `ScrollText`, `Server`, `Cpu`, `DollarSign`) are long-established lucide icons present since v0.100+ | If an icon is missing, check `node_modules/lucide-react/dist/cjs/lucide-react.js` for the exact export name, or substitute a semantically similar icon |
| **Center `<text>` element not rendering** — some Recharts versions don't render custom SVG children inside PieChart | The `<text>` element is a well-known Recharts pattern; verify it appears in the DOM via browser DevTools | Use Recharts `<Label>` component on the `<Pie>` with `position="center"` as fallback |
| **Legend wrapping on narrow donut chart** — legend items may overflow on mobile | `flexWrap` is not directly controllable on Recharts `<Legend>`; the `layout="horizontal"` will naturally reflow since it's rendered inside the ResponsiveContainer | Switch to `layout="vertical"` on mobile via a media query in a parent wrapper, or accept vertical stacking |
| **`noUnusedLocals` error** — if DP-01 removes the section title but `isMobile` or other variables become unused | The `isMobile` variable is already used for both metric card grid and chart grid — it won't become unused | If any variable becomes unused, remove it or prepend `_` |

---

Version: 1 | Author: planner | Ref: requirements v2 | Date: 2026-05-25

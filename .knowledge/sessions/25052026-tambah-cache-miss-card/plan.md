# Cache Miss Card + Fix Cost & Donut — Implementation Plan

> **For the Orchestrator:** The Orchestrator delegates this plan to the Programmer for execution. After implementation, the Orchestrator delegates to the Reviewer for code review. Do NOT dispatch subagents directly — the Orchestrator manages the multi-agent pipeline.

**Goal:** Add a "Cache Miss" metric card to the Overview page, fix the donut chart to use non-overlapping segments (Cache Miss / Cache Read / Output), and fix the cost calculation to stop double-charging cache_read tokens.

**Architecture:** Two independent changes in two files — both are pure frontend logic changes. No sync script changes, no JSON schema changes, no new dependencies. The `calculateCost()` function signature stays identical; only its internal formula changes. The `computeKeyMetrics()` function gains one new card and one new trend computation. The `computeTokenComposition()` function is restructured from Input/Output/Cache Read to Cache Miss/Cache Read/Output.

**Tech Stack:** React 19 + TypeScript, Recharts (passively consumes donut data)

**Reference:** Requirements: .knowledge/sessions/25052026-tambah-cache-miss-card/requirements.md v2

---

## File Structure

| File | Role | Changes |
|---|---|---|
| `src/utils/costCalculator.ts:8-17` | `calculateCost()` — pricing formula | Fix double-count: `(input-cache)×input_price + cache×cache_price + output×output_price` |
| `src/utils/overviewDataProcessor.ts:134-266` | `computeKeyMetrics()` — metric cards | Add `totalCacheMissTokens`, 7-day trend, insert "Cache Miss" card between "Cache Read" and "Models" |
| `src/utils/overviewDataProcessor.ts:268-287` | `computeTokenComposition()` — donut chart | Restructure segments: Input→Cache Miss, keep Cache Read + Output |
| `scripts/sync-opencode-data.js` | Sync script | **NO changes** |
| `src/pages/Overview.tsx` | Overview page | **NO changes** (passive consumer of metrics array) |
| All chart components (`*.tsx`) | Charts | **NO changes** (passive consumers) |
| `src/pages/SessionsList.tsx` | Sessions list | **NO changes** (calls `calculateCost` with same signature — benefit automatically) |
| `src/pages/SessionDetail.tsx` | Session detail | **NO changes** (calls `calculateCost` with same signature — benefit automatically) |

---

## Task Breakdown

### Task 1: Fix `calculateCost()` — stop double-charging cache_read tokens

**Files:**
- Modify: `src/utils/costCalculator.ts:8-17`

**Dependency:** None (independent — can be done first or in parallel with Task 2)

- [ ] **Step 1: Change the cost formula**

  Open `src/utils/costCalculator.ts`. Find lines 11-16:

  ```ts
    const inputCost = tokens.input * (pricing.input ?? 0)
    const outputCost = tokens.output * (pricing.output ?? 0)
    const reasoningCost = (tokens.reasoning ?? 0) * (pricing.reasoning ?? 0)
    const cacheCost = (tokens.cache ?? 0) * (pricing.cache ?? 0)
    return inputCost + outputCost + reasoningCost + cacheCost
  ```

  Replace with:

  ```ts
    const cacheReadTokens = tokens.cache ?? 0
    const cacheMissTokens = tokens.input - cacheReadTokens
    const inputCost = cacheMissTokens * (pricing.input ?? 0)
    const outputCost = tokens.output * (pricing.output ?? 0)
    const reasoningCost = (tokens.reasoning ?? 0) * (pricing.reasoning ?? 0)
    const cacheCost = cacheReadTokens * (pricing.cache ?? 0)
    return inputCost + outputCost + reasoningCost + cacheCost
  ```

  **Explanation:** The old formula charged `input * input_price` which includes cache_read tokens. The new formula isolates cache_miss (`input - cache_read`) for `input_price` and applies the cheaper `cache_price` only to `cache_read` tokens. `output` and `reasoning` are unchanged.

- [ ] **Step 2: Type-check the TypeScript**

  Run: `npx tsc -b`

  Expected: No errors. Output should be silent or show "Found 0 errors".

- [ ] **Step 3: Verify build succeeds**

  Run: `npm run build`

  Expected: Build completes successfully. No TypeScript errors, no lint errors.

**Definition of Done:** `tsc -b` and `npm run build` pass. The `calculateCost()` function now uses `(input - cache_read) * input_price + cache_read * cache_price + output * output_price`. All call sites (overviewDataProcessor lines 97, 165, 309, 340, 398; SessionsList line 36; SessionDetail line 53) continue to call the function with the same object shape — no signature change needed.

**Complexity:** low

---

### Task 2: Add "Cache Miss" card + restructure donut chart

**Files:**
- Modify: `src/utils/overviewDataProcessor.ts:148-158` (add `totalCacheMissTokens`)
- Modify: `src/utils/overviewDataProcessor.ts:210-210` (add 7-day cacheMiss trend)
- Modify: `src/utils/overviewDataProcessor.ts:241-246` (insert Cache Miss card)
- Modify: `src/utils/overviewDataProcessor.ts:268-287` (restructure donut segments)

**Dependency:** None (independent of Task 1; both can be parallel)

- [ ] **Step 1: Add `totalCacheMissTokens` computation**

  Open `src/utils/overviewDataProcessor.ts`. Find lines 156-158:

  ```ts
    // Total cache tokens from byDay (for Cache card)
    const totalCacheTokens =
      tokenUsage.byDay.reduce((sum, d) => sum + d.cache, 0)
  ```

  Replace with:

  ```ts
    // Total cache tokens from byDay (for Cache card)
    const totalCacheTokens =
      tokenUsage.byDay.reduce((sum, d) => sum + d.cache, 0)

    // Total cache miss tokens = input - cache_read (computed, not stored)
    const totalCacheMissTokens = totalInputTokens - totalCacheTokens
  ```

- [ ] **Step 2: Add 7-day trend calculation for cache miss**

  Find lines 206-211 (the cacheTokens7d/cacheTokensPrev7d/cacheTokensPct block):

  ```ts
    const cacheTokens7d = sumTokenFieldInRange(sessions, (s) => s.cache_tokens, last7Start, today)
    const cacheTokensPrev7d = sumTokenFieldInRange(sessions, (s) => s.cache_tokens, prev7Start, prev7End)
    const cacheTokensPct = cacheTokensPrev7d > 0
      ? Math.round(((cacheTokens7d - cacheTokensPrev7d) / cacheTokensPrev7d) * 100)
      : 0
  ```

  Insert after this block (before the `cost7d` line):

  ```ts
    const cacheMiss7d = inputTokens7d - cacheTokens7d
    const cacheMissPrev7d = inputTokensPrev7d - cacheTokensPrev7d
    const cacheMissPct = cacheMissPrev7d > 0
      ? Math.round(((cacheMiss7d - cacheMissPrev7d) / cacheMissPrev7d) * 100)
      : 0
  ```

- [ ] **Step 3: Insert "Cache Miss" card into the metrics array**

  Find the cards array. Locate lines 241-246 (the "Cache Read" card) and lines 247-251 (the "Models" card):

  ```ts
      {
        label: 'Cache Read',
        value: formatNumber(totalCacheTokens),
        subLabel: cacheTokensPct !== 0 ? `${cacheTokensPct > 0 ? '+' : ''}${cacheTokensPct}% vs last 7 days` : undefined,
        trend: cacheTokensPct > 0 ? 'up' : cacheTokensPct < 0 ? 'down' : 'neutral',
      },
      {
        label: 'Models',
        value: formatNumber(modelsCount),
        subLabel: 'Available models from all providers',
      },
  ```

  Replace with — inserting the new "Cache Miss" card between "Cache Read" and "Models":

  ```ts
      {
        label: 'Cache Read',
        value: formatNumber(totalCacheTokens),
        subLabel: cacheTokensPct !== 0 ? `${cacheTokensPct > 0 ? '+' : ''}${cacheTokensPct}% vs last 7 days` : undefined,
        trend: cacheTokensPct > 0 ? 'up' : cacheTokensPct < 0 ? 'down' : 'neutral',
      },
      {
        label: 'Cache Miss',
        value: formatNumber(totalCacheMissTokens),
        subLabel: cacheMissPct !== 0 ? `${cacheMissPct > 0 ? '+' : ''}${cacheMissPct}% vs last 7 days` : undefined,
        trend: cacheMissPct > 0 ? 'up' : cacheMissPct < 0 ? 'down' : 'neutral',
      },
      {
        label: 'Models',
        value: formatNumber(modelsCount),
        subLabel: 'Available models from all providers',
      },
  ```

- [ ] **Step 4: Restructure `computeTokenComposition()` to use non-overlapping segments**

  Find the `computeTokenComposition` function at lines 268-287:

  ```ts
  export function computeTokenComposition(tokenUsage: TokenUsageData): DonutSegment[] {
    const input = tokenUsage.byDay.reduce((sum, d) => sum + d.input, 0)
    const output = tokenUsage.byDay.reduce((sum, d) => sum + d.output, 0)
    const cache = tokenUsage.byDay.reduce((sum, d) => sum + d.cache, 0)
    const total = input + output + cache

    if (total === 0) {
      return [
        { name: 'Input', value: 0, color: 'var(--chart-1)' },
        { name: 'Output', value: 0, color: 'var(--chart-2)' },
        { name: 'Cache Read', value: 0, color: 'var(--chart-4)' },
      ]
    }

    return [
      { name: 'Input', value: input, color: 'var(--chart-1)' },
      { name: 'Output', value: output, color: 'var(--chart-2)' },
      { name: 'Cache Read', value: cache, color: 'var(--chart-4)' },
    ]
  }
  ```

  Replace the entire function with:

  ```ts
  export function computeTokenComposition(tokenUsage: TokenUsageData): DonutSegment[] {
    const input = tokenUsage.byDay.reduce((sum, d) => sum + d.input, 0)
    const output = tokenUsage.byDay.reduce((sum, d) => sum + d.output, 0)
    const cache = tokenUsage.byDay.reduce((sum, d) => sum + d.cache, 0)
    const cacheMiss = input - cache
    const total = cacheMiss + cache + output

    if (total === 0) {
      return [
        { name: 'Cache Miss', value: 0, color: 'var(--chart-1)' },
        { name: 'Cache Read', value: 0, color: 'var(--chart-4)' },
        { name: 'Output', value: 0, color: 'var(--chart-2)' },
      ]
    }

    return [
      { name: 'Cache Miss', value: cacheMiss, color: 'var(--chart-1)' },
      { name: 'Cache Read', value: cache, color: 'var(--chart-4)' },
      { name: 'Output', value: output, color: 'var(--chart-2)' },
    ]
  }
  ```

  **Explanation:** The old donut had overlapping segments (Input, Output, Cache Read) where `input` includes `cache`. Total was `input + output + cache` = overcounted. The new donut uses non-overlapping segments: Cache Miss (input - cache_read), Cache Read, and Output. Total = `cacheMiss + cache + output = input + output` — mathematically correct. Color mapping: Cache Miss inherits the old Input color (`var(--chart-1)`), Cache Read keeps `var(--chart-4)`, Output keeps `var(--chart-2)`.

- [ ] **Step 5: Type-check the TypeScript**

  Run: `npx tsc -b`

  Expected: No errors. Verify that no "unused variable" errors appear for `totalCacheMissTokens` or `cacheMissPct` — they are consumed in the inserted card.

- [ ] **Step 6: Verify build succeeds**

  Run: `npm run build`

  Expected: Build completes successfully. No TypeScript errors, no lint errors.

**Definition of Done:**
1. `computeKeyMetrics()` returns 9 cards (was 8): Total Sessions, Total Tokens, Input Tokens, Output Tokens, Cache Read, **Cache Miss** (new), Models, Providers, Estimated Cost
2. Cache Miss card shows `totalCacheMissTokens = totalInputTokens - totalCacheTokens`
3. Cache Miss card has a 7-day trend comparison
4. `computeTokenComposition()` returns 3 non-overlapping segments: Cache Miss, Cache Read, Output
5. Donut total equals `input + output` (not `input + output + cache`)
6. `tsc -b` passes; `npm run build` passes

**Complexity:** low

---

## Dependency Order

```
Task 1 (costCalculator.ts)  ──┐
                              ├──> Build verification (both must pass together)
Task 2 (overviewDataProcessor) ─┘
```

Tasks 1 and 2 modify different files and are **independent**. They can be executed in either order or in parallel. The build verification (`tsc -b` and `npm run build`) must pass after both are applied.

---

## Risks & Alternatives

- **Risk: `cacheMissTokens` could be negative if `cache_read > input` in data**
  - **Mitigation:** This is logically impossible — `cache_read` (tokens served from cache) is always a subset of `input` (total input tokens). No mitigation needed.
  - **Alternative:** If defensive coding is desired, add `Math.max(0, tokens.input - cacheReadTokens)`, but this would mask a data integrity issue and is not recommended.

- **Risk: The donut chart re-renders incorrectly with the new segment names**
  - **Mitigation:** The `TokenCompositionChart` component reads `name` and `value` from the `DonutSegment[]` array. It does not filter or hardcode segment names. A label change from "Input" to "Cache Miss" is transparent.
  - **Alternative:** If the chart component does filter segments by name (unlikely based on code review), update the relevant component. However, inspection confirms `TokenCompositionChart` is a pure renderer — it maps over whatever array it receives.

- **Risk: The auto-fit grid now holds 9 cards (was 8) — layout overflow on narrow viewports**
  - **Mitigation:** The grid uses `repeat(auto-fit, minmax(220px, 1fr))` which handles any number of cards. Cards reflow naturally. No overflow risk.
  - **Alternative:** None needed. Verified that the grid handles dynamic card count.

- **Risk: Cache Miss trend is misleading when both input and cache trend in opposite directions**
  - **Mitigation:** This is inherent to derived metrics. The trend shows `cacheMiss7d vs cacheMissPrev7d` which is the correct derived comparison. The adjacent Input Tokens and Cache Read cards provide context.
  - **Alternative:** Could omit the trend from Cache Miss, but FR-01 explicitly requires it.

- **Risk: Estimated Cost changes (decreases) after the cost formula fix**
  - **Mitigation:** This is expected and correct behavior. The old formula overcharged by double-counting cache_read tokens at `input_price`. Users should see lower (more accurate) cost estimates. The cost trend will still show valid comparisons within the new formula.

---

## Rollback Plan

To revert all changes:

```bash
git checkout -- src/utils/costCalculator.ts src/utils/overviewDataProcessor.ts
npm run build   # verify build still passes
```

No sync script changes, no JSON changes, no dependency changes. Pure code revert.

---

## Files NOT Modified (Verified)

These files were inspected and confirmed to require **no changes** — they benefit automatically from the upstream changes:

| File | Why No Change Needed |
|---|---|
| `scripts/sync-opencode-data.js` | `cache_miss` is computed at the frontend, not stored. No SQLite query changes. |
| `src/types/index.ts` | `MetricCardData` already supports any `label: string`. `DonutSegment` already supports any `name: string`. No type changes needed. |
| `src/pages/Overview.tsx` | Renders `metrics.map()` — card count increase is handled automatically. |
| `src/pages/SessionsList.tsx` | Calls `calculateCost({ input, output, reasoning, cache })` — same signature. New formula applies automatically. |
| `src/pages/SessionDetail.tsx` | Calls `calculateCost()` — same signature. New formula applies automatically. |
| `src/pages/TokenUsage.tsx` | Uses `computeTopModels()` from overviewDataProcessor, which calls `calculateCost()` internally — new formula applies automatically. |
| `src/components/TokenCompositionChart.tsx` | Pure renderer — reads `name`, `value`, and `color` from whatever `DonutSegment[]` it receives. |
| `src/components/DailyActivityChart.tsx` | Unchanged — renders input/output/cache series from byDay data. |
| `src/components/CostTrendChart.tsx` | Unchanged — renders cost points. Cost values change but chart structure is identical. |
| `src/utils/dataLoader.ts` | Pure fetch wrapper — no token logic. |
| `src/utils/appStore.ts` | Unchanged — Zustand store has no card-related state. |

---

## Verification Steps (after both tasks complete)

1. **Run `tsc -b`** — must pass with 0 errors
2. **Run `npm run build`** — must pass with 0 errors
3. **Run `npm run dev`** and verify in browser:
   - **Overview page:** 9 cards in order: Total Sessions, Total Tokens, Input Tokens, Output Tokens, Cache Read, **Cache Miss** (NEW), Models, Providers, Estimated Cost
   - **Cache Miss card:** Value = `totalInputTokens - totalCacheTokens`. Verify math: Cache Miss + Cache Read = Input Tokens
   - **Cache Miss trend:** Shows `+X% vs last 7 days` or `-X% vs last 7 days` with correct up/down/neutral arrow
   - **Donut chart:** 3 segments — Cache Miss (chart-1), Cache Read (chart-4), Output (chart-2). No "Input" segment. Hover tooltips show correct values. Three segments sum to `input + output` (not `input + output + cache`).
   - **Estimated Cost card:** Value is lower than before (cache_read tokens no longer charged at input_price)
   - **TokenUsage page:** Cost column shows corrected values
   - **SessionsList page:** Cost column shows corrected values
   - **SessionDetail page:** Cost display shows corrected value
4. **Lint check:** `npm run lint` — should pass with no new warnings

---

## Self-Review Checklist

### 1. Spec Coverage

| Requirement | Covered By | Status |
|---|---|---|
| FR-01: Card "Cache Miss" — baru (posisi, isi, trend) | Task 2 Steps 1-3 | ✅ |
| FR-02: Card "Input Tokens" — tidak berubah | No code changes needed (verified in "Files NOT Modified") | ✅ |
| FR-03: Card "Total Tokens" — tidak berubah | No code changes needed | ✅ |
| FR-04: Token Composition donut — restruktur ke non-overlapping | Task 2 Step 4 | ✅ |
| FR-05: Cost calculation — perbaiki formula | Task 1 Step 1 | ✅ |
| NFR-01: Tidak merusak perubahan sesi sebelumnya | Both tasks use additive changes; donut restructure uses `input - cache` which respects existing semantics | ✅ |
| NFR-02: Sync script tidak berubah | Verified — no changes to `scripts/sync-opencode-data.js` | ✅ |
| NFR-03: Backward compatibility | All JSON files unchanged; only frontend processing changes | ✅ |
| NFR-04: Build tidak terpengaruh | Both tasks include `tsc -b` and `npm run build` verification | ✅ |
| NFR-05: Tidak ada dependensi baru | No package changes | ✅ |
| NFR-06: Card layout responsif | auto-fit grid handles 9 cards (verified) | ✅ |
| C-01: cache_miss = computed, not stored | Task 2 Step 1: `totalInputTokens - totalCacheTokens` | ✅ |
| C-02: Tidak mengubah definisi session.cache_tokens | No changes to cache_tokens definition | ✅ |
| C-03: public/data/ di .gitignore | No changes | ✅ |
| C-04: Tidak menambah server-side code | All changes in `src/utils/` (client-side only) | ✅ |
| C-05: verbatimModuleSyntax | No `import type` changes needed; existing imports unchanged | ✅ |

### 2. Placeholder Scan

No TBD, TODO, "implement later", "add appropriate error handling", or vague references found. All steps contain exact code blocks with line numbers. All variables are defined before use. All card properties reference defined local variables.

### 3. Type Consistency

- `totalCacheMissTokens` (number) is declared in Step 1 and consumed in Step 3 via `formatNumber(totalCacheMissTokens)` — type matches
- `cacheMiss7d`, `cacheMissPrev7d` (number) are declared in Step 2 and consumed in Step 3 via `cacheMissPct` — type matches
- `cacheMissPct` (number) is declared in Step 2 and consumed in Step 3 — type matches
- `computeTokenComposition` still returns `DonutSegment[]` with `{ name, value, color }` shape — return type unchanged
- `calculateCost` signature unchanged — all existing call sites continue to work

---

Version: 1 | Author: planner | Ref: requirements v2 | Date: 2026-05-25

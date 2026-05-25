# Implementation Plan: Penyesuaian Kartu Halaman Overview

> **For the Orchestrator:** The Orchestrator delegates this plan to the Programmer for execution. After implementation, the Orchestrator delegates to the Reviewer for code review. Do NOT dispatch subagents directly — the Orchestrator manages the multi-agent pipeline.

**Goal:** Remove cache_write tokens from the entire data pipeline (sync → frontend) and add an "Output Tokens" card to the Overview.

**Architecture:** This is a surgical data-pipeline change. The sync script is the single source of truth — changing `cache_tokens` from `cache_read + cache_write` to `cache_read` only propagates automatically through all aggregations (byModel, byProvider, byProject, byDay/Week/Month) and into every downstream consumer (charts, cost calculator, session detail). No chart or page component needs code changes — they are all passive consumers.

**Tech Stack:** Node.js (ESM) sync script, React 19 + TypeScript + Recharts frontend

**Reference:** Requirements: .knowledge/sessions/25052026-penyesuaian-halaman-overview/requirements.md v2

---

## Analysis: Why Only 2 Files Need Changes

The sync script (`scripts/sync-opencode-data.js`) is the root of the data pipeline. It reads from SQLite, computes aggregations, and writes JSON. All frontend components consume these JSONs passively.

### Propagation chain (automatic, no code changes needed):
```
sync script: session.cache_tokens = cache_read only  ├→ byModel.cache += session.cache_tokens
                                                      ├→ byProvider.cache += session.cache_tokens
                                                      ├→ byProject.cache += session.cache_tokens
                                                      ├→ byDay/Week/Month.cache += session.cache_tokens
                                                      ├→ overview.totalCacheTokens = sum(session.cache_tokens)
                                                      └→ session.total_tokens (excludes cache_write)
                            ↓
         token-usage.json (cache field now cache_read only)
                            ↓
         ALL charts read tokenUsage.*.cache → automatically correct
         ALL cost calls pass session.cache_tokens → automatically correct
         ALL pages render session.total_tokens → automatically correct
```

### What we change in frontend:
Only `overviewDataProcessor.ts` — to add the new "Output Tokens" card, rename the "Cache" card to "Cache Read", and rename the donut segment label.

---

## Task Breakdown

### Task 1: Modify sync script — drop cache_write from session and message objects

**Files:**
- Modify: `scripts/sync-opencode-data.js:188-189` (session object)
- Modify: `scripts/sync-opencode-data.js:226` (message object)

**Dependency:** None (first task)

**Steps:**

- [ ] **Step 1: Change session `cache_tokens` to cache_read only**

  Open `scripts/sync-opencode-data.js`, find line 188:
  ```js
  cache_tokens: (s.tokens_cache_read ?? 0) + (s.tokens_cache_write ?? 0),
  ```
  Replace with:
  ```js
  cache_tokens: (s.tokens_cache_read ?? 0),
  ```

- [ ] **Step 2: Change session `total_tokens` to exclude cache_write**

  Find line 189:
  ```js
  total_tokens: (s.tokens_input ?? 0) + (s.tokens_output ?? 0) + (s.tokens_reasoning ?? 0) + (s.tokens_cache_read ?? 0) + (s.tokens_cache_write ?? 0),
  ```
  Replace with:
  ```js
  total_tokens: (s.tokens_input ?? 0) + (s.tokens_output ?? 0) + (s.tokens_reasoning ?? 0) + (s.tokens_cache_read ?? 0),
  ```

- [ ] **Step 3: Change message `cache_tokens` to cache_read only**

  Find line 226:
  ```js
  cache_tokens: (cache.read ?? 0) + (cache.write ?? 0),
  ```
  Replace with:
  ```js
  cache_tokens: (cache.read ?? 0),
  ```

- [ ] **Step 4: Run sync to regenerate JSON files**

  Run: `npm run sync`
  Expected: Script runs successfully. Output should show exported sessions, messages, parts.
  Verify: Check that `public/data/sessions.json` has sessions with `cache_tokens` values that equal `tokens_cache_read` (not read+write). Check that `total_tokens` field equals `input + output + reasoning + cache_read` (no cache_write).

- [ ] **Step 5: Verify no syntax errors**

  Run: `node --check scripts/sync-opencode-data.js`
  Expected: No output (script parses without error)

**Definition of Done:** Sync script runs successfully; `sessions.json` and `messages.json` have `cache_tokens` = cache_read only; `total_tokens` = input + output + reasoning + cache_read only.

**Complexity:** low

---

### Task 2: Add "Output Tokens" card and rename "Cache" card in overview metrics

**Files:**
- Modify: `src/utils/overviewDataProcessor.ts:134-250` (`computeKeyMetrics`)
- Modify: `src/utils/overviewDataProcessor.ts:252-271` (`computeTokenComposition`)

**Dependency:** Task 1 (sync data first so JSON is consistent for manual verification after build)

**Steps:**

- [ ] **Step 1: Add output tokens trend calculation in `computeKeyMetrics`**

  Find lines 190-194 (after the input tokens trend calculation, before the cache tokens trend calculation):

  ```ts
  const inputTokens7d = sumTokenFieldInRange(sessions, (s) => s.input_tokens, last7Start, today)
  const inputTokensPrev7d = sumTokenFieldInRange(sessions, (s) => s.input_tokens, prev7Start, prev7End)
  const inputTokensPct = inputTokensPrev7d > 0
    ? Math.round(((inputTokens7d - inputTokensPrev7d) / inputTokensPrev7d) * 100)
    : 0
  ```

  Add after this block (before cache trend):

  ```ts
  const outputTokens7d = sumTokenFieldInRange(sessions, (s) => s.output_tokens, last7Start, today)
  const outputTokensPrev7d = sumTokenFieldInRange(sessions, (s) => s.output_tokens, prev7Start, prev7End)
  const outputTokensPct = outputTokensPrev7d > 0
    ? Math.round(((outputTokens7d - outputTokensPrev7d) / outputTokensPrev7d) * 100)
    : 0
  ```

- [ ] **Step 2: Add total output tokens computation**

  Find lines 149-154 (the `totalInputTokens` and `totalCacheTokens` computations):

  ```ts
  // Total input tokens from byDay (for Input Tokens card)
  const totalInputTokens =
    tokenUsage.byDay.reduce((sum, d) => sum + d.input, 0)

  // Total cache tokens from byDay (for Cache card)
  const totalCacheTokens =
    tokenUsage.byDay.reduce((sum, d) => sum + d.cache, 0)
  ```

  Add after `totalInputTokens` computation (before `totalCacheTokens`):

  ```ts
  // Total output tokens from byDay (for Output Tokens card)
  const totalOutputTokens =
    tokenUsage.byDay.reduce((sum, d) => sum + d.output, 0)
  ```

- [ ] **Step 3: Insert the "Output Tokens" card into the array and rename "Cache" to "Cache Read"**

  Find the cards array starting around line 206. Locate the "Input Tokens" card (lines 219-224) and the "Cache" card (lines 225-230).

  Replace the "Cache" card block:

  ```ts
      {
        label: 'Cache',
        value: formatNumber(totalCacheTokens),
        subLabel: cacheTokensPct !== 0 ? `${cacheTokensPct > 0 ? '+' : ''}${cacheTokensPct}% vs last 7 days` : undefined,
        trend: cacheTokensPct > 0 ? 'up' : cacheTokensPct < 0 ? 'down' : 'neutral',
      },
  ```

  With the two new cards inserted between "Input Tokens" and the old cache position:

  ```ts
      {
        label: 'Output Tokens',
        value: formatNumber(totalOutputTokens),
        subLabel: outputTokensPct !== 0 ? `${outputTokensPct > 0 ? '+' : ''}${outputTokensPct}% vs last 7 days` : undefined,
        trend: outputTokensPct > 0 ? 'up' : outputTokensPct < 0 ? 'down' : 'neutral',
      },
      {
        label: 'Cache Read',
        value: formatNumber(totalCacheTokens),
        subLabel: cacheTokensPct !== 0 ? `${cacheTokensPct > 0 ? '+' : ''}${cacheTokensPct}% vs last 7 days` : undefined,
        trend: cacheTokensPct > 0 ? 'up' : cacheTokensPct < 0 ? 'down' : 'neutral',
      },
  ```

- [ ] **Step 4: Rename "Cache" segment label to "Cache Read" in donut chart**

  Find the `computeTokenComposition` function (lines 252-271). There are two arrays that return `{ name: 'Cache', ... }` segments:

  Line 263 (zero-value case):
  ```ts
  return [
    { name: 'Input', value: 0, color: 'var(--chart-1)' },
    { name: 'Output', value: 0, color: 'var(--chart-2)' },
    { name: 'Cache', value: 0, color: 'var(--chart-4)' },
  ]
  ```

  Replace with:
  ```ts
  return [
    { name: 'Input', value: 0, color: 'var(--chart-1)' },
    { name: 'Output', value: 0, color: 'var(--chart-2)' },
    { name: 'Cache Read', value: 0, color: 'var(--chart-4)' },
  ]
  ```

  Line 269 (non-zero case):
  ```ts
  return [
    { name: 'Input', value: input, color: 'var(--chart-1)' },
    { name: 'Output', value: output, color: 'var(--chart-2)' },
    { name: 'Cache', value: cache, color: 'var(--chart-4)' },
  ]
  ```

  Replace with:
  ```ts
  return [
    { name: 'Input', value: input, color: 'var(--chart-1)' },
    { name: 'Output', value: output, color: 'var(--chart-2)' },
    { name: 'Cache Read', value: cache, color: 'var(--chart-4)' },
  ]
  ```

- [ ] **Step 5: Type-check the TypeScript**

  Run: `npx tsc -b`
  Expected: No errors. Output should be silent or show "Found 0 errors".

- [ ] **Step 6: Verify build succeeds**

  Run: `npm run build`
  Expected: Build completes successfully. No TypeScript errors, no lint errors.

- [ ] **Step 7: Manual verification — start dev server and inspect Overview page**

  Run: `npm run dev`
  Expected:
  - Overview page loads without errors
  - Key Metrics section shows 8 cards (was 7): Total Sessions, Total Tokens, Input Tokens, **Output Tokens** (new), Cache Read (was Cache), Models, Providers, Estimated Cost
  - "Output Tokens" card displays total output tokens with 7-day trend comparison
  - "Cache Read" card displays cache_read tokens only (not read+write)
  - "Total Tokens" card displays input + output + cache_read only
  - Donut chart has 3 segments: Input, Output, Cache Read
  - Cost Trend chart still renders correctly
  - Daily Activity chart shows cache series correctly
  - Top Models chart shows cache bars correctly

**Definition of Done:** Type-check passes (`tsc -b`), build passes (`npm run build`), Overview page shows 8 cards in the correct order with correct values, donut chart labels say "Cache Read".

**Complexity:** low

---

## Dependency Order

```
Task 1 (sync script) → Task 2 (frontend overview processor)
```

Task 2 depends on Task 1 because the frontend expects JSON data where `cache_tokens` is cache_read only. Running sync first ensures the data is consistent before verifying the frontend.

---

## Risks & Alternatives

- **Risk: Field name `cache_tokens` is semantically misleading after the change** — it now means "cache read" rather than "cache read + write"
  - **Mitigation:** The field name `cache_tokens` is generic enough to represent "cache-related tokens." The user explicitly chose to DROP cache_write entirely (Q-02 resolved), so there's no ambiguity about what the field contains. Renaming the field would require coordinated changes across 11+ files and the JSON schema — not worth the risk.
  - **Alternative:** If in the future cache_write needs to be reintroduced, it would require a new field `cache_write_tokens` — but the user has explicitly stated it won't be used anywhere.

- **Risk: Running `npm run sync` after the change may produce JSON with zero cache values if no data has been generated yet**
  - **Mitigation:** This is expected behavior. The sync script reads from the actual `opencode.db`. If there's no data, cards show zeros. The sync script only changes how tokens are aggregated, not what data exists.

- **Risk: The `noUnusedLocals` TypeScript option could catch the new `totalOutputTokens` or `outputTokensPct` variables if the card array insertion is done incorrectly**
  - **Mitigation:** The plan explicitly shows where to add each variable and where to consume it. If `tsc -b` fails with unused-variable errors, verify the variable is used in the inserted card.

- **Risk: Adding an 8th card may overflow the `auto-fit` grid on certain narrow viewports**
  - **Mitigation:** The grid uses `repeat(auto-fit, minmax(220px, 1fr))` which handles any number of cards. On mobile (<768px), the grid switches to single-column. No overflow risk.
  - **Alternative:** If layout issues occur, the card order can be adjusted (FR-04 allows flexible placement).

---

## Rollback Plan

To revert all changes:

1. **Git revert** all changes (or `git checkout` the two modified files):
   ```bash
   git checkout -- scripts/sync-opencode-data.js src/utils/overviewDataProcessor.ts
   ```
2. **Re-run sync** to regenerate JSON files with the old formula:
   ```bash
   npm run sync
   ```
3. **Restart dev server** if running:
   ```bash
   npm run dev
   ```

The rollback touches only 2 files and one CLI command. No database changes, no package changes, no config changes.

---

## Files NOT Modified (Verified)

These files were inspected and confirmed to require **no changes** — they are passive consumers that automatically reflect the upstream data change:

| File | Why No Change Needed |
|---|---|
| `src/types/index.ts` | `cache_tokens` field still exists; only its runtime value changes |
| `src/utils/costCalculator.ts` | `calculateCost()` takes `tokens.cache` which is now cache_read — correct behavior |
| `src/utils/dataLoader.ts` | Pure JSON fetcher — no token logic |
| `src/components/DailyActivityChart.tsx` | Reads `dataKey="cache"` from TimeSeriesData — value changes automatically |
| `src/components/TokenCompositionChart.tsx` | Reads `name` and `value` from DonutSegment — label change is in `computeTokenComposition`, not here |
| `src/components/TopModelsChart.tsx` | Reads `dataKey="cache"` from ModelBreakdownItem — value changes automatically |
| `src/components/ProjectActivityChart.tsx` | Reads `dataKey="cache"` from ProjectBreakdownItem — value changes automatically |
| `src/components/TokenChart.tsx` | Reads `dataKey="cache"` — value changes automatically |
| `src/components/CostTrendChart.tsx` | Only renders `dataKey="cost"` — no token fields |
| `src/components/RecentSessionsList.tsx` | Reads `s.total_tokens` — value changes automatically |
| `src/pages/Overview.tsx` | Renders computed metrics array — card count change handled by `computeKeyMetrics` |
| `src/pages/TokenUsage.tsx` | Summary calculates `row.input + row.output + row.reasoning + row.cache` — cache is now cache_read, correct |
| `src/pages/SessionsList.tsx` | Reads `s.total_tokens` and `s.cache_tokens` — values change automatically |
| `src/pages/SessionDetail.tsx` | Reads `s.cache_tokens` and passes to `calculateCost` — values change automatically |

---

## Self-Review Checklist

### 1. Spec Coverage

| Requirement | Covered By | Status |
|---|---|---|
| FR-01: Total Tokens formula (input+output+cache_read) | Task 1 Step 2 (total_tokens change in sync) | ✅ |
| FR-02: Input Tokens unchanged | No code changes needed (verified) | ✅ |
| FR-03: Cache → Cache Read, value = cache_read only | Task 1 Step 1 (sync) + Task 2 Step 3/4 (label) | ✅ |
| FR-04: Output Tokens new card | Task 2 Steps 1-3 | ✅ |
| FR-05: Data pipeline sync script | Task 1 Steps 1-3 | ✅ |
| FR-06: Token Composition donut | Task 2 Step 4 (label rename) | ✅ |
| FR-07: Konsistensi seluruh dashboard | Verified — all consumers are passive; no code changes needed | ✅ |
| FR-08: Data regenerasi via `npm run sync` | Task 1 Step 4 | ✅ |
| NFR-01: Backward compatible JSON format | No structural change — only field values change | ✅ |
| NFR-02: reasoning_tokens untouched | Verified — no changes to reasoning anywhere | ✅ |
| NFR-03: Build tidak terpengaruh | Task 2 Step 5 (tsc) & Step 6 (build) | ✅ |
| NFR-04: Tidak ada dependensi baru | No package changes | ✅ |
| NFR-05: Card layout responsif | Verified — auto-fit grid handles 8 cards | ✅ |
| Q-01: total_tokens excludes cache_write everywhere | Task 1 Step 2 (root cause fix) | ✅ |
| Q-02: cache_write dropped completely | Task 1 Steps 1 & 3 (removed from all aggregations) | ✅ |
| Q-03: Cost excludes cache_write | Automatic — cache_tokens now cache_read only, passed to calculateCost | ✅ |

### 2. Placeholder Scan

No TBD, TODO, "implement later", "add appropriate error handling", or vague references found. All steps contain exact code blocks.

### 3. Type Consistency

- `totalOutputTokens` is declared in Step 2 and consumed in Step 3 — match confirmed
- `outputTokens7d`, `outputTokensPrev7d`, `outputTokensPct` are declared in Step 1 and consumed in Step 3 — match confirmed
- `computeTokenComposition` returns `DonutSegment[]` with `{ name, value, color }` — the label change from `'Cache'` to `'Cache Read'` is just a string change, type remains `string`
- All chart components remain unchanged — no type signature changes needed

---

Version: 1 | Author: planner | Ref: requirements v2 | Date: 2026-05-25

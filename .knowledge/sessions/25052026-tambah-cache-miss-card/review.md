# Code Review: Cache Miss Card + Fix Cost & Donut

## Reference
- Plan: .knowledge/sessions/25052026-tambah-cache-miss-card/plan.md v1
- Requirements: .knowledge/sessions/25052026-tambah-cache-miss-card/requirements.md v2
- Previous session: .knowledge/sessions/25052026-penyesuaian-halaman-overview/plan.md

## Verdict: PASS

## Summary

All 2 tasks implemented exactly per plan. The `calculateCost()` formula now correctly isolates cache_miss (charged at `input_price`) from cache_read (charged at `cache_price`). The `computeKeyMetrics()` function adds a new "Cache Miss" card (9 cards total, inserted between Cache Read and Models) with 7-day trend comparison. The `computeTokenComposition()` donut chart is restructured to non-overlapping segments: Cache Miss / Cache Read / Output. Zero issues found. All call sites benefit automatically from the corrected cost formula. No regressions to previous session changes.

## Issues

### Critical
None.

### Warning
None.

### Suggestion
- [S-01] `src/utils/overviewDataProcessor.ts:146` — The `totalTokens` formula (`sum(d.input + d.output + d.cache)`) counts `cache_read` twice (once inside `d.input`, once as `d.cache`). This is a **pre-existing design decision** documented in FR-03 of both sessions ("Formula tetap"). Not a regression and out of scope for this review, but worth noting for future accuracy improvements.

## Plan Adherence

### Task 1: Fix `calculateCost()` — stop double-charging cache_read tokens
- [x] Step 1: Formula changed to `cacheMissTokens = input - cacheReadTokens` → `costCalculator.ts:12-13` ✅
- [x] Step 1: `inputCost = cacheMissTokens * input_price` → `costCalculator.ts:14` ✅
- [x] Step 1: `cacheCost = cacheReadTokens * cache_price` → `costCalculator.ts:17` ✅
- [x] Step 2: Type-check passes → reported ✅
- [x] Step 3: Build passes → reported ✅
- [x] Function signature unchanged → all 7 call sites (`overviewDataProcessor.ts:97,168,325,356,414; SessionsList; SessionDetail`) pass same object shape ✅

### Task 2: Add "Cache Miss" card + restructure donut chart
- [x] Step 1: `totalCacheMissTokens = totalInputTokens - totalCacheTokens` → `overviewDataProcessor.ts:161` ✅
- [x] Step 2: `cacheMiss7d = inputTokens7d - cacheTokens7d` trend variables → `overviewDataProcessor.ts:215-219` ✅
- [x] Step 3: "Cache Miss" card inserted between "Cache Read" and "Models" → `overviewDataProcessor.ts:256-261` ✅
- [x] Step 4: `computeTokenComposition()` restructured to Cache Miss / Cache Read / Output → `overviewDataProcessor.ts:283-302` ✅
- [x] Step 4: No "Input" segment in donut → grep confirmed zero stale references ✅
- [x] Step 4: Donut total = `cacheMiss + cache + output` = `input + output` → line 288 ✅
- [x] Step 5: Type-check passes → reported ✅
- [x] Step 6: Build passes → reported ✅

## Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| **FR-01**: Card "Cache Miss" — nama, isi, trend, posisi | ✅ | `overviewDataProcessor.ts:256-261`: label='Cache Miss', value=totalInputTokens-totalCacheTokens, 7-day trend, positioned after Cache Read |
| **FR-02**: Card "Input Tokens" — tidak berubah | ✅ | `overviewDataProcessor.ts:239-243`: unchanged from previous session |
| **FR-03**: Card "Total Tokens" — tidak berubah | ✅ | `overviewDataProcessor.ts:145-146`: unchanged formula |
| **FR-04**: Donut chart — restruktur non-overlapping | ✅ | `overviewDataProcessor.ts:283-302`: Cache Miss/Read/Output, no Input, total = input+output |
| **FR-05**: Cost calculation — formula corrected | ✅ | `costCalculator.ts:12-18`: `(input-cache)×input_price + cache×cache_price + output×output_price` |
| **NFR-01**: Previous session changes preserved | ✅ | cache_write absent, Output Tokens card present, Cache Read label preserved, card order preserved |
| **NFR-02**: Sync script unchanged | ✅ | `scripts/sync-opencode-data.js` not in diff |
| **NFR-03**: Backward compatibility | ✅ | No JSON format changes; all computed at frontend |
| **NFR-04**: Build unaffected | ✅ | `tsc -b` and `npm run build` reported passing |
| **NFR-05**: No new dependencies | ✅ | No package changes |
| **NFR-06**: Card layout responsive | ✅ | auto-fit grid handles 9 cards |
| **C-01**: cache_miss = computed field | ✅ | `input - cache_read`, no DB changes |
| **C-02**: session.cache_tokens definition unchanged | ✅ | Still = cache_read only (from previous session sync change) |
| **C-05**: verbatimModuleSyntax | ✅ | All imports use `import type` where appropriate |

## Regression Check

- [x] **cache_write** still absent from pipeline → no references found ✅
- [x] **Cache Read** card label preserved → `overviewDataProcessor.ts:251` ✅
- [x] **Output Tokens** card preserved → `overviewDataProcessor.ts:244-249` ✅
- [x] **Card order** (9 cards): Total Sessions → Total Tokens → Input Tokens → Output Tokens → Cache Read → **Cache Miss** → Models → Providers → Estimated Cost ✅
- [x] **Donut chart** (`TokenCompositionChart.tsx`) confirmed as pure renderer — reads `name`, `value`, `color` from whatever `DonutSegment[]` passed; no hardcoded segment names ✅
- [x] **All cost consumers** benefit automatically: `computeCostInRange`, `computeKeyMetrics`, `computeDailyCost`, `computeTopModels`, `computeRecentSessions` all call `calculateCost()` with identical signature ✅

## Code Quality

- [x] No unused variables → `totalCacheMissTokens`, `cacheMiss7d`, `cacheMissPrev7d`, `cacheMissPct`, `cacheReadTokens`, `cacheMissTokens` all consumed ✅
- [x] No leftover references to old donut segment names → grep for `name.*'(Input|Cache)'` returned zero matches ✅
- [x] Type consistency → all computations use `number`, return types match declarations ✅
- [x] No `any` types introduced ✅
- [x] Edge case: `cacheMissTokens < 0` (impossible in practice, but unguarded) → per plan: no defensive `Math.max(0, ...)` needed — would mask data integrity issue ✅

## Git Diff Verification

```
costCalculator.ts:
  +4 lines — cacheReadTokens extraction, cacheMissTokens derivation, inputCost/cacheCost split

overviewDataProcessor.ts:
  +totalCacheMissTokens computation (line 161)
  +cacheMiss7d/cacheMissPrev7d/cacheMissPct trend (lines 215-219)
  +Cache Miss card in metrics array (lines 256-261)
  ~computeTokenComposition restructured: 3 lines removed (old Input/Cache),
   4 lines added (Cache Miss/Cache Read)
```

Diff matches plan exactly. No unintended changes.

---
Author: reviewer | Date: 2026-05-25 | Iteration: 1

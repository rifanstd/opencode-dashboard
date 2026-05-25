# Code Review: Fix Overview Page Bugs (Models Count & Estimated Cost)

## Reference
- Plan: .knowledge/sessions/20260525-fix-overview-bugs/plan.md v1
- Requirements: .knowledge/sessions/20260525-fix-overview-bugs/requirements.md v2

## Verdict: PASS_WITH_NOTES

## Summary
The four tasked changes (sync script model extraction, Overview filtering, subLabel text, formatCost zero) are correctly implemented and match the plan precisely. Types are sound, edge cases are handled, and all 11 acceptance criteria (AC-01 through AC-11) are satisfied.

**However**, the git diff reveals **significant unplanned changes** in the same commit that are NOT in the plan or requirements: cache_write removal from the sync script, three new metric cards (Output Tokens, Cache Read, Cache Miss), a redesigned token composition donut chart, and a semantic change to the Input Tokens card value. These require Orchestrator attention — they should either be split into a separate session or explicitly added to the plan.

Additionally, a **pre-existing bug** was discovered in `loadPricing()` (see W-05) — it has always used array indices as map keys against model IDs, causing pricing lookups to silently fail on the SessionsList and SessionDetail pages. This is outside the scope of the current plan but is worth fixing.

## Issues

### Critical
(None)

### Warning

- **[W-01]** `scripts/sync-opencode-data.js:188-189, 226` — **Plan deviation: cache_write removed from cache_tokens and total_tokens, NOT in plan.** The sync script previously summed `cache_read + cache_write` for both `cache_tokens` and included `cache_write` in `total_tokens`. This commit removes `cache_write` entirely, changing the semantics of the exported data. Neither the plan nor requirements mention this change. | Fix: Either revert these lines (keep `cache_write` in the sum) or add this change to the plan/requirements with acceptance criteria.

- **[W-02]** `src/utils/overviewDataProcessor.ts:203-261` — **Plan deviation: three new metric cards added (Output Tokens, Cache Read, Cache Miss), NOT in plan.** The plan (Task 3) only calls for changing the Models card subLabel on line 265. However, the commit adds: an "Output Tokens" card (trend-aware), renames "Cache" → "Cache Read", adds a "Cache Miss" card (`totalCacheMissTokens = totalInputTokens`), and changes the Input Tokens card value to `totalInputTokens + totalCacheTokens` (line 240, see W-03). These are significant feature additions with no corresponding acceptance criteria in requirements.md. | Fix: Either revert these card changes or create a separate plan/requirements for them.

- **[W-03]** `src/utils/overviewDataProcessor.ts:240` — **Semantic inconsistency: Input Tokens value includes cache tokens, but trend and label don't reflect this.** The card `label` is "Input Tokens" and the `subLabel` trend percentage derives from `inputTokensPct` (which is based on `s.input_tokens` only, excluding cache). But the displayed `value` is `formatNumber(totalInputTokens + totalCacheTokens)`. This means the displayed number includes cache tokens but the trend percentage doesn't — a user seeing "+10% vs last 7 days" would reasonably assume it applies to the displayed value, but it doesn't. | Fix: Either (a) rename the label to "Input + Cache" and compute the trend accordingly, or (b) keep the label "Input Tokens" and use `formatNumber(totalInputTokens)` (without adding cache).

- **[W-04]** `src/utils/overviewDataProcessor.ts:283-303` — **Plan deviation: computeTokenComposition redesigned from {Input, Output, Cache} → {Cache Miss, Cache Read, Output}, NOT in plan.** The original "Input" segment was removed entirely and replaced with "Cache Miss" (which equals `input`). This changes what the donut chart represents. If the additive model is correct (input = cache miss, cache = cache read), this is semantically valid — but there are no requirements or user-confirmed design for this change. | Fix: Either revert or document in requirements.

- **[W-05]** `src/utils/costCalculator.ts:48-64` — **Pre-existing bug: `loadPricing()` uses `Object.entries()` keys as map keys, but receives an array (`ModelInfo[]`).** `loadModels()` returns `ModelInfo[]` (a JSON-parsed array). `loadPricing()` does `for (const [key, model] of Object.entries(models))` — for an array, `Object.entries()` yields `['0', model0], ['1', model1], ...` so map keys are stringified indices, not model IDs. This means `pricingMap.has(s.model_id)` in `SessionsList.tsx:34` and `SessionDetail.tsx:52` **always returns false**, so computed cost is never applied — those pages fall back to the database `s.cost` field (which may be null). This is a pre-existing bug, NOT introduced by the current changes. The plan explicitly excludes `loadPricing` from modification ("no changes needed"). | Fix (separate session): Change `loadPricing` to accept `ModelInfo[]` and use `m.id` as the map key, matching how `buildPricingMap()` works in overviewDataProcessor.ts:111-122.

### Suggestion

- **[S-01]** `src/utils/overviewDataProcessor.ts:215-219` — **Redundant trend data: Cache Miss trend equals Input Tokens trend.** `cacheMiss7d = inputTokens7d` and `cacheMissPrev7d = inputTokensPrev7d`, so `cacheMissPct` will always equal `inputTokensPct`. The Cache Miss card and Input Tokens card will show the same trend percentage. This is logically correct but visually redundant. | Consider computing Cache Miss as a ratio (cache miss rate = non-cached / total) rather than an absolute count, or removing the redundant card.

- **[S-02]** `src/utils/costCalculator.ts:12` — **Minor refactoring: extracted `cacheReadTokens` variable.** The plan doesn't mention this change, but it's a harmless readability improvement (`const cacheReadTokens = tokens.cache ?? 0`). | No action needed; this is fine.

## Plan Adherence

| Task | File | Lines (Plan) | Lines (Actual) | Verdict |
|---|---|---|---|---|
| Task 1 | `scripts/sync-opencode-data.js` | 476-513 | 476-513 | ✅ **Matches plan** — nested provider→models traversal, `cost.{input,output,cache_read}` paths, divide-by-1M conversion, `provider: providerId` |
| Task 2 | `src/pages/Overview.tsx` | 116-124 | 116-124 | ✅ **Matches plan** — `configuredProviderIds` Set, filtered `modelsCount` |
| Task 3 | `src/utils/overviewDataProcessor.ts` | 265 | 265 | ✅ **subLabel matches plan** — changed to "Available models from configured providers" |
| Task 4 | `src/utils/costCalculator.ts` | 20-27 | 20-27 | ✅ **Matches plan** — `!Number.isFinite` guard, `value === 0` early return |
| — | `scripts/sync-opencode-data.js` | N/A | 188-189 | ❌ **Unplanned** — cache_write removed from cache_tokens |
| — | `scripts/sync-opencode-data.js` | N/A | 226 | ❌ **Unplanned** — cache_write removed from message cache_tokens |
| — | `src/utils/overviewDataProcessor.ts` | N/A | 152-161, 203-261, 283-303 | ❌ **Unplanned** — three new metric cards, donut chart redesign, Input Tokens value change |
| — | `src/utils/costCalculator.ts` | N/A | 12 | ⚠️ **Unplanned (minor)** — `cacheReadTokens` variable extraction |

## Requirements Coverage

| AC | Description | Status | Evidence |
|---|---|---|---|
| AC-01 | Models card counts only configured-provider models | ✅ Satisfied | Task 1 (`provider: providerId`) + Task 2 (`configuredProviderIds.has(m.provider)`) |
| AC-02 | No configured providers → models card shows 0 | ✅ Satisfied | Empty providers → empty Set → `.filter().length` returns 0 |
| AC-03 | subLabel updated to "configured providers" | ✅ Satisfied | `overviewDataProcessor.ts:265` |
| AC-04 | Graceful fallback for empty arrays | ✅ Satisfied | `.filter().length` safely returns 0 on empty `models` or `providers` arrays |
| AC-05 | Non-zero pricing in exported models.json | ✅ Satisfied | `cost?.input` path + `/1_000_000` unit conversion produces correct per-token values |
| AC-06 | Sync handles actual field structure | ✅ Satisfied | `cost?.input ?? modelData.input_price ?? modelData.inputPrice ?? 0` with fallbacks |
| AC-07 | Model ID matching works for pricing lookup | ✅ Satisfied | Per Q-02, IDs already match (short form); `buildPricingMap` uses `m.id` correctly |
| AC-08 | Estimated Cost card shows non-zero value | ✅ Satisfied | Root cause (zero pricing) fixed in Task 1; `calculateCost` now receives non-zero pricing |
| AC-09 | Free models show $0.00 correctly | ✅ Satisfied | `formatCost(0)` → `'$0.00'` (Task 4) |
| AC-10 | Cost Trend chart reflects corrected cost data | ✅ Satisfied | `computeDailyCost` reads from same pricing map, now with non-zero values |
| AC-11 | formatCost shows $0.00 for true zero | ✅ Satisfied | `value === 0` → early return `'$0.00'` (Task 4) |
| NFR-01 | All data fixes in sync script | ✅ Satisfied | Pricing extraction and unit conversion handled in sync script |
| NFR-02 | JSON schema unchanged | ✅ Satisfied | Same field names (`input_price`, `output_price`, etc.), only values changed |
| NFR-03 | No new dependencies | ✅ Satisfied | No npm packages added |
| NFR-04 | Build integrity | ⚠️ Not verified | Could not run `tsc -b` or `npm run build` due to tool restrictions; type analysis on code is sound |
| NFR-05 | Graceful degradation for missing pricing | ✅ Satisfied | `cost?.input ?? ... ?? 0` → `rawInputPrice / 1_000_000` → 0 → `calculateCost` uses `?? 0` |
| NFR-06 | Performance — O(n) on small datasets | ✅ Satisfied | Set + filter is O(n+m); datasets are < 1000 entries |

## Edge Cases Verified

| Case | Location | Result |
|---|---|---|
| Empty models array | `models.filter(...).length` | Returns 0 ✅ |
| Empty providers array | `new Set([].map(...))` | Empty Set → filter returns [] → 0 ✅ |
| Missing `cost` object | `cost?.input ?? ... ?? 0` | Falls back to 0, then `/1_000_000` → 0 ✅ |
| Missing `providerData.models` | `if (!providerModels) continue` | Provider skipped gracefully ✅ |
| `modelData` is not an object | `if (!modelData \|\| typeof modelData !== 'object') continue` | Model skipped gracefully ✅ |
| `formatCost(NaN)` | `!Number.isFinite(NaN)` | Returns `'$0.00'` ✅ |
| `formatCost(Infinity)` | `!Number.isFinite(Infinity)` | Returns `'$0.00'` ✅ |
| `formatCost(0)` | `value === 0` | Returns `'$0.00'` ✅ |
| `formatCost(-0)` | `-0 === 0` is `true` in JS | Returns `'$0.00'` ✅ |
| `formatCost(0.0001)` | `0.0001 < 1` | Returns `'$0.0001'` ✅ |
| `formatCost(1.5)` | `1.5 >= 1` | Returns `'$1.50'` ✅ |
| `formatCost(1000)` | `1000 >= 1` | Returns `'$1000.00'` ✅ |
| No configured providers | `configuredProviderIds` is empty Set | `modelsCount` = 0 ✅ |

## formatCost Callers — Impact Analysis

All callers of `formatCost` are backward-compatible with the change:

| Caller | File:Line | Usage | Impact |
|---|---|---|---|
| Overview Metrics | `overviewDataProcessor.ts:274` | `formatCost(totalCost)` | If totalCost is 0 → `'$0.00'` instead of `'$0.0000'` ✅ |
| Recent Sessions | `RecentSessionsList.tsx:55` | `formatCost(s.computedCost)` | If cost is 0 → cleaner display ✅ |
| Cost Trend Chart (axis) | `CostTrendChart.tsx:51` | `tickFormatter` | Zero tick → `'$0.00'` ✅ |
| Cost Trend Chart (tooltip) | `CostTrendChart.tsx:60` | `formatter` | Tooltip shows `'$0.00'` ✅ |
| Sessions List | `SessionsList.tsx:180` | `formatCost(s.cost)` | If DB cost is 0 → `'$0.00'` ✅ |
| Session Detail | `SessionDetail.tsx:123` | `formatCost(session.cost)` | If DB cost is 0 → `'$0.00'` ✅ |

No callers depend on the 4-decimal formatting of zero (the previous behavior was a bug, after all).

---
Author: reviewer | Date: 2026-05-25 | Iteration: 1

# Code Review: Overview Page Key Metrics Restructuring

## Reference
- Plan: .knowledge/sessions/opencode-dashboard-20260524-0000/plan.md v1
- Requirements: .knowledge/sessions/opencode-dashboard-20260524-0000/requirements.md v1

## Verdict: PASS

## Summary
Both issues from the previous review (iteration 1) have been properly fixed:

- **W-01 (Total Tokens subLabel includes reasoning)**: Resolved by introducing `sumTokensInRangeExcludingReasoning()` (lines 56–69) which sums only `input_tokens + output_tokens + cache_tokens`. The Total Tokens card value (`totalTokens` at line 146, computed from `byDay` as `input + output + cache`) and its 7-day comparison (`tokens7d`/`tokensPrev7d` at lines 186–187) now measure the same metric — both exclude reasoning. The original `sumTokensInRange` function was fully removed (no remaining callers, confirmed via grep).
- **S-02 (dead `computeToolCallMetrics` and unused `Part` import)**: Resolved. `computeToolCallMetrics()` (formerly lines 421–438) has been deleted. `Part` has been removed from the type import on line 3. `Message` remains imported, correctly, because `computeActivityHeatmap` still uses it.

No new issues were introduced. All 12 functional requirements remain fully satisfied. The remaining two suggestions (S-01, S-03) are at the "suggestion" severity level — not blocking — and have not changed since iteration 1. Code is ready to deliver.

## Issues

None at critical or warning level. Only the following suggestions remain from iteration 1:

### Suggestion
- [S-01] `src/utils/costCalculator.ts:36–38` — **`formatNumber` rounding edge at K/M boundary.** For values 999,950–999,999, `(value / 1000).toFixed(1)` rounds to `"1000.0"`, which after `.0` stripping displays as `"1000K"` instead of `"1M"`. Extremely unlikely for token/session counts (requires exactly ~1M of something). | Fix: Add a carry-over check: if the rounded K value >= 1000, re-format as M (e.g., `if (k >= 999.95) return formatNumber(Math.round(k))` to recurse into M branch).

- [S-03] `src/utils/overviewDataProcessor.ts:190–200` — **Input Tokens and Cache 7-day comparisons use session data while card values use `byDay` data.** `inputTokens7d`/`inputTokensPrev7d` come from session-level `s.input_tokens` via `sumTokenFieldInRange`, while `totalInputTokens` comes from `byDay` aggregation. Same pattern for cache. Both sources theoretically represent the same tokens but originate from different sync-script aggregation pipelines. In rare cases of data inconsistency between the two JSON files, the trend comparison could diverge from the displayed total. | Fix: Compute 7-day comparisons from `byDay` data filtered by date range for full consistency. Low priority — current approach is functional and unlikely to cause visible issues.

## Plan Adherence
- [x] Task 1: `formatNumber()` added to costCalculator.ts ✓
- [x] Task 2: `computeKeyMetrics()` refactored — new signature, new cards, dead code removed, reasoning excluded ✓
- [x] Task 2 Step 9: 7-card array matches plan exactly ✓
- [x] Task 2 Step 10: Dead `computeToolCallMetrics` and `Part` import removed ✓
- [x] Task 3: Reasoning `<Bar>` removed from TopModelsChart ✓
- [x] Task 4: `reasoning` color key removed from `colors` object ✓
- [x] Task 5: `loadProviders` added to imports, `Promise.all`, state, and `computeKeyMetrics` call ✓

## Requirements Coverage
- [x] FR-01: Total Sessions uses `formatNumber`, keeps 30d comparison subLabel — `overviewDataProcessor.ts:208–212` ✓
- [x] FR-02: Total Tokens = input + output + cache (NO reasoning) — `overviewDataProcessor.ts:145–146` ✓ **[FIXED: subLabel comparison now also excludes reasoning — lines 186–187]**
- [x] FR-03: "Input Tokens" card with comparison subLabel — `overviewDataProcessor.ts:219–224` ✓
- [x] FR-04: "Cache" card with comparison subLabel — `overviewDataProcessor.ts:225–230` ✓
- [x] FR-05: "Models" card with static subLabel — `overviewDataProcessor.ts:231–235` ✓
- [x] FR-06: "Providers" card — configured-only count, static subLabel — `Overview.tsx:117`, `overviewDataProcessor.ts:236–240` ✓
- [x] FR-07: 7 old cards removed ✓
- [x] FR-08: `formatNumber()` with K/M, 1 decimal, strip .0 — `costCalculator.ts:32–43` ✓
- [x] FR-09: Estimated Cost K/M for >= $1000 — `overviewDataProcessor.ts:242–243` ✓
- [x] FR-10: Dead code cleaned — `computeToolCallMetrics`, `Part`, `messages7d`, `toolMetrics`, `avgTokensPerSession` all removed ✓
- [x] FR-11: `loadProviders()` added to Overview — `Overview.tsx:8,88,103` ✓
- [x] FR-12: Reasoning removed from TokenComposition (3 segments) and TopModelsChart (3 bars) — `overviewDataProcessor.ts:252–271`, `TopModelsChart.tsx:90–92` ✓
- [x] NFR-01: TypeScript — `tsc -b` exit 0, zero type errors ✓
- [x] NFR-02: CSS grid — `repeat(auto-fit, minmax(220px, 1fr))` unchanged, works for 7 cards ✓
- [x] NFR-03: Performance — `loadProviders()` in existing `Promise.all`, no serialization ✓
- [x] NFR-04: Fallback — empty arrays default to 0 for Models/Providers counts ✓

---
Author: reviewer | Date: 2026-05-24 | Iteration: 2

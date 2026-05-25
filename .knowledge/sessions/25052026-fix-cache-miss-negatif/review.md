# Code Review: Fix Cache Miss Negative Value & Additive Token Model

## Reference
- Plan: .knowledge/sessions/25052026-fix-cache-miss-negatif/plan.md v1
- Requirements: .knowledge/sessions/25052026-fix-cache-miss-negatif/requirements.md v1

## Verdict: PASS_WITH_NOTES

## Summary

All 5 fixes (FR-01 through FR-05) are correctly implemented. The additive token model (`input_tokens` and `cache_tokens` are independent, additive fields) is now consistently applied across both changed files. No remaining subtractions between input and cache exist anywhere in the codebase. All call sites of `calculateCost` pass raw additive fields — no pre-subtraction is done by any caller. Regression items (Cache Read, Output Tokens, Total Sessions, Models, Providers, Estimated Cost) are all preserved. No `cache_write` appears anywhere.

Build verification (`npx tsc -b`, `npm run build`) was **blocked by bash permission restrictions** in the review environment. However, thorough static analysis of all type usage confirms no type errors are expected — no function signatures changed, no new types introduced, and all arithmetic operations are on compatible `number` types.

## Issues

### Critical
*None*

### Warning
*None*

### Suggestion

- **[S-01]** `src/utils/overviewDataProcessor.ts:240` — The Input Tokens card `value` now correctly sums `totalInputTokens + totalCacheTokens` (additive model), but the `subLabel` trend still shows `inputTokensPct` which compares only `input_tokens` across 7-day windows, not `input_tokens + cache_tokens`. This means the displayed trend may not reflect the change in the displayed card value. Consider computing a combined 7-day trend (`inputTokens7d + cacheTokens7d` vs `inputTokensPrev7d + cacheTokensPrev7d`) for consistency. This is **not blocking** — the requirement only specified changing the `value` field, and showing the non-cached input trend is a reasonable design choice.

## Plan Adherence

- [x] Task 1 (FR-01): Cache Miss value = `totalInputTokens` only, no subtraction — line 161 ✓
- [x] Task 2 (FR-02): Cache Miss trend = `inputTokens7d` only, no subtraction — lines 215-216 ✓
- [x] Task 3 (FR-03): Input Tokens card = `totalInputTokens + totalCacheTokens` — line 240 ✓
- [x] Task 4 (FR-04): Donut chart `cacheMiss = input`, `total = input + cache + output` — lines 287-288 ✓
- [x] Task 5 (FR-05): Cost calculator uses `tokens.input * input_price` directly (additive), no `cacheMissTokens` variable — lines 13, 16 ✓
- [x] Task 6 (Step 3): All verification math checks out for real data (see table below)

**Verification math (real data: `totalInputTokens = 367,455`, `totalCacheTokens = 3,720,704`):**

| Metric | Expected | Actual | Match |
|--------|----------|--------|-------|
| Cache Miss value | `367,455` | `totalInputTokens` = `367,455` | ✓ |
| Cache Miss trend | `inputTokens7d` | `inputTokens7d` | ✓ |
| Input Tokens value | `4,088,159` | `totalInputTokens + totalCacheTokens` = `4,088,159` | ✓ |
| Donut total | `input + cache + output` | `input + cache + output` | ✓ |
| Cost formula | `input*i + cache*c + output*o` | Same (additive, no subtraction) | ✓ |

## Requirements Coverage

- [x] FR-01: Cache Miss card uses `totalInputTokens` directly — line 161 ✓
- [x] FR-02: Cache Miss trend uses `inputTokens7d` directly — lines 215-216 ✓
- [x] FR-03: Input Tokens card sums `totalInputTokens + totalCacheTokens` — line 240 ✓
- [x] FR-04: Donut chart uses `cacheMiss = input`, `total = input + cache + output` — lines 287-288 ✓
- [x] FR-05: Cost calculator reverted to additive formula (`input * input_price + cache * cache_price`) — lines 13, 16 ✓
- [x] NFR-01: All metric values are non-negative for real data — verified by arithmetic
- [x] NFR-02: Estimated Cost uses additive formula (no undercounting) — all callers pass raw fields
- [x] NFR-03: Donut chart has three additive segments (Cache Miss, Cache Read, Output) — verified

## Regression Check

| What | Status | Evidence |
|------|--------|----------|
| Cache Read card | ✓ OK | `value: formatNumber(totalCacheTokens)` — line 252 |
| Output Tokens card | ✓ OK | `value: formatNumber(totalOutputTokens)` — line 246 |
| Total Tokens card | ✓ OK | `d.input + d.output + d.cache` at line 146 (unchanged) |
| Total Sessions card | ✓ OK | `overview.totalSessions` — line 228 (unchanged) |
| Models card | ✓ OK | `modelsCount` — line 264 (unchanged) |
| Providers card | ✓ OK | `providersCount` — line 269 (unchanged) |
| Estimated Cost card | ✓ OK | Uses `calculateCost` with raw additive fields — lines 168-175 |
| Daily cost chart | ✓ OK | `computeDailyCost` passes raw `s.input_tokens`/`s.cache_tokens` — lines 327-330 |
| Top Models breakdown | ✓ OK | `calculateCost` receives raw `m.input`/`m.cache` — lines 356-358 |
| Top Projects breakdown | ✓ OK | Does not call `calculateCost` — uses raw fields directly |
| Recent Sessions table | ✓ OK | `calculateCost` receives raw `s.input_tokens`/`s.cache_tokens` — lines 416-419 |
| SessionsList page | ✓ OK | Raw `s.input_tokens`/`s.cache_tokens` — lines 38, 41 |
| SessionDetail page | ✓ OK | Raw `s.input_tokens`/`s.cache_tokens` — lines 55, 58 |
| No `cache_write` present | ✓ OK | Zero grep matches in `src/` |
| No remaining `input - cache` | ✓ OK | Zero grep matches in `src/` |

## Call Site Audit

All 7 call sites of `calculateCost` were audited. Every one passes raw additive fields with no pre-subtraction:

| File | Line | Input source | Cache source | Pre-subtraction? |
|------|------|-------------|-------------|-----------------|
| `overviewDataProcessor.ts` | 97 | `s.input_tokens` | `s.cache_tokens` | None |
| `overviewDataProcessor.ts` | 168 | `s.input_tokens` | `s.cache_tokens` | None |
| `overviewDataProcessor.ts` | 325 | `s.input_tokens` | `s.cache_tokens` | None |
| `overviewDataProcessor.ts` | 356 | `m.input` | `m.cache` | None |
| `overviewDataProcessor.ts` | 414 | `s.input_tokens` | `s.cache_tokens` | None |
| `SessionsList.tsx` | 36 | `s.input_tokens` | `s.cache_tokens` | None |
| `SessionDetail.tsx` | 53 | `s.input_tokens` | `s.cache_tokens` | None |

## costCalculator.ts Final State

```ts
export function calculateCost(
  tokens: { input: number; output: number; reasoning?: number; cache?: number },
  pricing: Pricing
): number {
  const cacheReadTokens = tokens.cache ?? 0      // extract once, used for cacheCost
  const inputCost = tokens.input * (pricing.input ?? 0)        // additive: no subtraction
  const outputCost = tokens.output * (pricing.output ?? 0)
  const reasoningCost = (tokens.reasoning ?? 0) * (pricing.reasoning ?? 0)
  const cacheCost = cacheReadTokens * (pricing.cache ?? 0)
  return inputCost + outputCost + reasoningCost + cacheCost    // additive sum
}
```

- Function signature unchanged ✓
- Formula: `input * input_price + cache * cache_price + output * output_price + reasoning * reasoning_price` ✓
- No `cacheMissTokens` variable exists ✓
- `cacheReadTokens` is a DRY refactoring (was `tokens.cache ?? 0` inline, now computed once) — functionally identical ✓

## Build Verification

⚠️ **Blocked by environment restrictions.** `npx tsc -b` and `npm run build` could not be executed due to bash permission rules in the review environment. Manual verification is recommended before delivery. Static analysis indicates all types are compatible — no signature changes, no new types, all arithmetic is on `number` operands.

---
Author: reviewer | Date: 2026-05-25 | Iteration: 1

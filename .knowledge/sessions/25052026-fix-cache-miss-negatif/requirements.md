# Requirements: Fix Cache Miss Negative Value & Additive Token Model Misunderstanding

## Context

In session `25052026-tambah-cache-miss-card`, a "Cache Miss" metric card was added to the Overview page, computed as `totalInputTokens - totalCacheTokens`. It displays a **negative number** (e.g., `-3.3M`).

### Root Cause

The code assumed `cache_read ⊆ input_tokens` (nested model). In opencode's actual database schema, `tokens_input` and `tokens_cache_read` are **separate, additive fields** — `tokens_input` already represents non-cached input (i.e., cache misses).

| Field | Actual meaning |
|---|---|
| `tokens_input` | Non-cached input tokens (= cache miss) |
| `tokens_cache_read` | Cached input tokens |
| **Total input** | `tokens_input + tokens_cache_read` |

The subtraction `input - cache` is therefore incorrect. It:
- Produces a negative number in the Cache Miss card (since cache > input in real data: 367K vs 3.7M)
- Undercounts the total input token display
- Incorrectly splits the donut chart
- Applies a wrong cost formula that reduces cost when cache exceeds input

### Evidence

Real `overview.json` data:
```
totalInputTokens  : 367,455
totalCacheTokens  : 3,720,704
```
Cache tokens are ~10× larger than input tokens, proving additive semantics.

## Functional Requirements

### FR-01: Cache Miss Card — Use Input Tokens Directly
**File:** `src/utils/overviewDataProcessor.ts`, line 161

Change `const totalCacheMissTokens = totalInputTokens - totalCacheTokens` to:
```ts
const totalCacheMissTokens = totalInputTokens
```
`totalInputTokens` already represents non-cached input (cache misses). No subtraction needed.

### FR-02: Cache Miss Trend — Use Input Tokens Directly
**File:** `src/utils/overviewDataProcessor.ts`, lines 215-217

Change:
```ts
const cacheMiss7d = inputTokens7d - cacheTokens7d
const cacheMissPrev7d = inputTokensPrev7d - cacheTokensPrev7d
```
To:
```ts
const cacheMiss7d = inputTokens7d
const cacheMissPrev7d = inputTokensPrev7d
```

### FR-03: Input Tokens Card — Sum Input + Cache
**File:** `src/utils/overviewDataProcessor.ts`, line 240

Change `value: formatNumber(totalInputTokens)` to:
```ts
value: formatNumber(totalInputTokens + totalCacheTokens)
```
Total input = non-cached input + cached input (additive model).

### FR-04: Donut Chart — Correct Token Composition
**File:** `src/utils/overviewDataProcessor.ts`, lines 287-288

Change:
```ts
const cacheMiss = input - cache
const total = cacheMiss + cache + output
```
To:
```ts
const cacheMiss = input
const total = input + cache + output
```

### FR-05: Cost Calculator — Revert to Original Additive Formula
**File:** `src/utils/costCalculator.ts`, lines 13-14

Change:
```ts
const cacheMissTokens = tokens.input - cacheReadTokens
const inputCost = cacheMissTokens * (pricing.input ?? 0)
```
To:
```ts
const inputCost = tokens.input * (pricing.input ?? 0)
```
Remove the `cacheMissTokens` intermediate variable entirely. The original formula `input * input_price + cache * cache_price + output * output_price` was correct because `input` and `cache` are additive, not nested.

## Non-Functional Requirements

- NFR-01: All metric card values on the Overview page must be non-negative for real data.
- NFR-02: The Estimated Cost card must reflect correct total cost (no undercounting or negative values).
- NFR-03: The donut chart must display segments proportional to actual token counts (three additive segments: Cache Miss, Cache Read, Output).

## Constraints

- Only 2 files are in scope: `src/utils/overviewDataProcessor.ts` and `src/utils/costCalculator.ts`.
- The `tokens_input` and `tokens_cache_read` fields in the data schema are additive — this is the foundational assumption that must be preserved.
- No API or data format changes are needed — the JSON output from `scripts/sync-opencode-data.js` is already correct.

## Regression Check

The following must NOT break after the fix:

| What | Why |
|---|---|
| Cache Read card value | Already correct — `totalCacheTokens` is displayed directly (line 252) |
| Output Tokens card value | Already correct — `totalOutputTokens` is displayed directly (line 246) |
| Total Tokens card (sum of input+output+cache) | Already correct — computed at line 146 via `d.input + d.output + d.cache` |
| Total Sessions card | Unaffected |
| Models / Providers cards | Unaffected |
| Daily cost chart (`computeDailyCost`) | Passes raw `input_tokens` and `cache_tokens` to `calculateCost` — will be fixed automatically by FR-05 |
| Top Models / Top Projects breakdowns | Pass raw fields to `calculateCost` — fixed automatically by FR-05 |
| Recent Sessions table | Pass raw fields to `calculateCost` — fixed automatically by FR-05 |

The Cost Calculator revert (FR-05) is the highest-risk change because `calculateCost` is called from multiple places. However, all callers pass the raw additive fields unchanged, so reverting to the additive formula is both correct and safe.

## Open Questions

None — root cause is confirmed, all fixes are deterministic code changes with clear before/after values.

---
Version: 1 | Author: analyst | Date: 2026-05-25

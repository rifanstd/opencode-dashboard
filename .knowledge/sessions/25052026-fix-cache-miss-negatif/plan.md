# Fix Cache Miss Negative Value & Additive Token Model Misunderstanding — Implementation Plan

> **For the Orchestrator:** The Orchestrator delegates this plan to the Programmer for execution. After implementation, the Orchestrator delegates to the Reviewer for code review. Do NOT dispatch subagents directly — the Orchestrator manages the multi-agent pipeline.

**Goal:** Fix the negative Cache Miss card value and incorrect cost/token displays by treating `input_tokens` + `cache_tokens` as **additive** (not nested) fields.

**Architecture:** The opencode database stores `tokens_input` and `tokens_cache_read` as independent additive columns — `input` already represents non-cached input (cache misses). The bug was introduced by subtracting `cache` from `input` under the incorrect assumption `cache ⊆ input`. Fix: remove all subtractions and treat them as additive.

**Tech Stack:** TypeScript, Recharts (donut chart is read-only in this fix)

**Reference:** Requirements: `.knowledge/sessions/25052026-fix-cache-miss-negatif/requirements.md` v1

---

## Decision Points

- [x] **Additive model confirmed** — `tokens_input` and `tokens_cache_read` are additive fields in opencode's database. No user decision needed.
- [x] **No data format change needed** — The JSON output from `scripts/sync-opencode-data.js` is already correct.
- [x] **All callers of `calculateCost` pass raw additive fields** — verified safe for revert.

---

## Task Breakdown

### Task 1: Fix Cache Miss card value (FR-01)

**Files:**
- Modify: `src/utils/overviewDataProcessor.ts:160-161`

**What:** `totalInputTokens` already represents non-cached input (cache misses). Remove the incorrect subtraction.

- [ ] **Step 1: Apply the fix**

```ts
// BEFORE (line 160-161):
  // Total cache miss tokens = input - cache_read (computed, not stored)
  const totalCacheMissTokens = totalInputTokens - totalCacheTokens

// AFTER:
  // Cache miss = non-cached input tokens (additive model: input and cache are separate columns)
  const totalCacheMissTokens = totalInputTokens
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc -b --noEmit`
Expected: No errors related to this change.

---

### Task 2: Fix Cache Miss 7-day trend (FR-02)

**Files:**
- Modify: `src/utils/overviewDataProcessor.ts:215-216`

**What:** Same additive fix applied to the 7-day comparison window.

- [ ] **Step 1: Apply the fix**

```ts
// BEFORE (lines 215-216):
  const cacheMiss7d = inputTokens7d - cacheTokens7d
  const cacheMissPrev7d = inputTokensPrev7d - cacheTokensPrev7d

// AFTER:
  const cacheMiss7d = inputTokens7d
  const cacheMissPrev7d = inputTokensPrev7d
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc -b --noEmit`
Expected: No errors related to this change.

---

### Task 3: Fix Input Tokens card to show total input (FR-03)

**Files:**
- Modify: `src/utils/overviewDataProcessor.ts:240`

**What:** The Input Tokens card must show `input + cache` = total input tokens (additive model).

- [ ] **Step 1: Apply the fix**

```ts
// BEFORE (line 240):
      value: formatNumber(totalInputTokens),

// AFTER:
      value: formatNumber(totalInputTokens + totalCacheTokens),
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc -b --noEmit`
Expected: No errors related to this change.

---

### Task 4: Fix donut chart token composition (FR-04)

**Files:**
- Modify: `src/utils/overviewDataProcessor.ts:287-288`

**What:** Donut segments must be three additive segments. `cacheMiss = input` (no subtraction), and `total = input + cache + output`.

- [ ] **Step 1: Apply the fix**

```ts
// BEFORE (lines 287-288):
  const cacheMiss = input - cache
  const total = cacheMiss + cache + output

// AFTER:
  const cacheMiss = input
  const total = input + cache + output
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc -b --noEmit`
Expected: No errors related to this change.

---

### Task 5: Fix cost calculator to use additive formula (FR-05)

**Files:**
- Modify: `src/utils/costCalculator.ts:12-14`

**What:** Revert to the original additive cost formula: `input * input_price + cache * cache_price + output * output_price`. Remove the `cacheMissTokens` intermediate variable. This is the highest-impact change — `calculateCost` is called from `overviewDataProcessor.ts` (5 call sites), `SessionsList.tsx` (1 call site), and `SessionDetail.tsx` (1 call site). All pass raw additive fields, so the revert is safe.

- [ ] **Step 1: Apply the fix**

```ts
// BEFORE (lines 12-14):
  const cacheReadTokens = tokens.cache ?? 0
  const cacheMissTokens = tokens.input - cacheReadTokens
  const inputCost = cacheMissTokens * (pricing.input ?? 0)

// AFTER:
  const inputCost = tokens.input * (pricing.input ?? 0)
```

- [ ] **Step 2: Verify all call sites compile**

Run: `npx tsc -b --noEmit`
Expected: No errors. The `cacheReadTokens` variable is still used on line 17 for `cacheCost`, so it must be kept.

**Note:** `cacheReadTokens` (line 12 before the edit) is also used on line 17 (`const cacheCost = cacheReadTokens * (pricing.cache ?? 0)`). After the edit, line 12 stays as-is — only lines 13-14 are replaced.

- [ ] **Step 3: Verify the final function signature**

After the fix, `calculateCost` should look like:

```ts
export function calculateCost(
  tokens: { input: number; output: number; reasoning?: number; cache?: number },
  pricing: Pricing
): number {
  const cacheReadTokens = tokens.cache ?? 0
  const inputCost = tokens.input * (pricing.input ?? 0)
  const outputCost = tokens.output * (pricing.output ?? 0)
  const reasoningCost = (tokens.reasoning ?? 0) * (pricing.reasoning ?? 0)
  const cacheCost = cacheReadTokens * (pricing.cache ?? 0)
  return inputCost + outputCost + reasoningCost + cacheCost
}
```

---

### Task 6: Full build verification

**Dependency:** Tasks 1-5 complete

- [ ] **Step 1: Type-check the entire project**

Run: `npx tsc -b`
Expected: Zero type errors.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: Successful Vite build with no errors.

- [ ] **Step 3: Verify the 5 modified locations in overviewDataProcessor.ts**

Check each changed line produces correct values for real data (`totalInputTokens = 367,455`, `totalCacheTokens = 3,720,704`):

| Metric | Before fix | After fix | Expected |
|---|---|---|---|
| Cache Miss card | `367,455 - 3,720,704 = -3,353,249` | `367,455` | Positive |
| Cache Miss 7d trend | `input7d - cache7d` | `input7d` | Non-negative |
| Input Tokens card | `367,455` | `367,455 + 3,720,704 = 4,088,159` | Sum of additive fields |
| Donut total | `(input-cache) + cache + output` | `input + cache + output` | Correct sum |
| Cost formula | `(input-cache)*input_price + ...` | `input*input_price + cache*cache_price + output*output_price` | No subtraction |

---

## Dependency Order

1 → 2 → 3 → 4 → 5 → 6

Tasks 1-5 are independent (different lines in 2 files) but are ordered for logical review flow. Task 6 depends on all prior tasks.

---

## Risks & Alternatives

- **Risk:** `calculateCost` revert (Task 5) could break callers if any pass pre-subtracted values.
  - **Mitigation:** All 7 call sites verified — every one passes raw `s.input_tokens` / `s.cache_tokens` / `d.input` / `d.cache` directly from the JSON data. No callers do pre-subtraction.
  - **Alternative:** If a caller is found that pre-subtracts, fix that caller instead of reverting the formula.

- **Risk:** The Input Tokens card doubles in displayed value (from 367K to 4M), which may surprise the user.
  - **Mitigation:** This is correct behavior — the card label "Input Tokens" implies total input, which is `input + cache`. The previous value only showed non-cached input.

- **Risk:** Donut chart segments change proportions significantly.
  - **Mitigation:** This is correct behavior. Cache Miss (non-cached input) will be ~367K, Cache Read ~3.7M, Output will be its own value. The three segments are now truly additive.

---
Version: 1 | Author: planner | Ref: requirements v1 | Date: 2026-05-25

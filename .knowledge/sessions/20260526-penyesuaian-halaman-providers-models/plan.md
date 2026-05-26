# Adjust Providers & Models Page Pricing Display - Implementation Plan

> **For the Orchestrator:** The Orchestrator delegates this plan to the Programmer for execution. After implementation, the Orchestrator delegates to the Reviewer for code review. Do NOT dispatch subagents directly — the Orchestrator manages the multi-agent pipeline.

**Goal:** Fix the double-division pricing bug and update the Providers & Models page to display accurate pricing in the correct format with cache and reasoning prices.

**Architecture:** Client-side dashboard with static JSON data. The sync script reads from local opencode cache and exports to `public/data/models.json`. The Resources.tsx page loads this data and formats it for display. Fix is localized to two files: sync script (remove incorrect division) and Resources.tsx (update display format).

**Tech Stack:** JavaScript (Node.js sync script), React/TypeScript (Resources.tsx), Vite build system

**Reference:** Requirements: .knowledge/sessions/20260526-penyesuaian-halaman-providers-models/requirements.md v1

---

## Files Requiring Changes

| File | Responsibility | Change Type |
|---|---|---|
| `scripts/sync-opencode-data.js:578-581` | Price unit conversion | Remove `/1_000_000` division - pass through raw values |
| `src/pages/Resources.tsx:182-185` | Price display formatting | Update format to `/1M`, add cache and reasoning prices |

---

## Task 1: Fix Double-Division Bug in Sync Script

**Files:**
- Modify: `scripts/sync-opencode-data.js:578-581`

**Context:** The opencode cache stores prices in per-1M-tokens format (e.g., `3` means $3.00 per 1 million tokens). The sync script incorrectly divides by 1,000,000 again, resulting in values like `0.000003` which display as `$0.00` after `toFixed(2)`.

- [ ] **Step 1: Remove incorrect division from price fields**

Open `scripts/sync-opencode-data.js` and locate lines 578-581. Change:

```javascript
// BEFORE (lines 578-581):
input_price: rawInputPrice / 1_000_000,
output_price: rawOutputPrice / 1_000_000,
reasoning_price: rawReasoningPrice != null ? rawReasoningPrice / 1_000_000 : undefined,
cache_price: rawCacheReadPrice / 1_000_000,
```

To:

```javascript
// AFTER:
input_price: rawInputPrice,
output_price: rawOutputPrice,
reasoning_price: rawReasoningPrice != null ? rawReasoningPrice : undefined,
cache_price: rawCacheReadPrice,
```

- [ ] **Step 2: Update the comment to reflect correct behavior**

Change the comment at lines 565-566 from:

```javascript
// Pricing from modelData.cost.{input,output,cache_read} (per-1M-tokens)
// Convert to per-token by dividing by 1_000_000
```

To:

```javascript
// Pricing from modelData.cost.{input,output,cache_read} (per-1M-tokens)
// Values are already in per-1M-tokens format - pass through without conversion
```

- [ ] **Step 3: Verify sync script runs without errors**

Run: `npm run sync`

Expected: Script completes successfully and generates `public/data/models.json`

- [ ] **Step 4: Verify pricing values in generated JSON**

Run: `cat public/data/models.json | grep -A 5 "input_price"`

Expected: Values should be whole numbers or decimals like `3`, `15`, `0.3` (not `0.000003`)

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-opencode-data.js
git commit -m "fix: remove double-division bug in pricing conversion

The sync script was incorrectly dividing by 1,000,000 when the cache
already stores prices in per-1M-tokens format. This caused all prices
to display as \$0.00/Mt in the dashboard."
```

---

## Task 2: Update Pricing Display Format in Resources.tsx

**Files:**
- Modify: `src/pages/Resources.tsx:182-185`

**Context:** The current display format uses `/Mt` (per megatoken) which is non-standard. Update to `/1M` format and add cache read pricing display.

- [ ] **Step 1: Update input and output price format**

Open `src/pages/Resources.tsx` and locate lines 182-183. Change:

```typescript
// BEFORE (lines 182-183):
const inputPrice = model.input_price ? `$${model.input_price.toFixed(2)}/Mt input` : null
const outputPrice = model.output_price ? `$${model.output_price.toFixed(2)}/Mt output` : null
```

To:

```typescript
// AFTER:
const inputPrice = model.input_price ? `$${model.input_price.toFixed(2)}/1M input` : null
const outputPrice = model.output_price ? `$${model.output_price.toFixed(2)}/1M output` : null
```

- [ ] **Step 2: Add cache read pricing display**

After line 183, add the cache price formatting:

```typescript
const cachePrice = model.cache_price ? `$${model.cache_price.toFixed(2)}/1M cache` : null
```

- [ ] **Step 3: Add reasoning pricing display**

After the cache price line, add reasoning price formatting:

```typescript
const reasoningPrice = model.reasoning_price ? `$${model.reasoning_price.toFixed(2)}/1M reasoning` : null
```

- [ ] **Step 4: Update pricingParts array to include new price types**

Change line 185 from:

```typescript
// BEFORE (line 185):
const pricingParts = [inputPrice, outputPrice, ctx].filter(Boolean).join(' · ')
```

To:

```typescript
// AFTER:
const pricingParts = [inputPrice, outputPrice, cachePrice, reasoningPrice, ctx].filter(Boolean).join(' · ')
```

- [ ] **Step 5: Verify TypeScript compiles without errors**

Run: `npx tsc -b`

Expected: No type errors. The `ModelInfo` interface already includes `cache_price?: number` and `reasoning_price?: number` fields.

- [ ] **Step 6: Verify Vite build succeeds**

Run: `npm run build`

Expected: Build completes successfully without errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Resources.tsx
git commit -m "feat: update pricing display format and add cache/reasoning prices

- Change format from /Mt to /1M for clarity
- Add cache read pricing display
- Add reasoning pricing display
- Maintain display order: input, output, cache, reasoning, context"
```

---

## Task 3: End-to-End Verification

**Files:**
- None (verification only)

**Context:** Verify the complete fix works end-to-end with actual data.

- [ ] **Step 1: Run sync to regenerate data with fixed prices**

Run: `npm run sync`

Expected: Script completes successfully

- [ ] **Step 2: Start dev server**

Run: `npm run dev`

Expected: Dev server starts on localhost

- [ ] **Step 3: Verify pricing display in browser**

Open browser to `http://localhost:5173` (or assigned port) and navigate to Providers & Models page.

Expected:
- Prices should show actual values (e.g., `$3.00/1M input`) instead of `$0.00/Mt`
- Format should use `/1M` instead of `/Mt`
- Cache read prices should appear if available (e.g., `$0.30/1M cache`)
- Reasoning prices should appear if available (e.g., `$6.00/1M reasoning`)
- Display order: input · output · cache · reasoning · context window

- [ ] **Step 4: Run lint check**

Run: `npm run lint`

Expected: No linting errors

- [ ] **Step 5: Final commit with all changes**

```bash
git add -A
git commit -m "chore: complete pricing display fix

- Fixed double-division bug in sync script
- Updated display format to /1M
- Added cache and reasoning price display
- Verified end-to-end functionality"
```

---

## Dependency Order

```
Task 1 (fix sync script) → Task 2 (update display) → Task 3 (verification)
```

Task 1 must be completed first because Task 2 depends on correct pricing values being available in the JSON data.

---

## Risks & Alternatives

| Risk | Mitigation |
|---|---|
| Cache file structure may vary between opencode versions | The sync script already handles multiple fallback fields (`cost.input`, `input_price`, `inputPrice`). No additional handling needed. |
| Some models may not have cache or reasoning prices | The display logic uses conditional checks (`model.cache_price ? ... : null`) and `.filter(Boolean)` to handle missing values gracefully. |
| Prices may display with excessive decimal places | Using `toFixed(2)` ensures consistent 2 decimal place formatting. |

---

## Open Questions (from Requirements)

| Question | Recommendation |
|---|---|
| Q-001: Should we display tooltip explaining pricing source? | Out of scope for this fix. Can be added as separate enhancement. |
| Q-002: What about different pricing tiers (batch vs standard)? | The cache only exposes single pricing per model. Display what's available. |
| Q-003: Should reasoning price be separate or merged with output? | Keep separate for transparency as specified in FR-04. |

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] `npm run sync` completes without errors
- [ ] `public/data/models.json` contains correct pricing values (not 0.000003)
- [ ] `npx tsc -b` passes without type errors
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] Browser shows correct pricing format (`/1M` not `/Mt`)
- [ ] Cache and reasoning prices display when available
- [ ] Display order is: input · output · cache · reasoning · context

---

Version: 1 | Author: planner | Ref: requirements v1 | Date: 2026-05-26

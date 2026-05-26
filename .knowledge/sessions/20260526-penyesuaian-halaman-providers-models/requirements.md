# Requirements: Adjust Providers & Models Page Pricing Display

## Context

User reports issues with the Providers & Models page (`Resources.tsx`) regarding token cost display:

1. **All token costs show $0.00/Mt** — pricing data appears as zero despite models having cost information in the opencode cache
2. **Format change requested** — user wants format changed from `$X.XX/Mt` to `$X.XX/1M`
3. **Missing cost types** — page only shows input and output prices, but user wants to see cache read pricing and potentially reasoning pricing
4. **Data source question** — user asks if pricing data fetches from `https://www.skills.sh`

## Root Cause Analysis

### RCA-1: Prices Display as $0.00/Mt (CONFIRMED)

**Location:** `scripts/sync-opencode-data.js:565-583` and `src/pages/Resources.tsx:182-183`

The sync script reads pricing from the opencode cache `models.json` file at `~/.cache/opencode/models.json`. The cache stores prices in **per-1M-tokens** format (e.g., `3` means $3.00 per 1 million tokens). However, the sync script incorrectly divides by 1,000,000 again:

```javascript
// sync-opencode-data.js:578-581
input_price: rawInputPrice / 1_000_000,   // 3 → 0.000003
output_price: rawOutputPrice / 1_000_000,  // 3 → 0.000003
```

Then in the UI, `toFixed(2)` formats `0.000003` as `"0.00"`:

```typescript
// Resources.tsx:182
const inputPrice = model.input_price ? `$${model.input_price.toFixed(2)}/Mt input` : null
```

**Result:** All prices display as `$0.00/Mt` regardless of actual cost.

### RCA-2: Display Format Shows "/Mt" (CONFIRMED)

**Location:** `src/pages/Resources.tsx:182-183`

The current format uses `/Mt` (per megatoken) which is non-standard. User requests `/1M` format which is clearer.

### RCA-3: Cache and Reasoning Prices Not Displayed (CONFIRMED)

**Location:** `src/pages/Resources.tsx:182-185`

The current code only constructs display strings for `inputPrice` and `outputPrice`:

```typescript
const inputPrice = model.input_price ? `$${model.input_price.toFixed(2)}/Mt input` : null
const outputPrice = model.output_price ? `$${model.output_price.toFixed(2)}/Mt output` : null
const ctx = model.context_window ? `${(model.context_window / 1000).toFixed(0)}K ctx` : null
const pricingParts = [inputPrice, outputPrice, ctx].filter(Boolean).join(' · ')
```

The `ModelInfo` type already includes `cache_price` and `reasoning_price` fields (both optional), but they are never used in the display logic.

### RCA-4: No Integration with skills.sh (CONFIRMED)

**Location:** `scripts/sync-opencode-data.js:549-587`

The pricing data comes **exclusively** from the local opencode cache file at `~/.cache/opencode/models.json`. There is:
- No HTTP fetch to any external API
- No reference to `skills.sh` or any pricing service
- No fallback pricing source

The cache file is populated by the opencode terminal itself, not by this dashboard.

## Data Flow Architecture

```
opencode cache (~/.cache/opencode/models.json)
    ↓
sync script (scripts/sync-opencode-data.js)
    ↓ reads modelData.cost.{input, output, cache_read}
    ↓ divides by 1,000,000 (INCORRECT - double division)
    ↓
public/data/models.json
    ↓
dataLoader.ts → loadModels()
    ↓
Resources.tsx (Providers & Models page)
    ↓ formats as $X.XX/Mt (only input + output)
    ↓
Display
```

## Functional Requirements

- **FR-01: Fix price unit conversion**
  - Remove the incorrect `/1_000_000` division in `scripts/sync-opencode-data.js:578-581`
  - The cache stores prices in per-1M-tokens format; the sync script should pass them through without conversion
  - After fix, a model priced at `$3.00/1M input` in the cache must display as `$3.00/1M input` in the dashboard

- **FR-02: Change display format to /1M**
  - Update `src/pages/Resources.tsx:182-183` to use `/1M` instead of `/Mt`
  - Format: `$X.XX/1M input`, `$X.XX/1M output`

- **FR-03: Display cache read pricing**
  - Add cache read price to the pricing display in `Resources.tsx`
  - Format: `$X.XX/1M cache`
  - Only display if `model.cache_price` is defined and greater than 0

- **FR-04: Display reasoning pricing (optional)**
  - Add reasoning price to the pricing display in `Resources.tsx`
  - Format: `$X.XX/1M reasoning`
  - Only display if `model.reasoning_price` is defined and greater than 0

- **FR-05: Pricing display order**
  - Display prices in this order: input, output, cache, reasoning, context window
  - Separate with ` · ` delimiter
  - Example: `$3.00/1M input · $15.00/1M output · $0.30/1M cache · 128K ctx`

## Non-Functional Requirements

- **NFR-01: Sync script only** — Price data must be embedded in exported JSON at sync time, not fetched at runtime. Dashboard remains client-side only.
- **NFR-02: Backward compatibility** — The JSON schema of `models.json` should not change structurally. Existing consumers must continue to work.
- **NFR-03: No new dependencies** — Do not add npm packages.
- **NFR-04: Build integrity** — `tsc -b` and `npm run build` must pass without errors after changes.
- **NFR-05: Graceful degradation** — If pricing data is missing or zero, the display should show nothing (not `$0.00/1M`).

## Constraints

- **C-01:** The dashboard is **client-side only** — pricing data must be embedded in exported JSON at sync time.
- **C-02:** `public/data/` is in `.gitignore` — generated JSON files are never committed.
- **C-03:** The sync script reads from the **user's local opencode cache** — the structure of `models.json` in the cache is determined by opencode, not by this project.
- **C-04:** `verbatimModuleSyntax: true` and other TypeScript project reference rules apply.
- **C-05:** The sync script cannot modify opencode's cache file — it is read-only.
- **C-06:** No external API calls — pricing data comes only from local cache.

## Files Requiring Changes

| File | Responsibility | Nature of Change |
|---|---|---|
| `scripts/sync-opencode-data.js:578-581` | Price unit conversion | **Remove `/1_000_000` division** — pass through raw values from cache |
| `src/pages/Resources.tsx:182-185` | Price display formatting | **Update format to /1M**, add cache and reasoning prices |

## Open Questions

- **? Q-001: Should we display a tooltip or info icon explaining pricing source?**
  - User asked about skills.sh integration — should we add a note indicating prices come from local opencode cache?

- **? Q-002: What if a model has different pricing tiers (e.g., batch vs. standard)?**
  - The cache may contain multiple pricing structures. Should we display all or just the standard rate?

- **? Q-003: Should reasoning price be displayed as a separate line item or merged with output?**
  - Some providers bundle reasoning cost into output cost. Should we show it separately for transparency?

---

## Summary of Findings

1. **$0.00/Mt issue is a double-division bug** — sync script divides by 1,000,000 when cache already stores per-1M-tokens values
2. **Format change is straightforward** — update string template in Resources.tsx from `/Mt` to `/1M`
3. **Cache/reasoning prices already in data model** — `ModelInfo` type has `cache_price` and `reasoning_price` fields, just not displayed
4. **No skills.sh integration** — pricing comes exclusively from local opencode cache, no external API
5. **Fix is localized** — two files need changes: sync script (remove division) and Resources.tsx (update display)

---

Version: 1 | Author: analyst | Date: 2026-05-26

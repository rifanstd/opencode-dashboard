# Requirements: Overview Page Key Metrics Restructuring

## Context
User requested modifications to the Overview page's Key Metrics section in the opencode-dashboard. The request involves removing 7 existing metric cards and replacing them with 4 new cards, changing the token count formula for the Total Tokens card, and applying K/M number formatting across all meaningful numbers (tokens, sessions, cost). The underlying data comes from static JSON files exported by the sync script from opencode's SQLite database and configuration files.

## Functional Requirements

### FR-01: Keep "Total Sessions" Card with Updated Formatting
- **Source**: `overview.totalSessions` (from `overview.json`, already represents global session count)
- **Value**: The session count formatted using K/M notation (e.g., 1500 → "1.5K")
- **Behavior**: Retain existing subLabel (±X vs last 30 days) and trend indicator

### FR-02: Modify "Total Tokens" Card Formula
- **New formula**: Sum of `cache + input + output` across all `tokenUsage.byDay` entries
- **Excluded**: `reasoning` tokens (currently included in the formula)
- **Formatting**: Apply K/M number formatting to the displayed value
- **Behavior**: Retain existing subLabel (±X% vs last 7 days) and trend indicator

### FR-03: Create "Input Tokens" Card
- **Label**: "Input Tokens"
- **Value source**: Sum of the `input` field across all `tokenUsage.byDay` entries (represents input token cache miss globally)
- **Formatting**: Apply K/M number formatting
- **SubLabel/Trend**: Produce a comparison subLabel (e.g., vs last 7 days) with trend indicator

### FR-04: Create "Cache" Card
- **Label**: "Cache"
- **Value source**: Sum of the `cache` field across all `tokenUsage.byDay` entries (combined cache read + cache write globally)
- **Formatting**: Apply K/M number formatting
- **SubLabel/Trend**: Produce a comparison subLabel (e.g., vs last 7 days) with trend indicator

### FR-05: Create "Models" Card
- **Label**: "Models"
- **Value source**: `models.length` (number of models available from connected providers). The `models` array is already loaded in Overview.tsx via `loadModels()`.
- **Formatting**: Apply K/M number formatting (only relevant if model count exceeds 1000, unlikely but consistent)
- **SubLabel/Trend**: Card should show a static subLabel text such as "Available models from all providers" without a trend indicator, OR omit subLabel entirely. See Open Question Q-003.

### FR-06: Create "Providers" Card
- **Label**: "Providers"
- **Value source**: Count of providers from `providers.json` where `configured === true` (only providers with API keys set). Overview.tsx currently does NOT call `loadProviders()` — this must be added to the data fetching `useEffect`.
- **Formatting**: Apply K/M number formatting
- **SubLabel/Trend**: Show static subLabel text (e.g., "Connected providers"), no trend indicator.

### FR-07: Remove 7 Existing Metric Cards
The following cards must be removed from `computeKeyMetrics()` output:
- "Most Used Model" (currently at index 3)
- "Active Projects" (currently at index 4)
- "Total Messages" (currently at index 5)
- "Sessions in Last 7 Days" (currently at index 6)
- "Sessions in Last 30 Days" (currently at index 7)
- "Avg Tokens per Session" (currently at index 8)
- "Tool Calls" (currently at index 9)

### FR-08: Implement K/M Number Formatting Utility
- Create a `formatNumber` function (likely in `src/utils/costCalculator.ts` or a new utility file) that formats numbers:
  - `< 1000`: Use standard locale formatting (e.g., "999")
  - `>= 1000 and < 1000000`: Format as `X.XK` (e.g., 1000 → "1K", 1500 → "1.5K", 999999 → "999.9K")
  - `>= 1000000`: Format as `X.XM` (e.g., 1000000 → "1M", 2500000 → "2.5M")
  - Strip trailing `.0` (e.g., "1.0K" → "1K", "1.0M" → "1M")
- Apply this formatting to ALL metric card values where the value is a number representing tokens, sessions, or cost (see FR-09 for cost)

### FR-09: Apply K/M Formatting to Estimated Cost Card
- The "Estimated Cost" card (currently retained) must apply K/M formatting to its value
- Current format: `$X.XX` (via `formatCost()`)
- New format: `$X.XK` or `$X.XM` where applicable, falling back to `$X.XX` for values under $1000
- **Example**: $1500 → "$1.5K", $2000000 → "$2M", $45.23 → "$45.23"
- See Open Question Q-004 for confirmation

### FR-10: Clean Up Dead Code in computeKeyMetrics()
After removing 7 cards, the following computations inside `computeKeyMetrics()` become unused (unless consumed by other cards):
- `messages7d`, `messagesPrev7d`, `messagesDiff` (only used by "Total Messages" card)
- `sessions7d`, `sessionsPrev7d`, `sessionsDiff` (only used by "Sessions in Last 7 Days" card)
- `sessions30d`, `sessionsPrev30d`, `sessions30dDiff` (used by "Total Sessions" subLabel and "Sessions in Last 30 Days" — **KEEP sessions30d logic for Total Sessions subLabel**)
- `avgTokensPerSession` (only used by "Avg Tokens per Session" card)
- `toolMetrics` computation and toolDiff closure (only used by "Tool Calls" card)
- The `parts` parameter to `computeKeyMetrics()` if no remaining code uses it

### FR-11: Add Providers Data Loading to Overview.tsx
- Add `loadProviders` to the import from `dataLoader.ts`
- Add `loadProviders()` to the `Promise.all([...])` call in the `fetch()` function
- Add `ProviderInfo[]` state variable
- Pass providers count into `computeKeyMetrics()` or compute the card value directly in Overview.tsx

### FR-12: Remove Reasoning Tokens from Charts
- **TokenCompositionChart**: Remove the "Reasoning" donut segment. Only show Input, Output, Cache.
- **TopModelsChart**: Remove the reasoning token column/bar from the model breakdown display.
- **computeTokenComposition()** in `overviewDataProcessor.ts`: Remove reasoning from the segments array.
- **ModelBreakdownItem** type: The `reasoning` field may remain in type but should not be rendered.

## Non-Functional Requirements

### NFR-01: TypeScript Type Safety
- All changes must pass `tsc -b` with zero type errors
- No use of `any`, `as` casts against unknown types, or suppressed errors
- The `MetricCardData` type (`label: string, value: string | number, subLabel?: string, trend?: 'up' | 'down' | 'neutral'`) must accommodate all newly formatted values

### NFR-02: Responsive Layout
- The CSS grid for Key Metrics cards uses `repeat(auto-fit, minmax(220px, 1fr))`. With 7 cards (down from 10), the layout must still render correctly at all viewport widths.
- The grid must not leave large empty gaps on wider screens.

### NFR-03: Performance
- Data loading time should not regress. Adding `loadProviders()` adds one more fetch, but all fetches run in parallel via `Promise.all`. No serialization should be introduced.
- `computeKeyMetrics()` should not recompute more than necessary. Use React `useMemo` dependencies correctly (already in place).

### NFR-04: Fallback Handling
- If `providers.json` fails to load (returns empty array), the "Providers" card should show "0" gracefully.
- If `models.json` fails to load, the "Models" card should show "0" gracefully.

## Constraints

- **Client-side only**: All data comes from static JSON files in `public/data/`. No backend API changes are needed.
- **Sync script unchanged**: The `scripts/sync-opencode-data.js` script should NOT be modified unless Open Question Q-001 dictates otherwise. The dashboard must work with existing JSON file formats.
- **Chart changes**: TokenCompositionChart and TopModelsChart must have reasoning tokens removed. Other charts (DailyActivity, CostTrend, ProjectActivity, ActivityHeatmap) remain untouched.
- **Token semantics are fixed by sync script**: The `cache` field in token data is the aggregated value `tokens_cache_read + tokens_cache_write`. Separating cache read from cache write requires a sync script change.
- **`SummaryCard` component**: No changes needed. The `value` prop already accepts `string | number`. Formatting is the caller's responsibility.
- **`MetricCardData` type**: No changes needed. `value` is already `string | number`.

## Open Questions (RESOLVED)

- **Q-001: Cache Read vs Cache (Read+Write)** → **RESOLVED: Option A.** Use existing combined value. Card labeled **"Cache"** (not "Cache Read").

- **Q-002: Providers Count Criteria** → **RESOLVED: Option B.** Only count providers with `configured: true`.

- **Q-003: SubLabels for New Cards** → **RESOLVED: Option B.** Input Tokens and Cache cards get comparison subLabels with trend; Models and Providers show static text only.

- **Q-004: Cost K/M Formatting** → **RESOLVED: Option A.** Estimated Cost uses K/M formatting with USD prefix.

- **Q-005: Formatting Precision** → **RESOLVED: Option A.** Always 1 decimal place, strip trailing ".0".

- **Q-006: Reasoning Tokens Visibility** → **RESOLVED: Option B.** Remove reasoning tokens from ALL views — both metric cards AND charts (TokenCompositionChart, TopModelsChart).

---
Version: 1 | Author: analyst | Date: 2026-05-24

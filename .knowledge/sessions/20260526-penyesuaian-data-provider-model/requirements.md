# Requirements: Fix Provider & Model Data Mismatch with OpenCode Terminal

## Context

User reports a data mismatch between the OpenCode terminal and the dashboard website for the Providers & Models page. Specifically:
- Provider "OpenCode Go" shows **14 models** on the website but only **12 models** in the actual OpenCode terminal
- One extra model on the website is "MiMo V2 Omni" which doesn't exist in reality (terminal)
- User wants all provider and model data to match reality
- Overview page data must also match

This issue persists **after** previous fixes (session `20260525-fix-overview-bugs`) that corrected:
- Nested provider→models structure iteration in sync script
- Pricing extraction from `cost.input`/`cost.output` with unit conversion
- Provider field corruption (garbled characters)
- Overview models count filtered to configured providers only

## Data Flow Architecture

```
opencode cache (~/.cache/opencode/models.json)
    ↓
sync script (scripts/sync-opencode-data.js) — reads ALL models, no filtering
    ↓
public/data/models.json
    ↓
dataLoader.ts — fetch('/data/models.json')
    ↓
Resources.tsx (Providers & Models page)
Overview.tsx (Overview page — model count metric)
```

## Root Cause Analysis

### RCA-1: Sync Script Exports All Cached Models Without Filtering (CONFIRMED)

**Location:** `scripts/sync-opencode-data.js:480-517`

The sync script reads `models.json` from the opencode cache directory and exports **every model** found under each provider's `.models` object. There is **no filtering logic** — no checks for model availability, deprecation, activation status, or any other criteria.

```javascript
for (const [modelId, modelData] of Object.entries(providerModels)) {
  if (!modelData || typeof modelData !== 'object') continue
  // ... directly pushes model to export array
  models.push({ id: modelId, name: modelData.name ?? modelId, provider: providerId, ... })
}
```

### RCA-2: Cache File Contains Models Not Shown by Terminal (CONFIRMED)

The opencode cache `models.json` (located at `C:\Users\rfan2\.cache\opencode\models.json` on this system) contains **14 models** under the `opencode-go` provider. The OpenCode terminal displays only **12** of these 14 models. The terminal applies **additional filtering criteria** that the dashboard does not apply.

The two extra models are:
1. **MiMo V2 Omni** — exists in cache, excluded by terminal
2. **MiMo V2 Pro** — exists in cache, excluded by terminal

Both models have `"status": "deprecated"` in their cache entry metadata, which is the filtering criteria the terminal uses to exclude them.

### RCA-3: Overview Page Model Count Reflects Cache, Not Reality (CONFIRMED)

**Location:** `src/pages/Overview.tsx:126-128`

The Overview page counts models from configured providers:
```typescript
const modelsCount = useMemo(
  () => models.filter((m) => configuredProviderIds.has(m.provider)).length,
  [models, configuredProviderIds],
)
```

This correctly filters to configured providers but still counts **all cached models** from those providers (14), not the **actually available models** (12).

### RCA-4: No Alternative Source of Truth (CONFIRMED)

The sync script has **no other data source** for model information besides the cache `models.json`. It does not:
- Query a live API for available models
- Cross-reference with session usage history
- Check for deprecation/availability flags in the model metadata
- Read from a separate "active models" configuration file

## Functional Requirements

- **FR-01: Sync script must filter models to match terminal reality**
  - The exported `public/data/models.json` must contain only models that the OpenCode terminal would display for each provider
  - After `npm run sync`, the model count for any provider must match the terminal's model count for that provider

- **FR-02: Filter out deprecated models**
  - The sync script must skip models where `modelData.status === 'deprecated'`
  - This matches the terminal's behavior of hiding deprecated models from the provider catalog
  - The filter must be applied during the model iteration loop in `scripts/sync-opencode-data.js`

- **FR-03: Overview page model count must match reality**
  - The Models metric card on Overview must display the count of **actually available** models from configured providers, not the count of all cached models
  - The count must match the Providers & Models page model count for each provider

- **FR-04: Providers & Models page must show only real models**
  - The Resources page (`/providers-models`) must list only models that exist in the terminal
  - No stale, deprecated, or unavailable models should be displayed

- **FR-05: Model usage data must remain accurate**
  - If a model was used in a session but is no longer available, it should still appear in session history and token usage charts (do not retroactively remove historical data)
  - The filtering applies only to the **provider catalog** (what models are currently available), not to **session history**

- **FR-06: Model Usage chart must display shortened model names**
  - Long model identifiers like `accounts/fireworks/models/kimi-k2p6` must be shortened to `<provider>/<model_name>` format (e.g., `fireworks/kimi-k2p6`)
  - The shortening logic must be applied in the sync script when generating `token-usage.json` or in the chart component when rendering
  - The original full identifier must still be preserved in the data for tooltip/detail views if needed

- **FR-07: Model Usage chart must include provider context for generic model names**
  - Generic model names like `deepseek-v4-pro` that appear without provider context must be prefixed with their provider (e.g., `opencode-go/deepseek-v4-pro`)
  - This ensures users can distinguish the same model name across different providers

- **FR-08: Model Usage chart must aggregate usage across all providers per model**
  - Instead of showing separate bars/entries for `provider-a/model-x` and `provider-b/model-x`, the chart must aggregate them into a single `model-x` entry
  - The aggregation sums token usage (input + output) across all providers for each unique model name
  - The chart displays model names without provider prefix after aggregation (e.g., just `kimi-k2p6`, `deepseek-v4-pro`)
  - Provider breakdown can be shown in tooltip or detail view, but the primary chart view shows aggregated model usage

## Non-Functional Requirements

- **NFR-01: Sync script only** — All data fixes must happen in `scripts/sync-opencode-data.js`. Do NOT add runtime HTTP calls or server-side lookups; the dashboard remains client-side only.
- **NFR-02: Backward compatibility** — The JSON schema of exported files (`models.json`, `providers.json`) should not change structurally. Existing consumers must continue to work.
- **NFR-03: No new dependencies** — Do not add npm packages.
- **NFR-04: Build integrity** — `tsc -b` and `npm run build` must pass without errors after changes.
- **NFR-05: Graceful degradation** — If filtering criteria cannot be determined, the dashboard must not crash. It should fall back to showing all cached models with a warning indicator.
- **NFR-06: Performance** — Model filtering is O(n) on small datasets (< 1000 entries). No measurable performance impact.

## Constraints

- **C-01:** The dashboard is **client-side only** — model data must be embedded in the exported JSON at sync time, not fetched at runtime.
- **C-02:** `public/data/` is in `.gitignore` — generated JSON files are never committed.
- **C-03:** The sync script reads from the **user's local opencode cache** — the structure of `models.json` in the cache is determined by opencode, not by this project.
- **C-04:** `verbatimModuleSyntax: true` and other TypeScript project reference rules apply.
- **C-05:** The sync script cannot modify opencode's cache file — it is read-only.
- **C-06:** The actual opencode data paths on this system are limited — only `C:\Users\rfan2\.cache\opencode\models.json` was found. Local and config directories were not detected.

## Files Requiring Changes

| File | Responsibility | Nature of Change |
|---|---|---|
| `scripts/sync-opencode-data.js:480-517` | Reads cached `models.json`, exports `public/data/models.json` | **Add `status !== 'deprecated'` filter** in the model iteration loop |
| `scripts/sync-opencode-data.js` (token usage section) | Generates `public/data/token-usage.json` | **Add model name shortening** and **provider aggregation** logic |
| `src/pages/Overview.tsx:126-128` | Computes `modelsCount` for metric card | **No change needed** — Overview counts from `models.json` which will already be filtered |
| `src/pages/Resources.tsx:34-39` | Groups models by provider for display | **No change needed** — Resources displays from `models.json` which will already be filtered |
| `src/components/ModelUsageChart.tsx` (or equivalent) | Renders Model Usage chart | **May need adjustment** for display formatting if aggregation is done in sync script |

## Open Questions — RESOLVED

- **Q-001: What filtering criteria does the OpenCode terminal apply?** ✅ **RESOLVED**
  - **Answer:** The terminal filters out models where `status === 'deprecated'`.
  - Both extra models (MiMo V2 Omni, MiMo V2 Pro) have `"status": "deprecated"` in the cache.

- **Q-002: Is there a separate source of truth for "active" models?** ✅ **RESOLVED**
  - **Answer:** No. The terminal filters directly from the same `models.json` cache using the `status` field.

- **Q-003: Should the dashboard filter by session usage history as a fallback?** ✅ **RESOLVED**
  - **Answer:** Not needed. The `status` field provides the correct filtering criteria.

- **Q-004: Can the opencode cache be refreshed before sync?** ⏸️ **NOT NEEDED**
  - The cache is not stale; it intentionally retains deprecated models for historical reference. The terminal simply filters them at display time.

- **Q-005: What is the exact identity of the second extra model?** ✅ **RESOLVED**
  - **Answer:** The second extra model is **MiMo V2 Pro**.

---

## Summary of Findings

1. **The sync script is not at fault for reading the wrong structure** — previous fixes already corrected the nested provider→models iteration, pricing extraction, and provider field assignment.
2. **The sync script IS at fault for lacking filtering** — it exports all 14 cached models for OpenCode Go without applying the terminal's filtering criteria.
3. **The cache file intentionally contains deprecated models** — `C:\Users\rfan2\.cache\opencode\models.json` has 14 models under `opencode-go`, including 2 deprecated ones (MiMo V2 Omni, MiMo V2 Pro). The terminal filters these out at display time.
4. **The UI components faithfully display what the sync script exports** — Resources.tsx and Overview.tsx are not hardcoding or inventing models. The mismatch originates upstream in the data pipeline.
5. **The root cause is upstream filtering disparity** — the OpenCode terminal filters out `status: 'deprecated'` models, but the dashboard sync script does not apply the same filter.
6. **The fix is simple and localized** — add a single condition `modelData.status !== 'deprecated'` in the model iteration loop in `scripts/sync-opencode-data.js`.
7. **Model Usage chart needs name formatting** — Long model identifiers (`accounts/fireworks/models/kimi-k2p6`) need shortening, generic names need provider context, and usage should be aggregated across providers per model.

## Recommended Next Steps

1. ✅ **Filtering criteria identified** — `status === 'deprecated'`
2. ✅ **Extra models identified** — MiMo V2 Omni, MiMo V2 Pro
3. **Implement the filter** in `scripts/sync-opencode-data.js:480-517`
4. **Implement model name shortening** in token-usage.json generation
5. **Implement provider aggregation** for Model Usage chart data
6. **Run `npm run sync`** to regenerate all JSON files
7. **Verify** that:
   - OpenCode Go shows 12 models on both Providers & Models page and Overview page
   - Model Usage chart shows shortened, aggregated model names

---
Version: 1 | Author: analyst | Date: 2026-05-26

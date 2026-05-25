# Requirements: Fix Overview Page Bugs (Models Count & Estimated Cost)

## Context

The opencode-dashboard Overview page (client-side React) displays key metric cards including a **Models** card (count of available models) and an **Estimated Cost** card (computed from session tokens × model pricing). Two bugs have been identified in production:

1. **Models card shows too many models** — counts ALL cached models from all providers, not just those from the user's configured providers.
2. **Estimated Cost card shows $0.00000** — cost calculation always yields zero due to one or both of: (a) pricing data defaulting to 0 in the sync script, (b) model ID mismatch between session data and pricing lookup keys.

Data flows through: `sync-opencode-data.js` (exports JSON) → `dataLoader.ts` (`fetch()`) → `overviewDataProcessor.ts` (computation) → `Overview.tsx` (rendering).

---

## Bug 1: Models Card Shows Inflated Count

### Current Behavior

- The **Models** metric card on the Overview page displays `models.length` — the total count of all model entries from opencode's cached `models.json`.
- This includes models from **all known providers** (including ones the user has never configured), not just models usable by the user.
- For example, a user with only "OpenCode Go" configured sees models from "OpenCode Zen", "OpenCode Pro", etc. counted.
- The subLabel reads `"Available models from all providers"` which is technically accurate but misleading.

### Expected Behavior

- The **Models** card should count only models whose **provider** is among the user's **configured** providers.
- A `ModelInfo` has a `provider` field (string). A `ProviderInfo` has `id` (string) and `configured` (boolean).
- Only models where `model.provider` matches a configured provider's `id` should be counted.
- The subLabel should be updated to reflect the filtering (e.g., `"Available models from configured providers"`).

### Root Cause

| Location | Issue |
|---|---|
| `Overview.tsx:116` | `const modelsCount = models.length` — no filtering of models by configured providers |
| `Overview.tsx:117` | `const providersCount = providers.filter((p) => p.configured).length` — providers ARE correctly filtered, but models are not |
| `overviewDataProcessor.ts:263-266` | Models card uses `modelsCount` as-is with subLabel `"Available models from all providers"` |

### Acceptance Criteria

- **AC-01:** The Models card value equals the count of models whose `provider` field matches the `id` of a provider with `configured: true`.
- **AC-02:** If no providers are configured, the Models card shows `0`.
- **AC-03:** The subLabel text is updated to `"Available models from configured providers"`.
- **AC-04:** The card calculation falls back gracefully — if `models` or `providers` arrays are empty, the count is `0` (no crash).

---

## Bug 2: Estimated Cost Card Shows $0.00000

### Current Behavior

- The **Estimated Cost** card always displays `$0.0000` (via `formatCost(0)`), regardless of actual token usage.
- Cost is computed client-side by: `calculateCost(sessionTokenCounts, pricingFromModel)`.
- This calculation depends on two things working correctly: (a) pricing data must be non-zero, (b) the model ID from the session must match a key in the pricing map.

### Expected Behavior

- The **Estimated Cost** card displays a non-zero dollar amount reflecting actual compute cost based on session token counts × per-token pricing from the model catalog.
- If a model truly has zero cost (free tier), or pricing data is genuinely unavailable for a given model, the cost should be `$0.00` — but this should be the exception, not the rule.

### Root Cause Analysis

There are **two independent sub-causes**, either or both of which can produce $0 cost:

#### Sub-Cause A: Pricing Data Defaults to 0 in Sync Script

| Location | Issue |
|---|---|
| `sync-opencode-data.js:488-491` | Extracts pricing as `Number(value.input_price ?? value.inputPrice ?? 0)` and `Number(value.output_price ?? value.outputPrice ?? 0)` |
| `costCalculator.ts:13-14` | `tokens.input * (pricing.input ?? 0)` — if pricing is 0, cost is 0 |

**Problem:** The opencode cached `models.json` may store pricing in a different structure than what the sync script expects. For example, pricing could be nested under a `pricing` object:
```json
{
  "model-id": {
    "pricing": { "input": 0.000002, "output": 0.000008 }
  }
}
```
In this case, `value.input_price` is `undefined` and `value.inputPrice` is `undefined`, so the sync script defaults to `0`. Both `sync-opencode-data.js` (line 488-491) and `costCalculator.ts:loadPricing()` (line 55-56) use the same field name assumptions.

Additionally, the pricing **unit** may differ between the cached models.json (e.g., dollars per 1M tokens) and what the calculation expects (dollars per single token). If the values are in per-1M-tokens but multiplied directly against raw token counts, the result would be astronomically high, not zero. So unit mismatch is unlikely the cause of $0 — it would cause OVER-estimation. However, if the per-1M-tokens price is extremely small (e.g., `0.15` per 1M), multiplying by individual tokens (e.g., `1000`) yields `0.00015`, which rounds to `$0.0002` — not `$0.0000`. So the unit mismatch alone wouldn't produce exactly zero unless the value itself is 0.

**Conclusion:** The most likely pricing-related cause is that the field names (`input_price`, `output_price`, `inputPrice`, `outputPrice`) don't match the actual schema of the cached `models.json`.

#### Sub-Cause B: Model ID Mismatch (Pricing Lookup Fails)

| Location | Issue |
|---|---|
| `sync-opencode-data.js:169-177` | Extracts `model_id` from DB `s.model` column (may be JSON like `{"id": "opencode-go/deepseek-v4-pro", ...}` or plain string) |
| `sync-opencode-data.js:483-484` | Model keys in exported JSON come from the **keys** of the cached `models.json` object |
| `overviewDataProcessor.ts:95` | `pricingMap.has(s.model_id)` — lookup uses session's `model_id` as key |
| `overviewDataProcessor.ts:166` | Same pattern in `computeKeyMetrics()` for the Estimated Cost card |

**Problem:** If the cached `models.json` uses short keys (e.g., `"deepseek-v4-pro"`) but sessions use full provider-scoped IDs (e.g., `"opencode-go/deepseek-v4-pro"`), the `pricingMap.has()` lookup fails, and cost is never added. The session's model ID is extracted from the database `model` column which may store the full provider-scoped identifier.

Similarly, even if the keys match the same format, any difference in casing or naming convention between the two sources will cause misses.

**Impact of sub-cause B:** Even if sub-cause A is fixed (pricing values are non-zero), cost remains $0 if model IDs don't match.

### Acceptance Criteria

- **AC-05:** After running `npm run sync`, the exported `public/data/models.json` contains non-zero `input_price` and `output_price` values for models where pricing data exists in the cached models.json.
- **AC-06:** The pricing extraction in `sync-opencode-data.js` handles the actual field structure present in the opencode cached `models.json` (not just the two fallback field names).
- **AC-07:** The model ID extracted from sessions matches the key format used in the models pricing map, OR a normalization/matching strategy ensures correct lookup.
- **AC-08:** The Estimated Cost card displays a non-zero value for sessions that use priced models.
- **AC-09:** Sessions using genuinely free models (zero pricing) display `$0.00`, which is correct behavior.
- **AC-10:** The Cost Trend chart (`CostTrendChart`) also reflects corrected cost data.
- **AC-11:** The `formatCost()` function continues to work correctly — `$0.0000` is replaced by `$0.00` when cost is truly zero (cosmetic fix).

---

## Non-Functional Requirements

- **NFR-01: Sync script only** — All data fixes must happen in `scripts/sync-opencode-data.js`. Do NOT add runtime HTTP calls or server-side lookups; the dashboard remains client-side only.
- **NFR-02: Backward compatibility** — The JSON schema of exported files (`models.json`, `providers.json`) should not change structurally. Existing consumers (other pages, charts) must continue to work.
- **NFR-03: No new dependencies** — Do not add npm packages.
- **NFR-04: Build integrity** — `tsc -b` and `npm run build` must pass without errors after changes.
- **NFR-05: Graceful degradation** — If pricing data is genuinely unavailable for a model (after fixing extraction), the dashboard must not crash or show NaN. Show `$0.00` for those models.
- **NFR-06: Performance** — Pricing map construction and model filtering are O(n) operations on small datasets (< 1000 entries). No measurable performance impact.

---

## Constraints

- **C-01:** The dashboard is **client-side only** — pricing must be embedded in the exported JSON at sync time, not fetched at runtime.
- **C-02:** `public/data/` is in `.gitignore` — generated JSON files are never committed.
- **C-03:** The sync script reads from the **user's local opencode cache** — the structure of `models.json` in the cache is determined by opencode, not by this project. The sync script must be resilient to variations.
- **C-04:** `verbatimModuleSyntax: true` and other TypeScript project reference rules apply.
- **C-05:** The `cost` field on `Session` (`s.cost` from the database) is **NOT** to be used as a substitute for computed cost. The dashboard intentionally recomputes cost from token counts × pricing for consistency and transparency.

---

## Scope — Files Potentially Affected

| File | Likelihood | Nature of Change |
|---|---|---|
| `scripts/sync-opencode-data.js` | **High** | Fix pricing extraction (handle actual models.json schema). Potentially normalize model ID format for matching. |
| `src/pages/Overview.tsx` | **Medium** | Filter `modelsCount` to configured providers only. |
| `src/utils/overviewDataProcessor.ts` | **Low** | May need to update `buildPricingMap()` if key format changes. Update subLabel text for Models card. |
| `src/utils/costCalculator.ts` | **Low** | May need to update `loadPricing()` field extraction to match sync script fix. |
| `src/types/index.ts` | **None** | No type changes needed. `ModelInfo.provider` and `ProviderInfo.id` already exist. |

---

## Open Questions — RESOLVED (field investigation)

All three open questions resolved via direct inspection of the user's system:

- **Q-01:** ✅ The cached `models.json` (at `~/.cache/opencode/models.json`) has the same structure as `models.dev/api.json`. Pricing is nested at `value.cost.input`, `value.cost.output`, `value.cost.cache_read` — **NOT** at `value.input_price`. This is confirmed by inspecting the actual cache file. Values are in **dollars per 1 million tokens** (e.g., deepseek-v4-pro: `{input: 1.74, output: 3.48}` = $1.74/1M input, $3.48/1M output).

- **Q-02:** ✅ Model IDs DO match. All sessions in the user's database use model ID `deepseek-v4-pro` (short form). The models.json keys under `opencode-go.models` are also short-form (`deepseek-v4-pro`, `kimi-k2.5`, etc.). No normalization needed — the pricing lookup already works structurally, it just returns 0 because the field paths are wrong.

- **Q-03:** ✅ Validation will be against a fresh `npm run sync` run. After sync, inspect `public/data/models.json` for non-zero pricing, and verify the Overview page shows non-zero cost.

## Additional Findings from Field Investigation

- **135 models exported** from cache (all providers), but user has only **1 configured provider** (OpenCode Go with ~14 models).
- **Unit conversion needed:** models.dev pricing is in dollars per 1M tokens. Current `calculateCost()` multiplies raw token counts directly. Formula must change to: `cost = (tokens / 1_000_000) * price`.
- **Provider field corruption:** The exported `models.json` shows garbled `provider` values (e.g., `provider=�?"`), likely a JSON serialization issue. The `provider` field should be the parent key from the models.json structure (e.g., `"opencode-go"`, `"opencode"`).

---

Version: 2 | Author: analyst + orchestrator (field investigation) | Date: 2026-05-25

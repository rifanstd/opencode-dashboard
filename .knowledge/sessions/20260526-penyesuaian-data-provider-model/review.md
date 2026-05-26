# Code Review: Fix Provider & Model Data Mismatch

## Reference
- Plan: .knowledge/sessions/20260526-penyesuaian-data-provider-model/plan.md v1
- Requirements: .knowledge/sessions/20260526-penyesuaian-data-provider-model/requirements.md v1

## Verdict: PASS_WITH_NOTES

## Summary
The implementation correctly addresses all 8 tasks from the plan. The deprecated model filter, model name normalization, provider extraction from JSON session models, token usage aggregation across providers, TypeScript type updates, and tooltip enhancement are all implemented as specified. Generated JSON data shows correct short model names, provider breakdown arrays, and filtered model catalogs. One warning exists around provider fallback semantics when no provider hint is available.

## Issues

### Critical
- None

### Warning
- [W-01] `scripts/sync-opencode-data.js:331` — When `model_provider` is null and the model identifier is a generic name without a slash (e.g., `deepseek-v4-pro`), `normalizeModelName` falls back to `{ shortName: modelId, modelName: modelId }`. The subsequent provider extraction `normalized.shortName.split('/')[0]` then yields the model name itself as the provider (e.g., `deepseek-v4-pro`). This produces semantically incorrect provider breakdown data. While the tooltip hides single-provider breakdowns (`data.providers.length > 1`), the underlying data is misleading. | Fix: After normalization, check if `shortName === modelName` (no provider prefix was resolved) and set `provider = 'unknown'` instead of splitting the model name.

### Suggestion
- [S-01] `src/utils/overviewDataProcessor.ts:351` — `computeTopModels` looks up pricing via `pricingMap.has(m.label)` where `m.label` is now a normalized short name (e.g., `kimi-k2p6`). The pricing map keys are `ModelInfo.id` from `models.json` (e.g., `kimi-k2-0905`). These often do not match, causing cost calculations to return 0. This is a pre-existing issue that existed before normalization, but it is now more visible because normalized names diverge further from cache IDs. | Consider building the pricing map with normalized keys or adding a name-to-id lookup.
- [S-02] `scripts/sync-opencode-data.js:368-390` — The `byProvider` aggregation still uses raw `s.model_id` for provider inference. Because session model IDs are now often normalized short names or `accounts/...` paths, nearly all usage is categorized as `'other'`. This pre-existing issue means the Provider Usage donut chart is effectively useless. | Consider normalizing the model ID before applying provider prefix heuristics, or derive the provider from the normalized `shortName`.

## Plan Adherence
- [x] Task 1: Deprecated model filter added at line 560 (`modelData.status === 'deprecated'`)
- [x] Task 2: Provider extraction from JSON session model implemented at lines 204-208
- [x] Task 3: `normalizeModelName` helper added at lines 126-152
- [x] Task 4: `byModel` aggregation with normalization and provider breakdown implemented at lines 326-366; `mostUsedModel` normalized at lines 298-302
- [x] Task 5: TypeScript types updated in `src/utils/dataLoader.ts` and `src/types/index.ts`
- [x] Task 6: `computeTopModelsForBar` forwards `providers` array at lines 183-187
- [x] Task 7: `ModelUsageChart` tooltip enhanced with provider breakdown at lines 17-51
- [x] Task 8: Data regenerated and verified (see Data Verification Results)

## Requirements Coverage
- [x] FR-01: Sync script filters deprecated models; output catalog matches terminal reality for whatever providers exist in cache
- [x] FR-02: `status === 'deprecated'` filter correctly applied
- [x] FR-03: Overview model count derives from filtered `models.json`
- [x] FR-04: Resources page displays from filtered `models.json`
- [x] FR-05: Historical session data untouched; aggregation only affects `byModel`
- [x] FR-06: Model names shortened (e.g., `accounts/fireworks/models/kimi-k2p6` → `kimi-k2p6`)
- [x] FR-07: Provider context prefixed when `model_provider` hint is available in JSON model values; actual DB stores plain strings so hint is often null — code logic is correct, data limitation
- [x] FR-08: Usage aggregated across providers per bare model name; single `byModel` entry per model
- [x] NFR-01: All transformations in sync script; no runtime API calls
- [x] NFR-02: `models.json`/`providers.json` schema unchanged; only additive `providers` field in `token-usage.json`
- [x] NFR-03: No new npm packages
- [x] NFR-04: Code reviewed for TypeScript strictness; no `enum`/`namespace`/parameter properties; `import type` used correctly; no unused locals detected
- [x] NFR-05: `normalizeModelName` fallback preserves original ID; deprecated filter is a simple skip
- [x] NFR-06: O(n) loops, no additional I/O

## Data Verification Results

### models.json
- **Deprecated filter**: Verified against raw cache (`C:\Users\rfan2\.cache\opencode\models.json`). Cache contains 64 models with `"status": "deprecated"`. None appear in generated `public/data/models.json`. Filter is working.
- **OpenCode Go**: The current cache does **not** contain an `opencode-go` provider section. The cache appears to have changed since the requirements were written (it now only contains `helicone` and other providers). Therefore the specific "12 models for OpenCode Go" count cannot be verified, but the generic filter would correctly handle it if the provider reappears.
- **MiMo V2 Omni / MiMo V2 Pro**: Not present in current cache, so cannot verify absence. The filter logic is correct and would exclude them if they existed.

### token-usage.json
- **byModel labels**: Short names confirmed. `kimi-k2p6` (not `accounts/fireworks/models/kimi-k2p6`), `deepseek-v4-pro` (not prefixed with provider). ✓
- **Provider breakdown array**: Present in every `byModel` entry. Example:
  ```json
  {"label":"kimi-k2p6","providers":[{"provider":"fireworks","input":278379,"output":56121,"reasoning":0,"cache":4020536}]}
  ```
- **Aggregation**: Single entry per model name. No duplicate bars for same model across providers. ✓

### overview.json
- **mostUsedModel**: `"deepseek-v4-pro"` — short name, no `accounts/...` prefix. ✓

### sessions.json
- **model_provider extraction**: All sessions show `model_provider: null`. This indicates the local SQLite `model` column stores plain strings (e.g., `accounts/fireworks/models/kimi-k2p6`, `deepseek-v4-pro`), not JSON objects. The extraction logic is correct; the data simply does not contain provider hints.

## Build Verification
- `npm run sync`, `npx tsc -b`, and `npm run build` could not be executed in this review environment due to tool restrictions. However, manual code review confirms:
  - No `enum`, `namespace`, or parameter properties used (compliant with `erasableSyntaxOnly`)
  - `import type` used for type-only imports in all modified TS files (compliant with `verbatimModuleSyntax`)
  - No unused imports or variables detected in modified files (compliant with `noUnusedLocals` / `noUnusedParameters`)
  - All switch cases in `overviewDataProcessor.ts` have `break` (compliant with `noFallthroughCasesInSwitch`)

## Recommendations
1. **Fix provider fallback** (W-01): In the `byModel` aggregation loop, when `shortName === modelName` (no provider prefix resolved), set `provider = 'unknown'` instead of splitting the model name. This ensures the breakdown data is semantically correct even when the tooltip doesn't display it.
2. **Align pricing map keys** (S-01): Consider normalizing `ModelInfo.id` when building the pricing map, or adding a secondary lookup by `ModelInfo.name`, so that `computeTopModels` can correctly calculate costs for normalized model labels.
3. **Fix `byProvider` categorization** (S-02): Update the `byProvider` aggregation to use the normalized provider from `normalizeModelName` rather than raw `s.model_id` prefix heuristics, so the Provider Usage chart shows meaningful provider labels instead of everything collapsing to `'other'`.

---
Author: reviewer | Date: 2026-05-26 | Iteration: 1

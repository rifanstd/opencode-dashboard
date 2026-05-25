# Fix Overview Page Bugs (Models Count & Estimated Cost) — Implementation Plan

> **For the Orchestrator:** The Orchestrator delegates this plan to the Programmer for execution. After implementation, the Orchestrator delegates to the Reviewer for code review. Do NOT dispatch subagents directly — the Orchestrator manages the multi-agent pipeline.

**Goal:** Fix two Overview page bugs: (1) Models card counts all cached models instead of only configured-provider models, (2) Estimated Cost card always shows $0 because sync script reads pricing from wrong JSON path and doesn't handle per-1M-token unit conversion.

**Architecture:** All data fixes happen in the sync script (NFR-01). The sync script's models.json export is restructured to correctly traverse the nested `providerId → .models → modelId` hierarchy, reading pricing from `modelData.cost.{input,output,cache_read}` and dividing by 1M to convert to per-token. The Overview page filters models by configured providers. No structural JSON schema changes, no new dependencies.

**Tech Stack:** Node.js (sync script), React 19 + TypeScript (dashboard), Zustand (state), Recharts (charts)

**Reference:** Requirements: .knowledge/sessions/20260525-fix-overview-bugs/requirements.md v2

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `scripts/sync-opencode-data.js:476-497` | Reads cached `models.json`, exports `public/data/models.json` | **Rewrite model extraction loop** — descend into nested provider→models structure, fix pricing field paths, apply unit conversion |
| `src/pages/Overview.tsx:114-117` | Computes `modelsCount` and `providersCount` for metric cards | **Filter models to configured providers** — add `Set` lookup and `useMemo` |
| `src/utils/overviewDataProcessor.ts:263-266` | Produces Models and Estimated Cost card definitions | **Update subLabel text** for Models card |
| `src/utils/costCalculator.ts:20-25` | Formats cost values for display | **Handle true-zero display** — show `$0.00` instead of `$0.0000` |

**NOT modified (no changes needed):** `buildPricingMap()`, `loadPricing()`, `calculateCost()`, `computeKeyMetrics()`, `dataLoader.ts`, `types/index.ts`, `Models.tsx`, `SessionsList.tsx`, `SessionDetail.tsx` — all downstream code works correctly once the exported `models.json` has correct pricing values and correct provider fields.

---

## Decision Points

- [x] **Unit conversion location: sync script.** Pricing in cached models.json is dollars-per-1M-tokens. Converting to per-token in the sync script (divide by 1,000,000) keeps all data normalization in one place (NFR-01) and lets the cost calculator (`calculateCost`) remain `tokens × price` without a magic divisor. Downstream consumers see canonical per-token prices.
- [x] **Provider field source: parent key.** The `provider` field for each model comes from the parent key of the provider sub-object (e.g., `"opencode-go"`), not from any field inside the model data. This is the authoritative provider ID and avoids the garbled `—` placeholder.
- [x] **None of the question marks in the current output format are actual placeholders — they are literal separators used in the markdown template and are fine.**

---

## Task Breakdown

### Task 1: Fix sync script — rewrite model extraction from nested provider→models structure

**Files:**
- Modify: `scripts/sync-opencode-data.js:476-497`

**Context:** The cached `models.json` has this structure:
```json
{
  "opencode-go": {
    "name": "OpenCode Go",
    "models": {
      "deepseek-v4-pro": {
        "name": "DeepSeek v4 Pro",
        "cost": { "input": 1.74, "output": 3.48, "cache_read": 0.0145 },
        "capabilities": ["chat", "tool-calling"],
        "context_window": 131072
      },
      "kimi-k2.5": { ... }
    }
  },
  "opencode": {
    "name": "OpenCode",
    "models": { ... }
  }
}
```

The current code iterates top-level keys as if they were individual models, but they are actually provider containers. It must descend one level into `providerValue.models`.

- [ ] **Step 1: Replace the models extraction block (lines 478-496)**

Replace the entire `if (modelsJson && typeof modelsJson === 'object')` block. The old code:

```javascript
// Models from models.json
if (paths.cache) {
    const modelsPath = path.join(paths.cache, 'models.json')
    const modelsJson = readJsonSafe(modelsPath)
    if (modelsJson && typeof modelsJson === 'object') {
      for (const [key, value] of Object.entries(modelsJson)) {
        if (value && typeof value === 'object') {
          models.push({
            id: key,
            name: value.name ?? key,
            provider: value.provider ?? '—',
            capabilities: Array.isArray(value.capabilities) ? value.capabilities : [],
            input_price: Number(value.input_price ?? value.inputPrice ?? 0),
            output_price: Number(value.output_price ?? value.outputPrice ?? 0),
            reasoning_price: value.reasoning_price != null ? Number(value.reasoning_price) : undefined,
            cache_price: value.cache_price != null ? Number(value.cache_price) : undefined,
            context_window: Number(value.context_window ?? value.contextWindow ?? 0),
          })
        }
      }
    }
  }
```

Replace with:

```javascript
  // Models from models.json (nested provider → models structure)
  if (paths.cache) {
    const modelsPath = path.join(paths.cache, 'models.json')
    const modelsJson = readJsonSafe(modelsPath)
    if (modelsJson && typeof modelsJson === 'object') {
      for (const [providerId, providerData] of Object.entries(modelsJson)) {
        // providerData is the provider container: { name, models: { ... } }
        if (!providerData || typeof providerData !== 'object') continue

        const providerModels = providerData.models
        if (!providerModels || typeof providerModels !== 'object') continue

        for (const [modelId, modelData] of Object.entries(providerModels)) {
          if (!modelData || typeof modelData !== 'object') continue

          // Pricing from modelData.cost.{input,output,cache_read} (per-1M-tokens)
          // Convert to per-token by dividing by 1_000_000
          const cost = modelData.cost
          const rawInputPrice = Number(cost?.input ?? modelData.input_price ?? modelData.inputPrice ?? 0)
          const rawOutputPrice = Number(cost?.output ?? modelData.output_price ?? modelData.outputPrice ?? 0)
          const rawCacheReadPrice = Number(cost?.cache_read ?? modelData.cache_price ?? 0)
          const rawReasoningPrice = modelData.reasoning_price != null ? Number(modelData.reasoning_price) : undefined

          models.push({
            id: modelId,
            name: modelData.name ?? modelId,
            provider: providerId,
            capabilities: Array.isArray(modelData.capabilities) ? modelData.capabilities : [],
            input_price: rawInputPrice / 1_000_000,
            output_price: rawOutputPrice / 1_000_000,
            reasoning_price: rawReasoningPrice != null ? rawReasoningPrice / 1_000_000 : undefined,
            cache_price: rawCacheReadPrice / 1_000_000,
            context_window: Number(modelData.context_window ?? modelData.contextWindow ?? 0),
          })
        }
      }
    }
  }
```

- [ ] **Step 2: Run sync to verify**

```bash
npm run sync
```

Expected: Output message shows actual model count (e.g., `Exported ... 14 models` for 1 configured provider with ~14 models, instead of the previous 135).

- [ ] **Step 3: Inspect exported models.json for correct pricing**

```bash
# Check the first model entry in the exported JSON
node -e "const m = require('./public/data/models.json'); console.log(JSON.stringify(m[0], null, 2))"
```

Expected: Non-zero values in `input_price` and `output_price` (e.g., `0.00000174` for a model with $1.74/1M input). The `provider` field should contain a clean provider ID string (e.g., `"opencode-go"`), not garbled characters or `"—"`.

- [ ] **Step 4: Verify Models page still works**

Run `npm run dev`, navigate to the Models page. Verify:
- All models appear in the list
- The Provider column shows meaningful IDs
- Input Price and Output Price columns show non-zero values (very small per-token prices, e.g., `$0.000002`)

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-opencode-data.js
git commit -m "fix(sync): extract models from nested provider structure, fix pricing paths and unit conversion"
```

---

### Task 2: Fix Overview.tsx — filter modelsCount to configured providers only

**Files:**
- Modify: `src/pages/Overview.tsx:114-117`

**Context:** Currently `modelsCount = models.length` counts ALL models. Should count only models whose `provider` field matches a configured provider's `id`. The `configuredProviderIds` Set is computed from `providers`, then used to filter `models`.

- [ ] **Step 1: Add configured provider ID set and filtered models count**

Replace lines 114-117:

```typescript
  const pricingMap = useMemo(() => buildPricingMap(models), [models])

  const modelsCount = models.length
  const providersCount = providers.filter((p) => p.configured).length
```

With:

```typescript
  const pricingMap = useMemo(() => buildPricingMap(models), [models])

  const configuredProviderIds = useMemo(
    () => new Set(providers.filter((p) => p.configured).map((p) => p.id)),
    [providers],
  )

  const modelsCount = useMemo(
    () => models.filter((m) => configuredProviderIds.has(m.provider)).length,
    [models, configuredProviderIds],
  )

  const providersCount = providers.filter((p) => p.configured).length
```

- [ ] **Step 2: Run type-check to verify**

```bash
npx tsc -b
```

Expected: No type errors. `ModelInfo.provider` is `string`, `ProviderInfo.id` is `string`, so the `Set<string>` lookup is type-safe.

- [ ] **Step 3: Manually verify in the dashboard**

1. Run `npm run dev`
2. Navigate to the Overview page
3. Check the Models card value — it should now show a much smaller number (e.g., 14 instead of 135), matching only the models from the configured provider(s)
4. If no providers are configured, the value should be 0

- [ ] **Step 4: Commit**

```bash
git add src/pages/Overview.tsx
git commit -m "fix(overview): filter models count to configured providers only"
```

---

### Task 3: Fix overviewDataProcessor.ts — update Models card subLabel

**Files:**
- Modify: `src/utils/overviewDataProcessor.ts:264-266`

**Context:** The Models card subLabel currently reads `"Available models from all providers"`. After the filtering fix, it should reflect the new behavior.

- [ ] **Step 1: Update the subLabel text**

Replace line 265:

```typescript
      subLabel: 'Available models from all providers',
```

With:

```typescript
      subLabel: 'Available models from configured providers',
```

- [ ] **Step 2: Run type-check to verify**

```bash
npx tsc -b
```

Expected: No type errors — this is a pure string change.

- [ ] **Step 3: Commit**

```bash
git add src/utils/overviewDataProcessor.ts
git commit -m "fix(overview): update models card sublabel to reflect configured-provider filtering"
```

---

### Task 4: Fix costCalculator.ts — formatCost shows $0.00 for true zero (AC-11)

**Files:**
- Modify: `src/utils/costCalculator.ts:20-25`

**Context:** `formatCost(0)` currently produces `$0.0000` (because 0 < 1 → `toFixed(4)`). AC-11 requires true zero to display as `$0.00`. Note: very small non-zero costs (e.g., `0.0001`) should still use 4 decimal places.

- [ ] **Step 1: Update formatCost to handle exact zero**

Replace the `formatCost` function (lines 20-25):

```typescript
export function formatCost(value: number): string {
  if (value < 1) {
    return `$${value.toFixed(4)}`
  }
  return `$${value.toFixed(2)}`
}
```

With:

```typescript
export function formatCost(value: number): string {
  if (!Number.isFinite(value)) return '$0.00'
  if (value === 0) return '$0.00'
  if (value < 1) {
    return `$${value.toFixed(4)}`
  }
  return `$${value.toFixed(2)}`
}
```

- [ ] **Step 2: Run type-check to verify**

```bash
npx tsc -b
```

Expected: No type errors. `Number.isFinite` is available in all modern JS runtimes and TypeScript targets.

- [ ] **Step 3: Commit**

```bash
git add src/utils/costCalculator.ts
git commit -m "fix(cost): display $0.00 instead of $0.0000 for true zero cost"
```

---

### Task 5: End-to-end verification

**Files:** None (verification only)

**Context:** After all code changes, run the full pipeline to verify both bugs are fixed end-to-end.

- [ ] **Step 1: Run fresh sync**

```bash
npm run sync
```

Expected: Console shows correct model count (models from configured providers only, matching the nested structure iteration).

- [ ] **Step 2: Inspect exported pricing data**

```bash
node -e "
const models = require('./public/data/models.json');
console.log('Total models exported:', models.length);
const priced = models.filter(m => m.input_price > 0);
console.log('Models with non-zero pricing:', priced.length);
if (priced.length > 0) {
  console.log('Sample:', JSON.stringify(priced[0], null, 2));
} else {
  console.log('WARNING: No models have non-zero pricing!');
}
"
```

Expected: Most models should have non-zero `input_price` and `output_price`. If any model truly has zero pricing in the source, that's fine — but the majority should be non-zero.

- [ ] **Step 3: Run full build**

```bash
npm run build
```

Expected: `tsc -b` passes, Vite build completes without errors.

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: No new lint errors.

- [ ] **Step 5: Manual smoke test of Overview page**

Run `npm run preview` (or `npm run dev`) and verify:
- **Models card:** Shows correct count (configured-provider models only), subLabel reads "Available models from configured providers"
- **Estimated Cost card:** Shows non-zero value (e.g., `$0.0012` or similar, depending on usage). NOT `$0.00` unless user has zero token usage or uses only free models.
- **Cost Trend chart:** Shows non-zero daily cost bars
- **Models page:** Lists correct models with proper provider names and pricing values
- **Sessions List page:** Shows computed cost per session (non-zero for priced models)
- No console errors, no blank cards, no NaN values

- [ ] **Step 6: Commit**

```bash
# Nothing to commit — verification only.
# If fixes were needed during verification, commit those separately.
echo "Verification complete — all checks pass."
```

---

## Dependency Order

```
Task 1 (sync script: nested structure + pricing fix)  ──┐
                                                         ├──→ Task 5 (verification)
Task 2 (Overview filtering) ────────────────────────────┤
                                                         │
Task 3 (subLabel text) ─────────────────────────────────┤
                                                         │
Task 4 (formatCost zero) ───────────────────────────────┘
```

Tasks 1–4 are independent of each other and can be executed in any order. Task 5 depends on all four being complete.

---

## Risks & Alternatives

- **Risk:** The cached `models.json` structure might differ from what was observed in the field investigation (e.g., some providers lack a `.models` sub-object, or the `cost` object uses different field names).
  - **Mitigation:** The new sync code includes fallbacks to the old field names (`input_price`, `inputPrice`) after trying `cost.input`. Providers without a `.models` sub-object are skipped gracefully with `continue`.
  - **Alternative:** If the structure varies significantly across providers, add a `console.warn` for skipped entries and inspect after first sync.

- **Risk:** The unit conversion (divide by 1M) might produce extremely small floating-point numbers that lose precision in JSON serialization.
  - **Mitigation:** JavaScript `Number` (IEEE 754 double) has ~15-17 significant digits. A price like `1.74 / 1e6 = 0.00000174` is well within range. JSON serialization preserves full precision for these values.
  - **Alternative:** Keep pricing as per-1M-tokens in the JSON and convert in `calculateCost()` instead. This would require changes to both `costCalculator.ts` AND `overviewDataProcessor.ts` (the `buildPricingMap` → `calculateCost` chain). The chosen approach (sync script) is simpler and keeps all data fixes in one place.

- **Risk:** The `configuredProviderIds` Set-based filtering may not match models to providers if there's a casing or naming mismatch between the `provider` field in models.json and the `id` field in providers.json.
  - **Mitigation:** Both fields now come from the same source — the provider key in the cached `models.json` and the key/`id` from `auth.json`. These should match exactly for the same provider.
  - **Alternative:** If mismatches are discovered during verification, add case-insensitive matching using `.toLowerCase()` on both sides.

---

## Self-Review Checklist

### 1. Spec Coverage

| Requirement | Task(s) | Status |
|---|---|---|
| AC-01: Models card counts only configured-provider models | Task 1 (provider field fix), Task 2 (filtering) | ✅ Covered |
| AC-02: No configured providers → models card shows 0 | Task 2 (filter returns empty when Set is empty) | ✅ Covered |
| AC-03: subLabel updated to "configured providers" | Task 3 | ✅ Covered |
| AC-04: Graceful fallback for empty arrays | Task 2 (`.filter().length` safely returns 0) | ✅ Covered |
| AC-05: Non-zero pricing in exported models.json | Task 1 (cost.input path + unit conversion) | ✅ Covered |
| AC-06: Sync script handles actual field structure | Task 1 (`cost?.input` with fallbacks) | ✅ Covered |
| AC-07: Model ID matching works for pricing lookup | Q-02 resolved — no change needed | ✅ N/A |
| AC-08: Estimated Cost card shows non-zero value | Task 1 (fixes root cause) + Task 5 (verification) | ✅ Covered |
| AC-09: Free models show $0.00 correctly | Task 4 (formatCost handles true zero) | ✅ Covered |
| AC-10: Cost Trend chart reflects corrected cost data | Task 1 (fixes root cause) — chart reads same pricing | ✅ Covered |
| AC-11: formatCost shows $0.00 for true zero | Task 4 | ✅ Covered |
| NFR-01: All data fixes in sync script | Task 1 handles all data extraction | ✅ Covered |
| NFR-02: JSON schema unchanged | Task 1 preserves same field names, only changes values | ✅ Covered |
| NFR-03: No new dependencies | No npm packages added | ✅ Covered |
| NFR-04: Build integrity | Task 5 includes `tsc -b` and `npm run build` | ✅ Covered |
| NFR-05: Graceful degradation for missing pricing | Task 1 (fallback to 0, cost = tokens × 0 = $0.00) | ✅ Covered |
| NFR-06: Performance — O(n) on small datasets | Task 2 (Set + filter is O(n+m)) | ✅ Covered |

### 2. Placeholder Scan

- No "TBD", "TODO", "implement later" present
- No "add appropriate error handling" without specific code
- All code blocks contain complete, copy-pasteable implementations
- No "Similar to Task N" references — each task is self-contained

### 3. Type Consistency

- `ModelInfo.provider` is `string` (from `types/index.ts:50`) → Task 1 sets `provider: providerId` (string) → Task 2 uses `configuredProviderIds.has(m.provider)` (string lookup) ✅
- `ModelInfo.input_price` is `number` (from `types/index.ts:52`) → Task 1 sets `input_price: rawInputPrice / 1_000_000` (number) → Task 1 also handles `reasoning_price?: number` and `cache_price?: number` ✅
- `ProviderInfo.configured` is `boolean` (from `types/index.ts:64`) → Task 2 filters `p.configured` (boolean check) ✅
- `ProviderInfo.id` is `string` (from `types/index.ts:60`) → Task 2 maps to `.id` and creates a `Set<string>` ✅
- `formatCost` signature unchanged: `(value: number): string` → Task 4 keeps same signature ✅

---

Version: 1 | Author: planner | Ref: requirements v2 | Date: 2026-05-25

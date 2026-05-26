# Implementation Plan: Fix Provider & Model Data Mismatch

> **For the Orchestrator:** The Orchestrator delegates this plan to the Programmer for execution. After implementation, the Orchestrator delegates to the Reviewer for code review. Do NOT dispatch subagents directly — the Orchestrator manages the multi-agent pipeline.

**Goal:** Align dashboard provider/model data with the OpenCode terminal by filtering deprecated models, shortening model identifiers, and aggregating token usage across providers in the sync script.

**Architecture:** All data transformations happen at sync time in `scripts/sync-opencode-data.js`. The dashboard remains client-side only; no runtime API calls. UI components receive pre-aggregated, pre-shortened data and only need minor tooltip enhancements.

**Tech Stack:** Node.js (sync script), React + TypeScript (dashboard), Recharts (charting), SQLite (source DB).

**Reference:** Requirements: `.knowledge/sessions/20260526-penyesuaian-data-provider-model/requirements.md` v1

---

## File Structure

| File | Responsibility | Nature of Change |
|---|---|---|
| `scripts/sync-opencode-data.js` | Reads SQLite + cache, exports 11 JSON files | **Primary changes:** add deprecated filter, model name normalization, provider aggregation, provider breakdown |
| `src/utils/dataLoader.ts` | Type definitions for loaded JSON data | Add optional `providers` field to `byModel` type |
| `src/types/index.ts` | Shared TypeScript interfaces | Add optional `providers` field to `ModelUsageBarItem` |
| `src/utils/overviewDataProcessor.ts` | Transforms `tokenUsage` into chart data | Pass `providers` through in `computeTopModelsForBar` |
| `src/components/ModelUsageChart.tsx` | Renders Model Usage bar chart | Enhance tooltip to show provider breakdown |

---

## Decision Points

- [x] **Filtering criteria:** `modelData.status === 'deprecated'` — confirmed by analyst, matches terminal behavior.
- [x] **Aggregation scope:** Sum input + output + reasoning + cache across all providers per model name.
- [x] **Name shortening location:** Sync script (`exportDatabase`) — satisfies NFR-01 (no runtime lookups).
- [x] **Provider breakdown storage:** Add `providers` array to each `byModel` entry — enables tooltip detail without structural schema changes to `models.json`/`providers.json`.
- [x] **UI changes:** Minimal — only tooltip enhancement; chart labels and aggregation come from sync script.

---

## Task Breakdown

### Task 1: Add deprecated model filter in sync script
- **Description:** Skip models where `modelData.status === 'deprecated'` during the `models.json` export loop so the dashboard catalog matches the OpenCode terminal.
- **Files affected:** `scripts/sync-opencode-data.js:492-493`
- **Dependency:** None
- **Definition of Done:** After `npm run sync`, `public/data/models.json` contains only non-deprecated models for every provider (e.g., OpenCode Go has 12 models, not 14).
- **Complexity:** low

**Steps:**

- [ ] **Step 1: Insert filter condition**

In `scripts/sync-opencode-data.js`, inside the `for (const [modelId, modelData] of Object.entries(providerModels))` loop (around line 492), add the deprecation check immediately after the existing object guard:

```javascript
for (const [modelId, modelData] of Object.entries(providerModels)) {
  if (!modelData || typeof modelData !== 'object') continue
  if (modelData.status === 'deprecated') continue   // ← ADD THIS LINE

  // Pricing from modelData.cost.{input,output,cache_read} (per-1M-tokens)
  // ... rest of existing code
}
```

- [ ] **Step 2: Run sync and verify filter**

```bash
npm run sync
```

Open `public/data/models.json` and confirm:
- OpenCode Go provider has **12** models (was 14).
- MiMo V2 Omni and MiMo V2 Pro are **absent**.

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-opencode-data.js
git commit -m "fix(sync): filter out deprecated models from models.json export"
```

---

### Task 2: Extract provider hint from session model JSON
- **Description:** When parsing the `model` column from the `session` table, extract the `provider` field from JSON objects so generic model names (e.g., `deepseek-v4-pro`) can later be prefixed with their provider.
- **Files affected:** `scripts/sync-opencode-data.js:167-192`
- **Dependency:** None
- **Definition of Done:** Every session object exported to `sessions.json` includes a `model_provider` field (null for non-JSON model values).
- **Complexity:** low

**Steps:**

- [ ] **Step 1: Parse provider from session model JSON**

In `scripts/sync-opencode-data.js`, inside `exportDatabase`, modify the session mapping (around line 167):

```javascript
const sessions = rawSessions.map((s) => {
  let modelId = s.model ?? null
  let modelProvider = null
  if (modelId && typeof modelId === 'string' && modelId.startsWith('{')) {
    try {
      const parsed = JSON.parse(modelId)
      modelId = parsed.id ?? parsed.modelID ?? modelId
      modelProvider = parsed.provider ?? null   // ← ADD THIS LINE
    } catch {
      // keep original
    }
  }
  return {
    id: s.id,
    title: s.title ?? 'Untitled',
    project_id: s.project_id ?? null,
    model_id: modelId,
    model_provider: modelProvider,   // ← ADD THIS FIELD
    created_at: msToIso(s.time_created) ?? '',
    updated_at: msToIso(s.time_updated) ?? '',
    input_tokens: s.tokens_input ?? 0,
    output_tokens: s.tokens_output ?? 0,
    reasoning_tokens: s.tokens_reasoning ?? 0,
    cache_tokens: (s.tokens_cache_read ?? 0),
    total_tokens: (s.tokens_input ?? 0) + (s.tokens_output ?? 0) + (s.tokens_reasoning ?? 0) + (s.tokens_cache_read ?? 0),
    cost: s.cost ?? null,
  }
})
```

- [ ] **Step 2: Run sync and verify provider extraction**

```bash
npm run sync
```

Inspect `public/data/sessions.json`. Sessions that previously had a JSON `model` field (e.g., `{"id":"deepseek-v4-pro","provider":"opencode-go"}`) should now have:
- `model_id`: `"deepseek-v4-pro"`
- `model_provider`: `"opencode-go"`

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-opencode-data.js
git commit -m "feat(sync): extract provider hint from session model JSON"
```

---

### Task 3: Add model name normalization helper
- **Description:** Create a reusable helper that converts raw model identifiers into a short display form and extracts the bare model name for aggregation.
- **Files affected:** `scripts/sync-opencode-data.js` (new helper function)
- **Dependency:** None
- **Definition of Done:** Helper correctly handles `accounts/<provider>/models/<model>`, `<provider>/<model>`, and generic names with/without provider hints.
- **Complexity:** low

**Steps:**

- [ ] **Step 1: Add `normalizeModelName` helper**

Insert the following function near the top of `scripts/sync-opencode-data.js`, after the existing helper functions (e.g., after `readTextFiles`):

```javascript
/**
 * Normalize a raw model identifier into:
 * - shortName: provider-prefixed form for display (e.g., "fireworks/kimi-k2p6")
 * - modelName: bare model name for aggregation (e.g., "kimi-k2p6")
 */
function normalizeModelName(modelId, providerHint) {
  if (!modelId || typeof modelId !== 'string') {
    return { shortName: modelId, modelName: modelId }
  }

  // Pattern 1: accounts/<provider>/models/<model>
  const accountsMatch = modelId.match(/^accounts\/([^/]+)\/models\/(.+)$/)
  if (accountsMatch) {
    const provider = accountsMatch[1]
    const modelName = accountsMatch[2]
    return { shortName: `${provider}/${modelName}`, modelName }
  }

  // Pattern 2: already has provider prefix (<provider>/<model>)
  const slashMatch = modelId.match(/^([^/]+)\/(.+)$/)
  if (slashMatch) {
    return { shortName: modelId, modelName: slashMatch[2] }
  }

  // Pattern 3: generic name — add provider hint if available
  if (providerHint) {
    return { shortName: `${providerHint}/${modelId}`, modelName: modelId }
  }

  // Fallback: unrecognizable, keep as-is
  return { shortName: modelId, modelName: modelId }
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/sync-opencode-data.js
git commit -m "feat(sync): add normalizeModelName helper for model identifier shortening"
```

---

### Task 4: Apply normalization and aggregation to `byModel` token usage
- **Description:** Replace the existing `byModel` accumulation loop with normalized model names, aggregate usage across providers per bare model name, and collect per-provider breakdown.
- **Files affected:** `scripts/sync-opencode-data.js:288-300`
- **Dependency:** Task 2 (provider extraction), Task 3 (normalization helper)
- **Definition of Done:** `public/data/token-usage.json` `byModel` entries use short model names (e.g., `kimi-k2p6`), duplicate model names are merged, and each entry contains a `providers` array.
- **Complexity:** medium

**Steps:**

- [ ] **Step 1: Replace `byModel` accumulation loop**

In `scripts/sync-opencode-data.js`, replace lines 288–300:

**OLD:**
```javascript
  // Token usage by model
  const modelMap = {}
  for (const s of sessions) {
    if (!s.model_id) continue
    if (!modelMap[s.model_id]) {
      modelMap[s.model_id] = { label: s.model_id, input: 0, output: 0, reasoning: 0, cache: 0 }
    }
    modelMap[s.model_id].input += s.input_tokens
    modelMap[s.model_id].output += s.output_tokens
    modelMap[s.model_id].reasoning += s.reasoning_tokens
    modelMap[s.model_id].cache += s.cache_tokens
  }
  const byModel = Object.values(modelMap).sort((a, b) => (b.input + b.output) - (a.input + a.output))
```

**NEW:**
```javascript
  // Token usage by model (normalized + aggregated across providers)
  const modelMap = {}
  for (const s of sessions) {
    if (!s.model_id) continue
    const normalized = normalizeModelName(s.model_id, s.model_provider)
    const modelName = normalized.modelName
    const provider = normalized.shortName.split('/')[0] || 'unknown'

    if (!modelMap[modelName]) {
      modelMap[modelName] = {
        label: modelName,
        input: 0,
        output: 0,
        reasoning: 0,
        cache: 0,
        providers: [],
      }
    }

    modelMap[modelName].input += s.input_tokens
    modelMap[modelName].output += s.output_tokens
    modelMap[modelName].reasoning += s.reasoning_tokens
    modelMap[modelName].cache += s.cache_tokens

    // Accumulate per-provider breakdown
    const existing = modelMap[modelName].providers.find((p) => p.provider === provider)
    if (existing) {
      existing.input += s.input_tokens
      existing.output += s.output_tokens
      existing.reasoning += s.reasoning_tokens
      existing.cache += s.cache_tokens
    } else {
      modelMap[modelName].providers.push({
        provider,
        input: s.input_tokens,
        output: s.output_tokens,
        reasoning: s.reasoning_tokens,
        cache: s.cache_tokens,
      })
    }
  }
  const byModel = Object.values(modelMap).sort((a, b) => (b.input + b.output) - (a.input + a.output))
```

- [ ] **Step 2: Normalize `mostUsedModel` in overview**

In the same `exportDatabase` function, replace the `modelCounts` loop (around line 262–275):

**OLD:**
```javascript
  const modelCounts = {}
  for (const s of sessions) {
    if (s.model_id) {
      modelCounts[s.model_id] = (modelCounts[s.model_id] || 0) + 1
    }
  }
```

**NEW:**
```javascript
  const modelCounts = {}
  for (const s of sessions) {
    if (s.model_id) {
      const normalized = normalizeModelName(s.model_id, s.model_provider)
      modelCounts[normalized.modelName] = (modelCounts[normalized.modelName] || 0) + 1
    }
  }
```

The `mostUsedModel` selection logic (lines 268–275) remains unchanged.

- [ ] **Step 3: Run sync and verify token-usage.json**

```bash
npm run sync
```

Inspect `public/data/token-usage.json`:
- `byModel` entries should have `label` values like `kimi-k2p6`, `deepseek-v4-pro` (not `accounts/fireworks/models/kimi-k2p6`).
- If the same model was used across multiple providers, there should be **one** `byModel` entry with a `providers` array containing multiple objects.
- `overview.mostUsedModel` should display the short model name.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-opencode-data.js
git commit -m "feat(sync): normalize and aggregate token usage by model name across providers"
```

---

### Task 5: Update TypeScript types for provider breakdown
- **Description:** Add the optional `providers` array to `byModel` type definitions so the UI can safely access breakdown data.
- **Files affected:** `src/utils/dataLoader.ts:14-28`, `src/types/index.ts:157-161`
- **Dependency:** Task 4 (schema change in JSON)
- **Definition of Done:** `tsc -b` passes with the new types; no type errors when accessing `providers` in chart components.
- **Complexity:** low

**Steps:**

- [ ] **Step 1: Update `TokenUsageData` in `dataLoader.ts`**

In `src/utils/dataLoader.ts`, modify the `byModel` array element type:

```typescript
export interface TokenUsageData {
  byModel: Array<{
    label: string
    input: number
    output: number
    reasoning: number
    cache: number
    providers?: Array<{
      provider: string
      input: number
      output: number
      reasoning: number
      cache: number
    }>
  }>
  // ... rest unchanged
}
```

- [ ] **Step 2: Update `ModelUsageBarItem` in `src/types/index.ts`**

```typescript
/** Single bar for the Model Usage chart */
export interface ModelUsageBarItem {
  label: string
  totalTokens: number
  providers?: Array<{
    provider: string
    input: number
    output: number
    reasoning: number
    cache: number
  }>
}
```

- [ ] **Step 3: Run type check**

```bash
npx tsc -b
```

Expected: **0 errors**.

- [ ] **Step 4: Commit**

```bash
git add src/utils/dataLoader.ts src/types/index.ts
git commit -m "types: add optional providers breakdown to model usage types"
```

---

### Task 6: Pass provider breakdown through chart data processor
- **Description:** Update `computeTopModelsForBar` to forward the `providers` array from `tokenUsage.byModel` into the chart data items.
- **Files affected:** `src/utils/overviewDataProcessor.ts:180-190`
- **Dependency:** Task 5 (types updated)
- **Definition of Done:** `computeTopModelsForBar` output items include `providers` when present in source data.
- **Complexity:** low

**Steps:**

- [ ] **Step 1: Forward `providers` in `computeTopModelsForBar`**

In `src/utils/overviewDataProcessor.ts`, replace the function body:

**OLD:**
```typescript
export function computeTopModelsForBar(
  tokenUsage: TokenUsageData
): ModelUsageBarItem[] {
  const items = tokenUsage.byModel.map((m) => ({
    label: m.label,
    totalTokens: m.input + m.output + m.reasoning + m.cache,
  }))

  items.sort((a, b) => b.totalTokens - a.totalTokens)
  return items.slice(0, 4)
}
```

**NEW:**
```typescript
export function computeTopModelsForBar(
  tokenUsage: TokenUsageData
): ModelUsageBarItem[] {
  const items = tokenUsage.byModel.map((m) => ({
    label: m.label,
    totalTokens: m.input + m.output + m.reasoning + m.cache,
    providers: m.providers,
  }))

  items.sort((a, b) => b.totalTokens - a.totalTokens)
  return items.slice(0, 4)
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc -b
```

Expected: **0 errors**.

- [ ] **Step 3: Commit**

```bash
git add src/utils/overviewDataProcessor.ts
git commit -m "feat(overview): pass provider breakdown to model usage chart data"
```

---

### Task 7: Enhance ModelUsageChart tooltip with provider breakdown
- **Description:** Update the `CustomTooltip` in `ModelUsageChart` to display per-provider token totals when a model was used across multiple providers.
- **Files affected:** `src/components/ModelUsageChart.tsx:17-37`
- **Dependency:** Task 6 (provider data available in chart items)
- **Definition of Done:** Hovering a bar in the Model Usage chart shows the total tokens plus a breakdown by provider when multiple providers exist.
- **Complexity:** low

**Steps:**

- [ ] **Step 1: Update tooltip component**

In `src/components/ModelUsageChart.tsx`, replace the `CustomTooltip` function:

**OLD:**
```tsx
function CustomTooltip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !payload || !Array.isArray(payload) || payload.length === 0) return null
  return (
    <div
      style={{
        background: '#1c2128',
        border: '1px solid #30363d',
        borderRadius: 6,
        padding: '8px 12px',
        fontFamily: 'var(--mono)',
        fontSize: 12,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>{String(label ?? '')}</div>
      <div style={{ color: 'var(--accent)' }}>
        {formatNumber(typeof payload[0]?.value === 'number' ? (payload[0] as Record<string, unknown>).value as number : 0)} tokens
      </div>
    </div>
  )
}
```

**NEW:**
```tsx
function CustomTooltip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !payload || !Array.isArray(payload) || payload.length === 0) return null
  const data = (payload[0] as Record<string, unknown>)?.payload as ModelUsageBarItem | undefined
  const totalTokens = typeof payload[0]?.value === 'number'
    ? (payload[0] as Record<string, unknown>).value as number
    : 0

  return (
    <div
      style={{
        background: '#1c2128',
        border: '1px solid #30363d',
        borderRadius: 6,
        padding: '8px 12px',
        fontFamily: 'var(--mono)',
        fontSize: 12,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>{String(label ?? '')}</div>
      <div style={{ color: 'var(--accent)' }}>
        {formatNumber(totalTokens)} tokens
      </div>
      {data?.providers && data.providers.length > 1 && (
        <div style={{ marginTop: 6, borderTop: '1px solid #30363d', paddingTop: 4 }}>
          {data.providers.map((p) => (
            <div key={p.provider} style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {p.provider}: {formatNumber(p.input + p.output + p.reasoning + p.cache)} tokens
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc -b
```

Expected: **0 errors**.

- [ ] **Step 3: Commit**

```bash
git add src/components/ModelUsageChart.tsx
git commit -m "feat(chart): show provider breakdown in ModelUsageChart tooltip"
```

---

### Task 8: Full build verification and end-to-end validation
- **Description:** Run the complete build pipeline and visually verify all three fixes in the running dashboard.
- **Files affected:** None (verification only)
- **Dependency:** Tasks 1–7
- **Definition of Done:** `npm run build` passes; dashboard shows correct model counts, shortened names, and aggregated usage.
- **Complexity:** low

**Steps:**

- [ ] **Step 1: Regenerate all data**

```bash
npm run sync
```

- [ ] **Step 2: Type-check and build**

```bash
npx tsc -b
npm run build
```

Expected: **Both commands exit with code 0**.

- [ ] **Step 3: Start dev server and verify**

```bash
npm run dev
```

Open `http://localhost:5173` (or the displayed URL) and verify:

1. **Overview page:**
   - Models metric card shows **12** (not 14) for OpenCode Go.
   - Most Used Model shows a short name (e.g., `kimi-k2p6`, not `accounts/fireworks/models/kimi-k2p6`).

2. **Providers & Models page (`/providers-models`):**
   - OpenCode Go accordion shows **12** models.
   - MiMo V2 Omni and MiMo V2 Pro are **not listed**.

3. **Model Usage chart (on Overview):**
   - X-axis labels are short model names (e.g., `kimi-k2p6`, `deepseek-v4-pro`).
   - No duplicate bars for the same model across different providers.
   - Hovering a bar shows total tokens; if the model was used across multiple providers, the tooltip lists each provider's token count.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: align dashboard provider/model data with OpenCode terminal"
```

---

## Data Flow Changes

```
Before:
  opencode cache (models.json) ──► sync script ──► models.json (all 14 models)
  opencode.db (sessions) ──► sync script ──► token-usage.json byModel (raw model IDs, unaggregated)

After:
  opencode cache (models.json) ──► sync script ──► models.json (12 models, deprecated filtered)
  opencode.db (sessions) ──► sync script
    ├─► normalizeModelName() ──► short names + provider hints
    ├─► aggregate by modelName ──► token-usage.json byModel (merged, provider breakdown)
    └─► overview.json mostUsedModel (short name)
```

**Key transformations in sync script:**
1. **Filter gate:** `modelData.status === 'deprecated'` → skip.
2. **Provider enrichment:** `JSON.parse(s.model).provider` → `session.model_provider`.
3. **Name normalization:** `accounts/fireworks/models/kimi-k2p6` → `{ shortName: 'fireworks/kimi-k2p6', modelName: 'kimi-k2p6' }`.
4. **Aggregation key:** `modelName` (bare name, no provider prefix).
5. **Breakdown sidecar:** Each `byModel` entry carries a `providers: [{provider, input, output, reasoning, cache}]` array for tooltip rendering.

---

## Testing / Verification Steps

| # | Check | How | Expected Result |
|---|---|---|---|
| 1 | Deprecated filter | `cat public/data/models.json \| jq '.[] \| select(.provider=="opencode-go")' \| jq -s 'length'` | `12` |
| 2 | Deprecated models absent | `cat public/data/models.json \| jq '.[] \| select(.name \| contains("MiMo V2 Omni","MiMo V2 Pro"))'` | Empty array |
| 3 | Short model names | `cat public/data/token-usage.json \| jq '.byModel[0].label'` | No `accounts/...` prefix |
| 4 | Aggregation | `cat public/data/token-usage.json \| jq '.byModel[] \| select(.label=="kimi-k2p6")' \| jq -s 'length'` | `1` (single entry) |
| 5 | Provider breakdown | `cat public/data/token-usage.json \| jq '.byModel[0].providers'` | Array of `{provider, input, output, reasoning, cache}` |
| 6 | Type check | `npx tsc -b` | Exit code `0` |
| 7 | Build | `npm run build` | Exit code `0` |
| 8 | UI model count | Open `/providers-models` → OpenCode Go | 12 models listed |
| 9 | UI chart labels | Open `/` → Model Usage chart | Short names, no duplicates |

---

## Risks & Alternatives

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Other providers also have deprecated models** that were previously hidden | Medium | Low | The filter is generic (`status === 'deprecated'`); it will correctly hide any deprecated model from any provider, not just OpenCode Go. |
| **Model name normalization regex misses edge cases** (e.g., `accounts/org/provider/models/name`) | Low | Medium | The regex `^accounts\/([^/]+)\/models\/(.+)$` is conservative. If an unhandled pattern appears, the fallback keeps the original ID — the dashboard still works, just with a long label. |
| **Aggregating by bare model name conflates genuinely different models** that share a name | Low | Low | Extremely unlikely; model names are globally unique identifiers in practice. If it happens, the provider breakdown array in the tooltip still distinguishes them. |
| **Type errors from adding `model_provider` to session export** | Low | Low | The sync script is plain JS; no TS checking there. The `Session` interface in `src/types/index.ts` does not need to include `model_provider` because no UI code reads it from sessions. |
| **Build failure from `verbatimModuleSyntax`** | Low | Medium | All type imports already use `import type`. No new runtime imports are added. Verify with `npx tsc -b` after every task. |

**Alternative approaches (if risks materialize):**
- If the `accounts/.../models/...` pattern varies by provider, extend `normalizeModelName` with additional regex branches.
- If aggregation proves undesirable, remove the `modelMap` merge logic and keep provider-prefixed labels (`fireworks/kimi-k2p6`) in `byModel` — the chart will still show short-ish names and no `accounts/...` prefix.
- If tooltip provider breakdown is too cluttered, remove the `providers` array and the tooltip enhancement; the core fix (short names + aggregation) still works.

---

## Rollback Plan

1. **Revert the sync script changes:**
   ```bash
   git checkout HEAD -- scripts/sync-opencode-data.js
   ```
   This restores the original unfiltered, unaggregated export logic.

2. **Revert UI type and component changes:**
   ```bash
   git checkout HEAD -- src/utils/dataLoader.ts src/types/index.ts src/utils/overviewDataProcessor.ts src/components/ModelUsageChart.tsx
   ```

3. **Regenerate data with old logic:**
   ```bash
   npm run sync
   ```

4. **Verify rollback:**
   - `public/data/models.json` should again show 14 models for OpenCode Go.
   - `public/data/token-usage.json` `byModel` should show raw model IDs.

All changes are confined to 5 files; no database migrations or external dependencies are involved.

---

## Self-Review Checklist

**1. Spec coverage:**
- FR-01 (sync script filters to match terminal) → **Task 1**
- FR-02 (filter out deprecated models) → **Task 1**
- FR-03 (Overview model count matches reality) → **Task 1** (filtered `models.json` automatically fixes Overview count)
- FR-04 (Resources page shows only real models) → **Task 1** (same reasoning)
- FR-05 (historical usage data preserved) → **Task 4** (aggregation only affects `byModel`, sessions/messages untouched)
- FR-06 (shortened model names) → **Tasks 3 & 4**
- FR-07 (provider context for generic names) → **Tasks 2, 3 & 4**
- FR-08 (aggregate usage across providers) → **Task 4**
- NFR-01 (sync script only) → All data fixes are in `scripts/sync-opencode-data.js`
- NFR-02 (backward compatibility) → `models.json`/`providers.json` schema unchanged; only additive `providers` field in `token-usage.json`
- NFR-03 (no new dependencies) → No npm packages added
- NFR-04 (build integrity) → Verified in **Task 8**
- NFR-05 (graceful degradation) → `normalizeModelName` fallback keeps original ID; deprecated filter is a simple skip
- NFR-06 (performance) → O(n) loops, no additional I/O

**2. Placeholder scan:**
- No "TBD", "TODO", "implement later", or "fill in details" found.
- Every step contains exact file paths, line numbers, and code blocks.
- Every verification step has an exact command and expected output.

**3. Type consistency:**
- `normalizeModelName` returns `{ shortName, modelName }` — used consistently in Tasks 2, 4.
- `providers` array shape is identical in `dataLoader.ts`, `types/index.ts`, and the sync script push logic.
- `ModelUsageBarItem` in `types/index.ts` matches the object created in `computeTopModelsForBar`.
- `import type` is already used in `ModelUsageChart.tsx`; no change needed.

**No gaps found. Plan is complete.**

---

Version: 1 | Author: planner | Ref: requirements v1 | Date: 2026-05-26

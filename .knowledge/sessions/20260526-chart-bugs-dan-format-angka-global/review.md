# Code Review: Chart Bugs, Project Column, Global Number Formatting

## Reference
- Plan: `.knowledge/sessions/20260526-chart-bugs-dan-format-angka-global/plan.md` v1
- Requirements: `.knowledge/sessions/20260526-chart-bugs-dan-format-angka-global/requirements.md` v2

## Verdict: FAIL

## Summary

8 of 8 tasks implemented across 9 files (+1 bonus refactor in `overviewDataProcessor.ts`). Primary functional goals achieved: chart axes visible, project names displayed, global K/M/B formatting applied. One critical bug found in `formatCost()` sub-$1000 regex that strips non-`.00` trailing zeros (e.g., `$0.50` → `$0.5`, `$12.50` → `$12.5`). One warning: TokenUsageChart and CostChart Tooltips lack the `contentStyle` fix applied to ModelUsageChart. Unable to run `tsc -b` / `npm run lint` due to tool restrictions — Orchestrator must verify.

## Verification Evidence

**`git diff --stat` output:**
```
 AGENTS.md                          | 30 ----------------------------
 prompt.md                          | 18 +++++++++++++++++
 src/components/CostChart.tsx       | 21 +++++++++++++++++---
 src/components/ModelUsageChart.tsx | 27 +++++++++++++++++++++----
 src/components/TokenUsageChart.tsx | 21 +++++++++++++++++---
 src/components/TopBar.tsx          |  6 +++---
 src/pages/Overview.tsx             |  7 ++++---
 src/pages/SessionDetail.tsx        | 33 ++++++++++++++++++++++---------
 src/pages/SessionsList.tsx         | 40 ++++++++++++++++++++++++++------------
 src/utils/costCalculator.ts        | 33 ++++++++++++++++++-------------
 src/utils/overviewDataProcessor.ts | 22 ++++-----------------
 11 files changed, 159 insertions(+), 99 deletions(-)
```

**Manual static analysis:** All 9 `src/` files reviewed line-by-line. Logic traced for edge cases via regex behavior analysis on `formatNumber()` and `formatCost()`.

**NOTE:** `npx tsc -b` and `npm run lint` could not be executed — bash commands restricted in this environment. The Orchestrator MUST run these commands before accepting the review.

---

## Issues

### Critical
- **[C-01]** `src/utils/costCalculator.ts:31` — `formatCost()` sub-$1000 regex strips non-`.00` trailing zeros.
  
  **Root cause:** The regex `\.?0+$` (`/\.?0+$/`) removes ANY trailing zero after the last digit, not just `.00`. On `"0.50"`, `0+$` matches the final `0` → result `"0.5"` → `"$0.5"` (violates requirement C-02: `"$0.50 tetap"`). On `"12.50"` → `"$12.5"`. On `"0.10"` → `"$0.1"`.
  
  **Impact:** Any cost value whose `.toFixed(2)` representation ends in a single trailing zero (e.g., $0.10, $0.50, $12.50, $0.30) will display with one fewer decimal place than required. Values ending in `.00` are correctly stripped. Values without trailing zeros (e.g., `"12.34"`, `"0.51"`) are unaffected.
  
  **Pattern analysis:** The same regex is used in `formatNumber()` at line 46 where it IS correct — `1.50K` → `1.5K` is the desired behavior. The difference is that `formatNumber` values (divided by powers of 1000) produce fractional results where trailing-zero stripping is semantically correct, while `formatCost` sub-$1000 values represent cents where the full 2dp should be preserved.
  
  **Fix:** Replace the generic strip in `formatCost()` sub-$1000 branch with a targeted `.00`-only strip:
  ```ts
  // Line 31: Replace
  const stripped = formatted.includes('.') ? formatted.replace(/\.?0+$/, '') : formatted
  // With:
  const stripped = formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted
  ```
  This preserves all non-`.00` decimal values and correctly strips only `$12.00` → `$12`.
  
  **Severity:** critical — violates explicit requirement C-02 + plan Task 2 DoD item.

### Warning
- **[W-01]** `src/components/TokenUsageChart.tsx:136` — `<Tooltip>` missing `contentStyle` prop.
  
  Recharts `<Tooltip>` renders a wrapper `<div>` with default `background: white`. The `CustomTooltip` component's own dark `#1c2128` div renders inside this wrapper, but the wrapper's white background may create a visible halo/bleed around the tooltip. ModelUsageChart received this fix at line 94: `contentStyle={{ background: 'none', border: 'none', padding: 0 }}`. TokenUsageChart and CostChart should receive the same fix for visual consistency (NFR-01).
  
  **Fix:** Add `contentStyle={{ background: 'none', border: 'none', padding: 0 }}` to the `<Tooltip>` at line 136.
  
  **Severity:** warning — visual inconsistency, likely subtle on dark backgrounds. Plan's Task 5 incorrectly assumed LineChart doesn't need this fix.

- **[W-02]** `src/components/CostChart.tsx:137` — Same as W-01. `<Tooltip>` missing `contentStyle` prop.
  
  **Fix:** Add `contentStyle={{ background: 'none', border: 'none', padding: 0 }}` to the `<Tooltip>` at line 137.
  
  **Severity:** warning — same issue as W-01.

### Suggestion
- **[S-01]** `src/components/ModelUsageChart.tsx:73` — `cursor` prop removed entirely due to Recharts v2 TypeScript type rejection. The plan's risk mitigation suggested `cursor={false}` as fallback to explicitly disable the cursor overlay. The current `contentStyle` fix alone may suffice for the visible white-background issue, but `cursor={false}` would be a more defensive fix (prevents any cursor rectangle rendering).
  
  **Status:** Accepted as known deviation per plan's risk mitigation notes. No change required.

- **[S-02]** `src/utils/overviewDataProcessor.ts:266` — The conditional `totalCost < 1000 ? formatCost(totalCost) : '$' + formatNumber(totalCost)` is now semantically redundant because `formatCost()` internally delegates to `formatNumber()` for values >= 1000. Both branches produce identical output. However, requirements explicitly state this logic "tetap dipertahankan" (must be preserved). No change needed — just noting for future cleanup.

- **[S-03]** `src/utils/overviewDataProcessor.ts` (diff bonus) — The programmer replaced the client-side cost computation loop (lines 220-234 in old code) with `overview.totalCost`. This is a good optimization: the cost was already pre-computed in `overview.json` by the sync script, so recalculating it was redundant. Unused params `sessions` and `pricingMap` correctly renamed to `_sessions` and `_pricingMap` per TypeScript unused-parameter convention. This change was NOT in the plan but is a safe, beneficial refactor. Approved.

---

## Plan Adherence

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 1 | Update formatNumber — 2dp + trailing-zero strip | ✅ Matches plan | Correct implementation; regex `\.?0+$` correct for formatNumber context |
| Task 2 | Update formatCost — K/M/B + $ prefix + 2dp strip | ❌ Deviation | Sub-$1000 regex strips non-`.00` trailing zeros (C-01). Fix: use `.endsWith('.00')` check instead of `\.?0+$` |
| Task 3 | Replace .toLocaleString() → formatNumber() | ✅ Matches plan | All 7 occurrences replaced across 4 files. Date formatting preserved. |
| Task 4 | Replace raw cost formatting → formatCost() in Overview | ✅ Matches plan | Line 237: `formatCost(overview.totalCost)`. Import added. |
| Task 5 | Fix ModelUsageChart white hover background | ✅ Matches plan (with known deviation) | `contentStyle` added to Tooltip. `cursor` prop removed (TS type rejection) — accepted per plan risk mitigation. |
| Task 6 | Fix chart axis labels — remove hide, add tick formatters | ✅ Matches plan | All 3 charts: XAxis+YAxis visible, tick formatters correct, CSS variables used, long-label rotation, margins adjusted. |
| Task 7 | Display project name in SessionsList | ✅ Matches plan | `loadProjects()` added, `Map<string,string>` with O(1) lookup, search+filter use project names, fallback to raw ID. |
| Task 8 | Display project name in SessionDetail | ✅ Matches plan | Same Map-based lookup pattern, both info bar + detail card updated. |
| Bonus | overviewDataProcessor.ts streamline | ✅ Safe refactor | Replaced client-side cost loop with pre-computed overview.totalCost. No behavioral change. |

---

## Requirements Coverage

### AREA A: Chart Bug Fixes

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| A-BUG-01 | Axis labels visible on all 3 charts | ✅ Satisfied | TokenUsageChart: L119-134 (XAxis+YAxis visible). CostChart: L120-135. ModelUsageChart: L75-92. All use CSS variables. |
| A-BUG-02 | No white background on ModelUsageChart hover | ✅ Satisfied (with known deviation) | `contentStyle={{ background: 'none', border: 'none', padding: 0 }}` at ModelUsageChart L94. `cursor` prop removed — accepted per plan. |

### AREA B: Project Column

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| B-FR-01 (SessionsList) | Display project NAME not UUID | ✅ Satisfied | L231: `projectNameMap.get(s.project_id ?? '') ?? s.project_id ?? '—'`. Map built via useMemo L64-70. |
| B-FR-01 + S-01 (SessionDetail) | Display project NAME not UUID | ✅ Satisfied | L265 (info bar): `{projectName ?? '—'}`. L283 (detail card): `{projectName ?? '—'}`. Map at L194-200, computed name at L202-204. |
| B-FR-02 | Document tokens/cost calculation | ✅ Satisfied | Addressed in requirements.md. No code change needed. |

### AREA C: Global Number Formatting

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| C-FR-01 | All numbers use K/M/B (no .toLocaleString) | ✅ Satisfied | All 7 occurrences replaced: Overview L225,231; SessionsList L233; SessionDetail L355,395; TopBar L49,159,178. |
| C-FR-02 | formatNumber 2dp with trailing-zero strip | ✅ Satisfied | `toFixed(2)` + `\.?0+$` regex strip. Verified: 1.5K, 1.25K, 1K, 2M, 1B all correct. |
| C-FR-03 | formatCost $ + K/M/B, sub-$1K $X.XX strip .00 | ❌ Not satisfied | Sub-$1000 branch: `\.?0+$` regex strips non-`.00` trailing zeros. `$0.50` → `$0.5`. See C-01. |

### Non-Functional Requirements

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| NFR-01 | Consistent dark tooltip styling | ⚠️ Partial | ModelUsageChart: fixed. TokenUsageChart + CostChart: missing contentStyle (W-01, W-02). |
| NFR-02 | O(1) project name lookup | ✅ Satisfied | `Map<string, string>` + `Map.get()` in both SessionsList and SessionDetail. No `.find()` in loops. |
| NFR-03 | TypeScript strict mode | ⚠️ Unverified | Orchestrator must run `tsc -b`. Static analysis: all `import type` correct, unused params prefixed `_`, no obvious type errors. |
| NFR-04 | formatCost signature unchanged | ✅ Satisfied | `(value: number): string` preserved. All 7 callers: SessionsList, SessionDetail, TopBar, CostChart, overviewDataProcessor, Overview. |
| NFR-05 | Chart axes use CSS variables | ✅ Satisfied | All 3 charts: `stroke: "var(--text-secondary)"`, `axisLine: { stroke: 'var(--border)' }`. |

### Constraints

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| C-01 | No new npm dependencies | ✅ Satisfied | No package.json changes. Only existing deps used (Recharts, React, motion). |
| C-02 | public/data/ unchanged | ✅ Satisfied | No changes to public/data/ or .gitignore. |
| C-03 | Only src/ files changed | ✅ Satisfied | AGENTS.md and prompt.md changes unrelated to this feature. sync-opencode-data.js unchanged. |
| C-04 | No JSON structure changes | ✅ Satisfied | sessions.json, projects.json, etc. unchanged. |
| C-05 | verbatimModuleSyntax compliance | ⚠️ Unverified | Static analysis: all type-only imports use `import type`. Must verify via `tsc -b`. |

### Regression Checks

| Check | Status | Evidence |
|-------|--------|----------|
| Date formatting unchanged | ✅ Safe | All `.toLocaleDateString()`, `.toLocaleString()` on Date objects UNCHANGED. Only numeric `.toLocaleString()` replaced. |
| Resources page pricing unchanged | ✅ Safe | Lines 182-184: `$X.XX/Mt` format preserved per R-01. |
| TokenCompositionChart unchanged | ✅ Safe | Per T-01, verified safe. Uses `formatNumber` (already had it), no other changes. |
| All existing imports valid | ✅ Safe | All new imports (formatNumber, formatCost, loadProjects, Project) added to existing import lines or as new lines. No orphaned imports. |

---

## Detailed Edge Case Analysis

### formatNumber() regex behavior — VERIFIED CORRECT

| Input | Computed | After `.toFixed(2)` | After `strip()` + suffix | Expected | Match? |
|-------|----------|---------------------|--------------------------|----------|--------|
| 42 | (sub-1000) | — | "42" | "42" | ✅ |
| 999 | (sub-1000) | — | "999" | "999" | ✅ |
| 1000 | 1000/1000=1 | "1.00" | "1K" | "1K" | ✅ |
| 1050 | 1050/1000=1.05 | "1.05" | "1.05K" | "1.05K" | ✅ |
| 1250 | 1250/1000=1.25 | "1.25" | "1.25K" | "1.25K" | ✅ |
| 1500 | 1500/1000=1.5 | "1.50" | "1.5K" | "1.5K" | ✅ |
| 2000 | 2000/1000=2 | "2.00" | "2K" | "2K" | ✅ |
| 1250000 | 1250000/1000000=1.25 | "1.25" | "1.25M" | "1.25M" | ✅ |
| 1500000 | 1500000/1000000=1.5 | "1.50" | "1.5M" | "1.5M" | ✅ |
| 1000000000 | 1000000000/1000000000=1 | "1.00" | "1B" | "1B" | ✅ |
| 2500000000 | 2500000000/1000000000=2.5 | "2.50" | "2.5B" | "2.5B" | ✅ |
| NaN | — | — | "0" | "0" | ✅ |
| Infinity | — | — | "0" | "0" | ✅ |

### formatCost() regex behavior — BUG FOUND

| Input | Branch | After `.toFixed(2)` | After `strip()` | Expected | Match? |
|-------|--------|---------------------|-----------------|----------|--------|
| 0 | zero | — | "$0" | "$0" | ✅ |
| NaN | non-finite | — | "$0" | "$0" | ✅ |
| 0.01 | sub-1000 | "0.01" | "$0.01" | "$0.01" | ✅ |
| 0.10 | sub-1000 | "0.10" | **"$0.1"** | "$0.10" | ❌ |
| 0.50 | sub-1000 | "0.50" | **"$0.5"** | "$0.50" | ❌ |
| 12.00 | sub-1000 | "12.00" | "$12" | "$12" | ✅ |
| 12.34 | sub-1000 | "12.34" | "$12.34" | "$12.34" | ✅ |
| 12.50 | sub-1000 | "12.50" | **"$12.5"** | "$12.50" | ❌ |
| 1250 | >= 1000 | delegates to formatNumber | "$1.25K" | "$1.25K" | ✅ |
| 1500 | >= 1000 | delegates to formatNumber | "$1.5K" | "$1.5K" | ✅ |
| 2500000 | >= 1000 | delegates to formatNumber | "$2.5M" | "$2.5M" | ✅ |
| 1000000000 | >= 1000 | delegates to formatNumber | "$1B" | "$1B" | ✅ |

---

## Orchestrator Action Items

1. **MUST:** Run `npx tsc -b` in the project root to verify TypeScript strict-mode compliance. Report any errors.
2. **MUST:** Run `npm run lint` to verify ESLint compliance. Report any warnings/errors.
3. **RECOMMEND:** Fix C-01 before accepting — change `formatCost()` sub-$1000 regex from `\.?0+$` to targeted `.00` strip.
4. **RECOMMEND:** Apply W-01 and W-02 (contentStyle on TokenUsageChart + CostChart Tooltips) for visual consistency.

---
Author: reviewer | Date: 2026-05-26 | Iteration: 1

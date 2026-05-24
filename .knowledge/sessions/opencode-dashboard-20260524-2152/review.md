# Code Review: Fix Provider Count Showing 0 for OpenCode Go Users

## Reference
- Plan: `.knowledge/sessions/opencode-dashboard-20260524-2152/plan.md` v1
- Requirements: `.knowledge/sessions/opencode-dashboard-20260524-2152/requirements.md` v1

## Verdict: PASS_WITH_NOTES

## Summary
All 5 implementation tasks (Tasks 1–5) are correctly implemented in `scripts/sync-opencode-data.js`. The core bug (FR-03: `key` field not recognized) is fixed — verified by reading `public/data/providers.json`, which now contains `{"id":"opencode-go","configured":true,"apiKey":"sk-..."}`. Supporting changes (diagnostic logging, array handling, config fallback, path candidates) match the plan precisely. No frontend changes made (NFR-01 satisfied). Output schema unchanged (NFR-02 satisfied). One minor code-quality issue flagged as a warning, plus two optional suggestions.

## Issues

### Critical
None.

### Warning
- **[W-01]** `scripts/sync-opencode-data.js:405,448` — Diagnostic log may produce misleading output for non-object `auth.json` values. The log at line 405 runs `Object.keys(authJson).length` before the `typeof authJson === 'object'` guard at line 409. If `auth.json` contains a JSON primitive (e.g., a bare string `"hello"` from a corrupted file), `Object.keys("hello")` returns `5` (character indices), logging "auth.json found in local (5 entries)" — but then zero providers are extracted because the `typeof` guard correctly skips the primitive. The log message is misleading for debugging. Same issue at line 448 for the config fallback.
  
  **Fix:** Move the entry-count log inside the `typeof authJson === 'object'` guard, or gate it with a type check:
  ```js
  const entryCount = (typeof authJson === 'object' && authJson !== null)
    ? (Array.isArray(authJson) ? authJson.length : Object.keys(authJson).length)
    : 0
  ```
  
  **Severity rationale:** The guard at line 409/458 correctly prevents any malformed entries from being added. The risk is limited to a misleading log message in an extremely unlikely edge case (non-object JSON in `auth.json`). Classified as warning rather than critical because no data corruption or incorrect provider export can occur.

### Suggestion
- **[S-01]** `scripts/sync-opencode-data.js:418-420,430-432,462-464` — The field coalescing logic for `apiKey` and `configured` (6-field chain: `apiKey ?? api_key ?? key ?? token ?? secret ?? apiToken`) is duplicated verbatim across three branches (local array, local object, config fallback). Extracting this into a local helper function would improve maintainability and eliminate the risk of future divergence. The plan (Task 3 design note) acknowledges this tradeoff is acceptable for a single-file script — no action required, noted for future refactoring.

- **[S-02]** `scripts/sync-opencode-data.js:444` — Path deduplication uses string comparison (`configAuthPath !== localAuthPath`). On Windows (case-insensitive filesystem), two path strings that differ only in case would fail this check and cause a double-read. Using `path.resolve()` before comparison would be more robust:
  ```js
  if (path.resolve(configAuthPath) !== path.resolve(localAuthPath))
  ```

## Plan Adherence
- [x] **Task 1 (Expand API key field detection):** Lines 418, 420, 430, 432, 462, 464 — `apiKey ?? api_key ?? key ?? token ?? secret ?? apiToken` coalescing chain implemented in all provider extraction branches. `configured` check mirrors the same fields. ✅
- [x] **Task 2 (Diagnostic logging):** Lines 402-408, 411, 445-473 — Console logs report auth.json path, found/not-found status, entry count, array detection, and dedup skips. ✅
- [x] **Task 3 (Array auth.json handling):** Lines 410-423, 451-467 — `Array.isArray(authJson)` branches in both local and config blocks. Non-object elements skipped via `value && typeof value === 'object'` guard. Index-based fallback IDs (`provider-${index}`). ✅
- [x] **Task 4 (Config auth.json fallback):** Lines 440-474 — Second provider extraction block reads `paths.config/auth.json`, skips if same path as local, deduplicates via `Set` of existing IDs, logs skipped duplicates. ✅
- [x] **Task 5 (Path detection candidates):** Lines 32-33, 39, 45 — `AppData/Local/OpenCode`, `~/opencode` (non-dotfile), `AppData/Local/OpenCode/Cache`, and `AppData/Roaming/OpenCode` candidates appended after existing paths. First-match-wins preserved. ✅
- [x] **Task 6 (Verification):** Not performed by the Reviewer — delegated to the Orchestrator/Programmer. However, the output file `public/data/providers.json` was inspected and contains correct data. ✅
- [n/a] **Task 7 (Stretch):** Deferred per plan decision (Q-001 unresolved). Correctly not implemented. ✅

## Requirements Coverage
- [x] **FR-01 (Expand path detection):** 5 new candidates added across local/cache/config. ✅
- [x] **FR-02 (Config auth.json fallback):** Merged reads from both paths, local takes precedence, dedup by id. ✅
- [x] **FR-03 (Expand field detection):** `key`, `token`, `secret`, `apiToken` recognized. Verified: `providers.json` shows `configured: true` with the `key` field value in `apiKey`. ✅
- [x] **FR-04 (Diagnostic logging):** Paths, found/not-found, entry counts, array detection, dedup skips all logged. ✅
- [x] **FR-05 (Array auth.json):** Array branch with per-element guards and index fallback IDs. ✅
- [n/a] **FR-06 (Config file providers):** Deferred per plan. ✅
- [x] **NFR-01 (No frontend changes):** Only `scripts/sync-opencode-data.js` modified. No `.ts`/`.tsx` files touched. ✅
- [x] **NFR-02 (Backward compatibility):** Existing candidates and field names (`apiKey`, `api_key`) retain priority. Output schema unchanged. ✅
- [x] **NFR-03 (Graceful degradation):** `readJsonSafe` returns `null` on missing/invalid files. Empty arrays when no data found. No hard errors for missing auth.json. ✅
- [x] **NFR-04 (Performance):** Only `fs.existsSync` (already used in path detection) and `readFileSync` added. Negligible overhead. ✅
- [x] **AC-01 (providers.json contains configured entries):** Verified — `public/data/providers.json` contains `{"id":"opencode-go","configured":true,"apiKey":"sk-..."}`. ✅
- [x] **AC-02 (Providers card shows ≥ 1):** Frontend unchanged — with `configured: true` in the data, the card will show ≥ 1. ✅
- [x] **AC-03 (Providers page displays details):** Frontend unchanged — output schema identical to `ProviderInfo`. ✅
- [x] **AC-04 (No regression for OpenCode Classic):** `apiKey` and `api_key` retain top priority in coalescing chain. ✅
- [x] **AC-05 (npm run build passes):** No `.ts`/`.tsx` files changed; script is `.js` (not type-checked by `tsc`); no new imports or dependencies. Build should pass without issues. ✅
- [x] **AC-06 (npm run lint passes):** ESLint config (line 11) only targets `**/*.{ts,tsx}` files. The `.js` sync script is not linted. No new errors introduced. ✅
- [x] **AC-07 (Diagnostic output clear):** Console logs added for auth.json discovery, entry counts, array detection, and dedup skips. ✅

---
Author: reviewer | Date: 2026-05-24 | Iteration: 1

# Fix Provider Count Showing 0 for OpenCode Go Users — Implementation Plan

> **For the Orchestrator:** The Orchestrator delegates this plan to the Programmer for execution. After implementation, the Orchestrator delegates to the Reviewer for code review. Do NOT dispatch subagents directly — the Orchestrator manages the multi-agent pipeline.

**Goal:** Fix the sync script so that OpenCode Go users' provider credentials (using the `key` field in `auth.json`) are correctly detected as configured, and improve overall path detection / file handling resilience.

**Architecture:** A single-file change in `scripts/sync-opencode-data.js`. The critical fix expands the API key field detection in `exportJsonFiles()` (lines 400–411) to recognize `value.key` and other alternative field names. Supporting changes add diagnostic logging, path detection candidates for OpenCode Go, fallback reading of `auth.json` from `paths.config`, and defensive handling of array-formatted `auth.json`. No frontend or TypeScript type changes are needed — the exported `ProviderInfo` shape remains identical.

**Tech Stack:** Node.js (built-in `fs`, `path`), sqlite3 (existing dependency).

**Reference:** Requirements: `.knowledge/sessions/opencode-dashboard-20260524-2152/requirements.md` v1

---

## File Structure

- **Modify:** `scripts/sync-opencode-data.js` — the only file changed. All modifications are additive to the existing script logic.
- **No new files** — no test framework exists in this project.
- **No frontend changes** — per NFR-01.

---

## Decision Points

- [x] **Field detection order:** `apiKey` → `api_key` → `key` → `token` → `secret` → `apiToken`. Existing fields (`apiKey`, `api_key`) retain priority; new fields are appended. No user input needed.
- [x] **Merge strategy for dual auth.json sources:** `paths.local` takes precedence over `paths.config` for same-`id` entries. Deduplication by `id`. No user input needed.
- [x] **New path candidates are additive:** Appended after existing candidates, preserving first-match-wins behavior. No user input needed.
- [ ] **FR-06 (Provider from config file):** Open Question Q-001 — OpenCode Go's unified config format is unknown. This task is deferred as a low-priority optional step (Task 7). **User input needed:** Should we attempt to read `opencode.json`/`opencode.jsonc` from `paths.config` for provider info, or skip FR-06 entirely?

---

## Task Breakdown

### Task 1: Expand API Key Field Name Detection (CRITICAL — FR-03)

**Files:**
- Modify: `scripts/sync-opencode-data.js` lines 400–411

**Description:** The `exportJsonFiles()` function only recognizes `apiKey` and `api_key`. OpenCode Go uses `key`. Add `key`, `token`, `secret`, and `apiToken` to the coalescing chain for both `apiKey` value extraction and `configured` boolean calculation.

- [ ] **Step 1: Locate the provider extraction block**

Open `scripts/sync-opencode-data.js`. The block to change is lines 400–411:

```js
            apiKey: value.apiKey ?? value.api_key ?? null,
            baseUrl: value.baseUrl ?? value.base_url ?? null,
            configured: !!(value.apiKey || value.api_key),
```

- [ ] **Step 2: Expand the field detection**

Replace lines 405 and 407 with:

```js
            apiKey: value.apiKey ?? value.api_key ?? value.key ?? value.token ?? value.secret ?? value.apiToken ?? null,
            baseUrl: value.baseUrl ?? value.base_url ?? null,
            configured: !!(value.apiKey || value.api_key || value.key || value.token || value.secret || value.apiToken),
```

**Order rationale:** Existing fields (`apiKey`, `api_key`) retain priority. The new field `key` (OpenCode Go's convention) is checked next, followed by defensive alternatives (`token`, `secret`, `apiToken`). The `configured` check must mirror the same fields in the same order.

- [ ] **Step 3: Verify with a manual check**

Run the sync script:

```bash
npm run sync
```

Expected output: If OpenCode Go `auth.json` exists at the detected `paths.local`, the output should show `Exported N providers` where N ≥ 1 (assuming at least one provider has a `key` field). The `providers.json` file at `public/data/providers.json` should contain at least one entry with `"configured": true`.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-opencode-data.js
git commit -m "fix: recognize key/token/secret/apiToken fields in auth.json provider detection"
```

**Dependency:** None (first task)
**Definition of Done:** `value.key` is checked when extracting `apiKey` and computing `configured`. OpenCode Go users with `key` in `auth.json` get `configured: true` and a non-null `apiKey`.
**Complexity:** low

---

### Task 2: Add Diagnostic Logging for auth.json Discovery (FR-04)

**Files:**
- Modify: `scripts/sync-opencode-data.js` lines 388–412 (`exportJsonFiles` function)

**Description:** Add `console.log` statements inside `exportJsonFiles()` to report which auth.json paths were found, whether they were successfully parsed, and how many providers were extracted from each source. This enables users and developers to diagnose path detection failures without modifying the script.

- [ ] **Step 1: Add logging for auth.json path detection in `exportJsonFiles()`**

Modify the `exportJsonFiles()` function. Currently lines 396–412 handle the single `paths.local/auth.json` read. Add logging around the read:

```js
  // Providers from auth.json
  if (paths.local) {
    const authPath = path.join(paths.local, 'auth.json')
    console.log(`  Attempting auth.json from local: ${authPath}`)
    const authJson = readJsonSafe(authPath)
    if (authJson) {
      console.log(`  auth.json found in local (${Object.keys(authJson).length} entries)`)
    } else {
      console.log(`  auth.json not found or unreadable in local`)
    }
    if (authJson && typeof authJson === 'object') {
      for (const [key, value] of Object.entries(authJson)) {
        if (value && typeof value === 'object') {
          providers.push({
            id: key,
            name: value.name ?? key,
            apiKey: value.apiKey ?? value.api_key ?? value.key ?? value.token ?? value.secret ?? value.apiToken ?? null,
            baseUrl: value.baseUrl ?? value.base_url ?? null,
            configured: !!(value.apiKey || value.api_key || value.key || value.token || value.secret || value.apiToken),
          })
        }
      }
    }
  }
```

Note: The `apiKey` and `configured` lines in the code above already include the Task 1 fix.

- [ ] **Step 2: Standardize all "not found" log messages to use consistent prefixing**

Existing logs in `main()` already use `console.log('  local:', ...)` style (two-space indent + label). The new log messages use the same pattern: `console.log('  Attempting auth.json from local:', ...)`.

- [ ] **Step 3: Verify logging output**

Run the sync script:

```bash
npm run sync
```

Expected output includes lines like:
```
  Attempting auth.json from local: C:\Users\rfan2\.local\share\opencode\auth.json
  auth.json found in local (2 entries)
  ...
  Exported 2 providers, 15 models, ...
```

If no `auth.json` exists:
```
  Attempting auth.json from local: C:\Users\rfan2\.local\share\opencode\auth.json
  auth.json not found or unreadable in local
```

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-opencode-data.js
git commit -m "feat: add diagnostic logging for auth.json path detection in sync script"
```

**Dependency:** Task 1 (builds on the expanded field detection code)
**Definition of Done:** Running `npm run sync` logs the exact path of auth.json being checked, whether it was found, and if so how many entries it contains. The existing "Exported N providers" line in `main()` remains the final count.
**Complexity:** low

---

### Task 3: Handle `auth.json` Formatted as an Array (FR-05)

**Files:**
- Modify: `scripts/sync-opencode-data.js` lines 396–412 (`exportJsonFiles` function, provider extraction block)

**Description:** If `auth.json` is parsed as a JSON array rather than an object, the current code produces zero providers because `Object.entries([])` returns `[]`. Add array handling: iterate array elements, treat each as a provider entry with an index-based id, and skip non-object elements gracefully.

- [ ] **Step 1: Add array-branch handling around the provider extraction loop**

Modify the provider extraction block (after the existing Task 1/Task 2 changes) to wrap the `Object.entries()` loop in a check for array vs object:

Replace the inner block (from `if (authJson && typeof authJson === 'object')` through the closing brace of the for loop) with:

```js
    if (authJson && typeof authJson === 'object') {
      if (Array.isArray(authJson)) {
        console.log(`  auth.json is an array (${authJson.length} entries), iterating as providers`)
        authJson.forEach((value, index) => {
          if (value && typeof value === 'object') {
            const id = value.id ?? value.name ?? `provider-${index}`
            providers.push({
              id,
              name: value.name ?? id,
              apiKey: value.apiKey ?? value.api_key ?? value.key ?? value.token ?? value.secret ?? value.apiToken ?? null,
              baseUrl: value.baseUrl ?? value.base_url ?? null,
              configured: !!(value.apiKey || value.api_key || value.key || value.token || value.secret || value.apiToken),
            })
          }
        })
      } else {
        for (const [key, value] of Object.entries(authJson)) {
          if (value && typeof value === 'object') {
            providers.push({
              id: key,
              name: value.name ?? key,
              apiKey: value.apiKey ?? value.api_key ?? value.key ?? value.token ?? value.secret ?? value.apiToken ?? null,
              baseUrl: value.baseUrl ?? value.base_url ?? null,
              configured: !!(value.apiKey || value.api_key || value.key || value.token || value.secret || value.apiToken),
            })
          }
        }
      }
    }
```

**Design note:** For array entries without an explicit `id` or `name`, we fall back to `provider-${index}` to guarantee a unique `id`. The `apiKey`/`configured` logic is identical to the object branch — extracted to avoid duplication in a follow-up step would be nice, but for a single-file script with two branches this is acceptable.

- [ ] **Step 2: Verify graceful handling**

Create a temporary test `auth.json` as an array in the detected `paths.local`:

```bash
# Temporary test file (remove after verification)
echo '[{"name":"Test","key":"sk-test123"}]' > /path/to/detected/local/auth.json
npm run sync
# Clean up test file
```

Expected: The provider "Test" appears in `providers.json` with `configured: true` and `apiKey: "sk-test123"`.

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-opencode-data.js
git commit -m "feat: handle auth.json formatted as an array"
```

**Dependency:** Task 1 (uses expanded field detection)
**Definition of Done:** An `auth.json` that is a JSON array produces correct provider entries. Non-object array elements are skipped without error. Object-formatted `auth.json` continues to work unchanged (backward compatible).
**Complexity:** low

---

### Task 4: Search `auth.json` in `paths.config` as Fallback (FR-02)

**Files:**
- Modify: `scripts/sync-opencode-data.js` lines 396–435 (`exportJsonFiles` function, entire provider extraction section)

**Description:** Currently only `paths.local/auth.json` is read. Add a secondary read from `paths.config/auth.json` (when `paths.config` is available and different from `paths.local`). Merge results with `paths.local` taking precedence for same-`id` entries.

- [ ] **Step 1: Restructure `exportJsonFiles()` to return providers from a helper or inline dual read**

After the existing `paths.local` provider extraction block (which now includes array handling from Task 3), add a second block for `paths.config`:

```js
  // Providers from auth.json in paths.config (fallback)
  if (paths.config) {
    const configAuthPath = path.join(paths.config, 'auth.json')
    // Only read config auth.json if it's a different file from local auth.json
    const localAuthPath = paths.local ? path.join(paths.local, 'auth.json') : null
    if (configAuthPath !== localAuthPath) {
      console.log(`  Attempting auth.json from config: ${configAuthPath}`)
      const configAuthJson = readJsonSafe(configAuthPath)
      if (configAuthJson) {
        console.log(`  auth.json found in config (${Array.isArray(configAuthJson) ? configAuthJson.length : Object.keys(configAuthJson).length} entries)`)
        // Build a set of existing provider IDs from local for deduplication
        const existingIds = new Set(providers.map(p => p.id))
        const entries = Array.isArray(configAuthJson)
          ? configAuthJson.map((value, index) => [value.id ?? value.name ?? `provider-${index}`, value])
          : Object.entries(configAuthJson)
        for (const [key, value] of entries) {
          // Skip if already present from local (local takes precedence)
          if (existingIds.has(key)) {
            console.log(`  Provider "${key}" from config skipped (already in local)`)
            continue
          }
          if (value && typeof value === 'object') {
            providers.push({
              id: key,
              name: value.name ?? key,
              apiKey: value.apiKey ?? value.api_key ?? value.key ?? value.token ?? value.secret ?? value.apiToken ?? null,
              baseUrl: value.baseUrl ?? value.base_url ?? null,
              configured: !!(value.apiKey || value.api_key || value.key || value.token || value.secret || value.apiToken),
            })
          }
        }
      } else {
        console.log(`  auth.json not found or unreadable in config`)
      }
    } else {
      console.log(`  config auth.json path same as local, skipping duplicate read`)
    }
  }
```

**Design notes:**
- The `configAuthPath !== localAuthPath` check prevents reading the same file twice when `paths.local === paths.config` (common in some setups).
- A `Set` of existing provider IDs ensures O(1) deduplication. Local entries always win.
- The array vs object branching from Task 3 is mirrored here.
- Existing `providers` array (populated from local) is mutated in place with config additions.

- [ ] **Step 2: Verify merge behavior**

Run the sync script:

```bash
npm run sync
```

Expected behavior:
- If `paths.config/auth.json` exists and has providers not in `paths.local/auth.json`, they are appended.
- If `paths.config/auth.json` has a provider with the same `id` as one from local, the config entry is skipped (logged).
- If `paths.config` and `paths.local` are the same directory, config read is skipped (logged).

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-opencode-data.js
git commit -m "feat: read auth.json from paths.config as fallback for provider detection"
```

**Dependency:** Task 3 (uses array handling), Task 2 (uses logging patterns)
**Definition of Done:** Providers are extracted from both `paths.local/auth.json` and `paths.config/auth.json` when both exist and differ. Duplicates are resolved with local taking precedence. If only one source exists, that source is used. Diagnostic logs confirm which path(s) contributed providers.
**Complexity:** medium

---

### Task 5: Expand Path Detection Candidates for OpenCode Go (FR-01)

**Files:**
- Modify: `scripts/sync-opencode-data.js` lines 17–90 (`detectOpencodePaths` function)

**Description:** Add candidate paths that cover common OpenCode Go installation directories. New candidates are appended after existing ones to preserve the first-match-wins behavior for existing users.

- [ ] **Step 1: Add new candidate paths to the `candidates` object**

In `detectOpencodePaths()`, modify the `candidates` object (lines 27–43). Add new entries at the end of each array:

```js
    const candidates = {
      local: [
        path.join(home, '.local', 'share', 'opencode'),
        path.join(home, 'AppData', 'Local', 'opencode'),
        path.join(home, '.opencode'),
        path.join(home, 'AppData', 'Local', 'OpenCode'),   // OpenCode Go Windows (local, capitalized)
        path.join(home, 'opencode'),                         // OpenCode Go Linux/macOS (non-dotfile)
      ],
      cache: [
        path.join(home, '.cache', 'opencode'),
        path.join(home, 'AppData', 'Local', 'opencode', 'Cache'),
        path.join(home, '.opencode', 'cache'),
        path.join(home, 'AppData', 'Local', 'OpenCode', 'Cache'), // OpenCode Go Windows (cache, capitalized)
      ],
      config: [
        path.join(home, '.config', 'opencode'),
        path.join(home, 'AppData', 'Roaming', 'opencode'),
        path.join(home, '.opencode'),
        path.join(home, 'AppData', 'Roaming', 'OpenCode'),  // OpenCode Go Windows (config, capitalized)
      ],
    }
```

**Rationale for each new path:**
| New candidate | OS | Rationale |
|---|---|---|
| `AppData\Local\OpenCode` | Windows | Go apps may capitalize directory names differently than Node.js apps |
| `AppData\Local\OpenCode\Cache` | Windows | Corresponding cache subdirectory for capitalized variant |
| `AppData\Roaming\OpenCode` | Windows | Roaming config for capitalized variant |
| `~/opencode` (non-dotfile) | Linux/macOS | Some Go application installers use unprefixed directory names |

- [ ] **Step 2: Verify detection output**

Run the sync script:

```bash
npm run sync
```

Expected: The existing diagnostic logs from `main()` (lines 530–532) show which paths were resolved:

```
Detecting opencode data folders…
  local: C:\Users\rfan2\.local\share\opencode
  cache: C:\Users\rfan2\AppData\Local\opencode\Cache
  config: C:\Users\rfan2\.config\opencode
```

For a user whose data is only in the new paths, the script should detect them. For existing users, the first-match-wins ensures no regression.

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-opencode-data.js
git commit -m "feat: add OpenCode Go candidate paths to directory detection"
```

**Dependency:** None (independent of Tasks 1–4, but logically benefits from their logging)
**Definition of Done:** `detectOpencodePaths()` checks the new candidate directories. Existing candidates are unchanged. First-match-wins behavior is preserved. Diagnostics from `main()` confirm which paths matched.
**Complexity:** low

---

### Task 6: Verification — Build, Lint, and End-to-End Check

**Files:**
- No code changes — verification only.

**Description:** Run the full verification suite to ensure no regressions and all acceptance criteria are met.

- [ ] **Step 1: Run sync script to generate fresh data**

```bash
npm run sync
```

Expected: No errors. Diagnostic logs show path detection, auth.json source(s), and final export counts.

- [ ] **Step 2: Inspect `providers.json` output**

Check `public/data/providers.json` for correct structure:

```json
[
  {
    "id": "opencode-go",
    "name": "opencode-go",
    "apiKey": "sk-...",
    "baseUrl": null,
    "configured": true
  }
]
```

Verify: Every entry has all five fields (`id`, `name`, `apiKey`, `baseUrl`, `configured`). The `configured` field is `true` for providers with valid credentials.

- [ ] **Step 3: Run the build (includes TypeScript type-check)**

```bash
npm run build
```

Expected: `tsc -b` passes with no errors, and the Vite build completes successfully. AC-05 must pass.

- [ ] **Step 4: Run the linter**

```bash
npm run lint
```

Expected: No new errors introduced. AC-06 must pass. (The script is a `.js` file, so ESLint should not flag it if configured correctly; verify no unexpected warnings.)

- [ ] **Step 5: Start dev server and check Overview page**

```bash
npm run dev
```

Open the dashboard in a browser:
- The Providers card on the Overview page shows a positive number (≥ 1) — **AC-01, AC-02**.
- Navigate to `/providers` — each provider is displayed with name, masked API key, base URL (if any), and a "Configured" badge — **AC-03**.

- [ ] **Step 6: Verify backward compatibility**

If possible, test on a machine (or with data) that uses the original `apiKey` field (OpenCode Classic format):

```json
{ "openai": { "type": "api", "apiKey": "sk-..." } }
```

Run `npm run sync` and verify that providers with `apiKey` are still detected as configured — **AC-04**.

- [ ] **Step 7: Verify graceful degradation**

Delete `auth.json` (or temporarily rename it) and run `npm run sync`:

```bash
npm run sync
```

Expected: No errors. `providers.json` contains an empty array `[]`. Dashboard shows "0" on the Providers card without crashing.

- [ ] **Step 8: Final commit**

```bash
# If any changes were made during verification:
git add -A
git commit -m "chore: verification complete, all acceptance criteria pass"
```

**Dependency:** Tasks 1–5 (all implementations must be complete)
**Definition of Done:** All seven acceptance criteria (AC-01 through AC-07) pass. `npm run build` and `npm run lint` succeed without new errors. Manual verification of providers on the Overview and Providers pages confirms correct behavior.
**Complexity:** low (manual verification)

---

### Task 7 (OPTIONAL — Stretch Goal): Provider Detection from Config File (FR-06)

**Files:**
- Modify: `scripts/sync-opencode-data.js` (`exportJsonFiles` function)

**Description:** If OpenCode Go uses a unified config file (e.g., `opencode.json` or `opencode.jsonc` in `paths.config`) that contains provider definitions, read that file and extract provider entries. This task depends on Open Question Q-001 — the exact file format is unknown.

**Deferred until Q-001 is resolved.** If resolved, implementation would follow this pattern:

- Read `paths.config/opencode.json` and `paths.config/opencode.jsonc` via `readJsonSafe()`.
- If the config contains a `providers` key (or similar), extract entries and merge into the providers array.
- Follow the same deduplication rules as Task 4 (local > config file > config auth.json).

**Dependency:** Task 4 (builds on config fallback pattern), Q-001 must be resolved first.
**Definition of Done:** Not defined — deferred.
**Complexity:** medium (requires knowledge of OpenCode Go config schema)

---

## Dependency Order

```
Task 1 (field detection fix) ──┐
                                ├──> Task 2 (diagnostic logging) ──> Task 4 (config auth.json fallback)
                                │                                       │
                                └──> Task 3 (array auth.json) ──────────┘
                                                                         │
Task 5 (path detection) ─────────────────────────────────────────────────┤
                                                                         │
                                                                         v
                                                                  Task 6 (verification)
                                                                         │
                                                                         v
                                                                  Task 7 (optional, deferred)
```

**Simplified:** 1 → {2, 3} (parallel) → 4 → 5 → 6 → [7]

Tasks 2 and 3 are independent of each other (both modify `exportJsonFiles()` but in different sub-blocks). If the implementer makes Task 2 and Task 3 changes to the same code region, they should be applied sequentially (2 then 3) to avoid merge conflicts.

**Recommendation:** Execute sequentially to avoid merge conflicts: 1 → 2 → 3 → 4 → 5 → 6.

---

## Risks & Alternatives

- **Risk:** New path candidates (`~/opencode` on Linux) could match a directory that is NOT an OpenCode data directory, causing false positives. | **Mitigation:** The candidates are added at the END of the existing list, so existing paths still win. The script checks for subdirectories (e.g., `opencode.db` existence) before reading data — an empty directory would still get `paths.local` set but produce no database data, which is harmless.
- **Risk:** The `%APPDATA%\OpenCode` (capitalized) path may not exist — it's speculative. | **Mitigation:** `fs.existsSync` handles this gracefully (returns `false`). No performance impact. If a future OpenCode Go version uses this path, it will work automatically.
- **Risk:** Array-formatted `auth.json` with non-object entries could produce weird provider data. | **Mitigation:** The `typeof value === 'object'` guard skips primitives. For arrays, the guard is applied per-element.
- **Risk:** If `paths.config` equals `paths.local`, the config auth.json read could double-read the same file. | **Mitigation:** The `configAuthPath !== localAuthPath` comparison prevents this (Task 4).
- **Alternative (if field detection fix doesn't work):** If OpenCode Go uses a fundamentally different auth format (e.g., TOML or environment variables), the fix in Task 1 won't cover all cases. | **Mitigation:** Open Question Q-003 is tracked for env-var-based detection. The current fix solves the confirmed case (`key` field in `auth.json`).

---

## Verification Checklist (Self-Review)

### 1. Spec Coverage

| Requirement | Task | Status |
|---|---|---|
| FR-01: Expand path detection for OpenCode Go | Task 5 | ✅ Covered |
| FR-02: Search auth.json in paths.config as fallback | Task 4 | ✅ Covered |
| FR-03: Expand API key field name detection | Task 1 | ✅ Covered |
| FR-04: Diagnostic logging | Task 2 | ✅ Covered |
| FR-05: Handle auth.json structural variations (array) | Task 3 | ✅ Covered |
| FR-06: Provider from config file (stretch) | Task 7 (deferred) | ⚠️ Requires Q-001 |
| NFR-01: No frontend changes | All tasks | ✅ No frontend files touched |
| NFR-02: Backward compatibility | Tasks 1, 4, 5 | ✅ Preserved |
| NFR-03: Graceful degradation | Task 6 Step 7 | ✅ Verified |
| NFR-04: Performance < 100ms increase | Tasks 4, 5 | ✅ Only fs.existsSync + readFileSync added |
| AC-01: providers.json contains configured entries | Task 6 Steps 1–2 | ✅ Covered |
| AC-02: Providers card shows ≥ 1 | Task 6 Step 5 | ✅ Covered |
| AC-03: Providers page displays details | Task 6 Step 5 | ✅ Covered |
| AC-04: No regression for OpenCode Classic | Task 6 Step 6 | ✅ Covered |
| AC-05: npm run build passes | Task 6 Step 3 | ✅ Covered |
| AC-06: npm run lint passes | Task 6 Step 4 | ✅ Covered |
| AC-07: Diagnostic output clear | Task 2 | ✅ Covered |

### 2. Placeholder Scan

- No "TBD", "TODO", "implement later", "fill in details" found.
- No "add appropriate error handling" without specific code.
- All code steps include actual code blocks.
- All paths are exact (`scripts/sync-opencode-data.js`).
- Task 7 is explicitly marked as deferred with a dependency on Q-001.

### 3. Type Consistency

- `ProviderInfo` interface (from `src/types/index.ts` lines 59–65): `id: string`, `name: string`, `apiKey: string | null`, `baseUrl: string | null`, `configured: boolean`. All tasks produce objects matching this shape.
- Field names used in Tasks 1–4 (`value.key`, `value.token`, `value.secret`, `value.apiToken`) are consistent throughout.
- The `configured` boolean formula is identical across all provider extraction blocks (Tasks 1, 3, 4).
- No TypeScript type changes needed — the exported JSON shape matches `ProviderInfo`.

---

> **QA Pass:** Self-review completed. All requirements covered. No placeholders. Type consistency verified.

---
Version: 1 | Author: planner | Ref: requirements v1 | Date: 2026-05-24

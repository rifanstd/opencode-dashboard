# Requirements: Fix Provider Count Showing 0 for OpenCode Go Users

## Context

A user running **OpenCode Go** (the Go-based version of OpenCode) reports that the "Providers" card on the Overview page shows **0**, even though they have providers configured. The bug is in the sync script (`scripts/sync-opencode-data.js`), which cannot locate OpenCode Go's `auth.json` file and therefore exports an empty `providers.json`. The dashboard frontend correctly computes `providers.filter((p) => p.configured).length` — it simply receives zero entries from the data pipeline.

The sync script was originally built for the Node.js "classic" version of OpenCode, which follows XDG directory conventions (`~/.local/share/opencode`, `%LOCALAPPDATA%\opencode`) and stores provider credentials in `auth.json` under the **local** data path. OpenCode Go uses different directory conventions and potentially different file formats.

## Root Cause Analysis (UPDATED after investigation)

**Confirmed root cause: RCA-3 (field name mismatch). RCA-1 and RCA-2 are NOT the issue.**

Verified on user's machine: `auth.json` exists at `C:\Users\rfan2\.local\share\opencode\auth.json` (matches first candidate in path detection). The file contains:

```json
{
  "opencode-go": {
    "type": "api",
    "key": "sk-..."
  }
}
```

The sync script's field detection fails: `!!(value.apiKey || value.api_key)` → `false` because OpenCode Go uses `key`.

### RCA-3: API Key Field Name `key` Not Recognized (CONFIRMED)

The `detectOpencodePaths()` function (lines 17–89) searches for `paths.local` in:
```
~/.local/share/opencode          # Linux XDG
%USERPROFILE%\AppData\Local\opencode   # Windows LocalAppData
~/.opencode                       # Legacy dotfile
```

**OpenCode Go** (being a Go application) likely uses different conventions:
- `%USERPROFILE%\.opencode` on Windows (standard Go dotfile convention)
- `%APPDATA%\opencode` or `%APPDATA%\OpenCode` on Windows
- `~/.config/opencode` on Linux (XDG config, not data)
- Or a project-local `.opencode` directory

If none of the candidate paths match, **`paths.local` is `null`**, which means:
1. The database (`opencode.db`) is never read — all session data is empty
2. `auth.json` is never read (line 397: `if (paths.local)`) — **providers array is always `[]`**

### RCA-2: `auth.json` Is Only Searched in `paths.local` (NOT THE ISSUE)

The sync script reads from `paths.local`, and on the user's machine `paths.local` correctly resolves to the right directory containing `auth.json`. OpenCode's official docs confirm `~/.local/share/opencode/auth.json` as the canonical path.

### RCA-3: Field Name Mismatch — OpenCode Go Uses `key` (CONFIRMED ROOT CAUSE)

Verified from user's `auth.json`:
```json
{
  "opencode-go": {
    "type": "api",
    "key": "sk-..."
  }
}
```

Line 405/407 only recognize `apiKey` and `api_key`:
```js
apiKey: value.apiKey ?? value.api_key ?? null,      // → null for OpenCode Go
configured: !!(value.apiKey || value.api_key),       // → false for OpenCode Go
```

OpenCode Go uses `key` as the field name. The provider IS extracted but with `configured: false` and `apiKey: null`.

## Functional Requirements

### FR-01: Expand Path Detection Candidates for OpenCode Go
- The `detectOpencodePaths()` function SHALL include additional candidate paths that cover common OpenCode Go installation directories:
  - **Windows**: `%USERPROFILE%\.opencode` (dotfile), `%APPDATA%\opencode`, `%APPDATA%\OpenCode`
  - **Linux/macOS**: `~/.opencode` (already included), `~/opencode` (project-root style)
- Existing candidates SHALL be preserved — new paths are **additive** and checked **after** existing ones (or reordered by priority, but never removed).
- First match wins for each path type (`local`, `cache`, `config`), consistent with existing behavior.

### FR-02: Search `auth.json` in Both `paths.local` AND `paths.config`
- The `exportJsonFiles()` function SHALL attempt to read `auth.json` from:
  1. `paths.local/auth.json` (existing behavior, primary)
  2. `paths.config/auth.json` (new fallback)
- If both paths yield valid data, the results SHALL be **merged** (deduplicated by provider `id`), with `paths.local` taking precedence over `paths.config` for entries with the same `id`.
- If only one path yields data, that data is used.
- If neither path yields data, the providers array remains empty (graceful degradation).

### FR-03: Expand API Key Field Name Detection
- The `configured` field SHALL be set to `true` if **any** of the following fields exist and are truthy (non-null, non-empty-string):
  - `value.apiKey` (existing)
  - `value.api_key` (existing)
  - `value.key` (new)
  - `value.token` (new)
  - `value.secret` (new)
  - `value.apiToken` (new)
- The `apiKey` field on the exported `ProviderInfo` object SHALL capture the first available key value from the above fields, in the order listed (existing priority preserved).

### FR-04: Comprehensive Diagnostic Logging for Sync Script
- The sync script SHALL log, at minimum:
  - Which candidate path matched for `local`, `cache`, and `config`
  - Whether `auth.json` was found in `paths.local` and/or `paths.config`
  - How many providers were exported (already logged as `Exported N providers`)
- This enables users and developers to diagnose path detection failures without modifying the script.

### FR-05: Handle `auth.json` Structural Variations Gracefully
- If `auth.json` contains entries that are not objects (e.g., primitive values at the top level), those entries SHALL be **skipped** with no error thrown (existing behavior is already defensive — simply preserve it).
- If `auth.json` is an array instead of an object, the script SHALL handle this by iterating the array (new capability) rather than silently producing zero providers.

### FR-06: Provider Inheritance from Config File (Stretch Goal)
- As an additional detection mechanism, the sync script SHALL also check for a provider configuration file in `paths.config/opencode.json` or `paths.config/opencode.jsonc` (if OpenCode Go uses a unified config format). This is lower priority and depends on Open Question Q-001.

## Non-Functional Requirements

### NFR-01: No Frontend Changes Required
- `src/pages/Overview.tsx`, `src/pages/Providers.tsx`, `src/utils/overviewDataProcessor.ts`, `src/utils/dataLoader.ts`, and `src/types/index.ts` SHALL NOT be modified. The bug is entirely in the sync script's data export pipeline.
- The existing `ProviderInfo` interface (`id`, `name`, `apiKey`, `baseUrl`, `configured`) is adequate.

### NFR-02: Backward Compatibility
- Existing OpenCode Classic users (Node.js version) SHALL continue to work without any change to their workflow.
- Path detection for existing candidates SHALL be preserved at current priority levels.
- The `providers.json` output format SHALL remain identical (array of `ProviderInfo`-shaped objects).

### NFR-03: Graceful Degradation
- If no `auth.json` is found anywhere, the script SHALL export an empty `providers: []` array (as it does now). The dashboard treats an empty data file gracefully — no runtime errors.
- No hard errors SHALL be thrown for missing files — `readJsonSafe()` already returns `null` on failure; this pattern SHALL be followed for all new file reads.

### NFR-04: Sync Script Performance
- Additional file system checks for new candidate paths and `auth.json` in `paths.config` SHALL add negligible overhead (single `fs.existsSync` and `readFileSync` calls).
- Sync script execution time SHALL not regress measurably (< 100ms increase).

## Constraints

- **Sync script only**: Changes are limited to `scripts/sync-opencode-data.js`. The dashboard frontend, Vite config, and build process remain untouched.
- **No runtime environment**: The sync script runs at build time or via `npm run sync`. It cannot access runtime environment variables from the Vite dev server — only the Node.js process environment at the time of execution.
- **No network calls**: The sync script reads local files exclusively.
- **No OpenCode Go repository dependency**: We cannot link to OpenCode Go's source or test against it directly. Fixes must be based on reasonable assumptions about Go application conventions and defensive coding.
- **Do NOT introduce new npm dependencies**: Use only Node.js built-in modules (`fs`, `path`), consistent with the existing script.

## Edge Cases

| Case | Handling |
|------|----------|
| User has **both** OpenCode Classic and OpenCode Go installed | First-match path detection may prefer one over the other. This is acceptable; user can override with `--local`, `--cache`, `--config` CLI args or `OPENCODE_DATA_PATH` env var. |
| Provider has a `baseUrl` but no API key in auth.json | Provider is extracted with `configured: false`. The `baseUrl` is still exported. This is correct — a configured base URL without credentials does not constitute a "configured" provider. |
| Provider uses environment variables for API keys (no key in auth.json) | The provider will show as `configured: false`. See Open Question Q-003 for potential env-var-based detection. |
| `auth.json` contains empty-string API keys | `!!""` evaluates to `false`, so `configured` remains `false`. This is correct behavior. |
| `auth.json` does not exist at all | Empty `providers` array exported. Dashboard shows "0" on the Provider card. No error thrown. |
| `paths.local` is found but contains no `opencode.db` | Database export is skipped (line 560–562), but `auth.json`/providers extraction still runs. Providers card still works correctly. |
| OpenCode Go uses TOML/YAML for config instead of JSON | Out of scope for this fix. Document as a known limitation. |

## Verification Criteria (Acceptance Criteria)

1. **AC-01**: Running `npm run sync` on a machine with OpenCode Go installed populates `public/data/providers.json` with at least one entry where `configured === true`, assuming the user has configured at least one provider in OpenCode Go.
2. **AC-02**: The "Providers" card on the Overview page shows a positive integer (≥ 1) after sync, matching the number of providers with valid API keys.
3. **AC-03**: The dedicated Providers page (`/providers`) displays each provider with name, masked API key, base URL (if any), and "Configured" badge.
4. **AC-04**: Existing OpenCode Classic users see no regression — their provider count remains unchanged.
5. **AC-05**: Running `npm run build` succeeds (which runs `tsc -b`). The sync script has no TypeScript checking (it's a `.js` file), but `npm run build` must still pass.
6. **AC-06**: `npm run lint` produces no new errors.
7. **AC-07**: The sync script's console output clearly states which `auth.json` path(s) were used and how many providers were exported.

## Non-Goals (What We Should NOT Change)

- ❌ Do NOT modify the dashboard frontend (Overview.tsx, Providers.tsx, overviewDataProcessor.ts, dataLoader.ts, types/index.ts)
- ❌ Do NOT modify the `ProviderInfo` TypeScript interface
- ❌ Do NOT change how `computeKeyMetrics()` handles the providers count
- ❌ Do NOT add OpenCode Go as a build/test dependency
- ❌ Do NOT implement a runtime provider detection mechanism (e.g., fetching from a Go API)
- ❌ Do NOT add TOML/YAML parsing libraries for Go-native config formats
- ❌ Do NOT change the `public/data/providers.json` output schema

## Open Questions

- **Q-001: OpenCode Go Config File Format** — Does OpenCode Go use a unified configuration file (e.g., `opencode.json`, `opencode.jsonc`, `config.toml`) instead of (or in addition to) `auth.json`? If so, what is the file path relative to the data/config root, and what is the schema for provider entries? *Needed for FR-06.*
- **Q-002: OpenCode Go Directory Conventions** — What is the exact directory structure OpenCode Go uses on Windows, macOS, and Linux? Specifically: where is the database (`opencode.db` or equivalent), where is `auth.json`, and where are models/skills/agents stored? *Needed for FR-01 to add precise candidates rather than guessing.*
- **Q-003: Environment Variable API Keys** — Does OpenCode Go rely primarily on environment variables (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) rather than file-based credentials? If so, should the sync script check the Node.js process environment for common API key variables and synthesize provider entries from those? *This is a design decision about the boundary of the sync script's responsibility.*

---
Version: 1 | Author: analyst | Date: 2026-05-24

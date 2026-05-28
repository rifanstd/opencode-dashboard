# Implementation Plan: Cleanup Unused Data Files and Restrict Skill Scanning Paths

> **For the Orchestrator:** The Orchestrator delegates this plan to the Programmer for execution. After implementation, the Orchestrator delegates to the Reviewer for code review. Do NOT dispatch subagents directly — the Orchestrator manages the multi-agent pipeline.

**Goal:** Stop generating unused `logs.json`, remove all associated dead code, restrict skill scanning to global paths only, and remove unused `skills-lock.json` parsing logic from the sync script.

**Architecture:** Surgical deletions across the sync script (`scripts/sync-opencode-data.js`), type definitions (`src/types/index.ts`), data loader (`src/utils/dataLoader.ts`), and a utility file (`src/utils/logParser.ts`). No new code is written; only unused code is removed. Build verification ensures TypeScript strictness rules remain satisfied.

**Tech Stack:** Node.js ESM (sync script), TypeScript/React (dashboard), Vite, SQLite3.

**Reference:** Requirements: `.knowledge/sessions/20260528-cleanup-unused-data-files/requirements.md` v1

---

## Decision Points

- [x] **Remove `skills-lock.json` dead code** — Confirmed: `lockFileSources` Map is built but never read in the final `skills.json` output. Decision: remove it.
- [x] **Remove `sourceHint`/`sourceLabel` fields** — These are also unused in the final `skills.json` output, but they are harmless in the Node.js sync script. Decision: leave them in place to minimize scope creep; the requirements focus on path restriction and skills-lock.json removal.

---

## Task Breakdown

### Task 1: Remove `logs.json` generation from sync script

**Files:**
- Modify: `scripts/sync-opencode-data.js`

**Description:**
Delete all log-related export logic from the sync script:
1. Remove the `readLogFiles` helper function (lines 154–168).
2. In `exportJsonFiles`, remove the `logs` array initialization (line 532: `const logs = []`).
3. In `exportJsonFiles`, remove the entire log-parsing block (lines 765–801) that reads `.log` files and populates the `logs` array.
4. In `exportJsonFiles`, remove `logs` from the returned object (line 803: `return { providers, models, agents, skills, logs }` → `return { providers, models, agents, skills }`).
5. In `main()`, remove the `fs.writeFileSync` call for `logs.json` (line 852).
6. In `main()`, update the final `console.log` to remove the `${auxData.logs.length} log entries` reference (line 853).

**Verification:**
- Run `node scripts/sync-opencode-data.js` and confirm it completes without errors.
- Confirm `public/data/logs.json` is NOT created (or, if it existed previously, is no longer overwritten).

**Dependency:** None (first task)
**Complexity:** low

---

### Task 2: Restrict skill scanning to global paths only

**Files:**
- Modify: `scripts/sync-opencode-data.js`

**Description:**
Remove the project-local skill scanning block and keep only the global paths:
1. Delete the project-local scanning block (lines 696–708) that scans:
   - `CWD/.opencode/skills`
   - `CWD/.claude/skills`
   - `CWD/.agents/skills`
2. Keep the global scanning block (lines 711–724) that scans:
   - `~/.config/opencode/skills`
   - `~/.claude/skills`
   - `~/.agents/skills`
3. Remove the `cwd` variable declaration (line 696: `const cwd = process.cwd()`) if it becomes unused after the deletion. Verify whether `cwd` is still used elsewhere in `exportJsonFiles` (it is used on line 740 for the project-root `skills-lock.json` read, which will be removed in Task 3).

**Verification:**
- Run `node scripts/sync-opencode-data.js` and confirm it completes without errors.
- Confirm `public/data/skills.json` is still generated and contains only skills from global directories.

**Dependency:** None (can be done in parallel with Task 1, but sequential is safer)
**Complexity:** low

---

### Task 3: Remove `skills-lock.json` dead code from sync script

**Files:**
- Modify: `scripts/sync-opencode-data.js`

**Description:**
Delete the supplementary `skills-lock.json` reading logic that builds an unused `lockFileSources` Map:
1. Remove the `lockFileSources` Map declaration (line 727: `const lockFileSources = new Map()`).
2. Remove the `paths.config` `skills-lock.json` read block (lines 728–738).
3. Remove the project-root `skills-lock.json` read block (lines 739–748).
4. If `cwd` (from `process.cwd()`) is now completely unused in `exportJsonFiles`, remove its declaration as well.

**Verification:**
- Run `node scripts/sync-opencode-data.js` and confirm it completes without errors.
- Confirm `public/data/skills.json` is still generated correctly.

**Dependency:** Task 2 (removes the other `cwd` usage, making it safe to drop `cwd` if unused)
**Complexity:** low

---

### Task 4: Remove `loadLogs()` from data loader

**Files:**
- Modify: `src/utils/dataLoader.ts`

**Description:**
1. Remove `LogEntry` from the type import list (line 10).
2. Remove the `loadLogs()` function (lines 117–119).

**Verification:**
- Run `npm run build` and confirm no TypeScript errors (especially `noUnusedLocals` / `verbatimModuleSyntax`).

**Dependency:** Task 5 (removing `LogEntry` from types first avoids a transient import error, but since `LogEntry` is only imported here and in `logParser.ts`, order is flexible). To be safe, do Task 5 before Task 4.
**Complexity:** low

---

### Task 5: Remove `LogEntry` interface from types

**Files:**
- Modify: `src/types/index.ts`

**Description:**
1. Delete the `LogEntry` interface (lines 80–85).

**Verification:**
- Run `npm run build` and confirm no TypeScript errors.

**Dependency:** None
**Complexity:** low

---

### Task 6: Delete dead `logParser.ts` utility

**Files:**
- Delete: `src/utils/logParser.ts`

**Description:**
1. Delete the file `src/utils/logParser.ts` entirely. It is never imported by any module in the codebase.

**Verification:**
- Run `npm run build` and confirm no "module not found" or unresolved import errors.
- Confirm the file no longer exists in `src/utils/`.

**Dependency:** Task 5 (ensures `LogEntry` type still exists while `logParser.ts` is being deleted, though the file is not imported anywhere so order is technically flexible). Best done after Task 5 for cleanliness.
**Complexity:** low

---

### Task 7: Final build verification

**Files:**
- None (verification only)

**Description:**
1. Run `npm run build` from the project root.
2. Confirm `tsc -b` passes with zero errors.
3. Confirm Vite build completes successfully.
4. Run `npm run sync` (or `node scripts/sync-opencode-data.js`) and confirm all 10 remaining JSON files are generated in `public/data/`:
   - `sessions.json`, `projects.json`, `messages.json`, `parts.json`, `overview.json`, `token-usage.json`, `providers.json`, `models.json`, `agents.json`, `skills.json`
5. Confirm `logs.json` is NOT generated.
6. (Optional manual smoke test) Run `npm run dev`, open the dashboard, and verify the Skills, Agents, Sessions, and Overview pages still load data correctly.

**Verification:**
- `npm run build` exits with code 0.
- `ls public/data/` (or Windows equivalent) shows exactly 10 `.json` files, no `logs.json`.

**Dependency:** Tasks 1–6 all complete
**Complexity:** low

---

## Dependency Order

```
Task 1 (remove logs.json generation) ──┐
Task 2 (restrict skill paths) ──────────┤
Task 3 (remove skills-lock.json) ──────┤──→ Task 4 (remove loadLogs) ──→ Task 5 (remove LogEntry type) ──→ Task 6 (delete logParser.ts) ──→ Task 7 (final build verification)
                                       │
Task 5 (remove LogEntry type) ─────────┘ (can start before Task 4, but must finish before Task 4's build check)
```

Simplified safe order:
1 → 2 → 3 → 5 → 4 → 6 → 7

---

## Risks & Alternatives

| Risk | Mitigation |
|------|------------|
| **Stale `logs.json` in developer's local `public/data/`** | `public/data/` is `.gitignore`d, so the stale file won't be committed. Developers may see an old `logs.json` locally until they manually delete it or run `npm run sync`. Document this in the commit message. |
| **TypeScript `noUnusedLocals` error after removing `LogEntry`** | Removing `LogEntry` from `types/index.ts` before removing it from `dataLoader.ts` could cause a transient build failure if an incremental check is run. Mitigation: remove from `dataLoader.ts` first, or do both in the same commit and run `npm run build` only after both are done. |
| **Accidental deletion of still-used code** | Each deletion is scoped to a specific requirement (FR-02 through FR-09). Greps confirm zero consumers for `LogEntry`, `loadLogs`, `logParser.ts`, and `skills-lock.json` logic. |
| **Sync script `cwd` variable becomes unused** | After removing project-local skill scanning and project-root `skills-lock.json` reading, `const cwd = process.cwd()` may be unused. The TypeScript/Node.js sync script does not have `noUnusedLocals` enabled, but cleaning it up keeps the code tidy. Include this in Task 2 or Task 3. |

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - FR-02 (stop generating `logs.json`) → Task 1
  - FR-03 (remove log-related export logic) → Task 1
  - FR-04 (remove `loadLogs()`) → Task 4
  - FR-05 (remove `LogEntry` type) → Task 5
  - FR-06 (delete `logParser.ts`) → Task 6
  - FR-07 (scan only 3 global directories) → Task 2
  - FR-08 (stop scanning project-local paths) → Task 2
  - FR-09 (remove `skills-lock.json` dead code) → Task 3
  - NFR-01 (TypeScript strictness) → Task 7
  - NFR-02 (valid JSON for remaining files) → Task 7
  - NFR-03 (build passes) → Task 7
- [x] **Placeholder scan:** No TBDs, TODOs, or vague instructions. Every step specifies exact file paths and line ranges.
- [x] **Type consistency:** All type references (`LogEntry`, `SkillInfo`, etc.) match the existing codebase. No new types are introduced.

---
Version: 1 | Author: planner | Ref: requirements v1 | Date: 2026-05-28

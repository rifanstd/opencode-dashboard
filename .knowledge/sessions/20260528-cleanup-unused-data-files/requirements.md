# Requirements: Cleanup Unused Data Files and Restrict Skill Scanning Paths

## Context
The sync script `scripts/sync-opencode-data.js` generates 11 JSON files in `public/data/`. The dashboard loads these files via `src/utils/dataLoader.ts`. The user wants to:
1. Identify which generated JSON files are unused by the dashboard and stop generating them
2. Restrict skill data scanning to only two global paths: `~/.agents/skills` and `~/.config/opencode/skills`

## Functional Requirements

### File Generation Cleanup
- **FR-01**: The sync script MUST continue generating the following files because they are actively used by the dashboard:
  - `sessions.json` — used by `SessionsList.tsx`, `SessionDetail.tsx`, `Overview.tsx`
  - `projects.json` — used by `SessionsList.tsx`, `SessionDetail.tsx`
  - `messages.json` — used by `SessionDetail.tsx`
  - `parts.json` — used by `SessionDetail.tsx`
  - `overview.json` — used by `Layout.tsx` and `Overview.tsx` (via `overviewCache.ts`)
  - `token-usage.json` — used by `Overview.tsx`
  - `providers.json` — used by `Resources.tsx`, `Overview.tsx`
  - `models.json` — used by `Resources.tsx`, `SessionsList.tsx`, `SessionDetail.tsx`, `Overview.tsx`
  - `agents.json` — used by `Agents.tsx`
  - `skills.json` — used by `Skills.tsx`
- **FR-02**: The sync script MUST stop generating `logs.json` because it is not fetched or used by any page or component in the dashboard.
- **FR-03**: The sync script MUST remove all log-related export logic, including the `readLogFiles` helper function, the `logs` array accumulation, and the `fs.writeFileSync` call for `logs.json`.
- **FR-04**: `src/utils/dataLoader.ts` MUST remove the `loadLogs()` function and the `LogEntry` type import since no consumer exists.
- **FR-05**: `src/types/index.ts` MUST remove the `LogEntry` interface since it is no longer referenced anywhere in the codebase.
- **FR-06**: `src/utils/logParser.ts` MUST be deleted because it is dead code (never imported by any module).

### Skill Scanning Path Restriction
- **FR-07**: The sync script MUST scan for `SKILL.md` files ONLY in the following three global directories (per official documentation):
  - `~/.config/opencode/skills/<name>/SKILL.md` (Global config)
  - `~/.claude/skills/<name>/SKILL.md` (Global Claude-compatible)
  - `~/.agents/skills/<name>/SKILL.md` (Global agent-compatible)
- **FR-08**: The sync script MUST stop scanning the following project-local directories:
  - `CWD/.opencode/skills/`
  - `CWD/.claude/skills/`
  - `CWD/.agents/skills/`
- **FR-09**: The `skills-lock.json` supplementary metadata reading logic in the sync script SHOULD be evaluated for removal because the parsed `lockFileSources` map is built but never used in the final `skills.json` output (dead code).

## Non-Functional Requirements
- **NFR-01**: TypeScript strictness rules (`noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`) MUST remain satisfied after deletions; removing unused types/functions achieves this naturally.
- **NFR-02**: The sync script MUST continue to produce valid JSON for all remaining files; no functional change to the generation logic of used files.
- **NFR-03**: The dashboard MUST continue to build and run without errors after the cleanup (`npm run build` must pass).

## Constraints
- The project uses TypeScript with `verbatimModuleSyntax: true`, `erasableSyntaxOnly: true`, `noUnusedLocals: true`, and `noUnusedParameters: true` — unused imports/vars block `tsc -b`.
- `public/data/` is in `.gitignore`; removing files from generation does not affect the repo, but stale files may remain in the developer's local `public/data/` directory until manually deleted or regenerated.
- No test runner exists in this repo; verification must be done via `npm run build` and manual smoke-testing.
- The sync script runs in Node.js and uses ESM (`import` syntax).

## Open Questions
- None — the request is clear and the codebase analysis confirms exactly which files are used vs. unused.

---
Version: 1 | Author: analyst | Date: 2026-05-28

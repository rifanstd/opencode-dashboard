# Requirements: Fix Skills Page Empty Issue

## Context

User reports that the Skills page in the opencode-dashboard is empty ("No skills found."). Investigation reveals that while skills ARE installed (evidenced by `.opencode/skills/frontend-design/SKILL.md` and `skills-lock.json` in the project root), the dashboard fails to display them.

After reading the official OpenCode documentation (https://opencode.ai/docs/skills/), it is clear that **OpenCode discovers skills by scanning directories for `SKILL.md` files**, not by reading `skills-lock.json`. The `skills-lock.json` is an internal tracking file and its location/structure may vary. The canonical discovery mechanism is directory scanning.

## Investigation Summary

### Data Flow
1. **Source**: Skill directories containing `SKILL.md` files (`.opencode/skills/`, `.claude/skills/`, `.agents/skills/`, global equivalents)
2. **Sync Script**: `scripts/sync-opencode-data.js` → `exportJsonFiles()`
3. **Output**: `public/data/skills.json`
4. **UI**: `src/pages/Skills.tsx` → `loadSkills()` → `fetch('/data/skills.json')`

### Evidence Gathered
- `public/data/skills.json` contains `[]` (empty array) — direct cause of empty page
- `public/data/agents.json` has 5 entries, `providers.json` has 2 entries, `overview.json` has data — proves path detection and sync script work for OTHER data types
- Project root `skills-lock.json` exists and contains 1 skill (`frontend-design`) with structure: `{ "version": 1, "skills": { "frontend-design": { "source": "...", "sourceType": "...", "skillPath": "...", "computedHash": "..." } } }`
- `.opencode/skills/frontend-design/SKILL.md` exists — skill is genuinely installed
- `~/.config/opencode/skills/` exists and contains multiple skills (e.g., `brainstorming`, `systematic-debugging`, etc.)
- Sync script only looks for `skills-lock.json` in `paths.config` (auto-detected global opencode config dir)
- The official docs specify these discovery paths:
  - Project: `.opencode/skills/<name>/SKILL.md`, `.claude/skills/<name>/SKILL.md`, `.agents/skills/<name>/SKILL.md`
  - Global: `~/.config/opencode/skills/<name>/SKILL.md`, `~/.claude/skills/<name>/SKILL.md`, `~/.agents/skills/<name>/SKILL.md`
  - For project-local, OpenCode walks up from CWD until git worktree root

### Root Causes Identified

**Bug 1: Wrong discovery mechanism**
The sync script searches for `skills-lock.json` exclusively in the auto-detected global opencode config directory (`paths.config`). However, per the official docs, skills are discovered by scanning directories for `SKILL.md` files. The script never scans the actual skill directories.

**Bug 2: Wrong JSON structure parsing (if using lock file)**
Even if `skills-lock.json` were found, the sync script (lines 620-635) iterates `Object.entries(skillsJson)` on the top-level object. The actual structure has a nested `skills` property:
```json
{
  "version": 1,
  "skills": {
    "frontend-design": { ... }
  }
}
```
The script would incorrectly treat `"version"` (skipped, not an object) and `"skills"` (treated as a single bogus skill named "skills") instead of iterating the actual skills.

**Bug 3: Missing field mapping (if using lock file)**
The skill entries in `skills-lock.json` do not contain a `version` property. The fields are: `source`, `sourceType`, `skillPath`, `computedHash`. The script reads `value.version` which will always resolve to `'—'`.

## Functional Requirements

- FR-01: The sync script MUST discover skills by scanning the documented skill directories for `SKILL.md` files, per the official OpenCode docs. It MUST check:
  - Project-local paths relative to the current working directory: `.opencode/skills/<name>/SKILL.md`, `.claude/skills/<name>/SKILL.md`, `.agents/skills/<name>/SKILL.md`
  - Global paths: `~/.config/opencode/skills/<name>/SKILL.md`, `~/.claude/skills/<name>/SKILL.md`, `~/.agents/skills/<name>/SKILL.md`
- FR-02: For each `SKILL.md` found, the sync script MUST parse the YAML frontmatter to extract at minimum the `name` and `description` fields. It SHOULD also extract `license`, `compatibility`, and `metadata` if present.
- FR-03: The sync script MUST de-duplicate skills by name. If the same skill name exists in multiple locations (e.g., both project-local and global), project-local MUST take precedence (or the script MUST use a deterministic precedence order).
- FR-04: The sync script MAY still read `skills-lock.json` as a fallback or supplementary source for metadata (e.g., `source`, `version`), but `SKILL.md` discovery MUST be the primary mechanism.
- FR-05: After fixing the sync script and running `npm run sync`, `public/data/skills.json` MUST contain the actual installed skills (non-empty array when skills are installed).
- FR-06: The Skills page (`src/pages/Skills.tsx`) MUST display the skills data correctly. The UI currently expects `{ name: string, version: string, source: string }`. The sync script MUST produce output compatible with this structure (using `'—'` or path-derived source for missing fields).

## Non-Functional Requirements

- NFR-01: The fix MUST NOT break existing data sync for other file types (agents, providers, models, logs, database tables).
- NFR-02: The sync script SHOULD remain backward-compatible with the existing `skills-lock.json` reading logic (e.g., if `skills-lock.json` is found and parseable, use it as additional/supplementary data).
- NFR-03: Error handling SHOULD be informative — if no skill directories are found or all are empty, the sync script console output should indicate this (currently it silently produces `[]`).
- NFR-04: The sync script MUST handle missing/skipped `SKILL.md` files gracefully (e.g., missing frontmatter, malformed YAML).

## Constraints

- Tech stack: Node.js ESM, `scripts/sync-opencode-data.js`
- The `public/data/` directory is `.gitignore`d; fixes must be in the sync script, not the generated JSON.
- TypeScript strictness: `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals` — but this applies to `src/`, not the sync script (which is plain JS).
- The sync script runs in both dev mode (via Vite middleware `/api/sync`) and manually (`npm run sync`).
- Windows-first path detection is already implemented and working.

## Open Questions

- ? Does the user's project also have skills in `.claude/skills/` or `.agents/skills/`?
- ? Should the UI display `description` in addition to `name`, `version`, and `source`?
- ? Should the sync script walk UP from CWD to git root for project-local skills (as the docs say OpenCode does), or only scan the immediate project root?

---
Version: 2 | Author: analyst + orchestrator | Date: 2026-05-26

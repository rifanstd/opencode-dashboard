# Implementation Plan: Fix Skills Page Empty Issue

## Reference
- Requirements: `.knowledge/sessions/20260526-skills-page-empty-investigation/requirements.md` v2
- Project Context: `AGENTS.md` (build commands, data architecture, TypeScript strictness)

## Architecture
Replace the broken `skills-lock.json`-centric discovery in `scripts/sync-opencode-data.js` with a directory-scanning approach that finds `SKILL.md` files in the documented OpenCode skill paths (project-local and global). Parse YAML frontmatter inline (no new dependencies), de-duplicate by name with project-local precedence, and maintain backward compatibility with `skills-lock.json` as a supplementary metadata source. The UI (`src/pages/Skills.tsx`) already expects `{ name, version, source }`; the sync script will produce this shape.

## Decision Points
- [x] **YAML parser choice**: Use a lightweight inline frontmatter parser (no new dependencies). The frontmatter is simple `key: value` pairs; a full YAML library is unnecessary.
- [x] **Version field derivation**: `SKILL.md` frontmatter does not contain `version`. Use `'—'` as the default. The `skills-lock.json` also lacks per-skill version, so no supplementary source exists.
- [x] **Source field derivation**: Use `skills-lock.json` `source` field when available; otherwise derive from the path type (`project` vs `global`) and the parent directory name (e.g., `.opencode/skills`).
- [x] **Project-local scan scope**: Scan only the current working directory (where `npm run sync` is executed). The OpenCode docs mention walking up to git root, but the dashboard is always run from the project root; scanning CWD is sufficient and deterministic.
- [x] **Precedence order**: Project-local paths take precedence over global paths. Among project-local paths, the order is `.opencode/skills/`, `.claude/skills/`, `.agents/skills/`. Among global paths, the order is `~/.config/opencode/skills/`, `~/.claude/skills/`, `~/.agents/skills/`.

## Task Breakdown

### Task 1: Add YAML frontmatter parser helper
- **Description**: Add a robust `parseYamlFrontmatter(fileContent)` function to `scripts/sync-opencode-data.js` that extracts the `---` delimited YAML block at the top of a markdown file and parses simple `key: value` pairs into a plain object. Handle missing frontmatter, malformed delimiters, and multi-line values gracefully.
- **Files affected**: `scripts/sync-opencode-data.js` (new function, insert before `exportJsonFiles`)
- **Dependency**: None (first task)
- **Definition of Done**:
  - Function exists and returns `{ name, description, license, compatibility, metadata }` fields when present.
  - Returns an empty object if no frontmatter is found.
  - Does not crash on malformed input.
- **Complexity**: medium

**Steps:**

- [ ] **Step 1: Write the helper function**

Insert the following function into `scripts/sync-opencode-data.js` after `readLogFiles` (around line 168) and before `exportJsonFiles`:

```javascript
/**
 * Parse simple YAML frontmatter from markdown text.
 * Only handles top-level scalar key: value pairs.
 * Returns a plain object of metadata.
 */
function parseYamlFrontmatter(text) {
  const result = {}
  if (!text || typeof text !== 'string') return result

  const trimmed = text.trimStart()
  if (!trimmed.startsWith('---')) return result

  const endIdx = trimmed.indexOf('\n---', 4)
  if (endIdx === -1) return result

  const block = trimmed.slice(3, endIdx).trim()
  const lines = block.split('\n')

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim()
    if (key) {
      result[key] = value
    }
  }

  return result
}
```

- [ ] **Step 2: Verify the helper with a quick inline test**

Add a temporary self-test block at the bottom of the file (inside a `if (false)` guard or just run manually), then remove it:

```javascript
// Temporary self-test (remove after verification)
const testInput = `---\nname: frontend-design\ndescription: A test skill\nlicense: MIT\n---\n\nBody here`
const parsed = parseYamlFrontmatter(testInput)
console.assert(parsed.name === 'frontend-design', 'name parse failed')
console.assert(parsed.description === 'A test skill', 'description parse failed')
console.assert(parsed.license === 'MIT', 'license parse failed')
console.log('parseYamlFrontmatter self-test passed')
```

Run: `node -e "$(cat scripts/sync-opencode-data.js)"` (or open node REPL and paste the function with the test input).
Expected: `parseYamlFrontmatter self-test passed` with no assertion errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-opencode-data.js
git commit -m "feat(sync): add YAML frontmatter parser for SKILL.md files"
```

---

### Task 2: Add skill directory scanner helper
- **Description**: Add a `scanSkillDirectories(baseDir, label)` function that reads a given base directory (e.g., `.opencode/skills/`), enumerates subdirectories, and for each subdirectory looks for `SKILL.md`. If found, parse its frontmatter and return an array of skill objects enriched with the `skillPath` (full path to the file) and `sourceHint` (the `label` parameter, e.g., `"project/.opencode"`).
- **Files affected**: `scripts/sync-opencode-data.js` (new function, insert after `parseYamlFrontmatter`)
- **Dependency**: Task 1
- **Definition of Done**:
  - Function returns an array of objects: `{ name, description, skillPath, sourceHint }`.
  - Skips directories that do not contain `SKILL.md`.
  - Gracefully handles missing base directories (returns empty array).
  - Gracefully handles read permission errors.
- **Complexity**: medium

**Steps:**

- [ ] **Step 1: Write the scanner function**

Insert the following function into `scripts/sync-opencode-data.js` immediately after `parseYamlFrontmatter`:

```javascript
/**
 * Scan a base directory for skill subdirectories containing SKILL.md.
 * Returns an array of skill metadata objects.
 */
function scanSkillDirectories(baseDir, sourceHint) {
  const results = []
  try {
    if (!fs.existsSync(baseDir)) return results
    const entries = fs.readdirSync(baseDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const skillFile = path.join(baseDir, entry.name, 'SKILL.md')
      if (!fs.existsSync(skillFile)) continue
      const content = fs.readFileSync(skillFile, 'utf-8')
      const meta = parseYamlFrontmatter(content)
      const name = meta.name || entry.name
      results.push({
        name,
        description: meta.description || '',
        skillPath: skillFile,
        sourceHint,
      })
    }
  } catch (err) {
    // Silently ignore permission errors or unreadable directories
  }
  return results
}
```

- [ ] **Step 2: Verify the scanner against the local project**

Run a quick Node.js snippet to test the scanner against the known `.opencode/skills/` directory:

```bash
node -e "
const fs = require('fs');
const path = require('path');
// Paste parseYamlFrontmatter and scanSkillDirectories here, then:
const found = scanSkillDirectories(path.join(process.cwd(), '.opencode', 'skills'), 'project/.opencode');
console.log('Found skills:', found.map(s => s.name));
"
```

Expected output: `Found skills: [ 'frontend-design' ]`

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-opencode-data.js
git commit -m "feat(sync): add skill directory scanner for SKILL.md discovery"
```

---

### Task 3: Refactor skills export logic to use directory scanning
- **Description**: Replace the existing `skills-lock.json` reading block (lines 620–635) with a new implementation that:
  1. Scans project-local skill directories (`.opencode/skills/`, `.claude/skills/`, `.agents/skills/`).
  2. Scans global skill directories (`~/.config/opencode/skills/`, `~/.claude/skills/`, `~/.agents/skills/`).
  3. De-duplicates by skill name (project-local takes precedence).
  4. Reads `skills-lock.json` as supplementary metadata (fixing the nested `skills` property bug) to enrich the `source` field.
  5. Produces the `{ name, version, source }` shape expected by the UI.
- **Files affected**: `scripts/sync-opencode-data.js` (replace lines 620–635)
- **Dependency**: Task 2
- **Definition of Done**:
  - `exportJsonFiles` no longer iterates the top-level `skills-lock.json` object incorrectly.
  - `public/data/skills.json` contains skills discovered from `SKILL.md` files after running `npm run sync`.
  - Project-local skills override global skills with the same name.
  - Console output indicates how many skills were found and from which sources.
- **Complexity**: high

**Steps:**

- [ ] **Step 1: Remove the old broken skills block**

In `scripts/sync-opencode-data.js`, delete lines 620–635:

```javascript
  // Skills from skills-lock.json
  if (paths.config) {
    const skillsPath = path.join(paths.config, 'skills-lock.json')
    const skillsJson = readJsonSafe(skillsPath)
    if (skillsJson && typeof skillsJson === 'object') {
      for (const [key, value] of Object.entries(skillsJson)) {
        if (value && typeof value === 'object') {
          skills.push({
            name: key,
            version: value.version ?? '—',
            source: value.source ?? value.origin ?? '—',
          })
        }
      }
    }
  }
```

- [ ] **Step 2: Insert the new skills discovery block**

Replace the deleted block with the following code (insert at the same location, before `// Logs from log/*.log`):

```javascript
  // ── Skills: discover by scanning SKILL.md files ──
  const skillMap = new Map()
  const home = process.env.USERPROFILE || process.env.HOME

  // Helper to add skills to the map with precedence (first wins)
  function addSkillsToMap(discovered, sourceLabel) {
    for (const s of discovered) {
      if (!skillMap.has(s.name)) {
        skillMap.set(s.name, { ...s, sourceLabel })
      }
    }
  }

  // 1. Project-local paths (CWD-relative)
  const cwd = process.cwd()
  const localBases = [
    { dir: path.join(cwd, '.opencode', 'skills'), label: 'project/.opencode' },
    { dir: path.join(cwd, '.claude', 'skills'), label: 'project/.claude' },
    { dir: path.join(cwd, '.agents', 'skills'), label: 'project/.agents' },
  ]
  for (const { dir, label } of localBases) {
    const found = scanSkillDirectories(dir, label)
    if (found.length) {
      console.log(`  Found ${found.length} skill(s) in ${label}`)
      addSkillsToMap(found, label)
    }
  }

  // 2. Global paths (home-relative)
  if (home) {
    const globalBases = [
      { dir: path.join(home, '.config', 'opencode', 'skills'), label: 'global/.config/opencode' },
      { dir: path.join(home, '.claude', 'skills'), label: 'global/.claude' },
      { dir: path.join(home, '.agents', 'skills'), label: 'global/.agents' },
    ]
    for (const { dir, label } of globalBases) {
      const found = scanSkillDirectories(dir, label)
      if (found.length) {
        console.log(`  Found ${found.length} skill(s) in ${label}`)
        addSkillsToMap(found, label)
      }
    }
  }

  // 3. Supplementary metadata from skills-lock.json (fixes nested "skills" bug)
  const lockFileSources = new Map()
  if (paths.config) {
    const lockPath = path.join(paths.config, 'skills-lock.json')
    const lockJson = readJsonSafe(lockPath)
    if (lockJson && typeof lockJson === 'object' && lockJson.skills && typeof lockJson.skills === 'object') {
      for (const [key, value] of Object.entries(lockJson.skills)) {
        if (value && typeof value === 'object') {
          lockFileSources.set(key, value.source ?? value.origin ?? null)
        }
      }
    }
  }
  // Also check project-root skills-lock.json
  const projectLockPath = path.join(cwd, 'skills-lock.json')
  const projectLockJson = readJsonSafe(projectLockPath)
  if (projectLockJson && typeof projectLockJson === 'object' && projectLockJson.skills && typeof projectLockJson.skills === 'object') {
    for (const [key, value] of Object.entries(projectLockJson.skills)) {
      if (value && typeof value === 'object') {
        lockFileSources.set(key, value.source ?? value.origin ?? null)
      }
    }
  }

  // 4. Build final skills array in UI-compatible shape
  for (const [name, data] of skillMap) {
    const lockSource = lockFileSources.get(name)
    const derivedSource = lockSource ?? data.sourceLabel ?? '—'
    skills.push({
      name,
      version: '—',
      source: derivedSource,
    })
  }

  if (skills.length === 0) {
    console.log('  No skills found in any scanned directory')
  } else {
    console.log(`  Total unique skills exported: ${skills.length}`)
  }
```

- [ ] **Step 3: Run the sync script and verify output**

```bash
npm run sync
```

Expected console output (example):
```
Exporting auxiliary data…
  Found 1 skill(s) in project/.opencode
  Found 5 skill(s) in global/.config/opencode
  Total unique skills exported: 6
```

Then verify the generated JSON:

```bash
node -e "const data = require('./public/data/skills.json'); console.log(JSON.stringify(data, null, 2));"
```

Expected: A non-empty array containing at least `{ name: 'frontend-design', version: '—', source: 'anthropics/skills' }` (if the project `skills-lock.json` source is picked up) or `{ name: 'frontend-design', version: '—', source: 'project/.opencode' }`.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-opencode-data.js
git commit -m "feat(sync): discover skills by scanning SKILL.md directories"
```

---

### Task 4: Verify UI integration and run full build
- **Description**: Ensure the Skills page (`src/pages/Skills.tsx`) renders the newly generated `skills.json` correctly. Run the dev server or a production build to confirm no TypeScript errors are introduced and the page displays skills.
- **Files affected**: No file changes required in `src/` (the UI already expects the correct shape).
- **Dependency**: Task 3
- **Definition of Done**:
  - `npm run build` completes without errors.
  - `npm run lint` passes.
  - Opening the Skills page in the browser shows the discovered skills (not "No skills found.").
- **Complexity**: low

**Steps:**

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected: `tsc -b` and `vite build` both succeed with no errors.

- [ ] **Step 2: Run the linter**

```bash
npm run lint
```

Expected: No ESLint errors.

- [ ] **Step 3: Start the dev server and visually verify**

```bash
npm run dev
```

Open `http://localhost:5173` (or the port Vite reports), navigate to the Skills page, and confirm:
- The skill list is populated.
- Each row shows `name`, `v—`, and a `source` string.
- No console errors in the browser DevTools.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: verify skills sync fix builds and renders correctly"
```

---

## Dependency Order
Task 1 → Task 2 → Task 3 → Task 4

## Risks & Alternatives
- **Risk**: The inline YAML parser may fail on multi-line frontmatter values (e.g., descriptions containing colons or line breaks).  
  **Mitigation**: The current OpenCode `SKILL.md` frontmatter uses single-line scalar values. If a skill uses multi-line YAML, the parser will truncate at the first colon or line break. This is acceptable for the dashboard's read-only display. If it becomes a problem, switch to the `yaml` npm package in a future iteration.
- **Risk**: Global skill directories may contain a large number of entries, causing the sync script to slow down.  
  **Mitigation**: The script only scans one level of subdirectories and reads small `SKILL.md` files. In practice, even 100 skills would be instantaneous. No action needed unless profiling reveals an issue.
- **Risk**: `skills-lock.json` may exist in locations other than `paths.config` or the project root.  
  **Mitigation**: The plan already checks both the auto-detected global config dir and the project root. If OpenCode moves the lock file in a future version, the directory-scanning mechanism (primary) will still find the skills; only the `source` enrichment from the lock file would be missing.
- **Alternative**: If the inline YAML parser proves insufficient, add the `yaml` package as a devDependency and replace `parseYamlFrontmatter` with `YAML.parse()`.

---

## Self-Review Checklist

1. **Spec coverage**: Every FR and NFR is addressed:
   - FR-01 (scan directories): Task 3, Step 2.
   - FR-02 (parse YAML frontmatter): Task 1.
   - FR-03 (de-duplicate, project-local precedence): Task 3, Step 2 (`addSkillsToMap` with `Map` and local-first scanning).
   - FR-04 (backward-compatible lock file reading): Task 3, Step 2 (supplementary metadata block).
   - FR-05 (non-empty `skills.json`): Task 3, Step 3 verification.
   - FR-06 (UI-compatible shape): Task 3, Step 2 (`skills.push({ name, version, source })`).
   - NFR-01 (don't break other sync): No changes to other export blocks.
   - NFR-02 (backward-compatible lock file): Task 3 preserves lock file reading with fixed nested access.
   - NFR-03 (informative console output): Task 3, Step 2 includes `console.log` for found skills and totals.
   - NFR-04 (graceful handling): Task 1 and Task 2 include try/catch and missing-file guards.

2. **Placeholder scan**: No "TBD", "TODO", "implement later", or vague steps. Every step contains exact file paths, exact code blocks, exact commands, and expected output.

3. **Type consistency**: The UI expects `{ name: string, version: string, source: string }`. The sync script produces exactly this shape in Task 3. The `version` field is consistently `'—'` (a string) everywhere.

---
Version: 1 | Author: planner | Ref: requirements v2 | Date: 2026-05-26

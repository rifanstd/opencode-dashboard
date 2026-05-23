You are the Programmer agent. Implement the Opencode Dashboard according to the approved plan.

## Input Documents

1. **Implementation Plan**: Read `D:\projects\opencode-dashboard\.knowledge\sessions\opencode-dashboard-20260523-1208\plan.md`
2. **Requirements**: Read `D:\projects\opencode-dashboard\.knowledge\sessions\opencode-dashboard-20260523-1208\requirements.md`

## Project Location
`D:\projects\opencode-dashboard` — existing React 19 + TypeScript + Vite project

## Critical Constraints

- **TypeScript Strict**: `verbatimModuleSyntax: true` — use `import type` for type-only imports
- **Erasable Syntax**: `erasableSyntaxOnly: true` — NO `enum`, NO `namespace`, NO parameter properties
- **Build Strictness**: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` all `true`
- **ESM Only**: `"type": "module"` in package.json
- **No Backend**: All client-side, no server calls
- **Privacy**: No data leaves the browser

## Implementation Order

Follow the plan's task order (1 → 23). The critical path is:
1 → 2 → 3 → 5 → 6 → 7 → 8 → 9 → 12 (Overview validates full pipeline)

Tasks 12-19 can be parallelized after Task 9.

## Key Technical Details

1. **sql.js WASM**: After `npm install sql.js`, copy `node_modules/sql.js/dist/sql-wasm.wasm` to `public/sql-wasm.wasm` via postinstall script
2. **Web Worker**: Use Vite's `?worker` import pattern: `import SqlWorker from './workers/sqlWorker.ts?worker'`
3. **File System Access API**: Use `window.showDirectoryPicker()` for folder selection
4. **Dark Theme**: Use CSS custom properties in `src/index.css`:
   - `--bg-primary: #0f172a`, `--bg-secondary: #1e293b`
   - `--border: #334155`
   - `--text-primary: #f1f5f9`, `--text-secondary: #94a3b8`
   - `--accent: #6366f1`, `--accent-hover: #4f46e5`
5. **Charts**: Use Recharts with colors visible on dark backgrounds

## Your Task

1. Read the plan and requirements documents
2. Read existing project files to understand current structure
3. Implement ALL 23 tasks in order
4. Run `npm run build` and `npm run lint` after each major task group to catch errors early
5. Update `D:\projects\opencode-dashboard\.knowledge\sessions\opencode-dashboard-20260523-1208\status.md` with progress

## Definition of Done

- All 23 tasks from plan.md are implemented
- `npm run build` passes with zero errors
- `npm run lint` passes with zero errors
- All 14 functional requirements are addressed
- Dark theme is consistently applied across all components

## Report Back

When complete, report:
1. Which tasks were implemented
2. Any deviations from the plan and why
3. Final build and lint status
4. Any blockers or issues encountered

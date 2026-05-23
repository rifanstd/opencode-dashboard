You are the Programmer agent. Fix the issues found by the Reviewer in the Opencode Dashboard implementation.

## Context

The initial implementation is complete (23/23 tasks) but the Reviewer found issues that need fixing. You must fix ALL issues listed below and verify the build passes before reporting completion.

## CRITICAL: Use Verification Before Completion

Before claiming any task is complete, you MUST:
1. Run `npm run build` and confirm it passes with zero errors
2. Run `npm run lint` and confirm it passes with zero errors
3. Report the actual output, not assumptions

## Issues to Fix (from Reviewer Report)

### Issue 1: Build Blocker — Unused variable in useSqlWorker.ts
**File**: `src/hooks/useSqlWorker.ts` (line 65)
**Problem**: Unused local variable `workerRef` (or `useRef`) that will cause `tsc -b` to fail under `noUnusedLocals: true`
**Fix**: Remove the unused variable/import.

### Issue 2: Functional Bug — models.json read from wrong directory
**Files**: `src/pages/Overview.tsx`, `src/pages/SessionsList.tsx`, `src/pages/SessionDetail.tsx`
**Problem**: `models.json` is being read from `directoryHandles.local` instead of `directoryHandles.cache`
**Fix**: Update all three files to read `models.json` from the `cache` directory handle.

### Issue 3: Double database initialization after refresh
**File**: `src/App.tsx`
**Problem**: After `refreshData()` completes, the init effect in App.tsx re-runs, causing double initialization
**Fix**: Add a flag or condition to prevent the init effect from re-running when a refresh is in progress or just completed.

### Issue 4: Database buffer not transferred to worker
**File**: `src/utils/dbInit.ts` (or related worker initialization code)
**Problem**: The 196MB database buffer is being cloned instead of transferred to the Web Worker
**Fix**: Use `worker.postMessage({ buffer }, [buffer.buffer])` to transfer the ArrayBuffer ownership to the worker, freeing memory on the main thread.

### Issue 5: Sequential part fetching in SessionDetail
**File**: `src/pages/SessionDetail.tsx`
**Problem**: Message parts are fetched one by one sequentially, causing slow loading
**Fix**: Use `Promise.all()` to fetch all parts in parallel.

### Issue 6: Missing Zustand selectors causing unnecessary re-renders
**Files**: Multiple components using Zustand store
**Problem**: Components re-render when ANY store state changes, even if they only use a subset
**Fix**: Use Zustand selectors (e.g., `useAppStore(state => state.isLoading)`) instead of subscribing to the entire store.

### Issue 7: Sidebar does not collapse below 1400px
**File**: `src/components/Layout.tsx` and/or `src/components/Sidebar.tsx`
**Problem**: Sidebar should collapse/hide on narrow viewports (< 1400px) but currently doesn't
**Fix**: Add CSS media query or conditional rendering to collapse sidebar below 1400px. Add a hamburger button to toggle it.

### Issue 8: Chart colors hardcoded instead of using CSS variables
**Files**: Chart components (e.g., `src/components/TokenChart.tsx`, pages using Recharts)
**Problem**: Chart colors are hardcoded and may not match the dark theme
**Fix**: Read CSS custom properties (variables) for chart colors or define chart color constants that match the theme.

## Additional Requirements

- Maintain the dark theme design (opencode-inspired: deep navy/black base with blue/purple accents)
- Ensure all existing functionality continues to work after fixes
- Do NOT introduce new dependencies
- Follow existing code style and patterns

## Files to Modify

Based on the issues above, you will likely need to modify:
- `src/hooks/useSqlWorker.ts`
- `src/pages/Overview.tsx`
- `src/pages/SessionsList.tsx`
- `src/pages/SessionDetail.tsx`
- `src/App.tsx`
- `src/utils/dbInit.ts`
- `src/components/Layout.tsx`
- `src/components/Sidebar.tsx`
- `src/components/TokenChart.tsx`
- Any other components using Zustand without selectors

## Verification Steps

After fixing ALL issues:
1. Run `npm run build` — must pass with zero errors
2. Run `npm run lint` — must pass with zero errors
3. Verify no new TypeScript errors introduced

## Report Back

When complete, report:
1. Which issues were fixed and how
2. Build and lint verification output
3. Any issues you could not fix or new issues discovered

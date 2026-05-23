You are the Programmer agent. Fix the one remaining issue found in the second review.

## Issue to Fix

**File**: `src/App.tsx` (around line 91)
**Problem**: The `isRefreshing` flag is included in the init `useEffect` dependency array. When the timeout flips `isRefreshing` to `false` after refresh completes, the effect re-runs and initializes the 196MB database again (~50ms after refresh).

**Fix Required**:
- Remove `isRefreshing` from the `useEffect` dependency array
- Use a ref (`useRef`) to check the `isRefreshing` state inside the effect, OR
- Guard the effect with `isDbReady` so it only runs when the database is not already initialized

**Important**: Do NOT break the existing refresh functionality. The refresh button should still work correctly.

## Verification Steps

After fixing:
1. Run `npm run build` — must pass with zero errors
2. Run `npm run lint` — must pass with zero errors

## Report Back

Report what you changed and the verification results.

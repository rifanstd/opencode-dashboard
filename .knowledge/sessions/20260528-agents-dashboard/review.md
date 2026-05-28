# Code Review: Agents Dashboard Enhancement

## Reference
- Plan: `.knowledge/sessions/20260528-agents-dashboard/plan.md` v1
- Requirements: `.knowledge/sessions/20260528-agents-dashboard/requirements.md` v1

## Verdict: PASS_WITH_NOTES

## Summary
The implementation fully satisfies all 18 functional requirements and correctly implements all 10 plan tasks. TypeScript interfaces are properly extended, the sync script robustly parses YAML frontmatter with `js-yaml`, usage statistics are correctly computed via session title regex matching, and both the dashboard (`Agents.tsx`) and detail page (`AgentDetail.tsx`) render correctly with responsive layouts, filtering, sorting, pagination, and charts. The programmer's reported verification results (`tsc -b`, `build`, `lint`, `sync` all passing) are consistent with the code quality observed. Three minor suggestions were identified — none are blocking delivery.

## Issues

### Critical
*None*

### Warning
*None*

### Suggestion
- **[S-01]** `src/utils/costCalculator.ts:78-103` — `formatDateTick` constructs `new Date(dateStr + 'T00:00:00.000Z')` for non-year strings. When the detail page's monthly granularity produces keys like `"2026-05"`, this creates `"2026-05T00:00:00.000Z"` which is an invalid ISO date in strict parsers. The function falls back to returning the raw `"2026-05"` string, so monthly X-axis labels display as raw `"2026-05"` instead of `"May 2026"`. This is a pre-existing function reused by the new feature; consider fixing the monthly branch to append `"-01"` before the `T` separator (e.g., `dateStr.length === 7 ? dateStr + '-01T00:00:00.000Z' : dateStr + 'T00:00:00.000Z'`).

- **[S-02]** `scripts/sync-opencode-data.js:673-680` — `mode` and `permissions` values from YAML frontmatter are not validated against the expected TypeScript union types (`'primary' | 'subagent' | null` and `'allow' | 'deny' | null`). If a user writes `mode: foo` or `edit: yes`, those raw strings flow into `agents.json` and display verbatim in the UI. Consider adding lightweight validation/normalization (e.g., only allow known values, else default to `null`).

- **[S-03]** `src/pages/AgentDetail.tsx:48` — `CustomTooltip` always calls `formatDateTick(label, 'all')`, which formats weekly/monthly tooltip labels as daily dates (e.g., "May 26" for Week 22). Passing the actual `granularity` state to `CustomTooltip` would produce more context-aware tooltip labels.

## Plan Adherence

- [x] **Task 1**: `js-yaml` added to `devDependencies` in `package.json` (and `package-lock.json` updated)
- [x] **Task 2**: TypeScript interfaces extended — `AgentPermissions`, `AgentUsage` added; `AgentInfo` expanded with `mode`, `hidden`, `temperature`, `permissions`, `usage`, `content`
- [x] **Task 3**: Sync script YAML frontmatter parsing replaced with `js-yaml` based `parseYamlFrontmatter`; `extractContentWithoutFrontmatter` and `escapeRegex` helpers added; agent extraction loop reads all new metadata fields
- [x] **Task 4**: `exportJsonFiles` signature updated to accept `sessions`; usage computation block pre-compiles regexes per agent, scans all sessions in O(n×m), aggregates stats, and attaches `usage` to every agent (zero-valued for unused agents)
- [x] **Task 5**: `dataLoader.ts` requires no changes — `loadJson<AgentInfo[]>()` automatically picks up the new interface shape
- [x] **Task 6**: `AgentDetail.tsx` created with metadata grid, usage stats, token composition chart, time-series line chart (daily/weekly/monthly/all), paginated session list (50-row lazy load), prompt preview with expand/collapse, and "Back to Agents" navigation
- [x] **Task 7**: `Agents.tsx` redesigned as dashboard with summary cards, search/mode/hidden filters, sort controls, responsive card grid, hover hints, empty state, and clickable cards navigating to detail page
- [x] **Task 8**: `App.tsx` adds `/agents/:filename` route rendering `AgentDetail`
- [x] **Task 9**: `index.css` adds `.agent-card:hover .agent-card-hint` rule; `Agents.tsx` uses the CSS classes instead of an inline `<style>` block
- [x] **Task 10**: Programmer verification reports `npm run sync`, `npx tsc -b`, `npm run build`, and `npm run lint` all pass with zero errors

## Requirements Coverage

- [x] **FR-01**: Dashboard displays clickable summary cards with name, description, mode, hidden status, session count, total tokens, total cost, and last used date
- [x] **FR-02**: Cards navigate to `/agents/:filename` on click
- [x] **FR-03**: Visual indicators present — color-coded mode badge (primary=blue, subagent=purple), green activity dot for last-30-days usage, EyeOff icon for hidden agents
- [x] **FR-04**: Sorting supported by name, session count, total tokens, total cost, and last used (asc/desc toggle)
- [x] **FR-05**: Filtering supported by mode (all/primary/subagent), hidden toggle, and text search across name + description
- [x] **FR-06**: Summary section shows total agents, primary count, subagent count, total agent-driven sessions, and total agent-driven tokens
- [x] **FR-07**: Detail page accessible at `/agents/:filename` with full metadata from YAML frontmatter
- [x] **FR-08**: Usage statistics display total sessions, total tokens, input/output/reasoning/cache breakdown (via donut chart), total cost, average tokens/session, and time-series chart with daily/weekly/monthly/all buckets
- [x] **FR-09**: Session list sorted by date descending, with "Load more sessions" button adding 50 rows at a time
- [x] **FR-10**: Prompt preview shows markdown content minus frontmatter, truncated to 2000 characters with expand/collapse button
- [x] **FR-11**: "Back to Agents" link present, matching SessionDetail back-link pattern
- [x] **FR-12**: Sync script parses YAML frontmatter with `js-yaml`, extracting `description`, `mode`, `hidden`, `temperature`, and nested `permission` fields
- [x] **FR-13**: Usage computed by scanning session titles for `@<name> subagent` (case-insensitive), matching by both filename (without `.md`) and markdown heading name
- [x] **FR-14**: Aggregated stats include session count, sum of all token types, total cost, and most recent session date
- [x] **FR-15**: Enhanced `agents.json` exported with extended schema including `mode`, `hidden`, `temperature`, `permissions`, `usage`, and `content`
- [x] **FR-16**: Zero-usage agents exported with `sessionCount: 0`, `totalTokens: 0`, `totalCost: 0`, `lastUsed: null`
- [x] **FR-17**: `/agents/:filename` route added to `App.tsx`
- [x] **FR-18**: Route parameter `:filename` matches `filename` field from `agents.json`

---
Author: reviewer | Date: 2026-05-28 | Iteration: 1

# Requirements: Agents Dashboard Enhancement

## Context

The opencode-dashboard currently displays agents in a simple list view (`src/pages/Agents.tsx`) showing only `name`, `description`, and `filename`. Agent data is sourced from `~/.config/opencode/agents/*.md` files and exported as static JSON via `scripts/sync-opencode-data.js`. There is no agent usage tracking in the database (no `agent_id` column), but session titles contain agent references via the pattern `@<agentname> subagent`.

This enhancement transforms the Agents page into a full dashboard with summary cards, usage statistics, and a detail page.

## Functional Requirements

### Dashboard View (Agent List)

- **FR-01**: The dashboard MUST display agents as clickable summary cards (not a simple list), with each card showing: agent name, description, mode (primary/subagent), hidden status, session count, total tokens, total cost, and last used date.
- **FR-02**: Each card MUST be clickable and navigate to the agent detail page at `/agents/:filename`.
- **FR-03**: Cards MUST include visual indicators: color-coded badge for mode (primary vs subagent), and an activity indicator showing whether the agent has been used in the last 30 days.
- **FR-04**: The dashboard MUST support sorting by: name (alphabetical), session count (descending), total tokens (descending), total cost (descending), and last used (descending).
- **FR-05**: The dashboard MUST support filtering by: mode (primary/subagent), hidden status (show/hide), and text search across name and description.
- **FR-06**: The dashboard MUST display an overall summary section at the top showing: total agents count, total primary agents, total subagents, total agent-driven sessions, and total agent-driven tokens.

### Detail Page

- **FR-07**: The detail page MUST be accessible at `/agents/:filename` and display the full agent metadata extracted from YAML frontmatter.
- **FR-08**: The detail page MUST display complete usage statistics: total sessions, total tokens (input/output/reasoning/cache breakdown), total cost, average tokens per session, and a time-series chart of usage over time (daily/weekly/monthly buckets).
- **FR-09**: The detail page MUST list all sessions associated with this agent (matched by `@<agentname> subagent` pattern in session title), sorted by date descending, with pagination or lazy loading if more than 50 sessions.
- **FR-10**: The detail page MUST show a "Prompt Preview" section displaying the agent's markdown content (excluding YAML frontmatter), truncated to first 2000 characters with a "Show full prompt" expand button.
- **FR-11**: The detail page MUST include a "Back to Agents" navigation link following the same pattern as SessionDetail (`/sessions/:id`).

### Data Pipeline (Sync Script)

- **FR-12**: The sync script (`scripts/sync-opencode-data.js`) MUST parse YAML frontmatter from each agent markdown file and extract all scalar fields: `description`, `mode`, `hidden`, `temperature`, plus nested `permission` fields (`edit`, `bash`, `glob`).
- **FR-13**: The sync script MUST compute agent usage statistics by scanning all session titles for the pattern `@<agentname> subagent` (case-insensitive), where `<agentname>` is derived from the agent's markdown filename (without `.md` extension).
- **FR-14**: For each matched agent, the sync script MUST aggregate: session count, sum of input/output/reasoning/cache tokens, sum of cost, and most recent session date (last used).
- **FR-15**: The sync script MUST export enhanced agent data to `agents.json` with the extended schema defined in Data Requirements.
- **FR-16**: Agents with zero usage MUST still be exported with `sessionCount: 0`, `totalTokens: 0`, `totalCost: 0`, and `lastUsed: null`.

### Routing

- **FR-17**: `App.tsx` MUST add a new route `/agents/:filename` that renders the `AgentDetail` component.
- **FR-18**: The route parameter `:filename` MUST match the `filename` field from `agents.json` (e.g., `planner.md` → `/agents/planner.md`).

## Data Requirements

The `agents.json` output schema MUST be extended from the current:

```json
{
  "name": "string",
  "description": "string",
  "filename": "string"
}
```

To the new schema:

```json
{
  "name": "string",
  "description": "string",
  "filename": "string",
  "mode": "primary | subagent | null",
  "hidden": "boolean",
  "temperature": "number | null",
  "permissions": {
    "edit": "allow | deny | null",
    "bash": "allow | deny | null",
    "glob": "allow | deny | null"
  },
  "usage": {
    "sessionCount": "number",
    "totalTokens": "number",
    "inputTokens": "number",
    "outputTokens": "number",
    "reasoningTokens": "number",
    "cacheTokens": "number",
    "totalCost": "number",
    "lastUsed": "ISO date string | null"
  }
}
```

**TypeScript Interface Updates:**
- `AgentInfo` in `src/types/index.ts` MUST be updated to match the new schema.
- A new `AgentUsage` interface MUST be added.

## UI/UX Requirements

### Dashboard View

- **UI-01**: Summary cards MUST use a grid layout (responsive: 1 column on mobile, 2 on tablet, 3-4 on desktop) with consistent card styling matching `SummaryCard` component aesthetics.
- **UI-02**: Each card MUST display:
  - Agent name (14px, font-weight 500, primary color)
  - Mode badge (colored pill: blue for primary, purple for subagent)
  - Hidden indicator (eye-off icon or "Hidden" tag if `hidden: true`)
  - Description (12px, muted color, 2-line clamp with ellipsis)
  - Stats row: session count, total tokens, total cost (12px, mono font for numbers)
  - Last used date (11px, muted color, relative format: "2 days ago")
- **UI-03**: Hover state on cards MUST show a subtle background change and a "View details →" hint.
- **UI-04**: Empty state MUST display "No agents found" with an icon, matching existing empty states in the app.
- **UI-05**: Filter controls MUST be positioned above the grid: search input (left), mode toggle (center), hidden toggle (right).

### Detail Page

- **UI-06**: Page header MUST show agent name, mode badge, and filename.
- **UI-07**: Metadata section MUST display all frontmatter fields in a key-value grid: mode, hidden, temperature, permissions.
- **UI-08**: Usage statistics MUST be displayed in a 4-column summary card row: total sessions, total tokens, total cost, avg tokens/session.
- **UI-09**: A token breakdown bar chart (or stacked bar) MUST show input/output/reasoning/cache distribution, reusing existing chart components if available.
- **UI-10**: A time-series chart MUST show agent usage over time, using the same Recharts-based approach as other dashboard charts.
- **UI-11**: The session list MUST display: session title (truncated), date, model, total tokens, cost — with clickable rows that navigate to `/sessions/:id`.
- **UI-12**: The prompt preview MUST be in a scrollable code-like block with syntax highlighting disabled, using `var(--mono)` font family.

## Integration Requirements

- **INT-01**: The sync script's existing `parseYamlFrontmatter` function MUST be enhanced or replaced to handle nested objects (specifically the `permission` block). If enhanced, it MUST correctly parse 2-space indented nested keys. If replaced, a new dependency MUST NOT be added unless approved — the project currently has no YAML parser.
- **INT-02**: Agent name matching for usage tracking MUST use the filename (without `.md`) as the canonical agent identifier, matching against the pattern `@<filename> subagent` in session titles, case-insensitive.
- **INT-03**: The `exportDatabase` function in the sync script MUST expose session data to the `exportJsonFiles` function so that agent usage can be computed without re-reading the database.
- **INT-04**: `dataLoader.ts` MUST continue to silently return `[]` on fetch failures; no new error handling behavior is required.
- **INT-05**: The enhanced `agents.json` MUST be backward-compatible in the sense that old fields (`name`, `description`, `filename`) remain unchanged.

## Non-Functional Requirements

- **NFR-01**: TypeScript strict mode compliance: all new code MUST pass `tsc -b` with `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters` enabled. No `enum`, `namespace`, or parameter properties.
- **NFR-02**: Performance: agent usage computation in the sync script MUST complete in O(n × m) where n = session count and m = agent count. With typical datasets (<10k sessions, <50 agents), this MUST take <500ms.
- **NFR-03**: The dashboard MUST render the agent cards view within 2 seconds of data load for up to 100 agents.
- **NFR-04**: The detail page MUST lazy-load or paginate the session list if an agent has >50 associated sessions to avoid rendering performance issues.
- **NFR-05**: No new runtime dependencies SHOULD be added to the project. If a YAML parser is absolutely required, it MUST be discussed as an open question.
- **NFR-06**: All new UI components MUST follow existing styling patterns (CSS custom properties: `var(--bg-secondary)`, `var(--text-primary)`, etc.) and MUST NOT introduce new CSS frameworks.

## Constraints

- Client-side only: all data from static JSON in `public/data/`. No backend API.
- `public/data/` is in `.gitignore` and MUST NOT be committed.
- `/api/sync` only works in dev mode (Vite middleware).
- Build order: `tsc -b` first, then Vite build. Type errors block the build.
- No test runner in this repo — manual verification only.
- `dataLoader.ts` silently returns `[]` on fetch failures.
- Existing routing pattern uses `react-router-dom` with `BrowserRouter` and `AnimatePresence` for page transitions.

## Open Questions

## Decisions (User Approved)

- **?-01 → DECISION**: Add `js-yaml` dependency to sync script for robust YAML frontmatter parsing.
- **?-02 → DECISION**: Match by both filename (without `.md`) AND markdown heading name. Use whichever matches the `@<name> subagent` pattern in session titles.
- **?-03 → DECISION**: Hidden agents (`hidden: true`) are visible by default in the dashboard with a "Hidden" indicator/tag.
- **?-04 → DECISION**: Prompt preview shows the entire markdown file content minus frontmatter, rendered as markdown (not plain text).
- **?-05 → DECISION**: Cost is pre-computed in the sync script using session `cost` fields.
- **?-06 → DECISION**: Activity filter supports: Daily, Weekly, Monthly, and All (no fixed threshold).

---
Version: 1 | Author: analyst | Date: 2026-05-28

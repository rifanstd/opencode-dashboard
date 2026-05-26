# Requirements: Penyesuaian Halaman SessionList dan SessionDetail

## Context

The opencode-dashboard is a client-side React + Vite dashboard that visualizes opencode usage data from static JSON files in `public/data/`. The user wants to adjust two pages: **SessionList** (`src/pages/SessionsList.tsx`) and **SessionDetail** (`src/pages/SessionDetail.tsx`).

Current issues observed:
- **SessionList** has three separate filter inputs (search, project, model) and two unlabeled date pickers; pagination is 50 items/page; model IDs are displayed in raw long form.
- **SessionDetail** info bar duplicates detail card content; detail cards have unequal widths; cost sometimes renders as "—"; consecutive assistant messages are not grouped; message roles other than user/assistant are not collapsible.

## Functional Requirements

### SessionList

- **FR-01 (Single Search Field):** The page must display exactly one text search input. Typing into this input must filter the session list by matching against session title, project name, and model name (case-insensitive substring match). The separate "Project" and "Model" filter inputs must be removed.
  - *Test:* Searching for a string that appears only in the project name of a session must include that session in the filtered results.

- **FR-02 (Date Quick Filters):** The page must provide quick-filter controls for **Today**, **This Week**, **This Month**, and **This Year**. Activating a quick filter must restrict results to sessions whose `created_at` falls within the selected time range. Only one quick filter may be active at a time; selecting a new one replaces the previous selection.
  - *Test:* With a session created today, clicking "Today" must show that session; clicking "This Week" must also show it (since today is within the week); clicking "This Month" must also show it.

- **FR-03 (Custom Date Range Labels):** If the custom date range inputs (From / To) are retained alongside quick filters, they must have visible labels reading **"From"** and **"To"**. If they are removed, this requirement is satisfied by the quick filters alone.
  - *Test:* A user must be able to identify which date input controls the start date and which controls the end date without trial and error.

- **FR-04 (Pagination 20 items):** The table must display a maximum of **20 sessions per page**. The pagination controls (Previous / Next / page indicator) must update accordingly.
  - *Test:* With 45 sessions and page 1 active, the table shows sessions 1–20; page 2 shows 21–40; page 3 shows 41–45.

- **FR-05 (Model Name Shortening):** In the **Model** column, raw model identifiers must be shortened to the format `<provider_name>/<model_name>`. For example, `accounts/fireworks/models/kimi-k2p6` must display as `fireworks/kimi-k2p6`. If the provider cannot be determined, the raw ID is shown.
  - *Test:* A session with `model_id = "accounts/fireworks/models/kimi-k2p6"` must render the Model cell as `fireworks/kimi-k2p6`.

### SessionDetail

- **FR-06 (Info Bar Differentiation):** The info bar directly under the session title must display information **different from** the four detail cards (Model, Project, Date, Cost). It must not repeat the same values.
  - *Test:* The info bar text must not contain the exact model ID, project name, full date string, or formatted cost that appear in the detail cards below it.

- **FR-07 (Detail Cards Equal Size):** All detail cards in the top grid must have **equal width and equal height** within the same row.
  - *Test:* Inspecting the rendered cards shows identical `offsetWidth` and `offsetHeight` for all four cards on the same viewport.

- **FR-08 (Desktop 4-Column Grid):** On desktop/laptop viewports (minimum width **1024 px**), the detail cards grid must display **exactly 4 columns** that collectively fill the available content width (no trailing empty space wider than a single card).
  - *Test:* At 1280 px viewport width, the grid container width divided by 4 equals the width of each card (accounting for gap).

- **FR-09 (Text Overflow Prevention):** No text content inside any detail card may visually extend beyond the card's right edge. Long values (e.g., model IDs, project names) must wrap or be truncated with ellipsis.
  - *Test:* A session with a 100-character project name must not cause horizontal overflow inside its detail card.

- **FR-10 (Cost Card Fix):** The **Cost** detail card must display the actual computed cost for the session. It must show "—" **only** when the session has no model ID, zero tokens, or no pricing data is available. If the session has token usage and a known model, a numeric cost (including `$0`) must be shown.
  - *Test:* A session with `input_tokens=1000`, `output_tokens=500`, a known `model_id`, and valid pricing data must display a non-"—" cost value.

- **FR-11 (Merge Consecutive Assistant Messages):** When two or more consecutive messages all have `role === 'assistant'` with no message of `role === 'user'` between them, they must be rendered as a **single grouped message card**. The grouped card must preserve the chronological order of the individual messages and show a visual indicator that multiple assistant turns are present (e.g., a subtle separator or count).
  - *Test:* Given messages [assistant-1, assistant-2, assistant-3, user-1], the UI must render one grouped assistant card containing all three assistant messages, followed by one user card.

- **FR-12 (Collapsible Non-Standard Messages):** Messages whose `role` is **neither** `'user'` **nor** `'assistant'` (e.g., `'system'`, `'tool'`, or any other role) must be rendered inside an **expandable/collapsible** container. By default, these containers are collapsed (showing only a header with role name and timestamp). Clicking the header expands to reveal the full message content.
  - *Test:* A message with `role='system'` must initially render as a collapsed bar; clicking it reveals the message content; clicking again collapses it.

## Non-Functional Requirements

- **NFR-01 (TypeScript Strictness):** All changes must compile under the existing strict TypeScript configuration (`verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`). The build command `npm run build` must pass without type errors.

- **NFR-02 (No New Dependencies):** The implementation must not introduce new npm dependencies. All UI behavior must be achieved with React, browser APIs, and existing project utilities.

- **NFR-03 (Responsive Fallback):** On viewports narrower than 1024 px, the detail cards grid may fall back to 2 columns; on viewports narrower than 640 px, it may fall back to 1 column. The cards must remain equal-width within the current row configuration.

- **NFR-04 (Performance):** Filtering, pagination, and message grouping logic must use `useMemo` or equivalent to avoid unnecessary recomputation on every render.

- **NFR-05 (Accessibility):** Interactive elements (pagination buttons, expandable message headers) must be keyboard-focusable and operable via Enter/Space keys.

## Constraints

- **Static JSON Data Only:** No backend API changes. All data continues to come from `public/data/*.json` via `dataLoader.ts`.
- **Existing Type System:** The `Session` type currently lacks `model_provider`. If model name shortening requires provider hint data, the type and/or sync script may need adjustment — see Open Question Q3.
- **CSS Variable Theming:** All styling must continue using the existing CSS custom properties (`var(--bg-secondary)`, `var(--text-primary)`, etc.) defined in `src/index.css`.
- **Cost Calculation Reuse:** Cost must be computed using the existing `loadPricing` / `calculateCost` utilities in `src/utils/costCalculator.ts`. Do not duplicate pricing logic.
- **Message Role Openness:** The `Message.role` field is typed as `string`, so the implementation must handle arbitrary roles gracefully without hard-coding an exhaustive enum.

## Open Questions

- **Q1 (Info Bar Content — DECIDED):** ✅ **Option 3** — Summary sentence: "42 messages · 12.5K tokens · $0.34 · fireworks/kimi-k2p6"

- **Q2 (Date Filter UX — DECIDED):** ✅ **Option 2** — Coexist: quick filters (Today/Week/Month/Year) alongside custom From/To date pickers. Quick filters are visually distinct and reset date pickers to their range; manual date picker changes deselect the quick filter.

- **Q3 (Model Name Shortening Data Source — DECIDED):** ✅ **Option 2** — Extend type + sync script: Add `model_provider?: string | null` to the `Session` interface and ensure `sync-opencode-data.js` writes it to `sessions.json`. This is more robust and handles provider hints for non-`accounts/…` IDs.

- **Q4 (Message Grouping Scope — DECIDED):** ✅ **Option 1** — All messages with `role !== 'user'` and `role !== 'assistant'` (e.g., `system`, `tool`) are rendered in expandable/collapsible containers by default.

---
Version: 1 | Author: analyst | Date: 2026-05-26

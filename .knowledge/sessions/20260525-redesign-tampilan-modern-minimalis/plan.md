# Redesign Tampilan Modern Minimalis Implementation Plan

> **For the Orchestrator:** The Orchestrator delegates this plan to the Programmer for execution. After implementation, the Orchestrator delegates to the Reviewer for code review. Do NOT dispatch subagents directly — the Orchestrator manages the multi-agent pipeline.

**Goal:** Complete visual redesign of the opencode dashboard to Industrial Dark aesthetic (Linear/Raycast/Vercel inspired) — charcoal backgrounds, steel blue accents, Geist + JetBrains Mono typography, precision spacing, and subtle motion via framer-motion.

**Architecture:** Design tokens as CSS variables in `index.css` (single source of truth). Fonts loaded via `@font-face` with `font-display: swap`. Sidebar eliminated; all navigation in a slim 48px sticky TopBar. Overview page uses orchestrated staggered entrance animations. Providers+Models combined into a single Grouped Explorer with expandable provider sections. Agents+Skills restyled as Compact Registries. Route transitions via `AnimatePresence`. All inline styles replaced with CSS-variable-driven styling — no hardcoded colors, typography, or spacing values.

**Tech Stack:** React 19, TypeScript strict, React Router v7, Zustand 5, Recharts 3.8, Lucide React 1.16, Vite 8 + new: `motion` (framer-motion), Geist + JetBrains Mono fonts (self-hosted or CDN)

**Reference:** Requirements: .knowledge/sessions/20260525-redesign-tampilan-modern-minimalis/requirements.md v1

---

## Decision Points

- [x] **DP-01: Nav link count** — RESOLVED: Option (a) — 5 nav items: **Overview | Sessions | Providers & Models | Agents | Skills**. Route path: `/providers-models`. `/providers` and `/models` both render the same combined Explorer view (no redirect — both mount `<Resources />` directly). Nav label is "Providers & Models" to clearly communicate the combined view.

- [x] **DP-02: Font loading strategy** — RESOLVED: Option (a) — self-hosted `woff2` files in `public/fonts/geist/` and `public/fonts/jetbrains-mono/` with `@font-face` + `font-display: swap`. Subset to Latin + Latin Extended. Weights: Geist 400, 500, 600; JetBrains Mono 400, 500.

- [x] **DP-03: Brand icon choice** — RESOLVED: **`Terminal`** (Lucide React, 18px) for the "Opencode" brand icon in TopBar.

---

## Task Breakdown

### Task 1: Install Motion Dependency

- **Description:** Install `motion` (framer-motion) as a dependency. No code changes beyond `package.json` and `package-lock.json`.
- **Files affected:**
  - Modify: `package.json` — add `"motion": "^12.x"` to dependencies
  - Auto-generated: `package-lock.json`
- **Dependency:** None (first task)
- **Definition of Done:**
  - `npm install motion` completes successfully
  - `motion` appears in `package.json` dependencies
  - `npm run build` still works (empty import, not yet used)
- **Complexity:** low

---

### Task 2: Design System — CSS Variables, Typography, Global Styles

- **Description:** Rewrite `src/index.css` with the complete Industrial Dark design system. This is the foundation task — all subsequent tasks reference these CSS variables.

  Replace ALL existing CSS variables with the new Industrial Dark tokens (FR-01). Add Geist and JetBrains Mono font loading via `@font-face` (FR-02). Update global element styles to match the new aesthetic. Remove sidebar-related media queries. Add `@keyframes spin` for sync button (FR-22.1). Add `scroll-behavior: smooth` on `html` (FR-24.3). Add `prefers-reduced-motion` global override (NFR-02.4).

  **Font files** must be downloaded and placed in `public/fonts/geist/` and `public/fonts/jetbrains-mono/`. Subset to Latin + Latin Extended. Weights needed: Geist 400, 500, 600; JetBrains Mono 400, 500.

- **Files affected:**
  - Modify: `src/index.css` — full rewrite
  - Create: `public/fonts/geist/Geist[wght].woff2` (download)
  - Create: `public/fonts/geist/Geist-400.woff2` (or use variable)
  - Create: `public/fonts/geist/Geist-500.woff2`
  - Create: `public/fonts/geist/Geist-600.woff2`
  - Create: `public/fonts/jetbrains-mono/JetBrainsMono[wght].woff2` (or static)
  - Create: `public/fonts/jetbrains-mono/JetBrainsMono-400.woff2`
  - Create: `public/fonts/jetbrains-mono/JetBrainsMono-500.woff2`
- **Dependency:** None (standalone foundation task)
- **Definition of Done:**
  - `:root` block contains EXACTLY the color tokens from FR-01.2 through FR-01.7 (no old values remain)
  - `--sans` = `'Geist', sans-serif`; `--mono` = `'JetBrains Mono', monospace`
  - No `system-ui`, `-apple-system`, `Roboto`, `Segoe UI`, `SF Mono`, `Consolas` anywhere in `index.css`
  - `@font-face` blocks for both font families with `font-display: swap`
  - `color-scheme: dark` preserved on `:root`
  - `font-size: 14px` (base) preserved
  - `scroll-behavior: smooth` on `html`
  - `@keyframes spin` defined
  - `@media (prefers-reduced-motion: reduce)` block disables all animations
  - Global `table`, `th`, `td`, `code`, `input`, `button`, `a` styles updated per new design tokens
  - Old `@media (max-width: 1400px)` block removed
  - `h1`/`h2`/`h3` sizing updated per FR-02.6 typography scale
  - `tsc -b` passes (no type changes, only CSS)
  - New variables render correctly when previewed in browser devtools
- **Complexity:** medium

---

### Task 3: Layout Restructuring — Delete Sidebar, Restructure Layout.tsx

- **Description:** Delete `src/components/Sidebar.tsx`. Rewrite `src/components/Layout.tsx` to remove all sidebar state, logic, imports, and media query listeners. New layout: full-width TopBar (sticky top) + scrollable main content area with new padding (32px top/bottom, 40px left/right; responsive ≤768px: 20px). The Layout no longer receives or handles `onToggleSidebar`/`showSidebarToggle` props — those will be removed from TopBar in Task 4.

- **Files affected:**
  - Delete: `src/components/Sidebar.tsx`
  - Modify: `src/components/Layout.tsx` — full rewrite (remove `useState`, `useEffect`, sidebar import, sidebar toggle logic, flex layout with sidebar)
- **Dependency:** None (can run after Task 2 foundation, but doesn't strictly depend on it)
- **Definition of Done:**
  - `Sidebar.tsx` file deleted
  - `Layout.tsx` no longer imports `Sidebar`
  - `Layout.tsx` has no `useState`, no `useEffect`, no `window.matchMedia`, no `sidebarOpen`
  - `Layout.tsx` renders: `<div style={flex column, height 100vh}>` → `<TopBar ...>` → `<main style={new padding, overflow auto}>` → `{children}`
  - Main content padding: `32px 40px`; responsive `20px` at ≤768px via inline styles using `useViewportWidth` or CSS media query
  - `tsc -b` passes with no unused imports
- **Complexity:** low

---

### Task 4: TopBar Redesign + Quick Stats Data Strategy

- **Description:** Complete rewrite of `src/components/TopBar.tsx` per FR-05. Also create a module-level cache utility for overview stats so the TopBar quick stats work on ALL pages without duplicate fetches.

  **TopBar (FR-05):**
  - Height: 48px; background: `var(--bg-secondary)`; bottom border: `1px solid var(--border)`; sticky, z-index 10
  - Left: Brand icon (Lucide `Terminal`, 18px) + "Opencode" text (Geist 15px, weight 600, `text-primary`, letter-spacing -0.3px). Icon margin-right 8px.
  - Vertical divider: `1px solid var(--border)`, height 20px, margin 0 12px
  - Navigation links (5 items: Overview, Sessions, Providers & Models, Agents, Skills). Each as `NavLink` from React Router. Styling: Geist 13px, weight 500. Inactive: `text-secondary`. Active: `text-primary` with 2px underline (`--accent`, offset 10px from bottom, using `::after` pseudo-element or `border-bottom`). Padding horizontal 8px, gap between links handled by padding. Hover: `text-primary`, transition 150ms. Links wrapped in a `<nav>` element with `display: flex`, `gap: 0`.
  - Right-center: Quick stats from overview.json (formatted: `1,247 · 4.2M · $18.40`). JetBrains Mono 12px, `text-muted`. When unavailable: `"— · — · —"`. Hover shows tooltip with full label (using `title` attribute or custom tooltip). Three metrics: total sessions, total tokens, estimated cost.
  - Right: Sync button — RefreshCw icon (Lucide, 14px) + "Sync" text (Geist 12px). Height 28px, padding 6px 10px, border-radius 4px, transparent bg, `1px solid var(--border)` border. Hover: `bg-tertiary`, `text-primary`. Syncing: icon spins (CSS animation), text "Syncing…", opacity 0.7. Sync complete pulse: brief CSS `@keyframes` scale animation.
  - Responsive (≤768px): Nav collapses to hamburger (Lucide `Menu`/`X` icons), dropdown menu. Quick stats show only 1 metric (total sessions).
  - Remove `onToggleSidebar` and `showSidebarToggle` props — they no longer exist. TopBar receives `onSync` and `quickStats: { totalSessions, totalTokens, totalCost } | null`.

  **Quick Stats Cache (FR-05.6):**
  Create `src/utils/overviewCache.ts` — a module-level cache that wraps `loadOverviewStats()` from `dataLoader.ts`. Uses a singleton promise pattern to avoid duplicate fetches. Both TopBar (via Layout) and the Overview page call the same cached loader — only one HTTP request to `/data/overview.json` is issued across the entire app lifetime.

  Interface:
  ```ts
  // src/utils/overviewCache.ts
  import { loadOverviewStats } from './dataLoader.ts'
  import type { OverviewStats } from '../types/index.ts'

  let cached: Promise<OverviewStats> | null = null

  export function getOverviewStats(): Promise<OverviewStats> {
    if (!cached) {
      cached = loadOverviewStats()
    }
    return cached
  }

  export function invalidateOverviewCache(): void {
    cached = null
  }
  ```

  Layout.tsx loads overview data on mount using `getOverviewStats()`, extracts the three quick stat numbers, and passes them to TopBar. The Overview page also uses `getOverviewStats()` for its own data — both share the same cached promise. The Overview page does NOT need to change its data loading in this task — that happens in Task 5.

- **Files affected:**
  - Modify: `src/components/TopBar.tsx` — complete rewrite
  - Create: `src/utils/overviewCache.ts` — module-level overview data cache
  - Modify: `src/components/Layout.tsx` — add overview fetch, pass `quickStats` to TopBar
- **Dependency:** Tasks 2 (design system), 3 (Layout restructuring), DP-01 (nav link count decision)
- **Definition of Done:**
  - TopBar renders at 48px height with all sections: brand | nav | quick stats | sync
  - Brand shows `Terminal` icon + "Opencode"
  - 5 navigation links (Overview → `/`, Sessions → `/sessions`, Providers & Models → `/providers-models`, Agents → `/agents`, Skills → `/skills`)
  - Active link shows `--accent` underline
  - Quick stats show formatted numbers from `overview.json`; placeholder `"— · — · —"` when loading
  - Sync button shows RefreshCw icon + "Sync"; spins during sync; pulse on complete
  - Responsive: hamburger menu at ≤768px, single stat
  - `overviewCache.ts` returns cached promise; two callers share same promise
  - No modification to `src/stores/appStore.ts`, `src/utils/dataLoader.ts`, `src/utils/sync.ts`
  - `tsc -b` and ESLint pass
  - All existing routes still navigate correctly
- **Complexity:** high

---

### Task 5: Overview Page — Summary Strip + Metrics Cards

- **Description:** Restyle the Overview page per FR-06 and FR-07. This is a two-part task within one file.

  **Part A — Summary Strip (FR-06):**
  Add a full-width horizontal bar above the metrics cards:
  ```
  Last sync: X min ago · N sessions · N tokens · $X.XX this month
  ```
  Labels in Geist 11px `text-muted`. Numbers in JetBrains Mono 11px `text-secondary`. Background blends with page. Separated from metrics by `border-bottom: 1px solid var(--border)` + padding-bottom 12px + margin-bottom 24px.
  
  "Last sync" timestamp derived from `overview.json` — static, calculated once on page load. To derive this: check if `overview.json` has a timestamp field; if not, use `Date.now()` at load time. Parse as relative time ("X min ago", "X hours ago", "X days ago") using a simple function.

  **Part B — Metrics Cards (FR-07):**
  - 9 cards: Total Tokens, Input Tokens, Cache Miss, Cache Read, Output Tokens, Total Sessions, Providers, Models, Estimated Cost
  - Card background: `var(--bg-secondary)`, border-radius 6px, NO border. Padding: 20px 24px.
  - Layout: label (Geist 11px, `text-muted`, uppercase, tracking 0.5px, margin-bottom 8px) → value (JetBrains Mono 28px, `text-primary`, weight 500, tabular-nums, letter-spacing -1px) → subLabel with trend (Geist 11px, `text-muted`, margin-top 6px)
  - Trend indicators: inline colored text — `var(--success)` for up, `var(--danger)` for down
  - REMOVE icons from the `iconMap` and from `SummaryCard` usage — the `icon` prop is no longer passed
  - Hover: background shift to `var(--bg-tertiary)`, transition 200ms
  - Grid: `repeat(auto-fill, minmax(200px, 1fr))`, gap 12px
  - NO box-shadow, NO border on cards
  - Responsive ≤768px: 2 per row

  Update `SummaryCard.tsx` to match the new card styling — remove border, remove icon rendering (or make icon optional and don't pass it), update typography.

  Also update section headings to FR-08.8 style: "Overview" (h1, Geist 24px, weight 600, letter-spacing -0.5px, margin-bottom 20px) and "Key Metrics" (h2, Geist 14px, weight 500, `text-secondary`, uppercase, tracking 0.5px, margin-bottom 16px).

- **Files affected:**
  - Modify: `src/pages/Overview.tsx` — add summary strip section, restyle metrics grid, update headings
  - Modify: `src/components/SummaryCard.tsx` — remove border, remove icon area, update typography to JetBrains Mono value, Geist labels
- **Dependency:** Task 4 (quick stats cache — Overview should use `getOverviewStats()` for consistency)
- **Definition of Done:**
  - Summary strip renders above metrics with correct formatting and typography
  - "Last sync" shows relative time (static, not live-updating)
  - 9 metrics cards render without icons, without border
  - Card values use JetBrains Mono with tabular-nums
  - Card labels use Geist with uppercase tracking
  - Trend indicators show colored up/down arrows
  - Grid auto-fills correctly at various viewport widths
  - Hover on cards shows background transition
  - Section headings match design spec
  - Icon imports (`Coins`, `ArrowDownToLine`, etc.) removed from Overview.tsx
  - `tsc -b` passes
- **Complexity:** medium

---

### Task 6: Overview Charts Restyling + Delete GranularityFilter

- **Description:** Restyle all four chart components (TokenUsageChart, CostChart, ModelUsageChart, TokenCompositionChart) per FR-08.5 through FR-08.7. Delete `GranularityFilter.tsx` and inline the granularity selector directly into the TokenUsageChart and CostChart components per FR-08.4. Remove the separate `GranularityFilter` import from everywhere.

  **Chart container (FR-08.2):** The parent container div in Overview.tsx should use: `var(--bg-secondary)`, border-radius 6px, padding 20px, NO border.

  **Chart title (FR-08.3):** Each chart renders its own title as a `<h3>` or `<span>` — Geist 14px, weight 500, `text-secondary`, top-left.

  **Granularity selector (FR-08.4):** Inline pill tab group (top-right of Token Usage and Cost charts). Active: `bg-tertiary`, `text-primary`, radius 4px, padding 4px 10px. Inactive: transparent, `text-muted`. Gap 2px, transition 150ms. Replaces `<GranularityFilter>` with same options: Daily, Weekly, Monthly, Year, All.

  **Recharts restyling (FR-08.5):**
  - Grid: stroke `#21262d`, strokeWidth 0.5, horizontal lines only (`vertical={false}` or `horizontalPoints` prop). Remove `strokeDasharray`.
  - XAxis/YAxis: hidden (`hide={true}`) or stroke none
  - Line (TokenUsage): single `--accent` line, strokeWidth 1.5, dot=false
  - Area (TokenUsage): gradient fill `rgba(88,166,255,0.08)` to `rgba(88,166,255,0.01)` — use Recharts `<defs>` + `<linearGradient>`
  - Line (Cost): `--accent`, strokeWidth 1.5, dot=false, with area gradient same as above
  - Bar (ModelUsage): `--accent` fill with opacity 0.85, radius top 2px (`radius={[2,2,0,0]}`), gap 4px between bars (`barCategoryGap="4"`)
  - Donut (TokenComposition): monochromatic blue palette from `--chart-1` through `--chart-5`, innerRadius 65%, outerRadius 80%, stroke none (or `stroke: var(--bg-secondary)`, strokeWidth 1), labels hidden. Center text: JetBrains Mono 18px total.

  **Tooltip (FR-08.6):** Custom style for all charts: background `#1c2128`, border `1px solid #30363d`, borderRadius 6px, padding `8px 12px`, font JetBrains Mono 12px, no boxShadow. Use Recharts `contentStyle` prop.

  **Legend (FR-08.7):** Remove chart legend from ALL four charts. TokenCompositionChart uses inline labels next to the donut instead (positioned with custom SVG `<text>` elements or separate div below).

  **ModelUsageChart (FR-08.7 continued):** Remove the bottom legend bar. Use a single accent color per bar instead of cycling colors.

  **GranularityFilter deletion (FR-26.4):**
  - Delete `src/components/GranularityFilter.tsx`
  - Remove import from `TokenUsageChart.tsx` and `CostChart.tsx`
  - Replace with inline pill tab group in each chart component

- **Files affected:**
  - Modify: `src/components/TokenUsageChart.tsx` — inline granularity selector, restyle Recharts
  - Modify: `src/components/CostChart.tsx` — inline granularity selector, restyle Recharts, add area fill
  - Modify: `src/components/ModelUsageChart.tsx` — restyle Recharts, single color, remove legend
  - Modify: `src/components/TokenCompositionChart.tsx` — restyle donut, remove legend, add inline labels
  - Modify: `src/pages/Overview.tsx` — update chart container styles, adjust grid
  - Delete: `src/components/GranularityFilter.tsx`
- **Dependency:** Task 5 (Overview page restyling — same file)
- **Definition of Done:**
  - All four charts render with new Recharts styling (grid color, no axis, correct line/area/bar/donut styles)
  - Granularity selector appears inline in TokenUsageChart and CostChart as pill tabs
  - GranularityFilter.tsx deleted; no imports of it remain
  - Chart tooltips use the new dark style with JetBrains Mono
  - No legends on any chart
  - TokenCompositionChart shows inline labels
  - Chart container divs have correct background, radius, padding, no border
  - `tsc -b` passes
- **Complexity:** high

---

### Task 7: DataTable Component Restyling

- **Description:** Restyle `src/components/DataTable.tsx` per FR-09.2 and FR-14. No outer border wrapper — remove the `border: '1px solid var(--border)'` and `borderRadius: 10` from the outer div. Header: Geist 11px, `text-muted`, uppercase, tracking 0.5px, padding 10px 16px. Body: Geist 13px, `text-primary`, padding 12px 16px. Row border-bottom: `1px solid var(--border)`. Row hover: `rgba(88,166,255,0.04)`. Numeric columns use JetBrains Mono 13px, tabular-nums (detect via column metadata or render function). Sticky header: `position: sticky; top: 0; z-index: 1; background: var(--bg-primary)` (FR-14.2). Clickable rows have `cursor: pointer` (already present). No zebra striping. Empty state: single centered row "No data" — Geist 13px, `text-muted`, padding 40px, colSpan full width (FR-14.4). Sort indicators: small ▲/▼, 10px, next to label (already present, keep as-is).

- **Files affected:**
  - Modify: `src/components/DataTable.tsx` — restyle all elements
- **Dependency:** Task 2 (design system CSS variables)
- **Definition of Done:**
  - DataTable has no outer border/border-radius wrapper
  - Header cells use correct typography (Geist 11px uppercase)
  - Body cells use Geist 13px
  - Rows have `border-bottom: 1px solid var(--border)`, no zebra striping
  - Row hover shows `rgba(88,166,255,0.04)` tint
  - Header is sticky
  - Empty state renders "No data" centered
  - `tsc -b` passes (generic component, no type changes needed)
- **Complexity:** low

---

### Task 8: Sessions List Page Restyling

- **Description:** Restyle `src/pages/SessionsList.tsx` per FR-09. Filter bar restyling (FR-09.1): single horizontal row below heading. Search input with Search icon (Lucide `Search`, 14px) prefixed inside the input (using a wrapper div with absolute-positioned icon). All filter inputs: Geist 13px, height 32px, background `var(--bg-tertiary)`, border `1px solid var(--border)`, radius 4px, placeholder `text-muted`. Gap 8px between filters. Margin-bottom 20px.

  Pagination restyling (FR-09.4): centered below table. Buttons: Geist 12px, height 28px, `bg-tertiary`, border `1px solid var(--border)`, radius 4px. Page info: Geist 12px, `text-muted`. Session count to the left (keep existing).

  Heading: "Sessions" — Geist 22px, weight 600, `text-primary`, margin-bottom 20px (matching FR-12.5 pattern).

- **Files affected:**
  - Modify: `src/pages/SessionsList.tsx` — restyle filter bar, pagination, heading
- **Dependency:** Task 7 (DataTable restyling — SessionsList uses DataTable)
- **Definition of Done:**
  - Search input has Search icon prefix
  - All filter inputs use new styling (bg-tertiary, 32px height, Geist 13px)
  - Pagination buttons match new design (rounded, bg-tertiary, 28px height)
  - Table renders with restyled DataTable (from Task 7)
  - Heading matches typography spec
  - `tsc -b` passes
- **Complexity:** medium

---

### Task 9: Session Detail Page Restyling

- **Description:** Restyle `src/pages/SessionDetail.tsx` per FR-10. Also restyle `TokenChart.tsx` for the token breakdown section.

  **Back link (FR-10.1):** "← Back to Sessions" — Geist 13px, `text-secondary`, hover `text-primary`, no background. Keep as `<Link>`.

  **Title + info bar (FR-10.2):** Session title: Geist 22px, weight 600, `text-primary`, margin-top 8px. Info bar below: `Project · Model · Date` in Geist 13px, `text-muted`, single line, separated by middle-dots.

  **Detail cards (FR-10.3):** Model, Project, Date, Cost cards as: `bg-secondary`, radius 6px, padding 20px, margin-bottom 16px, NO border. Label: Geist 11px uppercase `text-muted`. Value: Geist 13px/14px `text-primary`.

  **Token breakdown (FR-10.4):** Replace the current stacked bar chart with a horizontal bar layout. Each token type (input, output, reasoning, cache) shown as a labeled bar: label (Geist 12px `text-muted`, fixed width 100px) + bar (proportional width, `--accent` color at varying opacity) + value (JetBrains Mono 13px, tabular-nums, `text-primary`). Total at bottom. Container: `bg-secondary`, radius 6px, padding 20px, no border.

  **Messages list (FR-10.5):** Each message as a minimal bubble: background `var(--bg-tertiary)`, radius 6px, padding 16px, NO border. Remove the outer border+radius from the message container div. Role badge: Geist 11px uppercase, removed from being in a separate row — move inline with timestamp. Message content: Geist 13px, `text-primary`, white-space pre-wrap.

  **Code blocks in messages (FR-10.5):** The message content may contain markdown code blocks (triple backticks) or inline code (single backtick). Implement a lightweight parser that detects:
  - Fenced code blocks: wrap in `<pre><code>` with styling: background `rgba(0,0,0,0.3)`, JetBrains Mono 12px, padding 12px 16px, border-radius 4px, margin 8px 0, white-space pre-wrap, overflow-x auto, border-left `2px solid var(--border-accent)`
  - Inline code: wrap in `<code>` with styling: background `rgba(88,166,255,0.1)`, JetBrains Mono 12px, padding 2px 6px, radius 3px
  - NO external syntax highlighting library — CSS-only differentiation
  
  This requires a simple regex-based parser: split content on triple-backtick boundaries, detect alternating code/text sections, and render accordingly. For inline code, use a regex to find backtick-wrapped spans and split/render. The parser should live as a helper function within SessionDetail.tsx (it's page-specific).

  **Parts (tool calls):** Keep existing parts rendering but restyle: background `var(--bg-primary)` → change to `rgba(0,0,0,0.2)`, JetBrains Mono 12px for tool_input/tool_output code blocks. Parts section header: Geist 11px uppercase `text-muted`.

  **Metadata (FR-10.6):** Already covered by the detail cards above.

  **TokenChart restyling:** The `TokenChart.tsx` component is used on the session detail page. Since FR-10.4 replaces the bar chart with horizontal bars, we need to restyle TokenChart OR replace its usage. The simplest approach: modify `TokenChart` to support a `horizontal-bars` type, or render the horizontal bars inline in `SessionDetail.tsx` and stop using `TokenChart` for the breakdown. Plan: render horizontal bars inline in `SessionDetail.tsx` (matches FR-10.4 exactly), keeping `TokenChart` unchanged for any other future use. If `TokenChart` is ONLY used in SessionDetail (verified yes), we can delete it and just render inline.

- **Files affected:**
  - Modify: `src/pages/SessionDetail.tsx` — complete restyle, add code block parser
  - Modify: `src/components/TokenChart.tsx` — significant restyle OR remove and inline in SessionDetail
- **Dependency:** Task 2 (design system), Task 7 (DataTable not used here, independent)
- **Definition of Done:**
  - Back link styled per spec
  - Session title and info bar match typography spec
  - Detail cards (Model, Project, Date, Cost) use new card style (no border, bg-secondary, correct typography)
  - Token breakdown rendered as horizontal bars with JetBrains Mono values
  - Messages list uses minimal bubble style (bg-tertiary, no border, proper padding)
  - Code blocks in messages: fenced blocks get dark background + left border accent; inline code gets subtle blue background
  - Parser handles edge cases: empty code blocks, nested backticks, code blocks without language specifier
  - Parts (tool calls) restyled with darker background and JetBrains Mono
  - `tsc -b` passes
- **Complexity:** high

---

### Task 10: Providers + Models Grouped Explorer

- **Description:** Create a new combined view for Providers and Models per FR-11.

  Create `src/pages/Resources.tsx` — the Grouped Explorer page. This page loads both providers and models, groups models by their `provider` field, and renders them as expandable sections.

  **Data loading:** Use `loadProviders()` and `loadModels()` from `dataLoader.ts` (existing functions, no changes needed).

  **Provider section (FR-11.2):** Full-width bar with background `var(--bg-tertiary)`, padding 12px 16px, border-radius 6px (all corners rounded when collapsed, only top corners when expanded — achieve via conditional border-radius). Chevron icon (Lucide `ChevronDown` when expanded, `ChevronRight` when collapsed, 14px, `text-muted`, CSS transition 150ms rotate) + provider name (Geist 15px, weight 500, `text-primary`). Right side: status badge "Configured"/"Not configured" (pill, Geist 11px, `--success`/`--muted`) + model count (JetBrains Mono 12px, `text-muted`: "N models"). Gap between provider sections: 8px.

  **Expand/collapse (FR-11.3):** Click toggles. Use local `useState<Set<string>>` tracking expanded provider IDs. Chevron rotates 90° via CSS transition.

  **Model rows (FR-11.4):** Inside expanded provider, models shown as compact list items indented 28px from provider left edge. Icon (Lucide `Box`, 14px, `text-muted`) + model name (Geist 13px, `text-primary`, weight 500) + metadata inline (JetBrains Mono 12px, `text-muted`). Row padding: 8px 16px, border-bottom: `1px solid var(--border)`. Row hover: background `rgba(88,166,255,0.04)`, transition 100ms.

  **Model metadata format (FR-11.5):** `$X.XX/Mt input · $X.XX/Mt output · XXXK ctx · [tags]`. Tags as subtle pills: Geist 10px, `text-muted`, transparent background, border `1px solid var(--border)`, radius pill, padding 1px 8px.

  **Initial state (FR-11.8):** All providers start EXPANDED on page load.

  **Empty states (FR-11.9):** No providers: centered "No providers configured" — Geist 13px, `text-muted`. Provider with zero models: "0 models" in count; expand shows "No models for this provider" in indented area.

  **Section heading (FR-11.7):** "Providers & Models" — Geist 22px, weight 600, `text-primary`, margin-bottom 20px.

- **Files affected:**
  - Create: `src/pages/Resources.tsx` — the combined Grouped Explorer page
- **Dependency:** Task 2 (design system), Task 4 (nav links reference `/providers-models`)
- **Definition of Done:**
  - Providers & Models page loads providers and models, groups by provider
  - Provider sections render with correct styling, chevron, status badge, model count
  - Click toggles expand/collapse with smooth chevron rotation
  - Expanded provider shows model rows with icon, name, pricing metadata, tags
  - All providers start expanded
  - Empty states render correctly
  - Heading matches typography spec
  - `tsc -b` passes
- **Complexity:** medium

---

### Task 11: Route Handling — Combined /providers and /models → /providers-models

- **Description:** Update routing to reflect the combined Providers+Models view per FR-13 and DP-01.

  **DP-01 resolved — 5 nav items, `/providers-models` route:**
  - Add `<Route path="/providers-models" element={<Resources />} />` in `App.tsx`
  - Keep `/providers` and `/models` rendering `<Resources />` directly (no redirect flash — both mount the same component)
  ```tsx
  // In App.tsx Routes:
  <Route path="/providers-models" element={<Resources />} />
  <Route path="/providers" element={<Resources />} />       {/* legacy, renders same view */}
  <Route path="/models" element={<Resources />} />           {/* legacy, renders same view */}
  ```
  This keeps all 6 routes functional per C-03.2 while providing a single combined view. The canonical route is `/providers-models`; `/providers` and `/models` are legacy aliases.
  - `Providers.tsx` and `Models.tsx` are no longer routed to — they serve as reference for data loading patterns. In practice, `Resources.tsx` replaces both.

  **TopBar nav links (5):**
  ```
  Overview → /        Sessions → /sessions    Providers & Models → /providers-models    Agents → /agents    Skills → /skills
  ```

- **Files affected:**
  - Modify: `src/App.tsx` — add Resources import and routes
  - Modify: `src/components/TopBar.tsx` — update nav items to 5 with "Providers & Models" label, route `/providers-models`
  - No files deleted: `Providers.tsx` and `Models.tsx` kept for reference (they can be cleaned in Task 16)
- **Dependency:** Task 10 (Resources.tsx exists), DP-01 resolved
- **Definition of Done:**
  - Navigating to `/providers-models` renders the Grouped Explorer
  - Navigating to `/providers` or `/models` also renders the Grouped Explorer
  - TopBar has 5 nav items: Overview, Sessions, Providers & Models, Agents, Skills
  - Active nav state works correctly for "Providers & Models" when on any of `/providers-models`, `/providers`, or `/models`
  - `tsc -b` passes (verify no missing imports)
- **Complexity:** low

---

### Task 12: Agents Page — Compact Registry Restyling

- **Description:** Restyle `src/pages/Agents.tsx` per FR-12 (Compact Registry layout).

  Layout: single-column vertical list. Each item: full-width row with icon (Lucide `Bot`, 16px, `text-muted`, margin-right 12px) + name (Geist 14px, weight 500, `text-primary`) + metadata inline (Geist 12px / JetBrains Mono 12px, `text-muted`). Items separated by `border-bottom: 1px solid var(--border)`, padding 12px 16px. Row hover: background `rgba(88,166,255,0.04)`, transition 100ms.

  Agent metadata expanded: show filename + description inline. If description is long, truncate with ellipsis.

  Heading: "Agents" — Geist 22px, weight 600, `text-primary`, margin-bottom 20px.
  Empty state: centered text "No agents found." — Geist 13px, `text-muted`, no icon (FR-12.6).

- **Files affected:**
  - Modify: `src/pages/Agents.tsx` — complete restyle
- **Dependency:** Task 2 (design system)
- **Definition of Done:**
  - Agents list renders as compact vertical registry (no card borders, no background blocks)
  - Each row has Bot icon + name + inline metadata
  - Row hover shows subtle blue tint
  - Heading and empty state match spec
  - `tsc -b` passes
- **Complexity:** low

---

### Task 13: Skills Page — Compact Registry Restyling

- **Description:** Restyle `src/pages/Skills.tsx` per FR-12 (same Compact Registry layout as Agents).

  Replace the current table layout with the Compact Registry layout. Each row: icon (Lucide `Wrench`, 16px, `text-muted`, margin-right 12px) + skill name (Geist 14px, weight 500, `text-primary`) + metadata inline: version (JetBrains Mono 12px, `text-muted`) + source (Geist 12px, `text-muted`). Items separated by `border-bottom: 1px solid var(--border)`, padding 12px 16px. Row hover: background `rgba(88,166,255,0.04)`, transition 100ms.

  Heading: "Skills" — Geist 22px, weight 600, `text-primary`, margin-bottom 20px.
  Empty state: centered text "No skills found." — Geist 13px, `text-muted`, no icon.

- **Files affected:**
  - Modify: `src/pages/Skills.tsx` — complete restyle (remove table, use list layout)
- **Dependency:** Task 2 (design system)
- **Definition of Done:**
  - Skills list renders as compact vertical registry (no table borders)
  - Each row has Wrench icon + name + version + source inline
  - Row hover shows subtle blue tint
  - Heading and empty state match spec
  - `tsc -b` passes
- **Complexity:** low

---

### Task 14: Shared Components Restyling (LoadingOverlay, ErrorMessage, ErrorBoundary)

- **Description:** Restyle three shared components per FR-16 and FR-17.

  **LoadingOverlay (FR-16):** Background: `var(--bg-primary)` with opacity 0.85 + `backdrop-filter: blur(4px)`. Remove the card/border wrapper div. Center content: CSS-only ring spinner (24px, `border: 2px solid var(--border)`, `border-top-color: var(--accent)`, border-radius 50%, animation spin 0.8s linear infinite) + text below (Geist 13px, `text-muted`). Z-index: 50. Remove the existing card with inner spinner — just spinner + text centered.

  **ErrorMessage (FR-17.1):** Container: `bg-secondary`, border-radius 6px, border-left `2px solid var(--danger)`, padding 16px 20px. Text: Geist 13px, `text-danger`. Add XCircle icon (Lucide `XCircle`, 16px) left-aligned with margin-right 10px.

  **ErrorBoundary (FR-17.2):** Fallback renders a centered ErrorMessage (using the updated component) with a "Retry" button below: Geist 13px, `bg-tertiary`, border `1px solid var(--border)`, radius 4px, padding 6px 14px, margin-top 12px. Keep the existing `componentDidCatch` logic — only change the render output.

- **Files affected:**
  - Modify: `src/components/LoadingOverlay.tsx` — simplify to spinner + text, blurred bg
  - Modify: `src/components/ErrorMessage.tsx` — add icon, new styling
  - Modify: `src/components/ErrorBoundary.tsx` — update fallback UI
- **Dependency:** Task 2 (design system)
- **Definition of Done:**
  - LoadingOverlay: blurred background, ring spinner (CSS only), Geist text. No card wrapper.
  - ErrorMessage: border-left accent, XCircle icon, correct typography and colors
  - ErrorBoundary: uses restyled ErrorMessage + Retry button
  - `tsc -b` passes
- **Complexity:** low

---

### Task 15: Motion — Animations & Transitions

- **Description:** Add motion animations across the app per FR-18 through FR-24. This is a single task but touches many files. Install was done in Task 1; this task adds `import { motion, AnimatePresence } from 'motion'` and applies animations.

  **Route transitions (FR-20):** Wrap `<Routes>` in `App.tsx` with `<AnimatePresence mode="wait">`. Each page component (Overview, SessionsList, SessionDetail, Resources, Agents, Skills) wraps its return in `<motion.div>` with:
  - initial: `{ opacity: 0, y: 6 }`
  - animate: `{ opacity: 1, y: 0 }`
  - exit: `{ opacity: 0, y: -6 }`
  - transition: enter `{ duration: 0.2, ease: [0.16, 1, 0.3, 1], delay: 0.05 }`, exit `{ duration: 0.15, ease: 'easeIn' }`
  - Use `useLocation()` to key `<Routes>` by `location.pathname` for AnimatePresence.

  **Overview orchestrated stagger (FR-19):**
  - Summary strip: `<motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0 }}>`
  - Metrics cards: wrap each card in `<motion.div>` with stagger. Use `motion`'s `staggerChildren` or manual stagger via `transition={{ delay: index * 0.04 }}` (total 9 cards × 40ms = 360ms). Each card: `initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}`
  - Chart containers: stagger 80ms per chart (4 charts). Each: `initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}`
  - Heading renders immediately (no animation wrapper).

  **Hover micro-interactions (FR-21):** These are already CSS-only transitions — they were applied in earlier tasks via inline `transition` styles. Verify: nav link color transition 150ms (Task 4), metric card background transition 200ms (Task 5), table row hover 100ms (Task 7), button transitions (various tasks). No additional motion library usage needed here. Add one chart tooltip animation: Recharts tooltip wrapper can use a custom component with `motion.div` for fade-in + scale 0.96→1, duration 120ms.

  **Sync button (FR-22):** CSS `@keyframes spin` already defined in Task 2. For sync-complete pulse, add a CSS `@keyframes syncPulse` (scale 1→1.05→1, 300ms) and apply it conditionally when `isSyncing` transitions from true to false. Use a local state `showPulse` in TopBar.

  **Chart animations (FR-23):** Recharts built-in `animationDuration` and `animationEasing` props:
  - Line charts: `animationDuration={800}`, `animationEasing="ease-out"`
  - Bar charts: `animationDuration={600}`, `animationEasing="ease-out"`
  - Donut: `animationDuration={700}`, `animationEasing="ease-out"`
  - Add `isAnimationActive={true}` (default). No number counting animation on metrics cards.

  **Focus & accessibility (FR-24):** These are CSS-only, handled in Task 2 (`:focus-visible` outline, `scroll-behavior: smooth`). Verify in this task. Also add `prefers-reduced-motion` support: wrap all motion component `transition` / `initial` / `animate` / `exit` values in a hook or conditional that checks `window.matchMedia('(prefers-reduced-motion: reduce)').matches`. When true, set all durations to 0 and disable animations. Create a simple hook `useReducedMotion()` in the component or a shared location.

  **Page-level AnimatePresence pattern:**
  ```tsx
  // App.tsx
  import { AnimatePresence, motion } from 'motion'
  const location = useLocation()
  
  // Inside Layout's main:
  <AnimatePresence mode="wait">
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
    >
      <Routes location={location}>
        ...
      </Routes>
    </motion.div>
  </AnimatePresence>
  ```

  Note: Each page component does NOT need its own `<motion.div>` wrapper — the single wrapper in App.tsx (or Layout.tsx) handles all route transitions. The Overview page stagger animations are additional inner animations within the Overview component itself.

- **Files affected:**
  - Modify: `src/App.tsx` — wrap Routes in AnimatePresence + motion.div with location key
  - Modify: `src/pages/Overview.tsx` — wrap summary strip, metric cards, charts in motion.div with stagger
  - Modify: `src/components/TopBar.tsx` — sync-complete pulse animation logic
  - Modify: `src/components/TokenUsageChart.tsx` — Recharts animation props
  - Modify: `src/components/CostChart.tsx` — Recharts animation props
  - Modify: `src/components/ModelUsageChart.tsx` — Recharts animation props
  - Modify: `src/components/TokenCompositionChart.tsx` — Recharts animation props
  - Modify: `src/components/TokenChart.tsx` — Recharts animation props (if kept)
- **Dependency:** Tasks 1-14 (all UI components must exist before adding motion)
- **Definition of Done:**
  - Route transitions work: navigate between pages, see fade+slide animation
  - Overview page has orchestrated stagger: summary strip, then cards, then charts
  - Sync button pulses briefly after sync completes
  - Chart animations draw smoothly (lines draw, bars grow, donut arcs)
  - `prefers-reduced-motion` disables all animations
  - No jank, no layout shift during animations
  - All animations use `transform` + `opacity` only (compositor-only)
  - `tsc -b` passes
- **Complexity:** high

---

### Task 16: Cleanup — Delete Legacy Components, Unused Files, Verify Build

- **Description:** Final cleanup pass. Delete files that are no longer used or referenced.

  **Delete legacy components** (verified unreferenced via grep — see exploration above):
  - Delete: `src/components/ActivityHeatmap.tsx`
  - Delete: `src/components/CostTrendChart.tsx`
  - Delete: `src/components/DailyActivityChart.tsx`
  - Delete: `src/components/ProjectActivityChart.tsx`
  - Delete: `src/components/RecentSessionsList.tsx`
  - Delete: `src/components/TimeRangeSelector.tsx`
  - Delete: `src/components/TopModelsChart.tsx`

  **Delete unused utility:**
  - Delete: `src/utils/markdownParser.ts` — not imported anywhere

  **Conditional deletions** (keep if still referenced for data patterns, but not routed):
  - `src/pages/Providers.tsx` — keep (may serve as reference) or delete if fully replaced by Resources.tsx. Plan: DELETE — Resources.tsx replaces it.
  - `src/pages/Models.tsx` — same as above. Plan: DELETE — Resources.tsx replaces it.

  **Verify no broken imports:**
  - Run `tsc -b` and confirm zero errors
  - Run `npm run lint` and confirm zero errors
  - Run `npm run build` and confirm successful build

  **Verify all routes work:**
  - `npm run dev` — navigate to all 6 (or 5) routes, confirm rendering
  - Test sync button
  - Test responsive layout at 375px, 768px, 1440px

- **Files affected:**
  - Delete: `src/components/ActivityHeatmap.tsx`
  - Delete: `src/components/CostTrendChart.tsx`
  - Delete: `src/components/DailyActivityChart.tsx`
  - Delete: `src/components/ProjectActivityChart.tsx`
  - Delete: `src/components/RecentSessionsList.tsx`
  - Delete: `src/components/TimeRangeSelector.tsx`
  - Delete: `src/components/TopModelsChart.tsx`
  - Delete: `src/utils/markdownParser.ts`
  - Delete: `src/pages/Providers.tsx` — replaced by Resources.tsx
  - Delete: `src/pages/Models.tsx` — replaced by Resources.tsx
- **Dependency:** Task 11 (route updates — Providers.tsx and Models.tsx must no longer be imported in App.tsx)
- **Definition of Done:**
  - All listed files deleted
  - `tsc -b` passes with zero errors (no broken imports from deleted files)
  - `npm run lint` passes with zero errors
  - `npm run build` completes successfully
  - `npm run dev` — all pages render correctly
  - No console errors in dev mode
- **Complexity:** low

---

## Dependency Order

```
Task 1 (install motion) ─────────────────────────────────────────────────┐
                                                                          │
Task 2 (design system/CSS) ──────────────────────────────────────────────┤
    │                                                                     │
    ├── Task 3 (Layout restructure, delete Sidebar) ─────────────────────┤
    │       │                                                             │
    │       └── Task 4 (TopBar + overview cache) ──── DP-01 decision ────┤
    │               │                                                     │
    │               ├── Task 5 (Overview summary + cards) ───────────────┤
    │               │       │                                             │
    │               │       └── Task 6 (Overview charts + delete GranularityFilter)
    │               │                                                     │
    │               ├── Task 7 (DataTable restyle) ──────────────────────┤
    │               │       │                                             │
    │               │       └── Task 8 (Sessions list)                    │
    │               │                                                     │
    │               ├── Task 9 (Session detail + code blocks) ─── (parallel with 7-8)
    │               │                                                     │
    │               ├── Task 10 (Providers & Models Explorer) ───────────┤
    │               │       │                                             │
    │               │       └── Task 11 (Route handling)                  │
    │               │                                                     │
    │               ├── Task 12 (Agents) ─── (parallel with 10-11) ──────┤
    │               ├── Task 13 (Skills)  ─── (parallel with 10-11) ─────┤
    │               ├── Task 14 (Shared components) ── (parallel with 9-13)
    │               │                                                     │
    │               └── [All components exist] ───────────────────────────┤
    │                                                                     │
    └── Task 15 (Motion animations) ─────────────────────────────────────┤
            │                                                             │
            └── Task 16 (Cleanup + verify) ──────────────────────────────┘
```

**Parallelizable groups:**
- Tasks 7→8 (Sessions pipeline) and Task 9 (Session detail) and Tasks 10→11 (Providers & Models pipeline) and Tasks 12+13+14 can all run in parallel after Task 4 completes

---

## Risks & Alternatives

- **Risk: Font files too large** — Geist variable + JetBrains Mono variable together could be ~500KB+. | **Mitigation:** Subset to Latin + Latin Extended only. Use `woff2` compression. Self-host to benefit from browser caching. If still too large, fall back to CDN (Google Fonts) which may already be in user cache.

- **Risk: Motion library causes bundle size increase beyond 35KB** — measured gzip may creep higher with many import sites. | **Mitigation:** motion (framer-motion) is ~30KB gzipped for the base package. Only import `motion` and `AnimatePresence` — no drag, gestures, or layout animations. If size exceeds 35KB, consider tree-shaking or using `m` (lazy) factory.

- **Risk: Code block regex parser misses edge cases** — nested backticks, code blocks inside code blocks, escaped characters. | **Mitigation:** Use a simple state machine approach (iterate characters, track if inside code fence) rather than pure regex. Keep the parser in a single function with clear edge case handling. If too complex, limit to detecting triple-backtick at line start only.

- **Risk: Recharts animation props conflict with framer-motion animated wrapper** — double-animation jank on charts. | **Mitigation:** Test each chart individually. If conflict, disable Recharts `isAnimationActive` and rely on framer-motion wrapper animation only (fade in). Chart internal animations (line draw, bar grow) are handled by Recharts internally.

- **Risk: Overview page double-fetches overview.json** — the Overview page and TopBar (via Layout) both call `loadOverviewStats()`. | **Mitigation:** The `overviewCache.ts` module-level singleton promise ensures only one HTTP request fires. Both callers await the same promise.

- **Alternative approach: CSS Modules or Tailwind** — If inline styles with CSS variables become unwieldy for the number of changes, consider adopting CSS Modules for component-specific styles. This is a significant architectural shift not in the current requirements, so flag to Orchestrator if inline styles prove insufficient. The current plan assumes inline styles remain the approach (consistent with existing codebase patterns).

---

## Files Summary

### Created (4 files)
| File | Task | Purpose |
|---|---|---|
| `public/fonts/geist/*.woff2` | 2 | Geist font files (variable or static weights) |
| `public/fonts/jetbrains-mono/*.woff2` | 2 | JetBrains Mono font files |
| `src/utils/overviewCache.ts` | 4 | Module-level cache for overview.json (shared by TopBar + Overview page) |
| `src/pages/Resources.tsx` | 10 | Combined Providers & Models Grouped Explorer page |

### Modified (25 files)
| File | Task(s) | Changes |
|---|---|---|
| `package.json` | 1 | Add `motion` dependency |
| `src/index.css` | 2 | Full rewrite: design tokens, fonts, global styles |
| `src/components/Layout.tsx` | 3, 4 | Remove sidebar, restructure layout, add overview fetch for quick stats |
| `src/components/TopBar.tsx` | 4, 11 | Complete rewrite: brand, nav, quick stats, sync button; update nav items |
| `src/pages/Overview.tsx` | 5, 6, 15 | Summary strip, metrics restyle, chart containers, motion stagger |
| `src/components/SummaryCard.tsx` | 5 | Remove icon, remove border, restyle typography |
| `src/components/TokenUsageChart.tsx` | 6, 15 | Inline granularity, Recharts restyling, animation props |
| `src/components/CostChart.tsx` | 6, 15 | Inline granularity, Recharts restyling, area fill, animation props |
| `src/components/ModelUsageChart.tsx` | 6, 15 | Single color bars, remove legend, animation props |
| `src/components/TokenCompositionChart.tsx` | 6, 15 | Donut restyle, inline labels, remove legend, animation props |
| `src/components/DataTable.tsx` | 7 | No border, sticky header, new typography, empty state |
| `src/pages/SessionsList.tsx` | 8 | Filter bar, pagination, heading |
| `src/pages/SessionDetail.tsx` | 9 | Full restyle: back link, info bar, cards, code blocks, token breakdown |
| `src/components/TokenChart.tsx` | 9 | Restyle for horizontal bars or keep as-is |
| `src/pages/Agents.tsx` | 12 | Compact Registry layout |
| `src/pages/Skills.tsx` | 13 | Compact Registry layout (replace table) |
| `src/components/LoadingOverlay.tsx` | 14 | Blur bg, ring spinner, no card |
| `src/components/ErrorMessage.tsx` | 14 | Border-left, XCircle icon |
| `src/components/ErrorBoundary.tsx` | 14 | Updated fallback UI + Retry button |
| `src/App.tsx` | 11, 15 | Providers & Models route, AnimatePresence wrapper |
| `src/components/TopBar.tsx` | 15 | Sync pulse animation |

### Deleted (12 files)
| File | Task | Reason |
|---|---|---|
| `src/components/Sidebar.tsx` | 3 | Replaced by top nav (FR-04.1) |
| `src/components/GranularityFilter.tsx` | 6 | Inlined into chart components (FR-26.4) |
| `src/pages/Providers.tsx` | 16 | Replaced by Resources.tsx |
| `src/pages/Models.tsx` | 16 | Replaced by Resources.tsx |
| `src/components/ActivityHeatmap.tsx` | 16 | Legacy, unused |
| `src/components/CostTrendChart.tsx` | 16 | Legacy, unused |
| `src/components/DailyActivityChart.tsx` | 16 | Legacy, unused |
| `src/components/ProjectActivityChart.tsx` | 16 | Legacy, unused |
| `src/components/RecentSessionsList.tsx` | 16 | Legacy, unused |
| `src/components/TimeRangeSelector.tsx` | 16 | Legacy, unused |
| `src/components/TopModelsChart.tsx` | 16 | Legacy, unused |
| `src/utils/markdownParser.ts` | 16 | Unused utility |

### Untouched (per constraints)
| File | Reason |
|---|---|
| `src/utils/dataLoader.ts` | C-01.1 |
| `src/utils/costCalculator.ts` | C-01.1 |
| `src/utils/overviewDataProcessor.ts` | C-01.1 |
| `src/utils/sync.ts` | C-01.1 |
| `src/stores/appStore.ts` | C-01.1 |
| `src/utils/logParser.ts` | Not in scope |
| `scripts/sync-opencode-data.js` | Not in scope |
| `vite.config.ts` | Not in scope |
| `eslint.config.*` | Not in scope |
| `tsconfig*.json` | Not in scope |
| `src/hooks/` | Empty directory |
| `src/workers/` | Empty directory |
| `src/types/index.ts` | Data types unchanged |
| `public/data/*.json` | Generated, gitignored |

---

## Self-Review Checklist (Pre-Report)

### 1. Spec Coverage
- [x] FR-01 (Color tokens) → Task 2 (index.css rewrite)
- [x] FR-02 (Typography) → Task 2 (fonts + CSS variables)
- [x] FR-03 (Spacing, Radius, Shadows) → Task 2 (applied throughout all tasks)
- [x] FR-04 (Remove sidebar) → Task 3
- [x] FR-05 (TopBar) → Task 4
- [x] FR-06 (Summary strip) → Task 5
- [x] FR-07 (Metrics cards) → Task 5
- [x] FR-08 (Charts grid) → Task 6
- [x] FR-09 (Sessions list) → Tasks 7, 8
- [x] FR-10 (Session detail) → Task 9
- [x] FR-11 (Grouped Explorer) → Task 10
- [x] FR-12 (Compact Registry) → Tasks 12, 13
- [x] FR-13 (Nav implications) → Task 11
- [x] FR-14 (DataTable shared) → Task 7
- [x] FR-15 (Charts shared) → Task 6
- [x] FR-16 (LoadingOverlay) → Task 14
- [x] FR-17 (ErrorMessage, ErrorBoundary) → Task 14
- [x] FR-18 (Motion library) → Task 1
- [x] FR-19 (Initial page load) → Task 15
- [x] FR-20 (Route transitions) → Task 15
- [x] FR-21 (Hover micro-interactions) → Tasks 4,5,7,15 (CSS transitions)
- [x] FR-22 (Sync button states) → Task 15
- [x] FR-23 (Chart animations) → Task 15
- [x] FR-24 (Focus & accessibility) → Task 2 (CSS), Task 15 (verify)
- [x] FR-25 (Global style changes) → Task 2
- [x] FR-26 (Deletions) → Tasks 3, 6, 16
- [x] NFR-01 (Performance) → Task 2 (font-display: swap), Task 15 (compositor-only)
- [x] NFR-02 (Accessibility) → Task 2 (:focus-visible), Task 15 (reduced-motion)
- [x] NFR-03 (Responsive) → Tasks 3, 4, 5 (responsive breakpoints)
- [x] NFR-04 (Maintainability) → Task 2 (CSS variables as single source of truth)
- [x] NFR-05 (Consistency) → All tasks reference same CSS variables
- [x] C-01 (Data logic untouched) → All tasks respect constraint
- [x] C-02 (Tech stack) → No new tech beyond `motion`
- [x] C-03 (Project structure) → All routes maintained
- [x] C-04 (Build) → No build changes needed beyond dependency install
- [x] C-05 (User constraints) → DP-01, DP-02, DP-03 flagged for Orchestrator approval

### 2. Placeholder Scan
- No "TBD", "TODO", "implement later", "fill in details"
- No "Add appropriate error handling" without specifics
- No "Write tests for the above" (no test runner in this project)
- No "Similar to Task N" without repeating code
- All file paths are exact and verified to exist (or marked CREATE)
- All type names match those in `src/types/index.ts`

### 3. Type Consistency
- `OverviewStats` from `src/types/index.ts` used consistently
- `Granularity` type referenced correctly
- `Session`, `Message`, `Part`, `ModelInfo`, `ProviderInfo`, `AgentInfo`, `SkillInfo` types match
- `loadOverviewStats`, `loadTokenUsage`, `loadSessions`, `loadModels`, `loadProviders`, `loadAgents`, `loadSkills`, `loadMessages`, `loadParts` function signatures match `dataLoader.ts`
- `formatNumber`, `formatCost`, `formatDateTick` from `costCalculator.ts` — not modified
- `useAppStore` Zustand store — not modified
- `handleSync` from `sync.ts` — not modified
- `MetricCardData` type matches SummaryCardProps interface changes

---

Version: 2 | Author: planner | Ref: requirements v1 | Date: 2026-05-25 (updated: DP-01/02/03 resolved)

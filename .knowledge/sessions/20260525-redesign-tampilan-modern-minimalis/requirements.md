# Requirements: Redesign Tampilan Modern Minimalis

## Context

**Project**: `opencode-dashboard` — a local, client-side dashboard for monitoring opencode (AI coding assistant) usage data. Currently a generic dark admin dashboard with system fonts, solid dark backgrounds, sidebar + topbar layout, bordered cards, and Recharts defaults.

**Goal**: Complete visual redesign of the entire frontend to a **modern, tech-oriented, minimalist, and "cool"** aesthetic. The chosen direction is **Industrial Dark** — inspired by tools like Linear, Raycast, and Vercel: charcoal backgrounds, steel blue accents, distinctive typography, precision spacing, and subtle motion.

**Scope**: All visual presentation layers are in scope. Data logic, data fetching, and data processing are **explicitly out of scope** — no changes to `dataLoader.ts`, `costCalculator.ts`, `overviewDataProcessor.ts`, or any data-related utility.

---

## Functional Requirements

### FR-01: Design System — Color Tokens
- **FR-01.1**: Define CSS variables in `src/index.css` for all color tokens as specified below.
- **FR-01.2**: Background tokens: `--bg-primary: #0d1117`, `--bg-secondary: #161b22`, `--bg-tertiary: #1c2128`.
- **FR-01.3**: Border tokens: `--border: #21262d`, `--border-accent: #30363d`.
- **FR-01.4**: Text tokens: `--text-primary: #e6edf3`, `--text-secondary: #8b949e`, `--text-muted: #484f58`.
- **FR-01.5**: Accent tokens: `--accent: #58a6ff`, `--accent-hover: #79c0ff`, `--accent-dim: rgba(88,166,255,0.12)`.
- **FR-01.6**: Semantic tokens: `--success: #3fb950`, `--warning: #d29922`, `--danger: #f85149`.
- **FR-01.7**: Chart color palette (8 colors, steel blue monochromatic + accent contrasts): `--chart-1: #58a6ff`, `--chart-2: #79c0ff`, `--chart-3: #a5d6ff`, `--chart-4: #1f6feb`, `--chart-5: #388bfd`, `--chart-6: #bc8cff`, `--chart-7: #f0883e`, `--chart-8: #3fb950`.
- **FR-01.8**: Remove all existing CSS variable values that differ from the above.

### FR-02: Design System — Typography
- **FR-02.1**: Load **Geist** font family for UI (headings, body, labels). Use `@font-face` or appropriate loading method.
- **FR-02.2**: Load **JetBrains Mono** font family for data, numbers, and code. Use `@font-face` or appropriate loading method.
- **FR-02.3**: Set CSS variable `--sans: 'Geist', sans-serif` as UI font.
- **FR-02.4**: Set CSS variable `--mono: 'JetBrains Mono', monospace` as data font.
- **FR-02.5**: Remove `system-ui` and all generic font fallbacks as the primary fonts.
- **FR-02.6**: Typography scale — Display (JetBrains Mono): 32px/36px; Headings h1 (Geist): 28px, h2: 22px, h3: 18px; Body (Geist): 14px default, 13px small, 16px large; Caption/Label (Geist): 12px; Micro/Badge (Geist): 11px; Data/Numbers/Code (JetBrains Mono): 13px tabular-nums.
- **FR-02.7**: All numeric values (token counts, costs, stats) throughout the application MUST use JetBrains Mono with `font-variant-numeric: tabular-nums` for aligned number columns.

### FR-03: Design System — Spacing, Radius, Shadows
- **FR-03.1**: Spacing scale based on 4px grid: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px.
- **FR-03.2**: Border radius scale: 4px (inputs, buttons, tags), 6px (cards, panels), 8px (modals), pill (badges).
- **FR-03.3**: No traditional box-shadows. Elevation conveyed through surface color differences and hairline borders (`0 1px 0 0 var(--border)`). Elevated surfaces (modal/overlay): `0 4px 12px rgba(0,0,0,0.4)`.

### FR-04: Layout — Remove Sidebar, Top Navigation Only
- **FR-04.1**: Remove the `Sidebar` component entirely. Delete `src/components/Sidebar.tsx`.
- **FR-04.2**: Restructure `Layout.tsx` to render TopBar (full-width, sticky top) + main content area (full-width, scrollable). No sidebar-related state, no collapse logic, no media query listeners for sidebar toggle.
- **FR-04.3**: Main content area padding: 32px top/bottom, 40px left/right. Mobile (≤768px): 20px all sides.

### FR-05: TopBar — Brand, Navigation, Quick Stats, Sync
- **FR-05.1**: TopBar height: 48px (reduced from current 56px).
- **FR-05.2**: Background: `var(--bg-secondary)`, bottom border: `1px solid var(--border)`.
- **FR-05.3**: Left section — brand icon + text "Opencode" in Geist 15px, weight 600, `text-primary`, letter-spacing -0.3px. Brand icon sourced from Lucide React (e.g., `Code2`, `Terminal`, `Box`, or `Cpu` — specific icon choice deferred to implementation). Icon size: 18px, color: `text-primary`, margin-right 8px.
- **FR-05.4**: Navigation links (6 items: Overview, Sessions, Providers, Models, Agents, Skills) displayed horizontally after a vertical divider (20px height, `1px solid var(--border)`).
- **FR-05.5**: Nav link styling — Geist 13px, weight 500. Inactive: `text-secondary`. Active: `text-primary` with 2px underline in `--accent` color, offset 10px from link bottom. No background block. Gap between links: 8px horizontal padding. Hover: `text-primary`, transition 150ms.
- **FR-05.6**: Right-center section — quick stats: three compact metrics without labels, separated by middle-dot (·). Format: `1,247 · 4.2M · $18.40`. Font: JetBrains Mono 12px, `text-muted`. Quick stats MUST appear on ALL pages (not only Overview). Data sourced from `overview.json` (same data file already loaded by the Overview page). Implementation approach for sharing data globally — state lifting to App level or module-level cache of `overview.json` — is a planning decision, but must NOT require new fetch calls beyond what already exists and must NOT modify `src/stores/appStore.ts` (per C-01.1). When overview data is unavailable (e.g., first load before Overview page has fetched), quick stats show "— · — · —" as placeholder. Hover shows tooltip with full label.
- **FR-05.7**: Right section — Sync button: icon RefreshCw (Lucide, 14px) + text "Sync" (Geist 12px), height 28px, padding 6px 10px, border-radius 4px, transparent background with `1px solid var(--border)` border. Hover: `bg-tertiary`, text `text-primary`. Syncing state: rotating icon (CSS spin) + text "Syncing…" + opacity 0.7.
- **FR-05.8**: TopBar is sticky (`position: sticky; top: 0; z-index: 10`).
- **FR-05.9**: Responsive (≤768px): nav links collapse to hamburger dropdown; quick stats show only 1 metric (total sessions).

### FR-06: Overview Page — Summary Strip
- **FR-06.1**: Add a "dashboard summary strip" above metrics cards. Full-width horizontal bar with: `Last sync: X min ago · N sessions · N tokens · $X.XX this month`.
- **FR-06.2**: Labels in Geist 11px `text-muted`, numbers in JetBrains Mono 11px `text-secondary`.
- **FR-06.3**: Background: `var(--bg-primary)` (blends with page). Separated from metrics by `border-bottom: 1px solid var(--border)` + padding-bottom 12px. Margin-bottom: 24px.
- **FR-06.4**: "Last sync" timestamp derived from `overview.json` timestamp field, calculated once on page load. Timestamp is STATIC — it does NOT auto-update or poll. It is recalculated only when the user clicks the Sync button (which triggers a full page reload, causing re-fetch of `overview.json`).
- **FR-06.5**: Data for summary strip from existing `overview.json` data (already fetched by Overview page). No new data fetch.

### FR-07: Overview Page — Metrics Cards
- **FR-07.1**: Redesign all metrics cards (9 cards: Total Tokens, Input Tokens, Cache Miss, Cache Read, Output Tokens, Total Sessions, Providers, Models, Estimated Cost).
- **FR-07.2**: Card background: `var(--bg-secondary)`, border-radius 6px, no border. Padding: 20px 24px.
- **FR-07.3**: Layout: label (Geist 11px, `text-muted`, uppercase, tracking 0.5px, margin-bottom 8px) → value (JetBrains Mono 28px, `text-primary`, weight 500, tabular-nums, letter-spacing -1px) → optional subLabel with trend (Geist 11px, `text-muted`, margin-top 6px).
- **FR-07.4**: Trend indicators: inline colored text — `--success` (#3fb950) for up, `--danger` (#f85149) for down.
- **FR-07.5**: Remove icons from metrics cards (currently Lucide icons rendered next to each card). Cards use typography-only presentation.
- **FR-07.6**: Hover state: background shift to `var(--bg-tertiary)`, transition 200ms.
- **FR-07.7**: Grid: `repeat(auto-fill, minmax(200px, 1fr))`, gap 12px.
- **FR-07.8**: No box-shadow, no border on cards.

### FR-08: Overview Page — Charts Grid
- **FR-08.1**: Four charts in a 2×2 grid: Token Usage (line), Cost (line), Model Usage (bar), Token Composition (donut).
- **FR-08.2**: Chart container: `var(--bg-secondary)`, border-radius 6px, padding 20px, no border.
- **FR-08.3**: Chart title: Geist 14px, weight 500, `text-secondary`, top-left of container.
- **FR-08.4**: Granularity selector (Token Usage & Cost charts): pill tab group in top-right corner — Geist 11px. Active: `bg-tertiary`, `text-primary`, radius 4px, padding 4px 10px. Inactive: transparent, `text-muted`. Gap: 2px. Transition: 150ms.
- **FR-08.5**: Recharts restyling — Grid: `#21262d`, strokeWidth 0.5, horizontal only. Axis: hidden. Line: `var(--accent)`, strokeWidth 1.5, dot=false. Area: gradient `rgba(88,166,255,0.08)` to `rgba(88,166,255,0.01)`. Bar: `var(--accent)` with opacity 0.85, radius top 2px, gap 4px. Donut: monochromatic blue palette, innerRadius 65%, stroke none, labels hidden.
- **FR-08.6**: Tooltip custom style: background `#1c2128`, border `1px solid #30363d`, radius 6px, padding 8px 12px, font JetBrains Mono 12px, no shadow.
- **FR-08.7**: Chart legend: removed. Token Composition uses inline labels next to donut.
- **FR-08.8**: Section heading "Overview" (h1): Geist 24px, weight 600, `text-primary`, letter-spacing -0.5px, margin-bottom 20px. Sub-heading "Key Metrics" (h2): Geist 14px, weight 500, `text-secondary`, uppercase, tracking 0.5px, margin-bottom 16px.
- **FR-08.9**: Responsive (≤768px): grid collapses to 1 column, cards 2 per row.

### FR-09: Sessions List Page
- **FR-09.1**: Filter bar — single horizontal row below heading. Input fields: Geist 13px, height 32px, background `var(--bg-tertiary)`, border `1px solid var(--border)`, radius 4px. Placeholder: `text-muted`. Search input with Search icon (Lucide, 14px) prefix. Gap: 8px between filters. Margin-bottom: 20px.
- **FR-09.2**: DataTable styling — no outer border. Header: Geist 11px, `text-muted`, uppercase, tracking 0.5px, padding 10px 16px. Body: Geist 13px, `text-primary`, padding 12px 16px. Row border-bottom: `1px solid var(--border)`. Row hover: `rgba(88,166,255,0.04)`. Numeric columns: JetBrains Mono 13px, tabular-nums. Sticky header. No zebra striping.
- **FR-09.3**: Sortable columns: clickable header with small ▲/▼ indicator (10px) next to label text.
- **FR-09.4**: Pagination — centered below table. Buttons: Geist 12px, height 28px, `bg-tertiary`, border subtle, radius 4px. Page info: Geist 12px, `text-muted`.

### FR-10: Session Detail Page
- **FR-10.1**: Back link "← Back to Sessions" at top: Geist 13px, `text-secondary`, hover `text-primary`, no background.
- **FR-10.2**: Session title: Geist 22px, weight 600, `text-primary`. Info bar below: `Project · Model · Date` in Geist 13px, `text-muted`.
- **FR-10.3**: Detail sections as cards: `bg-secondary`, radius 6px, padding 20px, margin-bottom 16px, no border.
- **FR-10.4**: Token breakdown — horizontal bar layout with JetBrains Mono values.
- **FR-10.5**: Messages list — scrollable container, each message as minimal bubble: Geist 13px, `text-primary`, background `bg-tertiary`, radius 6px. Code blocks within messages receive special rendering: background `rgba(0,0,0,0.3)` (darker than bubble), JetBrains Mono 12px, padding 12px 16px, border-radius 4px, margin 8px 0, white-space pre-wrap, overflow-x auto, border-left `2px solid var(--border-accent)`. Inline code: background `rgba(88,166,255,0.1)`, JetBrains Mono 12px, padding 2px 6px, radius 3px. No external syntax highlighting library — CSS-only differentiation.
- **FR-10.6**: Metadata — key-value pairs: label Geist 12px `text-muted`, value Geist 13px `text-primary`.

### FR-11: Providers & Models — Grouped Explorer (Combined View)
- **FR-11.1**: Providers and Models are presented as a single hierarchical explorer view. Providers act as expandable section headers; models are nested beneath their parent provider.
- **FR-11.2**: Provider section header — full-width bar: background `var(--bg-tertiary)`, padding 12px 16px, border-radius 6px (top corners rounded when expanded, all corners when collapsed). Left: chevron icon ▼/► (Lucide ChevronDown/ChevronRight, 14px, `text-muted`) + provider name (Geist 15px, weight 500, `text-primary`). Right: status badge "Configured" / "Not configured" (pill, Geist 11px, `--success` / `--muted`) + model count (JetBrains Mono 12px, `text-muted`: "4 models"). Gap between provider sections: 8px.
- **FR-11.3**: Click on provider header toggles expand/collapse. Chevron rotates 90° (CSS transition 150ms). Expanded: models list revealed below. Collapsed: models hidden.
- **FR-11.4**: Model rows (inside expanded provider) — compact list items, indented 28px from provider left edge. Each row: icon (Lucide Box/Cpu, 14px, `text-muted`) + model name (Geist 13px, `text-primary`, weight 500) + metadata inline (JetBrains Mono 12px, `text-muted`: pricing/context window/capability tags). Row padding: 8px 16px. Row border-bottom: `1px solid var(--border)` (light). Row hover: background `rgba(88,166,255,0.04)`, transition 100ms.
- **FR-11.5**: Model metadata format per row: `$X.XX/Mt input · $X.XX/Mt output · XXXK ctx · [tags]`. Tags displayed as subtle pills (Geist 10px, `text-muted`, background transparent, border `1px solid var(--border)`, radius pill, padding 1px 8px).
- **FR-11.6**: Models within a collapsed provider remain hidden — no lazy loading, all models are in the DOM but hidden via CSS. If performance becomes a concern with hundreds of models, defer to implementation decision.
- **FR-11.7**: Section heading: "Resources" or "Providers & Models" (Geist 22px, weight 600, `text-primary`, margin-bottom 20px).
- **FR-11.8**: All providers start EXPANDED on page load (not collapsed by default).
- **FR-11.9**: Empty state: "No providers configured" — centered text, Geist 13px, `text-muted`. If providers exist but have zero models: provider header shows "0 models", expand shows empty state "No models for this provider" in indented area.

### FR-12: Agents & Skills — Compact Registry
- **FR-12.1**: Agents page and Skills page each use the Compact Registry layout (single-column vertical list, information-dense).
- **FR-12.2**: Each registry item is a full-width row: icon (Lucide, 16px, `text-muted`, margin-right 12px) + name (Geist 14px, weight 500, `text-primary`) + metadata inline (Geist 12px / JetBrains Mono 12px, `text-muted`). Items separated by `border-bottom: 1px solid var(--border)`, padding 12px 16px.
- **FR-12.3**: Agents metadata: role/type, model association, status (enabled/disabled). Skills metadata: version, source, lock status. All metadata rendered inline within the row — no separate card expansion.
- **FR-12.4**: Row hover: background `rgba(88,166,255,0.04)`, transition 100ms.
- **FR-12.5**: Page heading: "Agents" / "Skills" — Geist 22px, weight 600, `text-primary`, margin-bottom 20px.
- **FR-12.6**: Empty state: centered text, Geist 13px, `text-muted`, no icon.

### FR-13: Navigation Implications (Providers + Models Combined)
- **FR-13.1**: The top navigation bar currently lists 6 items (FR-05.4). With Providers and Models now sharing a combined explorer view, the navigation should reflect this. Two options for implementation decision: (a) reduce nav items to 5 — Overview | Sessions | Resources | Agents | Skills — with `/resources` route rendering the combined explorer, or (b) keep separate "Providers" and "Models" nav links that both navigate to the same combined view with appropriate active state. Either approach acceptable — planner decides.
- **FR-13.2**: All 6 existing routes (`/`, `/sessions`, `/sessions/:id`, `/providers`, `/models`, `/agents`, `/skills`) must remain functional per C-03.2 — but `/providers` and `/models` may render the same combined component.

### FR-14: Shared Component — DataTable
- **FR-14.1**: DataTable component conforms to table styling in FR-09.2.
- **FR-14.2**: Sticky header with `position: sticky; top: 0; z-index: 1; background: var(--bg-primary)`.
- **FR-14.3**: Clickable rows: `cursor: pointer`.
- **FR-14.4**: Empty state: single centered row "No data" — Geist 13px, `text-muted`, padding 40px.

### FR-15: Shared Component — Charts
- **FR-15.1**: All chart components (TokenUsageChart, CostChart, ModelUsageChart, TokenCompositionChart, and any other chart components) follow unified styling per FR-08.5 through FR-08.7.
- **FR-15.2**: Chart components do NOT render their own background or border — the parent container card provides these.

### FR-16: Shared Component — LoadingOverlay
- **FR-16.1**: Background: `var(--bg-primary)` with opacity 0.85 + `backdrop-filter: blur(4px)`.
- **FR-16.2**: Center content: CSS-only ring spinner in `--accent` color (no icon library). Text below: Geist 13px, `text-muted`.
- **FR-16.3**: Z-index: 50.

### FR-17: Shared Component — ErrorMessage & ErrorBoundary
- **FR-17.1**: ErrorMessage container: `bg-secondary`, radius 6px, border-left `2px solid var(--danger)`, padding 16px 20px. Text: Geist 13px, `text-danger`. XCircle icon (Lucide, 16px) left-aligned.
- **FR-17.2**: ErrorBoundary fallback: centered ErrorMessage with "Retry" button (Geist 13px, `bg-tertiary`, border `1px solid var(--border)`, radius 4px, padding 6px 14px, margin-top 12px).

### FR-18: Motion — Library Addition
- **FR-18.1**: Install `motion` (framer-motion) as a dependency (~30KB gzipped).
- **FR-18.2**: All animations use the following easing curve as default: `cubic-bezier(0.16, 1, 0.3, 1)` for enter animations; `ease-in` for exit animations.

### FR-19: Motion — Initial Page Load (Overview)
- **FR-19.1**: Orchestrated staggered animation on Overview page mount:
  - Summary strip: fade-in + slide-down 4px, duration 250ms, delay 0ms.
  - Metrics cards: staggered fade-up 12px (opacity 0→1), duration 300ms, stagger 40ms per card (total 9 cards).
  - Chart containers: staggered fade-up 8px (opacity 0→1), duration 300ms, stagger 80ms per chart (total 4 charts).
- **FR-19.2**: Page heading "Overview" renders immediately with no animation.
- **FR-19.3**: Total orchestrated load sequence completes within ~600ms.

### FR-20: Motion — Route Transitions
- **FR-20.1**: Use `AnimatePresence` from motion library to animate page transitions.
- **FR-20.2**: Page exit: fade-out + slide-up 6px, duration 150ms.
- **FR-20.3**: Page enter: fade-in + slide-down 6px, duration 200ms, delay 50ms.
- **FR-20.4**: No scale transforms — only translate + opacity.

### FR-21: Motion — Hover Micro-Interactions
- **FR-21.1**: Nav links: color transition + underline slide-in from left, duration 150ms.
- **FR-21.2**: Metric cards: background shift `bg-secondary` → `bg-tertiary`, duration 200ms.
- **FR-21.3**: Table rows: background tint `rgba(88,166,255,0)` → `rgba(88,166,255,0.04)`, duration 100ms.
- **FR-21.4**: Buttons: background + border color shift via CSS transition, duration 150ms.
- **FR-21.5**: Chart tooltip: fade-in + scale 0.96→1, duration 120ms.

### FR-22: Motion — Sync Button States
- **FR-22.1**: Syncing state: icon RefreshCw rotates continuously using CSS `@keyframes spin`, linear, infinite, 1s.
- **FR-22.2**: Sync complete: brief pulse on accent (scale 1→1.05→1, 300ms) as success feedback.

### FR-23: Motion — Chart Animation
- **FR-23.1**: Line charts: `animationDuration={800}`, `animationEasing="ease-out"`, line draws left to right.
- **FR-23.2**: Bar charts: `animationDuration={600}`, `animationEasing="ease-out"`, bars grow from bottom.
- **FR-23.3**: Donut: `animationDuration={700}`, `animationEasing="ease-out"`, arc draws clockwise.
- **FR-23.4**: No number counting animation on metrics cards (intentional — Industrial Dark aesthetic values precision over motion).

### FR-24: Motion — Focus & Accessibility
- **FR-24.1**: Focus ring: `2px solid var(--accent)`, offset 2px, radius 4px. Applies only via `:focus-visible` (keyboard navigation).
- **FR-24.2**: No animation on focus ring appearance — immediate.
- **FR-24.3**: CSS `scroll-behavior: smooth` on `html` element.

### FR-25: Global Style Changes
- **FR-25.1**: Remove all generic styles from `index.css` that conflict with the new design system.
- **FR-25.2**: Maintain `color-scheme: dark` on `:root`.
- **FR-25.3**: Base font size: 14px (unchanged).
- **FR-25.4**: Override all component inline styles to use new CSS variables, typography scale, and spacing scale defined above.

### FR-26: Deletions
- **FR-26.1**: Delete `src/components/Sidebar.tsx` — no longer used.
- **FR-26.2**: Remove all Sidebar-related imports, state, and logic from `Layout.tsx`.
- **FR-26.3**: Remove all sidebar-related media query listeners (≤1400px collapse logic).
- **FR-26.4**: Remove `GranularityFilter` component if it exists as a separate component — replace inline in chart containers per FR-08.4.

---

## Non-Functional Requirements

### NFR-01: Performance
- **NFR-01.1**: Total additional JS bundle size from `motion` library must not exceed 35KB gzipped.
- **NFR-01.2**: Font loading (Geist + JetBrains Mono) must not block initial render. Use `font-display: swap` for both typefaces.
- **NFR-01.3**: All CSS animations must use `transform` and `opacity` only (compositor-only properties) to avoid layout thrashing.
- **NFR-01.4**: Staggered animations must not delay meaningful content by more than 1 second from page navigation.

### NFR-02: Accessibility
- **NFR-02.1**: Color contrast ratio must meet WCAG AA minimum (4.5:1 for normal text, 3:1 for large text).
- **NFR-02.2**: All interactive elements must have visible focus indicators (`:focus-visible`).
- **NFR-02.3**: Top nav links must be keyboard-navigable (Tab key).
- **NFR-02.4**: `prefers-reduced-motion` media query must be respected — all animations disabled or reduced to opacity-only transitions.

### NFR-03: Responsive Design
- **NFR-03.1**: Layout must be usable at viewport widths ≥ 375px.
- **NFR-03.2**: At ≤768px: single-column layout, reduced padding (20px), collapsed nav to hamburger menu.

### NFR-04: Maintainability
- **NFR-04.1**: CSS variables must remain the single source of truth for all design tokens. No hardcoded color/typography values in component inline styles.
- **NFR-04.2**: New typography scale must be used consistently across all components — no ad-hoc font-size values.

### NFR-05: Consistency
- **NFR-05.1**: All pages must use the same visual language (colors, typography, spacing, border-radius) — no per-page style overrides.
- **NFR-05.2**: DataTable component used on Sessions page must render consistently with the design system specified in FR-09.2 and FR-14.

---

## Constraints

### C-01: Data Logic Untouched
- **C-01.1**: Do NOT modify any data-fetching or data-processing files: `src/utils/dataLoader.ts`, `src/utils/costCalculator.ts`, `src/utils/overviewDataProcessor.ts`, `src/utils/sync.ts`, `src/stores/appStore.ts`.
- **C-01.2**: Do NOT add new fetch calls, API endpoints, or data queries. All new UI features must use data already available from existing fetches.
- **C-01.3**: `dataLoader.ts` silently returns `[]` on fetch failures — this behavior must not be changed.

### C-02: Technology Stack
- **C-02.1**: React 19, TypeScript (strict mode), React Router v7, Zustand 5, Recharts 3.8, Lucide React 1.16, Vite 8.
- **C-02.2**: TypeScript strict mode requirements: `verbatimModuleSyntax: true` (use `import type` for type-only imports), `erasableSyntaxOnly: true` (no enum/namespace/parameter properties), `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`.
- **C-02.3**: ESLint flat config must pass — no lint errors introduced.
- **C-02.4**: `tsc -b` must pass — type errors block Vite build.
- **C-02.5**: New dependency: `motion` (framer-motion) for animations.

### C-03: Project Structure
- **C-03.1**: Keep existing project structure — `src/components/`, `src/pages/`, `src/utils/`, `src/stores/`, `src/types/`.
- **C-03.2**: 6 routes must be maintained: `/`, `/sessions`, `/sessions/:id`, `/providers`, `/models`, `/agents`, `/skills`.

### C-04: Build & Environment
- **C-04.1**: `npm run sync` → `npm run build` build order must continue to work.
- **C-04.2**: Windows-first environment (sync script auto-detects `%USERPROFILE%`, `AppData` paths).
- **C-04.3**: No test runner, CI, or env files in this repo — no new infrastructure added.

### C-05: User Constraints
- **C-05.1**: Any improvisation or deviation from the requirements above must be reviewed with the user before implementation.

---

## Resolved Questions

- ✅ **RQ-01 (was OQ-01)**: Brand icon uses Lucide React icon (e.g., `Code2`, `Terminal`, `Box`, or `Cpu`) — not text ◆. Specific icon choice deferred to implementation. See FR-05.3.
- ✅ **RQ-02 (was OQ-02)**: "Last sync" timestamp is static — calculated once on page load, updated only when user clicks Sync (which triggers full page reload). No live updating. See FR-06.4.
- ✅ **RQ-03 (was OQ-03)**: Quick stats appear on ALL pages (not only Overview). Requires global data sharing strategy for `overview.json`. See FR-05.6.
- ✅ **RQ-04 (was OQ-04)**: Layout changes for data pages:
  - Providers + Models: Combined **Grouped Explorer** — providers as expandable section headers with nested models. See FR-11.
  - Agents & Skills: **Compact Registry** — single-column vertical list with inline metadata. See FR-12.
  - Navigation implications: See FR-13.
- ✅ **RQ-05 (was OQ-05)**: Code blocks in Session Detail messages receive special CSS-only rendering — darker background, JetBrains Mono, border-left accent, inline code styling. No external syntax highlighting library. See FR-10.5.

---

Version: 1 | Author: analyst | Date: 2026-05-25

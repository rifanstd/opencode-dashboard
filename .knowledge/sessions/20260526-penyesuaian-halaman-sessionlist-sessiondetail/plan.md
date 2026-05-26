# Implementation Plan: Penyesuaian Halaman SessionList dan SessionDetail

## Reference
- Requirements: `.knowledge/sessions/20260526-penyesuaian-halaman-sessionlist-sessiondetail/requirements.md` v1
- Project Context: `.knowledge/project.md` (does not exist)

## Architecture

All changes are confined to the client-side React layer. No backend or npm dependencies are introduced. Data continues to flow from `public/data/*.json` via `dataLoader.ts`. The plan addresses two independent page surfaces (SessionList and SessionDetail) that share a common data-layer fix (`loadPricing` + `Session` type extension). We fix the data layer first, then adjust SessionList, then SessionDetail.

Key patterns:
- **Inline styles** with CSS custom properties (`var(--*)`) for all visual styling.
- **CSS classes in `src/index.css`** only where media queries are required (detail-card responsive grid).
- **`useMemo`** for all derived data (filtering, pagination, message grouping).
- **Shared utility** `shortenModelName` used by both pages.

## Decision Points

- [x] **Q1 — Info bar content:** Summary sentence (message count, tokens, cost, short model name).
- [x] **Q2 — Date filter UX:** Quick filters coexist with custom From/To pickers; quick filters reset pickers, manual picker changes deselect quick filter.
- [x] **Q3 — Model provider data source:** Extend `Session` type with `model_provider` and rely on sync script (already outputs it).
- [x] **Q4 — Message grouping scope:** All non-user/non-assistant messages are collapsible.
- [x] **CSS media queries:** Add minimal component-specific classes to `src/index.css` for the detail-card grid (required because inline styles cannot express media queries).

## Task Breakdown

---

### Task 1: Extend Session Type and Fix loadPricing

**Description:**
Add `model_provider` to the `Session` interface so TypeScript knows about the field already written by the sync script. Fix `loadPricing` in `costCalculator.ts` so it correctly consumes the `ModelInfo[]` array returned by `loadModels()` and maps pricing by `model.id` instead of array index.

**Files affected:**
- `src/types/index.ts`
- `src/utils/costCalculator.ts`

**Dependency:** None (first task)

**Definition of Done:**
- `Session` interface includes `model_provider?: string | null`.
- `loadPricing` accepts `ModelInfo[]` and returns a `Map<string, Pricing>` keyed by `model.id`.
- `npm run build` still passes.

**Complexity:** low

**Steps:**

- [ ] **Step 1: Add `model_provider` to Session interface**

  In `src/types/index.ts`, add the field after `model_id`:
  ```typescript
  export interface Session {
    id: string
    title: string
    project_id: string | null
    model_id: string | null
    model_provider: string | null   // <-- add this line
    created_at: string
    updated_at: string
    input_tokens: number
    output_tokens: number
    reasoning_tokens: number
    cache_tokens: number
    total_tokens: number
    cost: number | null
  }
  ```

- [ ] **Step 2: Fix `loadPricing` to accept `ModelInfo[]`**

  In `src/utils/costCalculator.ts`, replace the existing `loadPricing` function with:
  ```typescript
  import type { ModelInfo } from '../types/index.ts'

  export function loadPricing(models: ModelInfo[]): Map<string, Pricing> {
    const map = new Map<string, Pricing>()
    if (!Array.isArray(models)) return map

    for (const model of models) {
      if (!model || typeof model !== 'object') continue
      const pricing: Pricing = {
        input: Number(model.input_price ?? 0),
        output: Number(model.output_price ?? 0),
        reasoning: model.reasoning_price != null ? Number(model.reasoning_price) : undefined,
        cache: model.cache_price != null ? Number(model.cache_price) : undefined,
      }
      map.set(model.id, pricing)
    }
    return map
  }
  ```

  Also update the import at the top of `costCalculator.ts`:
  ```typescript
  import type { Granularity, ModelInfo } from '../types/index.ts'
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add src/types/index.ts src/utils/costCalculator.ts
  git commit -m "fix: add model_provider to Session type and fix loadPricing for ModelInfo[]"
  ```

---

### Task 2: Create Shared Model Shortening Utility

**Description:**
Create a small shared utility `shortenModelName` that both pages can import. It handles the three patterns: `accounts/<provider>/models/<model>`, already-prefixed `<provider>/<model>`, and bare model names with an optional `model_provider` hint.

**Files affected:**
- `src/utils/modelUtils.ts` (create)

**Dependency:** Task 1 (uses `model_provider` concept)

**Definition of Done:**
- `shortenModelName` exists and returns correct shortened names for all three patterns.
- No TypeScript errors.

**Complexity:** low

**Steps:**

- [ ] **Step 1: Create utility file**

  Create `src/utils/modelUtils.ts`:
  ```typescript
  export function shortenModelName(
    modelId: string | null,
    modelProvider?: string | null
  ): string {
    if (!modelId) return '—'

    // Pattern 1: accounts/<provider>/models/<model>
    const accountsMatch = modelId.match(/^accounts\/([^/]+)\/models\/(.+)$/)
    if (accountsMatch) {
      return `${accountsMatch[1]}/${accountsMatch[2]}`
    }

    // Pattern 2: already has provider prefix
    const slashMatch = modelId.match(/^([^/]+)\/(.+)$/)
    if (slashMatch) {
      return modelId
    }

    // Pattern 3: generic name — add provider hint if available
    if (modelProvider) {
      return `${modelProvider}/${modelId}`
    }

    // Fallback: unrecognizable, keep as-is
    return modelId
  }
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add src/utils/modelUtils.ts
  git commit -m "feat: add shortenModelName utility"
  ```

---

### Task 3: SessionList — Single Search Field (FR-01)

**Description:**
Remove the separate "Project" and "Model" filter inputs. Keep only the search input. Expand the search logic so it matches against session title, project name, and model name (case-insensitive substring). Update `filtered` `useMemo` accordingly.

**Files affected:**
- `src/pages/SessionsList.tsx`

**Dependency:** Task 2 (uses `shortenModelName` for model name matching, or we can match against raw `model_id` since search is internal)

**Definition of Done:**
- Only one text input remains in the filter bar.
- Searching for a string that appears only in the project name includes that session.
- Searching for a string that appears only in `model_id` includes that session.

**Complexity:** low

**Steps:**

- [ ] **Step 1: Remove separate filter states and inputs**

  In `src/pages/SessionsList.tsx`:
  - Delete `projectFilter` and `modelFilter` state lines.
  - Delete the two `<input>` elements for Project and Model.
  - Remove `projectFilter` and `modelFilter` from the `filtered` `useMemo` dependency array.
  - Remove the `if (projectFilter) { ... }` and `if (modelFilter) { ... }` blocks inside `filtered`.

- [ ] **Step 2: Expand search matching logic**

  Inside the `filtered` `useMemo`, the existing search block becomes:
  ```typescript
  if (search) {
    const q = search.toLowerCase()
    result = result.filter((s) => {
      const projectName = s.project_id ? (projectNameMap.get(s.project_id) ?? s.project_id) : ''
      const modelName = s.model_id ?? ''
      return (
        s.title.toLowerCase().includes(q) ||
        projectName.toLowerCase().includes(q) ||
        modelName.toLowerCase().includes(q)
      )
    })
  }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add src/pages/SessionsList.tsx
  git commit -m "feat(SessionList): single search field filtering title, project, and model (FR-01)"
  ```

---

### Task 4: SessionList — Date Quick Filters + Labels (FR-02, FR-03)

**Description:**
Add quick-filter buttons (Today, This Week, This Month, This Year) alongside the existing From/To date pickers. Give the pickers visible "From" and "To" labels. Clicking a quick filter sets the date range and deselects any other quick filter. Manually changing a date picker clears the active quick filter.

**Files affected:**
- `src/pages/SessionsList.tsx`

**Dependency:** Task 3

**Definition of Done:**
- Four quick-filter buttons exist and restrict results correctly.
- Only one quick filter active at a time.
- Date pickers have visible "From" and "To" labels.
- Manual date picker change deselects the quick filter.

**Complexity:** medium

**Steps:**

- [ ] **Step 1: Add quick-filter state and helper**

  At the top of the component, add:
  ```typescript
  type QuickFilter = 'today' | 'week' | 'month' | 'year'
  const [quickFilter, setQuickFilter] = useState<QuickFilter | null>(null)
  ```

  Add a helper function inside the component (before the `useEffect`):
  ```typescript
  function getQuickFilterRange(filter: QuickFilter): { from: string; to: string } {
    const now = new Date()
    const iso = (d: Date) => d.toISOString().slice(0, 10)

    switch (filter) {
      case 'today':
        return { from: iso(now), to: iso(now) }
      case 'week': {
        const day = now.getDay() || 7
        const monday = new Date(now)
        monday.setDate(now.getDate() - day + 1)
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)
        return { from: iso(monday), to: iso(sunday) }
      }
      case 'month': {
        const first = new Date(now.getFullYear(), now.getMonth(), 1)
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        return { from: iso(first), to: iso(last) }
      }
      case 'year': {
        const first = new Date(now.getFullYear(), 0, 1)
        const last = new Date(now.getFullYear(), 11, 31)
        return { from: iso(first), to: iso(last) }
      }
    }
  }
  ```

- [ ] **Step 2: Add quick-filter button handlers**

  Create a handler:
  ```typescript
  const applyQuickFilter = (filter: QuickFilter) => {
    const range = getQuickFilterRange(filter)
    setQuickFilter(filter)
    setDateFrom(range.from)
    setDateTo(range.to)
    setPage(0)
  }
  ```

  Update the date-picker `onChange` handlers:
  ```typescript
  <input
    type="date"
    value={dateFrom}
    onChange={(e) => { setDateFrom(e.target.value); setQuickFilter(null); setPage(0) }}
    style={filterInputStyle}
  />
  <input
    type="date"
    value={dateTo}
    onChange={(e) => { setDateTo(e.target.value); setQuickFilter(null); setPage(0) }}
    style={filterInputStyle}
  />
  ```

- [ ] **Step 3: Render quick-filter buttons and labels**

  Replace the filter bar JSX with:
  ```tsx
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
    {/* Search input (existing, keep as-is) */}
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <Search size={14} style={{ position: 'absolute', left: 8, color: 'var(--text-muted)', pointerEvents: 'none' }} />
      <input
        type="text"
        placeholder="Search…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0) }}
        style={{ ...filterInputStyle, minWidth: 200, paddingLeft: 28 }}
      />
    </div>

    {/* Quick filters */}
    {(['today', 'week', 'month', 'year'] as QuickFilter[]).map((qf) => {
      const active = quickFilter === qf
      return (
        <button
          key={qf}
          type="button"
          onClick={() => applyQuickFilter(qf)}
          style={{
            fontFamily: 'var(--sans)',
            fontSize: 12,
            height: 32,
            padding: '0 12px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            background: active ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
            color: active ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: 'pointer',
            textTransform: 'capitalize',
          }}
        >
          {qf === 'week' ? 'This Week' : qf === 'month' ? 'This Month' : qf === 'year' ? 'This Year' : 'Today'}
        </button>
      )
    })}

    {/* Date pickers with labels */}
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-muted)' }}>
      From
      <input
        type="date"
        value={dateFrom}
        onChange={(e) => { setDateFrom(e.target.value); setQuickFilter(null); setPage(0) }}
        style={filterInputStyle}
      />
    </label>
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-muted)' }}>
      To
      <input
        type="date"
        value={dateTo}
        onChange={(e) => { setDateTo(e.target.value); setQuickFilter(null); setPage(0) }}
        style={filterInputStyle}
      />
    </label>
  </div>
  ```

- [ ] **Step 4: Commit**
  ```bash
  git add src/pages/SessionsList.tsx
  git commit -m "feat(SessionList): date quick filters and labeled date pickers (FR-02, FR-03)"
  ```

---

### Task 5: SessionList — Pagination 20 Items (FR-04)

**Description:**
Change the page size from 50 to 20. Update the pagination controls text accordingly.

**Files affected:**
- `src/pages/SessionsList.tsx`

**Dependency:** Task 4

**Definition of Done:**
- Table shows max 20 rows per page.
- Pagination indicator and buttons work correctly for any total count.

**Complexity:** low

**Steps:**

- [ ] **Step 1: Change pageSize constant**

  In `src/pages/SessionsList.tsx`, change:
  ```typescript
  const pageSize = 50
  ```
  to:
  ```typescript
  const pageSize = 20
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add src/pages/SessionsList.tsx
  git commit -m "feat(SessionList): reduce pagination to 20 items per page (FR-04)"
  ```

---

### Task 6: SessionList — Model Name Shortening (FR-05)

**Description:**
In the DataTable Model column, render shortened model names using the `shortenModelName` utility. Import the utility and apply it in the column `render` function.

**Files affected:**
- `src/pages/SessionsList.tsx`

**Dependency:** Task 2

**Definition of Done:**
- A session with `model_id = "accounts/fireworks/models/kimi-k2p6"` renders as `fireworks/kimi-k2p6`.
- If provider cannot be determined, raw ID is shown.

**Complexity:** low

**Steps:**

- [ ] **Step 1: Import utility and update column render**

  Add import:
  ```typescript
  import { shortenModelName } from '../utils/modelUtils.ts'
  ```

  Update the DataTable `columns` array:
  ```typescript
  { key: 'model_id', header: 'Model', render: (s) => shortenModelName(s.model_id, s.model_provider) },
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add src/pages/SessionsList.tsx
  git commit -m "feat(SessionList): shorten model names in table column (FR-05)"
  ```

---

### Task 7: SessionDetail — Info Bar Differentiation (FR-06)

**Description:**
Replace the info bar content with a summary sentence that does not duplicate the detail cards. The sentence format is: `{messageCount} messages · {totalTokens} tokens · {cost} · {shortModelName}`.

**Files affected:**
- `src/pages/SessionDetail.tsx`

**Dependency:** Task 2 (uses `shortenModelName`)

**Definition of Done:**
- Info bar shows message count, formatted token count, formatted cost, and shortened model name.
- Info bar does **not** contain the raw model ID, full project name, full date string, or formatted cost from the detail cards.

**Complexity:** low

**Steps:**

- [ ] **Step 1: Compute summary values and render**

  In `src/pages/SessionDetail.tsx`, import `shortenModelName`:
  ```typescript
  import { shortenModelName } from '../utils/modelUtils.ts'
  ```

  Replace the existing info bar JSX:
  ```tsx
  {/* Info bar */}
  <div
    style={{
      fontFamily: 'var(--sans)',
      fontSize: 13,
      color: 'var(--text-muted)',
      marginBottom: 24,
    }}
  >
    {messages.length} messages · {formatNumber(session.total_tokens)} tokens · {session.cost != null ? formatCost(session.cost) : '—'} · {shortenModelName(session.model_id, session.model_provider)}
  </div>
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add src/pages/SessionDetail.tsx
  git commit -m "feat(SessionDetail): info bar shows summary sentence (FR-06)"
  ```

---

### Task 8: SessionDetail — Detail Cards Layout & Overflow (FR-07, FR-08, FR-09, NFR-03)

**Description:**
Restyle the detail cards grid so all four cards have equal width and height on desktop (exactly 4 columns at ≥1024 px, filling the full width). Prevent text overflow inside cards with `overflow-wrap` / `text-overflow: ellipsis`. Add responsive fallbacks (2 columns below 1024 px, 1 column below 640 px) via CSS classes in `src/index.css`.

**Files affected:**
- `src/pages/SessionDetail.tsx`
- `src/index.css`

**Dependency:** Task 7

**Definition of Done:**
- At 1280 px viewport, all four cards have identical width and height.
- Long model IDs and project names do not overflow horizontally.
- Responsive fallbacks work as specified.

**Complexity:** medium

**Steps:**

- [ ] **Step 1: Add responsive grid CSS classes to `src/index.css`**

  Append to the bottom of `src/index.css`:
  ```css
  .detail-cards-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(4, 1fr);
  }

  @media (max-width: 1023px) {
    .detail-cards-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 639px) {
    .detail-cards-grid {
      grid-template-columns: 1fr;
    }
  }

  .detail-card {
    background: var(--bg-secondary);
    border-radius: 6px;
    padding: 20px;
    overflow: hidden;
    min-width: 0;
  }

  .detail-card-label {
    font-family: var(--sans);
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .detail-card-value {
    font-family: var(--sans);
    font-size: 13px;
    color: var(--text-primary);
    overflow-wrap: break-word;
    word-break: break-word;
  }
  ```

- [ ] **Step 2: Replace inline card styles with CSS classes in SessionDetail**

  In `src/pages/SessionDetail.tsx`, replace the detail cards grid and card markup:

  Replace:
  ```tsx
  {/* Detail Cards */}
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
      gap: 12,
      marginBottom: 24,
    }}
  >
    <div style={cardStyle}>
      <div style={cardLabelStyle}>Model</div>
      <div style={cardValueStyle}>{session.model_id ?? '—'}</div>
    </div>
    <div style={cardStyle}>
      <div style={cardLabelStyle}>Project</div>
      <div style={cardValueStyle}>{projectName ?? '—'}</div>
    </div>
    <div style={cardStyle}>
      <div style={cardLabelStyle}>Date</div>
      <div style={cardValueStyle}>{new Date(session.created_at).toLocaleString()}</div>
    </div>
    <div style={cardStyle}>
      <div style={cardLabelStyle}>Cost</div>
      <div style={cardValueStyle}>{session.cost != null ? formatCost(session.cost) : '—'}</div>
    </div>
  </div>
  ```

  With:
  ```tsx
  {/* Detail Cards */}
  <div className="detail-cards-grid" style={{ marginBottom: 24 }}>
    <div className="detail-card">
      <div className="detail-card-label">Model</div>
      <div className="detail-card-value">{shortenModelName(session.model_id, session.model_provider)}</div>
    </div>
    <div className="detail-card">
      <div className="detail-card-label">Project</div>
      <div className="detail-card-value">{projectName ?? '—'}</div>
    </div>
    <div className="detail-card">
      <div className="detail-card-label">Date</div>
      <div className="detail-card-value">{new Date(session.created_at).toLocaleString()}</div>
    </div>
    <div className="detail-card">
      <div className="detail-card-label">Cost</div>
      <div className="detail-card-value">{session.cost != null ? formatCost(session.cost) : '—'}</div>
    </div>
  </div>
  ```

  Note: The Model card now also uses `shortenModelName` for consistency.

- [ ] **Step 3: Commit**
  ```bash
  git add src/pages/SessionDetail.tsx src/index.css
  git commit -m "feat(SessionDetail): equal-width detail cards, 4-col desktop grid, text overflow prevention (FR-07, FR-08, FR-09)"
  ```

---

### Task 9: SessionDetail — Cost Card Fix (FR-10)

**Description:**
Ensure the Cost detail card displays a numeric cost (including `$0`) whenever the session has a model ID, non-zero tokens, and pricing data is available. The root cause is the broken `loadPricing` function (fixed in Task 1); verify the fix propagates correctly and that cost computation covers all token types.

**Files affected:**
- `src/pages/SessionDetail.tsx`
- `src/pages/SessionsList.tsx`

**Dependency:** Task 1, Task 8

**Definition of Done:**
- A session with `input_tokens=1000`, `output_tokens=500`, known `model_id`, and valid pricing shows a non-"—" cost.
- Cost shows `$0` when tokens exist but cost rounds to zero.
- "—" only appears when `model_id` is missing, all tokens are zero, or no pricing exists.

**Complexity:** low

**Steps:**

- [ ] **Step 1: Verify cost computation in SessionDetail**

  In `src/pages/SessionDetail.tsx`, the existing cost block is:
  ```typescript
  const pricingMap = loadPricing(models)
  let cost: number | null = null
  if (s.model_id && pricingMap.has(s.model_id)) {
    cost = calculateCost(
      {
        input: s.input_tokens,
        output: s.output_tokens,
        reasoning: s.reasoning_tokens,
        cache: s.cache_tokens,
      },
      pricingMap.get(s.model_id)!
    )
  }
  ```

  After Task 1, `loadPricing(models)` now works correctly with `ModelInfo[]`. No further code change is needed in SessionDetail **unless** we want to show `$0` instead of `—` when cost is exactly `0`. The current `formatCost(0)` returns `'$0'`, and the render is:
  ```tsx
  {session.cost != null ? formatCost(session.cost) : '—'}
  ```
  This is already correct: `cost = 0` means `cost != null` is true, so it renders `$0`.

  However, we must ensure cost is computed even when total tokens are zero but a model and pricing exist. The current `if (s.model_id && pricingMap.has(s.model_id))` does not check token count, so it already computes cost regardless of tokens. Good.

  One edge case: if `calculateCost` returns `0` due to zero pricing, `cost` will be `0` (not `null`), and the UI will show `$0`. This satisfies FR-10.

- [ ] **Step 2: Verify cost computation in SessionsList**

  In `src/pages/SessionsList.tsx`, the same `loadPricing` fix applies. The existing code:
  ```typescript
  const sessionsWithCost = sessions.map((s) => {
    if (s.model_id && pricingMap.has(s.model_id)) {
      const pricing = pricingMap.get(s.model_id)!
      const cost = calculateCost(...)
      return { ...s, cost }
    }
    return s
  })
  ```
  After Task 1, `pricingMap.has(s.model_id)` will correctly match model IDs. No code change needed here unless we want to explicitly compute cost for sessions that previously had `cost: null` in the JSON. The requirement says "must display the actual computed cost", so computing it from pricing is correct.

- [ ] **Step 3: Commit (if no changes, skip; otherwise commit)**

  If no file changes were required beyond Task 1, note in the commit message that this task is verified by the `loadPricing` fix:
  ```bash
  git commit --allow-empty -m "fix(SessionDetail/SessionsList): cost card now works correctly thanks to loadPricing fix (FR-10)"
  ```

---

### Task 10: SessionDetail — Merge Consecutive Assistant Messages (FR-11)

**Description:**
Group consecutive `assistant` messages into a single rendered card. The grouped card must preserve chronological order and show a subtle visual separator (or count indicator) between individual assistant turns.

**Files affected:**
- `src/pages/SessionDetail.tsx`

**Dependency:** Task 8

**Definition of Done:**
- Given messages `[assistant-1, assistant-2, assistant-3, user-1]`, the UI renders one grouped assistant card followed by one user card.
- Individual assistant messages inside the group remain in order.

**Complexity:** medium

**Steps:**

- [ ] **Step 1: Add message grouping logic with `useMemo`**

  Inside `SessionDetail`, after the `projectNameMap` memo, add:
  ```typescript
  type MessageGroup =
    | { type: 'user'; message: Message }
    | { type: 'assistant'; messages: Message[] }
    | { type: 'other'; message: Message }

  const messageGroups = useMemo<MessageGroup[]>(() => {
    const groups: MessageGroup[] = []
    let assistantBuffer: Message[] = []

    for (const msg of messages) {
      if (msg.role === 'assistant') {
        assistantBuffer.push(msg)
      } else {
        if (assistantBuffer.length > 0) {
          groups.push({ type: 'assistant', messages: assistantBuffer })
          assistantBuffer = []
        }
        groups.push({ type: msg.role === 'user' ? 'user' : 'other', message: msg })
      }
    }

    if (assistantBuffer.length > 0) {
      groups.push({ type: 'assistant', messages: assistantBuffer })
    }

    return groups
  }, [messages])
  ```

- [ ] **Step 2: Replace message list rendering with grouped rendering**

  Replace the existing messages map:
  ```tsx
  {messages.map((msg) => (
    <div key={msg.id} ...>
      ...
    </div>
  ))}
  ```

  With:
  ```tsx
  {messageGroups.map((group, groupIndex) => {
    if (group.type === 'assistant') {
      return (
        <div
          key={`assistant-group-${groupIndex}`}
          style={{
            padding: 16,
            borderRadius: 6,
            background: 'var(--bg-tertiary)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span
              style={{
                fontFamily: 'var(--sans)',
                fontSize: 11,
                textTransform: 'uppercase',
                color: 'var(--success)',
              }}
            >
              assistant {group.messages.length > 1 ? `(${group.messages.length} turns)` : ''}
            </span>
          </div>
          {group.messages.map((msg, idx) => (
            <div key={msg.id}>
              {idx > 0 && (
                <div
                  style={{
                    borderTop: '1px solid var(--border)',
                    margin: '12px 0',
                    opacity: 0.5,
                  }}
                />
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-muted)' }}>
                  Turn {idx + 1}
                </span>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-muted)' }}>
                  {new Date(msg.created_at).toLocaleString()}
                </span>
              </div>
              {msg.content && (
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--sans)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {parseContent(msg.content)}
                </div>
              )}
              {partsMap[msg.id]?.map((part) => (
                <div key={part.id} style={{ marginTop: 8, padding: 10, borderRadius: 6, background: 'rgba(0,0,0,0.2)' }}>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                    {part.type}
                    {part.tool_name ? ` — ${part.tool_name}` : ''}
                  </div>
                  {part.content && (
                    <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {part.content}
                    </div>
                  )}
                  {part.tool_input && (
                    <code style={{ display: 'block', marginTop: 4, fontFamily: 'var(--mono)', fontSize: 12 }}>
                      {part.tool_input}
                    </code>
                  )}
                  {part.tool_output && (
                    <code style={{ display: 'block', marginTop: 4, fontFamily: 'var(--mono)', fontSize: 12 }}>
                      {part.tool_output}
                    </code>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )
    }

    const msg = group.type === 'user' ? group.message : group.message
    const roleColor = msg.role === 'user' ? 'var(--accent)' : 'var(--text-secondary)'

    return (
      <div
        key={msg.id}
        style={{
          padding: 16,
          borderRadius: 6,
          background: 'var(--bg-tertiary)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 11,
              textTransform: 'uppercase',
              color: roleColor,
            }}
          >
            {msg.role}
          </span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-muted)' }}>
            {new Date(msg.created_at).toLocaleString()}
          </span>
        </div>
        {msg.content && (
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--sans)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {parseContent(msg.content)}
          </div>
        )}
        {partsMap[msg.id]?.map((part) => (
          <div key={part.id} style={{ marginTop: 8, padding: 10, borderRadius: 6, background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
              {part.type}
              {part.tool_name ? ` — ${part.tool_name}` : ''}
            </div>
            {part.content && (
              <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-secondary)' }}>
                {part.content}
              </div>
            )}
            {part.tool_input && (
              <code style={{ display: 'block', marginTop: 4, fontFamily: 'var(--mono)', fontSize: 12 }}>
                {part.tool_input}
              </code>
            )}
            {part.tool_output && (
              <code style={{ display: 'block', marginTop: 4, fontFamily: 'var(--mono)', fontSize: 12 }}>
                {part.tool_output}
              </code>
            )}
          </div>
        ))}
      </div>
    )
  })}
  ```

  Note: The `other` type (non-user/non-assistant) will be handled in Task 11 (FR-12) with collapsible containers. For now, it renders as a normal card, which is acceptable because Task 11 will wrap it.

- [ ] **Step 3: Commit**
  ```bash
  git add src/pages/SessionDetail.tsx
  git commit -m "feat(SessionDetail): merge consecutive assistant messages into grouped card (FR-11)"
  ```

---

### Task 11: SessionDetail — Collapsible Non-Standard Messages (FR-12, NFR-05)

**Description:**
Render messages whose `role` is neither `'user'` nor `'assistant'` inside an expandable/collapsible container. Default state is collapsed, showing only a header with role name and timestamp. Clicking the header (or pressing Enter/Space) toggles expansion. Use a `<button>` element for the header to satisfy keyboard accessibility automatically.

**Files affected:**
- `src/pages/SessionDetail.tsx`

**Dependency:** Task 10

**Definition of Done:**
- A `system` message renders as a collapsed bar initially.
- Clicking expands to reveal content; clicking again collapses.
- Header is keyboard-focusable and operable via Enter/Space.

**Complexity:** medium

**Steps:**

- [ ] **Step 1: Add expand/collapse state**

  Inside `SessionDetail`, add state:
  ```typescript
  const [expandedOthers, setExpandedOthers] = useState<Set<string>>(new Set())
  ```

  Add a toggle helper:
  ```typescript
  const toggleOther = (msgId: string) => {
    setExpandedOthers((prev) => {
      const next = new Set(prev)
      if (next.has(msgId)) {
        next.delete(msgId)
      } else {
        next.add(msgId)
      }
      return next
    })
  }
  ```

- [ ] **Step 2: Update the `other` branch in message group rendering**

  In the `messageGroups.map` render from Task 10, replace the `group.type === 'other'` return value with:

  ```tsx
  const msg = group.message
  const isExpanded = expandedOthers.has(msg.id)

  return (
    <div
      key={msg.id}
      style={{
        borderRadius: 6,
        background: 'var(--bg-tertiary)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => toggleOther(msg.id)}
        aria-expanded={isExpanded}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--sans)',
          fontSize: 11,
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          textAlign: 'left',
        }}
      >
        <span>
          {msg.role} {isExpanded ? '▾' : '▸'}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          {new Date(msg.created_at).toLocaleString()}
        </span>
      </button>
      {isExpanded && (
        <div style={{ padding: '0 16px 16px' }}>
          {msg.content && (
            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--sans)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {parseContent(msg.content)}
            </div>
          )}
          {partsMap[msg.id]?.map((part) => (
            <div key={part.id} style={{ marginTop: 8, padding: 10, borderRadius: 6, background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                {part.type}
                {part.tool_name ? ` — ${part.tool_name}` : ''}
              </div>
              {part.content && (
                <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {part.content}
                </div>
              )}
              {part.tool_input && (
                <code style={{ display: 'block', marginTop: 4, fontFamily: 'var(--mono)', fontSize: 12 }}>
                  {part.tool_input}
                </code>
              )}
              {part.tool_output && (
                <code style={{ display: 'block', marginTop: 4, fontFamily: 'var(--mono)', fontSize: 12 }}>
                  {part.tool_output}
                </code>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add src/pages/SessionDetail.tsx
  git commit -m "feat(SessionDetail): collapsible containers for non-user/non-assistant messages (FR-12)"
  ```

---

### Task 12: Build Verification (NFR-01, NFR-02, NFR-04)

**Description:**
Run the TypeScript build to confirm strict mode compliance. Ensure no new dependencies were introduced. Spot-check that `useMemo` is used for all heavy derived state.

**Files affected:**
- All modified files (verification only)

**Dependency:** All previous tasks

**Definition of Done:**
- `npm run build` exits with code 0 and no type errors.
- `npm run lint` passes (if it reveals issues introduced by changes, fix them).
- No new entries in `package.json` dependencies.

**Complexity:** low

**Steps:**

- [ ] **Step 1: Run build**
  ```bash
  npm run build
  ```
  Expected: clean exit, no `tsc` errors.

- [ ] **Step 2: Run lint**
  ```bash
  npm run lint
  ```
  Expected: no new lint errors.

- [ ] **Step 3: Fix any type or lint issues**

  Common issues to watch for:
  - `verbatimModuleSyntax`: ensure `import type` is used for type-only imports.
  - `noUnusedLocals` / `noUnusedParameters`: remove any unused variables introduced during refactoring.
  - `noFallthroughCasesInSwitch`: ensure all `switch` cases in `getQuickFilterRange` have `return` or `break`.

- [ ] **Step 4: Final commit**
  ```bash
  git add -A
  git commit -m "chore: verify build and lint pass after SessionList/SessionDetail adjustments"
  ```

---

## Dependency Order

```
Task 1 (data layer fix)
  → Task 2 (shared utility)
    → Task 3 (FR-01: single search)
      → Task 4 (FR-02/03: date filters)
        → Task 5 (FR-04: pagination)
          → Task 6 (FR-05: model shortening)
            → Task 7 (FR-06: info bar)
              → Task 8 (FR-07/08/09: cards layout)
                → Task 9 (FR-10: cost fix verification)
                  → Task 10 (FR-11: assistant grouping)
                    → Task 11 (FR-12: collapsible others)
                      → Task 12 (build verification)
```

**Parallelizable:** Tasks 3–6 (SessionList changes) are independent of Tasks 7–11 (SessionDetail changes) **after** Task 1 and Task 2 are complete. In practice, a single programmer will likely do them sequentially.

## Risks & Alternatives

| Risk | Mitigation |
|------|------------|
| **Risk:** `loadPricing` fix changes behavior for other pages that might rely on the old (broken) array-index keys. | **Mitigation:** Search the codebase for all `loadPricing` call sites (only SessionsList and SessionDetail). Both pass `ModelInfo[]`, so the fix is strictly corrective. No other consumers exist. |
| **Risk:** Adding CSS classes to `src/index.css` for the detail-card grid could conflict with future global class names. | **Mitigation:** Use highly specific class names (`.detail-cards-grid`, `.detail-card`). These are unlikely to collide. Alternative: use a `useMediaQuery` hook with inline styles, but that adds runtime overhead and complexity. |
| **Risk:** Message grouping (`useMemo`) could be expensive for sessions with thousands of messages. | **Mitigation:** Grouping is O(n) and runs only when `messages` changes. The dataset is local JSON, so thousands of messages are unlikely. If performance becomes an issue, virtualization (e.g., `react-window`) would be the next step, but that is out of scope. |
| **Risk:** The sync script already outputs `model_provider`, but some sessions may have it as `null` for non-JSON model fields. FR-05 fallback to raw ID must still work. | **Mitigation:** `shortenModelName` handles all three patterns and falls back to raw `modelId` when no provider is determinable. This is explicitly covered in the utility implementation. |
| **Risk:** Date quick-filter logic for "This Week" uses Monday as the start of week, which may not match the user's locale expectation. | **Mitigation:** The requirement does not specify week start; Monday is a conventional default. If user feedback arises, a one-line change to the `monday` calculation can adjust it. |

---

## Self-Review Checklist

**1. Spec coverage:**
- FR-01 → Task 3
- FR-02 → Task 4
- FR-03 → Task 4
- FR-04 → Task 5
- FR-05 → Task 2 + Task 6
- FR-06 → Task 7
- FR-07 → Task 8
- FR-08 → Task 8
- FR-09 → Task 8
- FR-10 → Task 1 + Task 9
- FR-11 → Task 10
- FR-12 → Task 11
- NFR-01 → Task 12
- NFR-02 → enforced throughout (no new npm deps)
- NFR-03 → Task 8 (CSS media queries)
- NFR-04 → Tasks 3, 4, 5, 10 (all use `useMemo`)
- NFR-05 → Task 11 (`<button>` elements for collapsible headers)

**2. Placeholder scan:**
- No "TBD", "TODO", "implement later", or "fill in details" found.
- No vague instructions like "add appropriate error handling".
- All code blocks contain complete, copy-pasteable implementations.

**3. Type consistency:**
- `model_provider` added to `Session` interface in Task 1 and used consistently in Tasks 2, 6, 7, 8.
- `shortenModelName` signature is consistent across all call sites: `(modelId: string \| null, modelProvider?: string \| null)`.
- `loadPricing` signature changed from `(modelsJson: unknown)` to `(models: ModelInfo[])` in Task 1; both call sites updated implicitly because they already pass `ModelInfo[]`.
- `MessageGroup` union type defined in Task 10 and consumed in Task 11 without alteration.

---

Version: 1 | Author: planner | Ref: requirements v1 | Date: 2026-05-26

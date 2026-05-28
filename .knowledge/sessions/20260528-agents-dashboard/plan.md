# Implementation Plan: Agents Dashboard Enhancement

## Reference
- Requirements: `.knowledge/sessions/20260528-agents-dashboard/requirements.md` v1
- Project Context: `.knowledge/project.md` (not present — using AGENTS.md conventions)

## Architecture

The enhancement follows the existing hub-and-spoke data architecture: the sync script (`scripts/sync-opencode-data.js`) reads agent markdown files, parses YAML frontmatter with `js-yaml`, computes usage by matching session titles against `@<name> subagent` patterns, and exports an enriched `agents.json`. The dashboard loads this static JSON client-side and renders a card-based list view (`Agents.tsx`) plus a detail page (`AgentDetail.tsx`) with usage charts, session lists, and prompt previews.

Key design choices:
- **YAML parsing**: Replace the hand-rolled `parseYamlFrontmatter` with `js-yaml` (approved by user) to handle nested `permission` blocks robustly.
- **Usage computation**: Done in the sync script (O(n × m)) by pre-compiling a regex per agent and scanning all exported sessions. This keeps the client-side detail page fast.
- **Detail page data**: The detail page loads `agents.json` + `sessions.json` and filters sessions client-side (same pattern as `SessionDetail`). Time-series and token-breakdown charts are computed client-side from the filtered session subset.
- **Prompt preview**: The sync script exports `content` (full markdown minus frontmatter) in `agents.json`; the detail page truncates client-side.

## Decision Points

- [x] **YAML parser**: Use `js-yaml` dependency (user approved)
- [x] **Agent matching**: Match by both filename (without `.md`) AND markdown heading name (user approved)
- [x] **Hidden agents**: Visible by default with "Hidden" indicator (user approved)
- [x] **Prompt preview**: Render as markdown, show full content minus frontmatter (user approved)
- [x] **Cost calculation**: Pre-computed in sync script using session `cost` fields (user approved)
- [x] **Activity filter**: Daily, Weekly, Monthly, All (user approved)

## Task Breakdown

### Task 1: Add `js-yaml` dependency

- **Description**: Install `js-yaml` as a devDependency (sync script is Node-only, like `sqlite3`).
- **Files affected**: `package.json`
- **Dependency**: None
- **Definition of Done**: `package.json` lists `js-yaml` in `devDependencies`; `package-lock.json` updated after install.
- **Complexity**: low

**Steps:**
1. Run `npm install -D js-yaml`
2. Verify `package.json` contains `"js-yaml": "^4.1.0"` (or latest) in `devDependencies`

---

### Task 2: Update TypeScript interfaces

- **Description**: Extend `AgentInfo` and add `AgentUsage`, `AgentPermissions` interfaces in `src/types/index.ts`. Add a `content` field to `AgentInfo` for the prompt preview.
- **Files affected**: `src/types/index.ts`
- **Dependency**: None
- **Definition of Done**: `tsc -b` passes with the new types; no existing code broken.
- **Complexity**: low

**Exact additions to `src/types/index.ts`:**

Insert after line 72 (after existing `AgentInfo`):

```typescript
export interface AgentPermissions {
  edit: 'allow' | 'deny' | null
  bash: 'allow' | 'deny' | null
  glob: 'allow' | 'deny' | null
}

export interface AgentUsage {
  sessionCount: number
  totalTokens: number
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  cacheTokens: number
  totalCost: number
  lastUsed: string | null
}

export interface AgentInfo {
  name: string
  description: string
  filename: string
  mode: 'primary' | 'subagent' | null
  hidden: boolean
  temperature: number | null
  permissions: AgentPermissions
  usage: AgentUsage
  content: string
}
```

Remove the old `AgentInfo` interface (lines 68–72) so there is only one definition.

---

### Task 3: Enhance sync script — YAML frontmatter parsing

- **Description**: Replace the hand-rolled `parseYamlFrontmatter` with a `js-yaml` based version that handles nested objects. Add a helper to strip frontmatter from markdown content. Update agent extraction to read all metadata fields.
- **Files affected**: `scripts/sync-opencode-data.js`
- **Dependency**: Task 1 (js-yaml installed)
- **Definition of Done**: `npm run sync` produces `agents.json` with `mode`, `hidden`, `temperature`, `permissions`, and `content` fields for every agent.
- **Complexity**: medium

**Steps:**

1. **Add import at top of file** (after existing imports, line 5):

```javascript
import yaml from 'js-yaml'
```

2. **Replace `parseYamlFrontmatter` function** (lines 159–185) with:

```javascript
function parseYamlFrontmatter(text) {
  if (!text || typeof text !== 'string') return {}
  const trimmed = text.trimStart()
  if (!trimmed.startsWith('---')) return {}
  const endIdx = trimmed.indexOf('\n---', 4)
  if (endIdx === -1) return {}
  const block = trimmed.slice(3, endIdx).trim()
  try {
    return yaml.load(block) || {}
  } catch {
    return {}
  }
}
```

3. **Add `extractContentWithoutFrontmatter` helper** after `parseYamlFrontmatter`:

```javascript
function extractContentWithoutFrontmatter(text) {
  if (!text || typeof text !== 'string') return ''
  const trimmed = text.trimStart()
  if (!trimmed.startsWith('---')) return trimmed
  const endIdx = trimmed.indexOf('\n---', 4)
  if (endIdx === -1) return trimmed
  return trimmed.slice(endIdx + 4).trim()
}
```

4. **Add `escapeRegex` helper** after the above:

```javascript
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
```

5. **Update the agent extraction block** (lines 634–663) to:

```javascript
  // Agents from agents/*.md
  if (paths.config) {
    const agentsDir = path.join(paths.config, 'agents')
    const agentFiles = readTextFiles(agentsDir, '.md')
    for (const file of agentFiles) {
      const lines = file.content.split('\n')
      let name = 'Unnamed Agent'
      for (const line of lines) {
        const match = line.match(/^#\s+(.+)$/)
        if (match) {
          name = match[1].trim()
          break
        }
      }

      const frontmatter = parseYamlFrontmatter(file.content)

      let description = ''
      if (frontmatter.description) {
        description = String(frontmatter.description)
      } else {
        let inCodeBlock = false
        for (const line of lines) {
          if (line.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock
            continue
          }
          if (inCodeBlock) continue
          if (line.trim().startsWith('#')) continue
          if (line.trim() === '') continue
          description = line.trim()
          break
        }
      }

      const filename = file.name
      const baseName = filename.replace(/\.md$/, '')

      const permissionBlock = frontmatter.permission || frontmatter.permissions || {}

      agents.push({
        name,
        description,
        filename,
        mode: frontmatter.mode ?? null,
        hidden: frontmatter.hidden === true || frontmatter.hidden === 'true',
        temperature: frontmatter.temperature != null ? Number(frontmatter.temperature) : null,
        permissions: {
          edit: permissionBlock.edit ?? null,
          bash: permissionBlock.bash ?? null,
          glob: permissionBlock.glob ?? null,
        },
        content: extractContentWithoutFrontmatter(file.content),
      })
    }
  }
```

---

### Task 4: Enhance sync script — agent usage computation

- **Description**: Pass exported sessions into `exportJsonFiles`, compute per-agent usage by matching session titles against `@<name> subagent` (case-insensitive), and attach usage stats to each agent.
- **Files affected**: `scripts/sync-opencode-data.js`
- **Dependency**: Task 3
- **Definition of Done**: `agents.json` contains `usage` object on every agent (zero-valued for unused agents). `npm run sync` completes in <500ms for typical datasets.
- **Complexity**: medium

**Steps:**

1. **Update `exportJsonFiles` signature** (line 511) to accept sessions:

```javascript
function exportJsonFiles(paths, sessions = []) {
```

2. **Insert usage computation block** immediately after the agents array is populated (after the agents `if (paths.config) { ... }` block, before the skills section). Add:

```javascript
  // Compute agent usage from session titles
  const agentRegexMap = new Map()
  for (const agent of agents) {
    const baseName = agent.filename.replace(/\.md$/, '')
    const names = [baseName]
    if (agent.name && agent.name !== baseName) {
      names.push(agent.name)
    }
    const escaped = names.map(escapeRegex)
    const pattern = new RegExp(`@(?:${escaped.join('|')})\\s+subagent`, 'i')
    agentRegexMap.set(agent.filename, pattern)

    agent.usage = {
      sessionCount: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cacheTokens: 0,
      totalCost: 0,
      lastUsed: null,
    }
  }

  for (const session of sessions) {
    const title = session.title ?? ''
    for (const agent of agents) {
      const regex = agentRegexMap.get(agent.filename)
      if (regex && regex.test(title)) {
        const u = agent.usage
        u.sessionCount++
        u.inputTokens += session.input_tokens ?? 0
        u.outputTokens += session.output_tokens ?? 0
        u.reasoningTokens += session.reasoning_tokens ?? 0
        u.cacheTokens += session.cache_tokens ?? 0
        u.totalTokens += session.total_tokens ?? 0
        u.totalCost += session.cost ?? 0
        const sessionDate = session.created_at ? new Date(session.created_at) : null
        if (sessionDate && !isNaN(sessionDate.getTime())) {
          if (!u.lastUsed || sessionDate > new Date(u.lastUsed)) {
            u.lastUsed = session.created_at
          }
        }
        break // A session title should match at most one agent
      }
    }
  }
```

3. **Update the call site** (line 753) to pass sessions:

```javascript
  const auxData = exportJsonFiles(paths, dbData.sessions)
```

---

### Task 5: Update `dataLoader.ts` type references

- **Description**: Ensure `loadAgents` return type matches the updated `AgentInfo`. No functional changes needed because `loadJson` is generic.
- **Files affected**: `src/utils/dataLoader.ts`
- **Dependency**: Task 2
- **Definition of Done**: `tsc -b` passes; `loadAgents()` returns the enriched `AgentInfo[]` type.
- **Complexity**: low

**Steps:**
1. No code changes required in `dataLoader.ts` because `loadJson<AgentInfo[]>` will automatically pick up the new interface shape from `src/types/index.ts`. Verify by running `npx tsc -b` after Task 2 is complete.

---

### Task 6: Create `AgentDetail.tsx` page

- **Description**: Build the full agent detail page with metadata, usage stats, token breakdown chart, time-series chart, paginated session list, and prompt preview.
- **Files affected**: `src/pages/AgentDetail.tsx` (new)
- **Dependency**: Task 2, Task 5
- **Definition of Done**: Page renders without errors, all sections visible, charts display correctly, session list paginated at 50 rows, prompt preview expandable.
- **Complexity**: high

**Steps:**

1. **Create the file** `src/pages/AgentDetail.tsx` with the following structure:

```tsx
import { useEffect, useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { loadAgents, loadSessions } from '../utils/dataLoader.ts'
import { formatNumber, formatCost, formatDateTick } from '../utils/costCalculator.ts'
import { shortenModelName } from '../utils/modelUtils.ts'
import ErrorMessage from '../components/ErrorMessage.tsx'
import TokenCompositionChart from '../components/TokenCompositionChart.tsx'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { AgentInfo, Session } from '../types/index.ts'
import type { Granularity } from '../types/index.ts'

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  borderRadius: 6,
  padding: 20,
}

const granularityOptions: { value: Granularity; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'all', label: 'All' },
]

function CustomTooltip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !payload || !Array.isArray(payload) || payload.length === 0) return null
  return (
    <div
      style={{
        background: '#1c2128',
        border: '1px solid #30363d',
        borderRadius: 6,
        padding: '8px 12px',
        fontFamily: 'var(--mono)',
        fontSize: 12,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>
        {formatDateTick(String(label ?? ''), 'all')}
      </div>
      {(payload as Array<Record<string, unknown>>).map((entry, i) => (
        <div key={i} style={{ color: String(entry.color ?? 'var(--text-primary)') }}>
          {String(entry.name ?? '')}: {formatNumber(Number(entry.value) || 0)}
        </div>
      ))}
    </div>
  )
}

function computeTimeSeriesData(sessions: Session[], granularity: Granularity) {
  const map = new Map<string, { date: string; input: number; output: number; reasoning: number; cache: number }>()
  for (const s of sessions) {
    const d = new Date(s.created_at)
    if (isNaN(d.getTime())) continue
    let key: string
    if (granularity === 'daily') {
      key = d.toISOString().slice(0, 10)
    } else if (granularity === 'weekly') {
      const dayNum = d.getUTCDay() || 7
      const d2 = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
      d2.setUTCDate(d2.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(d2.getUTCFullYear(), 0, 1))
      const week = Math.ceil((((d2.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
      key = `${d2.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
    } else if (granularity === 'monthly') {
      key = d.toISOString().slice(0, 7)
    } else {
      key = d.toISOString().slice(0, 10)
    }
    if (!map.has(key)) {
      map.set(key, { date: key, input: 0, output: 0, reasoning: 0, cache: 0 })
    }
    const entry = map.get(key)!
    entry.input += s.input_tokens
    entry.output += s.output_tokens
    entry.reasoning += s.reasoning_tokens
    entry.cache += s.cache_tokens
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 'Invalid date'
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} years ago`
}

export default function AgentDetail() {
  const { filename } = useParams<{ filename: string }>()
  const [agent, setAgent] = useState<AgentInfo | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [granularity, setGranularity] = useState<Granularity>('daily')
  const [showFullPrompt, setShowFullPrompt] = useState(false)
  const [visibleSessionCount, setVisibleSessionCount] = useState(50)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetch() {
      if (!filename) return
      try {
        setLoading(true)
        setError(null)
        const [agentsData, allSessions] = await Promise.all([
          loadAgents(),
          loadSessions(),
        ])
        const found = agentsData.find((a) => a.filename === filename)
        if (!found) {
          setError('Agent not found')
          setLoading(false)
          return
        }
        setAgent(found)

        const baseName = found.filename.replace(/\.md$/, '')
        const names = [baseName]
        if (found.name && found.name !== baseName) {
          names.push(found.name)
        }
        const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        const regex = new RegExp(`@(?:${escaped.join('|')})\\s+subagent`, 'i')
        const matched = allSessions.filter((s) => regex.test(s.title))
        matched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setSessions(matched)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [filename])

  const timeSeriesData = useMemo(
    () => computeTimeSeriesData(sessions, granularity),
    [sessions, granularity]
  )

  const compositionData = useMemo(() => {
    if (!agent) return []
    const u = agent.usage
    return [
      { name: 'Input', value: u.inputTokens, color: 'var(--chart-1)' },
      { name: 'Output', value: u.outputTokens, color: 'var(--chart-2)' },
      { name: 'Reasoning', value: u.reasoningTokens, color: 'var(--chart-3)' },
      { name: 'Cache', value: u.cacheTokens, color: 'var(--chart-5)' },
    ].filter((d) => d.value > 0)
  }, [agent])

  const avgTokens = useMemo(() => {
    if (!agent || agent.usage.sessionCount === 0) return 0
    return Math.round(agent.usage.totalTokens / agent.usage.sessionCount)
  }, [agent])

  const visibleSessions = useMemo(() => sessions.slice(0, visibleSessionCount), [sessions, visibleSessionCount])

  const promptPreview = useMemo(() => {
    if (!agent) return ''
    const maxLen = showFullPrompt ? Infinity : 2000
    if (agent.content.length <= maxLen) return agent.content
    return agent.content.slice(0, maxLen) + '...'
  }, [agent, showFullPrompt])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--sans)' }}>Loading agent…</span>
      </div>
    )
  }

  return (
    <div>
      <Link
        to="/agents"
        style={{
          fontFamily: 'var(--sans)',
          fontSize: 13,
          color: 'var(--text-secondary)',
          textDecoration: 'none',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
      >
        {'\u2190'} Back to Agents
      </Link>

      {error && <ErrorMessage message={error} />}

      {agent && (
        <>
          {/* Header */}
          <h1
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginTop: 8,
              marginBottom: 4,
            }}
          >
            {agent.name}
          </h1>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                background: agent.mode === 'primary' ? 'rgba(88,166,255,0.15)' : 'rgba(188,140,255,0.15)',
                color: agent.mode === 'primary' ? 'var(--accent)' : 'var(--chart-4)',
                marginRight: 8,
              }}
            >
              {agent.mode ?? 'unknown'}
            </span>
            {agent.filename}
            {agent.hidden && (
              <span style={{ marginLeft: 8, color: 'var(--warning)', fontSize: 11 }}>Hidden</span>
            )}
          </div>

          {/* Metadata */}
          <h2
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 16,
            }}
          >
            Metadata
          </h2>
          <div className="detail-cards-grid" style={{ marginBottom: 24 }}>
            <div className="detail-card">
              <div className="detail-card-label">Mode</div>
              <div className="detail-card-value">{agent.mode ?? '—'}</div>
            </div>
            <div className="detail-card">
              <div className="detail-card-label">Hidden</div>
              <div className="detail-card-value">{agent.hidden ? 'Yes' : 'No'}</div>
            </div>
            <div className="detail-card">
              <div className="detail-card-label">Temperature</div>
              <div className="detail-card-value">{agent.temperature != null ? agent.temperature : '—'}</div>
            </div>
            <div className="detail-card">
              <div className="detail-card-label">Permissions</div>
              <div className="detail-card-value">
                edit: {agent.permissions.edit ?? '—'} · bash: {agent.permissions.bash ?? '—'} · glob: {agent.permissions.glob ?? '—'}
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <h2
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 16,
            }}
          >
            Usage Statistics
          </h2>
          <div className="detail-cards-grid" style={{ marginBottom: 24 }}>
            <div className="detail-card">
              <div className="detail-card-label">Total Sessions</div>
              <div className="detail-card-value">{formatNumber(agent.usage.sessionCount)}</div>
            </div>
            <div className="detail-card">
              <div className="detail-card-label">Total Tokens</div>
              <div className="detail-card-value">{formatNumber(agent.usage.totalTokens)}</div>
            </div>
            <div className="detail-card">
              <div className="detail-card-label">Total Cost</div>
              <div className="detail-card-value">{formatCost(agent.usage.totalCost)}</div>
            </div>
            <div className="detail-card">
              <div className="detail-card-label">Avg Tokens / Session</div>
              <div className="detail-card-value">{formatNumber(avgTokens)}</div>
            </div>
          </div>

          {/* Token Breakdown */}
          <div style={{ ...cardStyle, marginBottom: 24 }}>
            <TokenCompositionChart data={compositionData} />
          </div>

          {/* Time Series */}
          <div style={{ ...cardStyle, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                }}
              >
                Usage Over Time
              </span>
              <div style={{ display: 'flex', gap: 2 }}>
                {granularityOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGranularity(opt.value)}
                    style={{
                      fontFamily: 'var(--sans)',
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 4,
                      border: 'none',
                      background: granularity === opt.value ? 'var(--bg-tertiary)' : 'transparent',
                      color: granularity === opt.value ? 'var(--text-primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'background 150ms, color 150ms',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ width: '100%', height: 300 }} aria-label="Agent usage line chart">
              {timeSeriesData.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--sans)',
                    fontSize: 13,
                  }}
                >
                  No data available
                </div>
              ) : (
                <ResponsiveContainer>
                  <LineChart data={timeSeriesData} margin={{ left: 8, right: 8, top: 5, bottom: 20 }}>
                    <CartesianGrid stroke="#21262d" strokeWidth={0.5} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d: string) => formatDateTick(d, granularity)}
                      stroke="var(--text-secondary)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border)' }}
                      dy={8}
                    />
                    <YAxis
                      tickFormatter={(v: number) => formatNumber(v)}
                      stroke="var(--text-secondary)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={60}
                    />
                    <Tooltip content={CustomTooltip} cursor={false} contentStyle={{ background: 'none', border: 'none', padding: 0 }} />
                    <Line type="monotone" dataKey="input" name="Input" stroke="var(--accent)" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="output" name="Output" stroke="var(--chart-2)" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="reasoning" name="Reasoning" stroke="var(--chart-3)" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="cache" name="Cache" stroke="var(--chart-5)" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Session List */}
          <h2
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 16,
            }}
          >
            Sessions ({sessions.length})
          </h2>
          <div style={{ ...cardStyle, marginBottom: 24 }}>
            {sessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontSize: 13 }}>
                No sessions found for this agent.
              </div>
            ) : (
              <>
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Date</th>
                      <th>Model</th>
                      <th>Tokens</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSessions.map((s) => (
                      <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => { navigate(`/sessions/${s.id}`) }}
                        <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.title}
                        </td>
                        <td>{new Date(s.created_at).toLocaleDateString()}</td>
                        <td>{shortenModelName(s.model_id, s.model_provider)}</td>
                        <td>{formatNumber(s.total_tokens)}</td>
                        <td>{s.cost != null ? formatCost(s.cost) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {visibleSessionCount < sessions.length && (
                  <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <button
                      type="button"
                      onClick={() => setVisibleSessionCount((c) => c + 50)}
                      style={{
                        fontFamily: 'var(--sans)',
                        fontSize: 13,
                        color: 'var(--accent)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Load more sessions
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Prompt Preview */}
          <h2
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 16,
            }}
          >
            Prompt Preview
          </h2>
          <div style={{ ...cardStyle, marginBottom: 24 }}>
            <pre
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 12,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
                maxHeight: showFullPrompt ? 'none' : 400,
                overflow: 'auto',
              }}
            >
              <code>{promptPreview}</code>
            </pre>
            {agent.content.length > 2000 && (
              <button
                type="button"
                onClick={() => setShowFullPrompt((v) => !v)}
                style={{
                  marginTop: 12,
                  fontFamily: 'var(--sans)',
                  fontSize: 12,
                  color: 'var(--accent)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {showFullPrompt ? 'Show less' : 'Show full prompt'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

---

### Task 7: Redesign `Agents.tsx` as dashboard

- **Description**: Replace the simple list with a dashboard featuring summary stats, filter controls, sort controls, and a responsive grid of clickable agent cards.
- **Files affected**: `src/pages/Agents.tsx`
- **Dependency**: Task 2, Task 6
- **Definition of Done**: Dashboard renders summary cards, filter/sort controls work, grid is responsive, cards navigate to detail page, empty state shown when no agents match filters.
- **Complexity**: high

**Steps:**

1. **Replace the entire contents** of `src/pages/Agents.tsx`:

```tsx
import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, EyeOff, Search, ArrowUpDown } from 'lucide-react'
import { loadAgents } from '../utils/dataLoader.ts'
import { formatNumber, formatCost } from '../utils/costCalculator.ts'
import ErrorMessage from '../components/ErrorMessage.tsx'
import type { AgentInfo } from '../types/index.ts'

type SortField = 'name' | 'sessionCount' | 'totalTokens' | 'totalCost' | 'lastUsed'
type SortOrder = 'asc' | 'desc'

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 'Invalid date'
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} years ago`
}

function isActive(lastUsed: string | null): boolean {
  if (!lastUsed) return false
  const d = new Date(lastUsed)
  if (isNaN(d.getTime())) return false
  return Date.now() - d.getTime() < 30 * 86400000
}

export default function Agents() {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [modeFilter, setModeFilter] = useState<'all' | 'primary' | 'subagent'>('all')
  const [showHidden, setShowHidden] = useState(true)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const navigate = useNavigate()

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true)
        setError(null)
        const data = await loadAgents()
        setAgents(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  const filteredAgents = useMemo(() => {
    let result = agents.filter((a) => {
      if (!showHidden && a.hidden) return false
      if (modeFilter !== 'all' && a.mode !== modeFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
        )
      }
      return true
    })

    result.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'sessionCount':
          cmp = a.usage.sessionCount - b.usage.sessionCount
          break
        case 'totalTokens':
          cmp = a.usage.totalTokens - b.usage.totalTokens
          break
        case 'totalCost':
          cmp = a.usage.totalCost - b.usage.totalCost
          break
        case 'lastUsed': {
          const da = a.usage.lastUsed ? new Date(a.usage.lastUsed).getTime() : 0
          const db = b.usage.lastUsed ? new Date(b.usage.lastUsed).getTime() : 0
          cmp = da - db
          break
        }
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    return result
  }, [agents, search, modeFilter, showHidden, sortField, sortOrder])

  const summary = useMemo(() => {
    const total = agents.length
    const primary = agents.filter((a) => a.mode === 'primary').length
    const subagent = agents.filter((a) => a.mode === 'subagent').length
    const totalSessions = agents.reduce((sum, a) => sum + a.usage.sessionCount, 0)
    const totalTokens = agents.reduce((sum, a) => sum + a.usage.totalTokens, 0)
    return { total, primary, subagent, totalSessions, totalTokens }
  }, [agents])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder(field === 'name' ? 'asc' : 'desc')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--sans)' }}>Loading agents…</span>
      </div>
    )
  }

  return (
    <div>
      <h1
        style={{
          fontFamily: 'var(--sans)',
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 20,
        }}
      >
        Agents
      </h1>

      {error && <ErrorMessage message={error} />}

      {/* Summary */}
      <div className="detail-cards-grid" style={{ marginBottom: 24 }}>
        <div className="detail-card">
          <div className="detail-card-label">Total Agents</div>
          <div className="detail-card-value">{summary.total}</div>
        </div>
        <div className="detail-card">
          <div className="detail-card-label">Primary</div>
          <div className="detail-card-value">{summary.primary}</div>
        </div>
        <div className="detail-card">
          <div className="detail-card-label">Subagents</div>
          <div className="detail-card-value">{summary.subagent}</div>
        </div>
        <div className="detail-card">
          <div className="detail-card-label">Agent Sessions</div>
          <div className="detail-card-value">{formatNumber(summary.totalSessions)}</div>
        </div>
        <div className="detail-card">
          <div className="detail-card-label">Agent Tokens</div>
          <div className="detail-card-value">{formatNumber(summary.totalTokens)}</div>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search agents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: 32 }}
          />
        </div>
        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value as typeof modeFilter)}
          style={{ minWidth: 120 }}
        >
          <option value="all">All modes</option>
          <option value="primary">Primary</option>
          <option value="subagent">Subagent</option>
        </select>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--sans)',
            fontSize: 13,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
            style={{ margin: 0 }}
          />
          Show hidden
        </label>
      </div>

      {/* Sort */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {([
          { field: 'name', label: 'Name' },
          { field: 'sessionCount', label: 'Sessions' },
          { field: 'totalTokens', label: 'Tokens' },
          { field: 'totalCost', label: 'Cost' },
          { field: 'lastUsed', label: 'Last Used' },
        ] as const).map(({ field, label }) => (
          <button
            key={field}
            type="button"
            onClick={() => toggleSort(field)}
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 4,
              border: 'none',
              background: sortField === field ? 'var(--bg-tertiary)' : 'transparent',
              color: sortField === field ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {label}
            {sortField === field && (
              <ArrowUpDown size={12} style={{ transform: sortOrder === 'desc' ? 'rotate(180deg)' : 'none' }} />
            )}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filteredAgents.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 60,
            fontFamily: 'var(--sans)',
            fontSize: 14,
            color: 'var(--text-muted)',
          }}
        >
          <Bot size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
          <div>No agents found.</div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          }}
        >
          {filteredAgents.map((a) => (
            <div
              key={a.filename}
              onClick={() => navigate(`/agents/${a.filename}`)}
              style={{
                background: 'var(--bg-secondary)',
                borderRadius: 6,
                padding: '16px 20px',
                cursor: 'pointer',
                transition: 'background 200ms',
                border: '1px solid transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)'
                e.currentTarget.style.border = '1px solid var(--border-accent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-secondary)'
                e.currentTarget.style.border = '1px solid transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    fontFamily: 'var(--sans)',
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: a.mode === 'primary' ? 'rgba(88,166,255,0.15)' : 'rgba(188,140,255,0.15)',
                    color: a.mode === 'primary' ? 'var(--accent)' : 'var(--chart-4)',
                    flexShrink: 0,
                  }}
                >
                  {a.mode ?? 'unknown'}
                </span>
                {a.hidden && (
                  <EyeOff size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                )}
                {isActive(a.usage.lastUsed) && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--success)',
                      flexShrink: 0,
                    }}
                    title="Active in last 30 days"
                  />
                )}
              </div>
              <div
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  lineHeight: 1.4,
                  marginBottom: 12,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {a.description}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                }}
              >
                <span>{formatNumber(a.usage.sessionCount)} sessions</span>
                <span>{formatNumber(a.usage.totalTokens)} tokens</span>
                <span>{formatCost(a.usage.totalCost)}</span>
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontFamily: 'var(--sans)',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                }}
              >
                Last used: {relativeTime(a.usage.lastUsed)}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontFamily: 'var(--sans)',
                  fontSize: 11,
                  color: 'var(--accent)',
                  opacity: 0,
                  transition: 'opacity 200ms',
                }}
                className="card-hint"
              >
                View details →
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .card-hint {
          opacity: 0;
        }
        div:hover > .card-hint {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  )
}
```

---

### Task 8: Add routing for `/agents/:filename`

- **Description**: Register the new `AgentDetail` route in `App.tsx`.
- **Files affected**: `src/App.tsx`
- **Dependency**: Task 6
- **Definition of Done**: Navigating to `/agents/some-file.md` renders `AgentDetail`; no existing routes broken.
- **Complexity**: low

**Steps:**

1. **Add import** near the top of `src/App.tsx` (after line 13):

```tsx
import AgentDetail from './pages/AgentDetail.tsx'
```

2. **Add route** inside `<Routes>` (after line 39):

```tsx
<Route path="/agents/:filename" element={<AgentDetail />} />
```

---

### Task 9: Add responsive grid CSS for agent cards

- **Description**: Add a small CSS utility class to `index.css` for the agent card grid hover hint, ensuring it works without inline-style limitations.
- **Files affected**: `src/index.css`
- **Dependency**: Task 7
- **Definition of Done**: Hovering an agent card shows "View details →" hint.
- **Complexity**: low

**Steps:**

1. **Append to `src/index.css`** at the end:

```css
.agent-card:hover .agent-card-hint {
  opacity: 1;
}
```

2. **Update `Agents.tsx`** to use these classes instead of the `<style>` tag. Replace the inline `<style>` block at the bottom of the component with class usage:

In the card `div`, add `className="agent-card"`.

In the hint `div`, replace the inline opacity/transition styles with:

```tsx
<div
  className="agent-card-hint"
  style={{
    marginTop: 8,
    fontFamily: 'var(--sans)',
    fontSize: 11,
    color: 'var(--accent)',
    opacity: 0,
    transition: 'opacity 200ms',
  }}
>
  View details →
</div>
```

And remove the `<style>{`...`}</style>` block entirely.

---

### Task 10: Verification and build

- **Description**: Run the sync script, verify JSON output, run TypeScript check, run build, and perform manual UI verification.
- **Files affected**: None (verification only)
- **Dependency**: All previous tasks
- **Definition of Done**: `npm run sync` succeeds, `npm run build` passes with zero errors, manual click-through of dashboard and detail page works.
- **Complexity**: medium

**Steps:**

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run sync script**:
   ```bash
   npm run sync
   ```
   Verify `public/data/agents.json` contains objects with:
   - `mode`, `hidden`, `temperature`, `permissions`, `content`, `usage`
   - `usage.sessionCount`, `usage.totalTokens`, `usage.totalCost`, `usage.lastUsed`
   - Unused agents have `usage.sessionCount: 0` and `usage.lastUsed: null`

3. **Type-check**:
   ```bash
   npx tsc -b
   ```
   Expected: zero errors.

4. **Build**:
   ```bash
   npm run build
   ```
   Expected: zero errors.

5. **Dev server manual test**:
   ```bash
   npm run dev
   ```
   - Open `/agents`
   - Verify summary cards show correct counts
   - Verify filter by mode works
   - Verify search filters by name/description
   - Verify sort by sessions/tokens/cost/last used works
   - Click a card → navigates to `/agents/:filename`
   - Verify detail page shows metadata, usage stats, charts, session list, prompt preview
   - Verify "Load more sessions" works if >50 sessions
   - Verify "Back to Agents" link works
   - Verify hidden agents show "Hidden" indicator
   - Verify active agents (used in last 30 days) show green dot

6. **Lint check**:
   ```bash
   npm run lint
   ```
   Expected: zero errors (or only pre-existing ones).

---

## Dependency Order

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

(Tasks 3 and 4 are sequential because usage computation depends on the new agent object shape. Tasks 6 and 7 can be developed in parallel after Task 2, but the plan sequences them for clarity.)

## Data Schema Changes

### `src/types/index.ts`

**Removed:**
```typescript
export interface AgentInfo {
  name: string
  description: string
  filename: string
}
```

**Added:**
```typescript
export interface AgentPermissions {
  edit: 'allow' | 'deny' | null
  bash: 'allow' | 'deny' | null
  glob: 'allow' | 'deny' | null
}

export interface AgentUsage {
  sessionCount: number
  totalTokens: number
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  cacheTokens: number
  totalCost: number
  lastUsed: string | null
}

export interface AgentInfo {
  name: string
  description: string
  filename: string
  mode: 'primary' | 'subagent' | null
  hidden: boolean
  temperature: number | null
  permissions: AgentPermissions
  usage: AgentUsage
  content: string
}
```

### `public/data/agents.json` (sync script output)

Each object extended from:
```json
{ "name": "...", "description": "...", "filename": "..." }
```

To:
```json
{
  "name": "...",
  "description": "...",
  "filename": "...",
  "mode": "subagent",
  "hidden": true,
  "temperature": 0.2,
  "permissions": { "edit": "allow", "bash": "allow", "glob": "allow" },
  "usage": {
    "sessionCount": 42,
    "totalTokens": 150000,
    "inputTokens": 50000,
    "outputTokens": 70000,
    "reasoningTokens": 20000,
    "cacheTokens": 10000,
    "totalCost": 0.75,
    "lastUsed": "2026-05-27T10:00:00.000Z"
  },
  "content": "You are the Programmer..."
}
```

## Sync Script Changes Summary

1. **Import `js-yaml`** at top of file.
2. **Replace `parseYamlFrontmatter`** with `js-yaml` based parser.
3. **Add `extractContentWithoutFrontmatter`** helper.
4. **Add `escapeRegex`** helper.
5. **Update agent extraction loop** to parse YAML, extract `mode`, `hidden`, `temperature`, `permissions`, and `content`.
6. **Change `exportJsonFiles` signature** to accept `sessions` array.
7. **Add usage computation** after agent extraction: pre-compile regex per agent, scan all sessions, aggregate stats, attach to agent object.
8. **Update call site** in `main()` to pass `dbData.sessions`.

## UI Component Structure

| Component | File | Props | Reused From |
|---|---|---|---|
| `Agents` (page) | `src/pages/Agents.tsx` | none | Redesigned from scratch |
| `AgentDetail` (page) | `src/pages/AgentDetail.tsx` | none | New |
| `TokenCompositionChart` | `src/components/TokenCompositionChart.tsx` | `data: DonutSegment[]` | Existing — reused in detail page |
| `LineChart` (Recharts) | `recharts` | various | Existing pattern from `TokenUsageChart.tsx` |
| `SummaryCard` | `src/components/SummaryCard.tsx` | `label, value, subLabel?, trend?` | Existing — used in Overview |

**New inline helpers in `AgentDetail.tsx`:**
- `computeTimeSeriesData(sessions, granularity)` → returns chart-ready data points
- `CustomTooltip` → chart tooltip (copied from `TokenUsageChart.tsx` pattern)
- `relativeTime(dateStr)` → "2 days ago" formatting

## Routing Changes

**`src/App.tsx`:**
- Import `AgentDetail` from `./pages/AgentDetail.tsx`
- Add `<Route path="/agents/:filename" element={<AgentDetail />} />` inside `<Routes>`

## Risks & Alternatives

| Risk | Mitigation | Alternative |
|---|---|---|
| **js-yaml parse failure on malformed frontmatter** | Wrap `yaml.load` in `try/catch`; fallback to empty object | Keep old scalar parser as fallback inside catch block |
| **Agent name substring collisions in regex** (e.g., "dev" matches "developer") | Use exact match with word boundaries: `\b@name\b` | Pre-filter with exact string inclusion before regex test |
| **Large `agents.json` due to `content` field** | Agent markdown files are typically small (<50 agents × <10KB = <500KB) | Truncate `content` at sync time if file exceeds threshold |
| **TypeScript strict errors from new interfaces** | Run `tsc -b` after every task; ensure `verbatimModuleSyntax` compliance with `import type` | None — strict mode is mandatory |
| **Detail page slow with >50 sessions** | Lazy-load 50 at a time; time-series computed on visible subset only | Pre-compute per-agent time-series in sync script (adds complexity) |
| **Session title regex false positives** | Regex requires `subagent` word after `@name` | Also check message parts for agent tool calls (not required by spec) |

---
Version: 1 | Author: planner | Ref: requirements v1 | Date: 2026-05-28

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
    const result = agents.filter((a) => {
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
              className="agent-card"
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

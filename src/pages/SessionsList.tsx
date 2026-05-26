import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { loadSessions, loadModels, loadProjects } from '../utils/dataLoader.ts'
import { loadPricing, calculateCost, formatCost, formatNumber } from '../utils/costCalculator.ts'
import { shortenModelName } from '../utils/modelUtils.ts'
import DataTable from '../components/DataTable.tsx'
import ErrorMessage from '../components/ErrorMessage.tsx'
import type { Session, Project } from '../types/index.ts'

export default function SessionsList() {
  const navigate = useNavigate()
  const [allSessions, setAllSessions] = useState<Session[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  type QuickFilter = 'today' | 'week' | 'month' | 'year'
  const [quickFilter, setQuickFilter] = useState<QuickFilter | null>(null)
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const pageSize = 20

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

  const applyQuickFilter = (filter: QuickFilter) => {
    const range = getQuickFilterRange(filter)
    setQuickFilter(filter)
    setDateFrom(range.from)
    setDateTo(range.to)
    setPage(0)
  }

  const clearFilters = () => {
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setQuickFilter(null)
    setPage(0)
  }

  const hasActiveFilters = search || dateFrom || dateTo || quickFilter

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true)
        setError(null)
        const [sessions, models, projectsData] = await Promise.all([loadSessions(), loadModels(), loadProjects()])
        const pricingMap = loadPricing(models)

        const sessionsWithCost = sessions.map((s) => {
          if (s.model_id && pricingMap.has(s.model_id)) {
            const pricing = pricingMap.get(s.model_id)!
            const cost = calculateCost(
              {
                input: s.input_tokens,
                output: s.output_tokens,
                reasoning: s.reasoning_tokens,
                cache: s.cache_tokens,
              },
              pricing
            )
            return { ...s, cost }
          }
          return s
        })

        setAllSessions(sessionsWithCost)
        setProjects(projectsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [])

  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of projects) {
      map.set(p.id, p.name)
    }
    return map
  }, [projects])

  const filtered = useMemo(() => {
    let result = [...allSessions]

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

    if (dateFrom) {
      const from = new Date(dateFrom).getTime()
      result = result.filter((s) => new Date(s.created_at).getTime() >= from)
    }

    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000
      result = result.filter((s) => new Date(s.created_at).getTime() < to)
    }

    result.sort((a, b) => {
      const aVal = ((a as unknown) as Record<string, unknown>)[sortBy]
      const bVal = ((b as unknown) as Record<string, unknown>)[sortBy]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return 0
    })

    return result
  }, [allSessions, search, dateFrom, dateTo, sortBy, sortOrder, projectNameMap])

  const paginated = useMemo(() => {
    return filtered.slice(page * pageSize, (page + 1) * pageSize)
  }, [filtered, page])

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortOrder('desc')
    }
    setPage(0)
  }

  const totalPages = Math.ceil(filtered.length / pageSize)

  const filterInputStyle: React.CSSProperties = {
    fontFamily: 'var(--sans)',
    fontSize: 13,
    height: 32,
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    padding: '0 10px',
    outline: 'none',
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
        Sessions
      </h1>
      {error && <ErrorMessage message={error} />}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        {/* Search input */}
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
              aria-pressed={active}
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

        {/* Clear filters button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 12,
              height: 32,
              padding: '0 12px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontFamily: 'var(--sans)' }}>
          Loading…
        </div>
      ) : (
        <>
          <DataTable<Session>
            columns={[
              { key: 'title', header: 'Title' },
              { key: 'project_id', header: 'Project', render: (s) => projectNameMap.get(s.project_id ?? '') ?? s.project_id ?? '—' },
              { key: 'model_id', header: 'Model', render: (s) => shortenModelName(s.model_id, s.model_provider) },
              { key: 'total_tokens', header: 'Tokens', render: (s) => formatNumber(s.total_tokens), numeric: true },
              { key: 'cost', header: 'Cost', render: (s) => (s.cost != null ? formatCost(s.cost) : '—'), numeric: true },
              { key: 'created_at', header: 'Date', render: (s) => new Date(s.created_at).toLocaleDateString() },
            ]}
            data={paginated}
            sortKey={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            keyExtractor={(s) => s.id}
            onRowClick={(s) => navigate(`/sessions/${s.id}`)}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 16,
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--sans)' }}>
              {filtered.length} sessions
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                aria-label="Previous page"
                disabled={page <= 0}
                onClick={() => setPage(page - 1)}
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 12,
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-tertiary)',
                  color: page <= 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                  cursor: page <= 0 ? 'default' : 'pointer',
                }}
              >
                Previous
              </button>
              <span
                style={{
                  color: 'var(--text-muted)',
                  fontSize: 12,
                  fontFamily: 'var(--sans)',
                }}
              >
                Page {page + 1} of {totalPages || 1}
              </span>
              <button
                type="button"
                aria-label="Next page"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 12,
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 4,
                  border: page >= totalPages - 1 ? '1px solid var(--border)' : '1px solid var(--accent)',
                  background: page >= totalPages - 1 ? 'var(--bg-tertiary)' : 'var(--accent)',
                  color: page >= totalPages - 1 ? 'var(--text-muted)' : '#ffffff',
                  cursor: page >= totalPages - 1 ? 'default' : 'pointer',
                }}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

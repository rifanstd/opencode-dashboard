import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { loadSessions, loadModels, loadProjects } from '../utils/dataLoader.ts'
import { loadPricing, calculateCost, formatCost, formatNumber } from '../utils/costCalculator.ts'
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
  const [projectFilter, setProjectFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const pageSize = 50

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
        return (
          s.title.toLowerCase().includes(q) ||
          projectName.toLowerCase().includes(q) ||
          (s.model_id?.toLowerCase().includes(q) ?? false)
        )
      })
    }

    if (projectFilter) {
      const pf = projectFilter.toLowerCase()
      result = result.filter((s) => {
        const projectName = s.project_id ? (projectNameMap.get(s.project_id) ?? '') : ''
        return projectName.toLowerCase().includes(pf)
      })
    }

    if (modelFilter) {
      result = result.filter((s) => s.model_id?.toLowerCase().includes(modelFilter.toLowerCase()))
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
  }, [allSessions, search, projectFilter, modelFilter, dateFrom, dateTo, sortBy, sortOrder, projectNameMap])

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

      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 20,
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 8,
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            style={{ ...filterInputStyle, minWidth: 200, paddingLeft: 28 }}
          />
        </div>
        <input
          type="text"
          placeholder="Project"
          value={projectFilter}
          onChange={(e) => { setProjectFilter(e.target.value); setPage(0) }}
          style={{ ...filterInputStyle, minWidth: 140 }}
        />
        <input
          type="text"
          placeholder="Model"
          value={modelFilter}
          onChange={(e) => { setModelFilter(e.target.value); setPage(0) }}
          style={{ ...filterInputStyle, minWidth: 140 }}
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(0) }}
          style={filterInputStyle}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(0) }}
          style={filterInputStyle}
        />
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
              { key: 'model_id', header: 'Model', render: (s) => s.model_id ?? '—' },
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
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 12,
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-tertiary)',
                  color: page >= totalPages - 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
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

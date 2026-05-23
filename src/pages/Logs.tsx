import { useEffect, useState, useMemo } from 'react'
import { loadLogs } from '../utils/dataLoader.ts'
import ErrorMessage from '../components/ErrorMessage.tsx'
import type { LogEntry } from '../types/index.ts'

const levelColors: Record<string, string> = {
  INFO: 'var(--info)',
  WARN: 'var(--warning)',
  ERROR: 'var(--danger)',
  DEBUG: 'var(--text-muted)',
}

export default function Logs() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [levelFilter, setLevelFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true)
        setError(null)
        const data = await loadLogs()
        const sorted = [...data].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setEntries(sorted)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [])

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (levelFilter !== 'ALL' && e.level !== levelFilter) return false
      if (dateFrom) {
        const ts = new Date(e.timestamp).getTime()
        const from = new Date(dateFrom).getTime()
        if (ts < from) return false
      }
      if (dateTo) {
        const ts = new Date(e.timestamp).getTime()
        const to = new Date(dateTo).getTime() + 86400000
        if (ts > to) return false
      }
      if (search) {
        const q = search.toLowerCase()
        if (!e.message.toLowerCase().includes(q) && !e.source.toLowerCase().includes(q)) {
          return false
        }
      }
      return true
    })
  }, [entries, levelFilter, dateFrom, dateTo, search])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <span style={{ color: 'var(--text-secondary)' }}>Loading logs…</span>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Logs</h1>
      {error && <ErrorMessage message={error} />}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as typeof levelFilter)}>
          <option value="ALL">All Levels</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
          <option value="DEBUG">DEBUG</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <input
          type="text"
          placeholder="Search logs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 200 }}
        />
      </div>

      {entries.length === 0 && !error && (
        <p style={{ color: 'var(--text-secondary)' }}>No log files found. Run `npm run sync` to export data.</p>
      )}

      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Level</th>
              <th>Message</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr key={`${e.timestamp}-${i}`}>
                <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                  {new Date(e.timestamp).toLocaleString()}
                </td>
                <td>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      background: `${levelColors[e.level]}20`,
                      color: levelColors[e.level],
                    }}
                  >
                    {e.level}
                  </span>
                </td>
                <td style={{ fontSize: 13, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {e.message}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {e.source}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

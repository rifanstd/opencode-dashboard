import { useEffect, useState } from 'react'
import { loadTokenUsage } from '../utils/dataLoader.ts'
import TokenChart from '../components/TokenChart.tsx'
import ErrorMessage from '../components/ErrorMessage.tsx'
import type { TokenUsageData, TimeSeriesData } from '../types/index.ts'

type Breakdown = 'model' | 'provider' | 'project' | 'time'

export default function TokenUsage() {
  const [breakdown, setBreakdown] = useState<Breakdown>('model')
  const [timeGranularity, setTimeGranularity] = useState<'day' | 'week' | 'month'>('day')
  const [data, setData] = useState<TokenUsageData[] | TimeSeriesData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState({ total: 0, avg: 0, peak: 0 })

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true)
        setError(null)
        const tokenUsage = await loadTokenUsage()

        let result: TokenUsageData[] | TimeSeriesData[] = []
        if (breakdown === 'model') {
          result = tokenUsage.byModel.map((r) => ({
            label: r.label,
            input: r.input,
            output: r.output,
            reasoning: r.reasoning,
            cache: r.cache,
          }))
        } else if (breakdown === 'provider') {
          result = tokenUsage.byProvider.map((r) => ({
            label: r.label,
            input: r.input,
            output: r.output,
            reasoning: r.reasoning,
            cache: r.cache,
          }))
        } else if (breakdown === 'project') {
          result = tokenUsage.byProject.map((r) => ({
            label: r.label,
            input: r.input,
            output: r.output,
            reasoning: r.reasoning,
            cache: r.cache,
          }))
        } else {
          const timeData =
            timeGranularity === 'day'
              ? tokenUsage.byDay
              : timeGranularity === 'week'
              ? tokenUsage.byWeek
              : tokenUsage.byMonth
          result = timeData.map((r) => ({
            date: r.date,
            input: r.input,
            output: r.output,
            reasoning: r.reasoning,
            cache: r.cache,
          }))
        }
        setData(result)

        let total = 0
        let peak = 0
        for (const row of result) {
          const rowTotal = (row.input ?? 0) + (row.output ?? 0) + (row.reasoning ?? 0) + (row.cache ?? 0)
          total += rowTotal
          if (rowTotal > peak) peak = rowTotal
        }
        const avg = result.length > 0 ? Math.round(total / result.length) : 0
        setSummary({ total, avg, peak })
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [breakdown, timeGranularity])

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Token Usage</h1>
      {error && <ErrorMessage message={error} />}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={breakdown} onChange={(e) => setBreakdown(e.target.value as Breakdown)}>
          <option value="model">By Model</option>
          <option value="provider">By Provider</option>
          <option value="project">By Project</option>
          <option value="time">Over Time</option>
        </select>
        {breakdown === 'time' && (
          <select value={timeGranularity} onChange={(e) => setTimeGranularity(e.target.value as 'day' | 'week' | 'month')}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Loading…</div>
      ) : (
        <>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 16, border: '1px solid var(--border)', marginBottom: 24 }}>
            <TokenChart
              type={breakdown === 'time' ? 'area' : 'bar'}
              data={data}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 16,
            }}
          >
            <div style={{ padding: 16, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Tokens</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                {summary.total.toLocaleString()}
              </div>
            </div>
            <div style={{ padding: 16, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Average</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                {summary.avg.toLocaleString()}
              </div>
            </div>
            <div style={{ padding: 16, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Peak</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                {summary.peak.toLocaleString()}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

import { useEffect, useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
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

function formatPermission(value: string | Record<string, string> | null): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  // Object with glob patterns
  const entries = Object.entries(value)
  if (entries.length === 0) return '—'
  return entries.map(([k, v]) => `${k}: ${v}`).join(', ')
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
                edit: {formatPermission(agent.permissions.edit)} · bash: {formatPermission(agent.permissions.bash)} · glob: {formatPermission(agent.permissions.glob)}
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
                      <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => { navigate(`/sessions/${s.id}`) }}>
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
            <div
              className="markdown-preview"
              style={{
                maxHeight: showFullPrompt ? 'none' : 400,
                overflow: 'auto',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <ReactMarkdown>{promptPreview}</ReactMarkdown>
            </div>
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

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { loadSessions, loadMessages, loadParts, loadModels } from '../utils/dataLoader.ts'
import { loadPricing, calculateCost, formatCost } from '../utils/costCalculator.ts'
import TokenChart from '../components/TokenChart.tsx'
import ErrorMessage from '../components/ErrorMessage.tsx'
import type { Message, Part } from '../types/index.ts'

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<{
    id: string
    title: string
    project_id: string | null
    model_id: string | null
    created_at: string
    input_tokens: number
    output_tokens: number
    reasoning_tokens: number
    cache_tokens: number
    total_tokens: number
    cost: number | null
  } | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [partsMap, setPartsMap] = useState<Record<string, Part[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetch() {
      if (!id) return
      try {
        setLoading(true)
        setError(null)

        const [sessions, allMessages, allParts, models] = await Promise.all([
          loadSessions(),
          loadMessages(),
          loadParts(),
          loadModels(),
        ])

        const s = sessions.find((x) => x.id === id)
        if (!s) {
          setError('Session not found')
          setLoading(false)
          return
        }

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

        setSession({ ...s, cost })

        const msgs = allMessages.filter((m) => m.session_id === id)
        setMessages(msgs)

        const parts: Record<string, Part[]> = {}
        for (const msg of msgs) {
          parts[msg.id] = allParts.filter((p) => p.message_id === msg.id)
        }
        setPartsMap(parts)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [id])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <span style={{ color: 'var(--text-secondary)' }}>Loading session…</span>
      </div>
    )
  }

  return (
    <div>
      <Link to="/sessions" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
        ← Back to sessions
      </Link>
      <h1 style={{ marginTop: 12, marginBottom: 8 }}>{session?.title ?? 'Session'}</h1>
      {error && <ErrorMessage message={error} />}
      {session && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Model</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 4 }}>{session.model_id ?? '—'}</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Project</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 4 }}>{session.project_id ?? '—'}</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 4 }}>{new Date(session.created_at).toLocaleString()}</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cost</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 4 }}>{session.cost != null ? formatCost(session.cost) : '—'}</div>
            </div>
          </div>

          <h2 style={{ marginBottom: 12 }}>Token Breakdown</h2>
          <div style={{ marginBottom: 24, background: 'var(--bg-secondary)', borderRadius: 10, padding: 16, border: '1px solid var(--border)' }}>
            <TokenChart
              type="bar"
              data={[
                {
                  label: 'Tokens',
                  input: session.input_tokens,
                  output: session.output_tokens,
                  reasoning: session.reasoning_tokens,
                  cache: session.cache_tokens,
                },
              ]}
            />
          </div>

          <h2 style={{ marginBottom: 12 }}>Messages</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  padding: 16,
                  borderRadius: 10,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color:
                        msg.role === 'user'
                          ? 'var(--accent)'
                          : msg.role === 'assistant'
                          ? 'var(--success)'
                          : 'var(--text-secondary)',
                    }}
                  >
                    {msg.role}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(msg.created_at).toLocaleString()}
                  </span>
                </div>
                {msg.content && (
                  <p style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 8, whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </p>
                )}
                {partsMap[msg.id]?.map((part) => (
                  <div
                    key={part.id}
                    style={{
                      marginTop: 8,
                      padding: 10,
                      borderRadius: 6,
                      background: 'var(--bg-primary)',
                      fontSize: 13,
                    }}
                  >
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>
                      {part.type}
                      {part.tool_name ? ` — ${part.tool_name}` : ''}
                    </div>
                    {part.content && <div style={{ color: 'var(--text-secondary)' }}>{part.content}</div>}
                    {part.tool_input && (
                      <code style={{ display: 'block', marginTop: 4, fontSize: 12 }}>{part.tool_input}</code>
                    )}
                    {part.tool_output && (
                      <code style={{ display: 'block', marginTop: 4, fontSize: 12 }}>{part.tool_output}</code>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

import { useEffect, useState, useMemo, type ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import { loadSessions, loadMessages, loadParts, loadModels, loadProjects } from '../utils/dataLoader.ts'
import { loadPricing, calculateCost, formatCost, formatNumber } from '../utils/costCalculator.ts'
import { shortenModelName } from '../utils/modelUtils.ts'
import ErrorMessage from '../components/ErrorMessage.tsx'
import type { Message, Part, Project } from '../types/index.ts'

function parseContent(content: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const lines = content.split('\n')
  let inCodeBlock = false
  let codeBlockLines: string[] = []

  function flushCodeBlock() {
    if (codeBlockLines.length > 0) {
      nodes.push(
        <pre key={nodes.length} style={codeBlockStyle}>
          <code>{codeBlockLines.join('\n')}</code>
        </pre>
      )
      codeBlockLines = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock()
        inCodeBlock = false
      } else {
        if (codeBlockLines.length === 0 && nodes.length > 0) {
          codeBlockLines = []
        }
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockLines.push(line)
      continue
    }

    // Parse inline code in this line
    const parts = line.split(/(`[^`]+`)/g)
    const lineNodes: ReactNode[] = []
    parts.forEach((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        const code = part.slice(1, -1)
        lineNodes.push(
          <code key={i} style={inlineCodeStyle}>{code}</code>
        )
      } else if (part.length > 0) {
        lineNodes.push(<span key={i}>{part}</span>)
      } else {
        lineNodes.push(<span key={i}>{' '}</span>)
      }
    })
    nodes.push(<div key={nodes.length}>{lineNodes.length > 0 ? lineNodes : <br />}</div>)
  }

  flushCodeBlock()
  return nodes
}

const codeBlockStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.3)',
  fontFamily: 'var(--mono)',
  fontSize: 12,
  padding: '12px 16px',
  borderRadius: 4,
  margin: '8px 0',
  whiteSpace: 'pre-wrap',
  overflowX: 'auto',
  borderLeft: '2px solid var(--border-accent)',
}

const inlineCodeStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 12,
  padding: '2px 6px',
  borderRadius: 3,
  background: 'rgba(88,166,255,0.1)',
  color: 'var(--text-primary)',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  borderRadius: 6,
  padding: 20,
}



interface TokenBar {
  label: string
  value: number
  total: number
  opacity: number
}

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
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetch() {
      if (!id) return
      try {
        setLoading(true)
        setError(null)

        const [sessions, allMessages, allParts, models, projectsData] = await Promise.all([
          loadSessions(),
          loadMessages(),
          loadParts(),
          loadModels(),
          loadProjects(),
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
        setProjects(projectsData)

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

  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of projects) {
      map.set(p.id, p.name)
    }
    return map
  }, [projects])

  const projectName = session
    ? (session.project_id ? (projectNameMap.get(session.project_id) ?? session.project_id) : null)
    : null

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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--sans)' }}>Loading session…</span>
      </div>
    )
  }

  const tokenBars: TokenBar[] = session
    ? [
        { label: 'Input', value: session.input_tokens, total: session.total_tokens, opacity: 1 },
        { label: 'Output', value: session.output_tokens, total: session.total_tokens, opacity: 0.8 },
        { label: 'Reasoning', value: session.reasoning_tokens, total: session.total_tokens, opacity: 0.6 },
        { label: 'Cache', value: session.cache_tokens, total: session.total_tokens, opacity: 0.4 },
      ]
    : []

  return (
    <div>
      <Link
        to="/sessions"
        style={{
          fontFamily: 'var(--sans)',
          fontSize: 13,
          color: 'var(--text-secondary)',
          textDecoration: 'none',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
      >
        {'\u2190'} Back to Sessions
      </Link>

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
        {session?.title ?? 'Session'}
      </h1>

      {error && <ErrorMessage message={error} />}

      {session && (
        <>
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

          {/* Token Breakdown */}
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
            Token Breakdown
          </h2>
          <div style={{ ...cardStyle, marginBottom: 24 }}>
            {tokenBars.map((bar) => {
              const pct = bar.total > 0 ? (bar.value / bar.total) * 100 : 0
              return (
                <div
                  key={bar.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--sans)',
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      width: 100,
                      flexShrink: 0,
                    }}
                  >
                    {bar.label}
                  </span>
                  <div style={{ flex: 1, height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.max(pct, 1)}%`,
                        height: '100%',
                        background: 'var(--accent)',
                        opacity: bar.opacity,
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      fontVariantNumeric: 'tabular-nums',
                      width: 80,
                      textAlign: 'right',
                      flexShrink: 0,
                    }}
                  >
                    {formatNumber(bar.value)}
                  </span>
                </div>
              )
            })}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderTop: '1px solid var(--border)',
                paddingTop: 8,
                marginTop: 4,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  width: 100,
                  flexShrink: 0,
                }}
              >
                Total
              </span>
              <div style={{ flex: 1 }} />
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                  width: 80,
                  textAlign: 'right',
                  flexShrink: 0,
                }}
              >
                {formatNumber(session.total_tokens)}
              </span>
            </div>
          </div>

          {/* Messages */}
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
            Messages
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
          </div>
        </>
      )}
    </div>
  )
}

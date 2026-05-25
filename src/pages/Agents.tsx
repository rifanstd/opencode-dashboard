import { useEffect, useState } from 'react'
import { Bot } from 'lucide-react'
import { loadAgents } from '../utils/dataLoader.ts'
import ErrorMessage from '../components/ErrorMessage.tsx'

export default function Agents() {
  const [agents, setAgents] = useState<Array<{
    name: string
    description: string
    filename: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      {agents.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: 40, fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-muted)' }}>
          No agents found.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {agents.map((a) => (
          <div
            key={a.filename}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              transition: 'background 100ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(88,166,255,0.04)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Bot size={16} style={{ color: 'var(--text-muted)', marginRight: 12, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                }}
              >
                {a.name}
              </div>
              <div
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  marginTop: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {a.description}
              </div>
            </div>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 12,
                color: 'var(--text-muted)',
                marginLeft: 12,
                flexShrink: 0,
              }}
            >
              {a.filename}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

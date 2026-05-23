import { useEffect, useState } from 'react'
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
        <span style={{ color: 'var(--text-secondary)' }}>Loading agents…</span>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Agents</h1>
      {error && <ErrorMessage message={error} />}
      {agents.length === 0 && !error && (
        <p style={{ color: 'var(--text-secondary)' }}>No agents found. Run `npm run sync` to export data.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {agents.map((a) => (
          <div
            key={a.filename}
            style={{
              padding: 16,
              borderRadius: 10,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              {a.name}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{a.description}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{a.filename}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

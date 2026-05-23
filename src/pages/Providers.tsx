import { useEffect, useState } from 'react'
import { loadProviders } from '../utils/dataLoader.ts'
import ErrorMessage from '../components/ErrorMessage.tsx'

function maskKey(key: string): string {
  if (key.length <= 7) return '•••••••'
  return key.slice(0, 3) + '...' + key.slice(-4)
}

export default function Providers() {
  const [providers, setProviders] = useState<Array<{
    id: string
    name: string
    apiKey: string | null
    baseUrl: string | null
    configured: boolean
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true)
        setError(null)
        const data = await loadProviders()
        setProviders(data)
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
        <span style={{ color: 'var(--text-secondary)' }}>Loading providers…</span>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Providers</h1>
      {error && <ErrorMessage message={error} />}
      {providers.length === 0 && !error && (
        <p style={{ color: 'var(--text-secondary)' }}>No providers found. Run `npm run sync` to export data.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {providers.map((p) => (
          <div
            key={p.id}
            style={{
              padding: 16,
              borderRadius: 10,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
              <span
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: p.configured ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                  color: p.configured ? 'var(--success)' : 'var(--text-muted)',
                }}
              >
                {p.configured ? 'Configured' : 'Not Configured'}
              </span>
            </div>
            {p.apiKey && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--mono)' }}>
                Key: {maskKey(p.apiKey)}
              </div>
            )}
            {p.baseUrl && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                URL: {p.baseUrl}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

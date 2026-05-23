import { useEffect, useState } from 'react'
import { loadModels } from '../utils/dataLoader.ts'
import ErrorMessage from '../components/ErrorMessage.tsx'

export default function Models() {
  const [models, setModels] = useState<Array<{
    id: string
    name: string
    provider: string
    capabilities: string[]
    inputPrice: number
    outputPrice: number
    contextWindow: number
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<'id' | 'provider'>('id')

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true)
        setError(null)
        const data = await loadModels()
        const entries = data.map((m) => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
          capabilities: m.capabilities,
          inputPrice: m.input_price,
          outputPrice: m.output_price,
          contextWindow: m.context_window,
        }))
        setModels(entries)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [])

  const sorted = [...models].sort((a, b) => {
    if (sortKey === 'id') return a.id.localeCompare(b.id)
    return a.provider.localeCompare(b.provider)
  })

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <span style={{ color: 'var(--text-secondary)' }}>Loading models…</span>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Models</h1>
      {error && <ErrorMessage message={error} />}
      {models.length === 0 && !error && (
        <p style={{ color: 'var(--text-secondary)' }}>No models found. Run `npm run sync` to export data.</p>
      )}

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => setSortKey('id')} style={{ padding: '6px 12px' }}>
          Sort by ID
        </button>
        <button type="button" onClick={() => setSortKey('provider')} style={{ padding: '6px 12px' }}>
          Sort by Provider
        </button>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
        <table>
          <thead>
            <tr>
              <th>Model ID</th>
              <th>Provider</th>
              <th>Capabilities</th>
              <th>Input Price</th>
              <th>Output Price</th>
              <th>Context Window</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.id}>
                <td style={{ fontWeight: 500 }}>{m.id}</td>
                <td>{m.provider}</td>
                <td>{m.capabilities.join(', ') || '—'}</td>
                <td>${m.inputPrice.toFixed(6)}</td>
                <td>${m.outputPrice.toFixed(6)}</td>
                <td>{m.contextWindow.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

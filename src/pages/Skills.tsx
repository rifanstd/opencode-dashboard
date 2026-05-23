import { useEffect, useState } from 'react'
import { loadSkills } from '../utils/dataLoader.ts'
import ErrorMessage from '../components/ErrorMessage.tsx'

export default function Skills() {
  const [skills, setSkills] = useState<Array<{
    name: string
    version: string
    source: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true)
        setError(null)
        const data = await loadSkills()
        setSkills(data)
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
        <span style={{ color: 'var(--text-secondary)' }}>Loading skills…</span>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Skills</h1>
      {error && <ErrorMessage message={error} />}
      {skills.length === 0 && !error && (
        <p style={{ color: 'var(--text-secondary)' }}>No skills found. Run `npm run sync` to export data.</p>
      )}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
        <table>
          <thead>
            <tr>
              <th>Skill Name</th>
              <th>Version</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {skills.map((s) => (
              <tr key={s.name}>
                <td style={{ fontWeight: 500 }}>{s.name}</td>
                <td>{s.version}</td>
                <td>{s.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

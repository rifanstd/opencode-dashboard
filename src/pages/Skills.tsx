import { useEffect, useState } from 'react'
import { Wrench } from 'lucide-react'
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
        <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--sans)' }}>Loading skills…</span>
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
        Skills
      </h1>
      {error && <ErrorMessage message={error} />}
      {skills.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: 40, fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-muted)' }}>
          No skills found.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {skills.map((s) => (
          <div
            key={s.name}
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
            <Wrench size={16} style={{ color: 'var(--text-muted)', marginRight: 12, flexShrink: 0 }} />
            <span
              style={{
                fontFamily: 'var(--sans)',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--text-primary)',
                flex: 1,
              }}
            >
              {s.name}
            </span>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 12,
                color: 'var(--text-muted)',
                marginLeft: 12,
                flexShrink: 0,
              }}
            >
              v{s.version}
            </span>
            <span
              style={{
                fontFamily: 'var(--sans)',
                fontSize: 12,
                color: 'var(--text-muted)',
                marginLeft: 16,
                flexShrink: 0,
              }}
            >
              {s.source}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

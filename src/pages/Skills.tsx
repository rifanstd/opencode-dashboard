import { useEffect, useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { loadSkills } from '../utils/dataLoader.ts'
import DataTable from '../components/DataTable.tsx'
import ErrorMessage from '../components/ErrorMessage.tsx'

export default function Skills() {
  const [skills, setSkills] = useState<Array<{
    name: string
    description: string
    path: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

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

  const filteredSkills = useMemo(() => {
    if (!search) return skills
    const q = search.toLowerCase()
    return skills.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    )
  }, [skills, search])

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
      {skills.length > 0 && (
        <>
          <div style={{ marginBottom: 20 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: 8, color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 13,
                  height: 32,
                  padding: '0 10px 0 28px',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  minWidth: 200,
                }}
              />
            </div>
          </div>
          {filteredSkills.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-muted)' }}>
              No skills found.
            </div>
          ) : (
            <DataTable
              columns={[
                { key: 'name', header: 'Name', width: '200px' },
                { key: 'description', header: 'Description' },
                { key: 'path', header: 'Path' },
              ]}
              data={filteredSkills}
              keyExtractor={(row) => row.name}
            />
          )}
        </>
      )}
    </div>
  )
}

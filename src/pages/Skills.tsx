import { useEffect, useState, useMemo } from 'react'
import { Search, FolderOpen } from 'lucide-react'
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

      {/* Data Source Info */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderLeft: '3px solid var(--accent)',
          borderRadius: 6,
          padding: '16px 20px',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <FolderOpen size={14} style={{ color: 'var(--accent)' }} />
          <span
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Data Sources
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'Global config', path: '~/.config/opencode/skills/<name>/SKILL.md' },
            { label: 'Global Claude-compatible', path: '~/.claude/skills/<name>/SKILL.md' },
            { label: 'Global agent-compatible', path: '~/.agents/skills/<name>/SKILL.md' },
          ].map((source) => (
            <div
              key={source.label}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 12,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  minWidth: 140,
                  flexShrink: 0,
                }}
              >
                {source.label}
              </span>
              <code
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  background: 'var(--bg-tertiary)',
                  padding: '2px 8px',
                  borderRadius: 4,
                  wordBreak: 'break-all',
                }}
              >
                {source.path}
              </code>
            </div>
          ))}
        </div>
      </div>

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

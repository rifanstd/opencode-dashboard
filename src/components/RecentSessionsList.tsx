import { useNavigate } from 'react-router-dom'
import type { RecentSessionRow, ModelInfo } from '../types/index.ts'
import { formatCost } from '../utils/costCalculator.ts'

interface RecentSessionsListProps {
  sessions: RecentSessionRow[]
  models?: ModelInfo[]
}

function getModelName(modelId: string | null, models: ModelInfo[] | undefined): string {
  if (!modelId) return '—'
  const model = models?.find((m) => m.id === modelId)
  return model?.name || modelId
}

export default function RecentSessionsList({ sessions, models }: RecentSessionsListProps) {
  const navigate = useNavigate()

  if (sessions.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
        No recent sessions
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>Recent Sessions</h3>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Model</th>
              <th>Total Tokens</th>
              <th>Estimated Cost</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr
                key={s.id}
                onClick={() => navigate(`/sessions/${s.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.title}
                </td>
                <td>{getModelName(s.model_id, models)}</td>
                <td>{s.total_tokens.toLocaleString()}</td>
                <td>{formatCost(s.computedCost)}</td>
                <td>{new Date(s.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

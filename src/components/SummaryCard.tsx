interface SummaryCardProps {
  label: string
  value: string | number
  subLabel?: string
  trend?: 'up' | 'down' | 'neutral'
}

const trendSymbols: Record<string, string> = {
  up: '↑',
  down: '↓',
  neutral: '—',
}

const trendColors: Record<string, string> = {
  up: 'var(--success, #22c55e)',
  down: 'var(--danger, #ef4444)',
  neutral: 'var(--text-muted)',
}

export default function SummaryCard({ label, value, subLabel, trend }: SummaryCardProps) {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 10,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
        {value}
      </div>
      {subLabel && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {trend && trend !== 'neutral' && (
            <span style={{ color: trendColors[trend], fontWeight: 700 }}>{trendSymbols[trend]}</span>
          )}
          <span>{subLabel}</span>
        </div>
      )}
    </div>
  )
}

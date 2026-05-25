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
  up: 'var(--success)',
  down: 'var(--danger)',
  neutral: 'var(--text-muted)',
}

export default function SummaryCard({ label, value, subLabel, trend }: SummaryCardProps) {
  return (
    <div
      style={{
        padding: '20px 24px',
        borderRadius: 6,
        background: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'background 200ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-tertiary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-secondary)'
      }}
    >
      <div
        style={{
          fontFamily: 'var(--sans)',
          fontSize: 11,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 28,
          fontWeight: 500,
          color: 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-1px',
        }}
      >
        {value}
      </div>
      {subLabel && (
        <div
          style={{
            fontFamily: 'var(--sans)',
            fontSize: 11,
            color: 'var(--text-muted)',
            marginTop: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {trend && trend !== 'neutral' && (
            <span style={{ color: trendColors[trend], fontWeight: 600 }}>
              {trendSymbols[trend]}
            </span>
          )}
          <span>{subLabel}</span>
        </div>
      )}
    </div>
  )
}

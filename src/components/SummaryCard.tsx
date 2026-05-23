interface SummaryCardProps {
  label: string
  value: string | number
  subLabel?: string
}

export default function SummaryCard({ label, value, subLabel }: SummaryCardProps) {
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
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subLabel}</div>
      )}
    </div>
  )
}

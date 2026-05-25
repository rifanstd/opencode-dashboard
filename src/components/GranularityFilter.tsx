import type { Granularity } from '../types/index.ts'

const options: { value: Granularity; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' },
]

interface GranularityFilterProps {
  value: Granularity
  onChange: (g: Granularity) => void
}

export default function GranularityFilter({ value, onChange }: GranularityFilterProps) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: value === opt.value ? 'var(--accent)' : 'var(--bg-secondary)',
            color: value === opt.value ? '#fff' : 'var(--text-secondary)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
} from 'recharts'
import type { Granularity, DailyCostPoint } from '../types/index.ts'
import { formatCost, formatDateTick } from '../utils/costCalculator.ts'

interface CostChartProps {
  data: DailyCostPoint[]
  granularity: Granularity
  onGranularityChange: (g: Granularity) => void
}

const granularityOptions: { value: Granularity; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' },
]

function CustomTooltip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !payload || !Array.isArray(payload) || payload.length === 0) return null
  return (
    <div
      style={{
        background: '#1c2128',
        border: '1px solid #30363d',
        borderRadius: 6,
        padding: '8px 12px',
        fontFamily: 'var(--mono)',
        fontSize: 12,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>
        {formatDateTick(String(label ?? ''), 'all')}
      </div>
      {(payload as Array<Record<string, unknown>>).map((entry, i) => (
        <div key={i} style={{ color: 'var(--accent)' }}>
          Cost: {formatCost(typeof entry.value === 'number' ? entry.value : 0)}
        </div>
      ))}
    </div>
  )
}

export default function CostChart({
  data,
  granularity,
  onGranularityChange,
}: CostChartProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span
          style={{
            fontFamily: 'var(--sans)',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          Cost
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          {granularityOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onGranularityChange(opt.value)}
              style={{
                fontFamily: 'var(--sans)',
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 4,
                border: 'none',
                background: granularity === opt.value ? 'var(--bg-tertiary)' : 'transparent',
                color: granularity === opt.value ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'background 150ms, color 150ms',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ width: '100%', height: 300 }} aria-label="Cost line chart">
        {data.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              fontFamily: 'var(--sans)',
              fontSize: 13,
            }}
          >
            No cost data
          </div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={data} margin={{ left: 0, right: 8, top: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="costAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#21262d" strokeWidth={0.5} vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip content={CustomTooltip} />
              <Area
                type="monotone"
                dataKey="cost"
                fill="url(#costAreaGrad)"
                stroke="none"
                animationDuration={800}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="cost"
                stroke="var(--accent)"
                strokeWidth={1.5}
                dot={false}
                animationDuration={800}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

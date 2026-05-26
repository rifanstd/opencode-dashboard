import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { Granularity, TokenUsageChartPoint } from '../types/index.ts'
import { formatNumber, formatDateTick } from '../utils/costCalculator.ts'

interface TokenUsageChartProps {
  data: TokenUsageChartPoint[]
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
        <div key={i} style={{ color: String(entry.color ?? 'var(--text-primary)') }}>
          {String(entry.name ?? '')}: {formatNumber(Number(entry.value) || 0)}
        </div>
      ))}
    </div>
  )
}

export default function TokenUsageChart({
  data,
  granularity,
  onGranularityChange,
}: TokenUsageChartProps) {
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
          Token Usage
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
      <div style={{ width: '100%', height: 300 }} aria-label="Token usage line chart">
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
            No data available
          </div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={data} margin={{ left: 8, right: 8, top: 5, bottom: 20 }}>
              <defs>
                <linearGradient id="tokenAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#21262d" strokeWidth={0.5} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => formatDateTick(d, granularity)}
                stroke="var(--text-secondary)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                dy={8}
              />
              <YAxis
                tickFormatter={(v: number) => formatNumber(v)}
                stroke="var(--text-secondary)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip content={CustomTooltip} cursor={false} contentStyle={{ background: 'none', border: 'none', padding: 0 }} />
              <Line
                type="monotone"
                dataKey="inputTotal"
                name="Input + Cache"
                stroke="var(--accent)"
                strokeWidth={1.5}
                dot={false}
                animationDuration={800}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="output"
                name="Output"
                stroke="var(--chart-2)"
                strokeWidth={1.5}
                dot={false}
                animationDuration={800}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="reasoning"
                name="Reasoning"
                stroke="var(--chart-3)"
                strokeWidth={1.5}
                dot={false}
                animationDuration={800}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="cacheRead"
                name="Cache Read"
                stroke="var(--chart-5)"
                strokeWidth={1.5}
                dot={false}
                animationDuration={800}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="cacheMiss"
                name="Cache Miss"
                stroke="var(--chart-4)"
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

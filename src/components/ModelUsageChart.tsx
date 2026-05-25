import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { ModelUsageBarItem } from '../types/index.ts'
import { formatNumber } from '../utils/costCalculator.ts'

interface ModelUsageChartProps {
  data: ModelUsageBarItem[]
}

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
      <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>{String(label ?? '')}</div>
      <div style={{ color: 'var(--accent)' }}>
        {formatNumber(typeof payload[0]?.value === 'number' ? (payload[0] as Record<string, unknown>).value as number : 0)} tokens
      </div>
    </div>
  )
}

export default function ModelUsageChart({ data }: ModelUsageChartProps) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <span
          style={{
            fontFamily: 'var(--sans)',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          Model Usage
        </span>
      </div>
      <div style={{ width: '100%', height: 300 }} aria-label="Model usage bar chart">
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
            <BarChart data={data} margin={{ left: 0, right: 8, top: 5, bottom: 5 }}>
              <CartesianGrid stroke="#21262d" strokeWidth={0.5} vertical={false} />
              <XAxis dataKey="label" hide />
              <YAxis hide />
              <Tooltip content={CustomTooltip} />
              <Bar
                dataKey="totalTokens"
                fill="var(--accent)"
                fillOpacity={0.85}
                radius={[2, 2, 0, 0]}
                maxBarSize={40}
                animationDuration={600}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

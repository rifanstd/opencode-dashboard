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
  const data = (payload[0] as Record<string, unknown>)?.payload as ModelUsageBarItem | undefined
  const totalTokens = typeof payload[0]?.value === 'number'
    ? (payload[0] as Record<string, unknown>).value as number
    : 0

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
        {formatNumber(totalTokens)} tokens
      </div>
      {data?.providers && data.providers.length > 1 && (
        <div style={{ marginTop: 6, borderTop: '1px solid #30363d', paddingTop: 4 }}>
          {data.providers.map((p) => (
            <div key={p.provider} style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {p.provider}: {formatNumber(p.input + p.output + p.reasoning + p.cache)} tokens
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ModelUsageChart({ data }: ModelUsageChartProps) {
  const hasLongLabels = data.some((d) => d.label.length > 15)

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
            <BarChart data={data} margin={{ left: 8, right: 8, top: 5, bottom: hasLongLabels ? 40 : 20 }}>
              <CartesianGrid stroke="#21262d" strokeWidth={0.5} vertical={false} />
              <XAxis
                dataKey="label"
                stroke="var(--text-secondary)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                angle={hasLongLabels ? -45 : 0}
                textAnchor={hasLongLabels ? 'end' : 'middle'}
                height={hasLongLabels ? 60 : undefined}
                dy={hasLongLabels ? -4 : 8}
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

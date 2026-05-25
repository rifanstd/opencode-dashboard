import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { DonutSegment } from '../types/index.ts'
import { formatNumber } from '../utils/costCalculator.ts'

interface TokenCompositionChartProps {
  data: DonutSegment[]
}

export default function TokenCompositionChart({ data }: TokenCompositionChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const hasData = total > 0

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>Token Composition</h3>
      </div>
      <div style={{ width: '100%', height: 320 }} aria-label="Token composition donut chart">
        {!hasData ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            No data available
          </div>
        ) : (
          <ResponsiveContainer>
            <PieChart margin={{ left: 0, right: 8, top: 5, bottom: 5 }}>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="80%"
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                stroke="var(--bg-secondary)"
                strokeWidth={2}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                }}
                formatter={(val, name) => {
                  const num = typeof val === 'number' ? val : 0
                  const pct = total > 0 ? ((num / total) * 100).toFixed(1) : '0.0'
                  return [`${formatNumber(num)} (${pct}%)`, String(name)]
                }}
              />
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                formatter={(value: string) => {
                  const segment = data.find((d) => d.name === value)
                  if (!segment) return value
                  const pct = total > 0 ? ((segment.value / total) * 100).toFixed(1) : '0.0'
                  return `${value} — ${formatNumber(segment.value)} (${pct}%)`
                }}
                wrapperStyle={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  paddingTop: 8,
                }}
              />
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="central"
                style={{ fontSize: 20, fontWeight: 700, fill: 'var(--text-primary)' }}
              >
                {formatNumber(total)}
              </text>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

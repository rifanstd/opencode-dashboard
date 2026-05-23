import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { DonutSegment } from '../types/index.ts'

interface TokenCompositionChartProps {
  data: DonutSegment[]
}

export default function TokenCompositionChart({ data }: TokenCompositionChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>Token Composition</h3>
      </div>
      <div style={{ width: '100%', height: 320 }} aria-label="Token composition donut chart">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="85%"
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
              return [`${num.toLocaleString()} (${pct}%)`, String(name)]
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      </div>
    </div>
  )
}

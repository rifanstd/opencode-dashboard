import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { ModelUsageBarItem } from '../types/index.ts'
import { formatNumber } from '../utils/costCalculator.ts'

interface ModelUsageChartProps {
  data: ModelUsageBarItem[]
}

const modelColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
]

export default function ModelUsageChart({ data }: ModelUsageChartProps) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>Model Usage</h3>
      </div>
      <div style={{ width: '100%', height: 320 }} aria-label="Model usage vertical bar chart">
        {data.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            No data available
          </div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={data} margin={{ left: 0, right: 8, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="label"
                stroke="var(--text-secondary)"
                tick={{ fontSize: 11 }}
              />
              <YAxis
                stroke="var(--text-secondary)"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => formatNumber(v)}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                }}
                formatter={(value) => [
                  formatNumber(typeof value === 'number' ? value : 0),
                  'Total Tokens',
                ]}
                labelFormatter={(label) => String(label)}
              />
              <Bar dataKey="totalTokens" radius={[4, 4, 0, 0]}>
                {data.map((item, index) => (
                  <Cell key={item.label} fill={modelColors[index % modelColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {data.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          {data.map((item, index) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: modelColors[index % modelColors.length] }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { ModelBreakdownItem } from '../types/index.ts'

interface TopModelsChartProps {
  data: ModelBreakdownItem[]
  sortBy: 'tokens' | 'cost'
  onSortChange: (sortBy: 'tokens' | 'cost') => void
}

const colors = {
  input: 'var(--chart-1)',
  output: 'var(--chart-2)',
  reasoning: 'var(--chart-3)',
  cache: 'var(--chart-4)',
}

export default function TopModelsChart({ data, sortBy, onSortChange }: TopModelsChartProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>Top Models</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => onSortChange('tokens')}
            aria-pressed={sortBy === 'tokens'}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: sortBy === 'tokens' ? 'var(--accent)' : 'var(--bg-secondary)',
              color: sortBy === 'tokens' ? '#fff' : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            By Tokens
          </button>
          <button
            onClick={() => onSortChange('cost')}
            aria-pressed={sortBy === 'cost'}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: sortBy === 'cost' ? 'var(--accent)' : 'var(--bg-secondary)',
              color: sortBy === 'cost' ? '#fff' : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            By Cost
          </button>
        </div>
      </div>
      <div style={{ width: '100%', height: 320 }} aria-label="Top models horizontal bar chart">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
            <YAxis
              dataKey="label"
              type="category"
              stroke="var(--text-secondary)"
              tick={{ fontSize: 11 }}
              width={100}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-primary)',
              }}
              formatter={(value, name) => {
                const num = typeof value === 'number' ? value : 0
                return [num.toLocaleString(), String(name)]
              }}
            />
            <Legend />
            <Bar dataKey="input" stackId="a" fill={colors.input} />
            <Bar dataKey="output" stackId="a" fill={colors.output} />
            <Bar dataKey="reasoning" stackId="a" fill={colors.reasoning} />
            <Bar dataKey="cache" stackId="a" fill={colors.cache} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

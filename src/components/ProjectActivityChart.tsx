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
import type { ProjectBreakdownItem } from '../types/index.ts'

interface ProjectActivityChartProps {
  data: ProjectBreakdownItem[]
}

const colors = {
  input: 'var(--chart-1)',
  output: 'var(--chart-2)',
  reasoning: 'var(--chart-3)',
  cache: 'var(--chart-4)',
}

export default function ProjectActivityChart({ data }: ProjectActivityChartProps) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>Project Activity</h3>
      </div>
      <div style={{ width: '100%', height: 320 }} aria-label="Project activity vertical bar chart">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="label"
              stroke="var(--text-secondary)"
              tick={{ fontSize: 11 }}
            />
            <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-primary)',
              }}
              formatter={(value, name) => [typeof value === 'number' ? value.toLocaleString() : String(value), String(name)]}
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

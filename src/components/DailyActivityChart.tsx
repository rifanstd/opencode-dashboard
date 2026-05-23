import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { TimeRange, TimeSeriesData } from '../types/index.ts'
import TimeRangeSelector from './TimeRangeSelector.tsx'

interface DailyActivityChartProps {
  data: TimeSeriesData[]
  range: TimeRange
  onRangeChange: (range: TimeRange) => void
}

const colors = {
  input: 'var(--chart-1)',
  output: 'var(--chart-2)',
  reasoning: 'var(--chart-3)',
  cache: 'var(--chart-4)',
}

function formatDateTick(dateStr: string, range: TimeRange): string {
  const d = new Date(dateStr + 'T00:00:00.000Z')
  const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  const day = d.getUTCDate()
  if (range === '90d' || range === 'all') {
    const year = d.getUTCFullYear()
    return `${month} ${year}`
  }
  return `${month} ${day}`
}

export default function DailyActivityChart({ data, range, onRangeChange }: DailyActivityChartProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>Daily Activity</h3>
        <TimeRangeSelector value={range} onChange={onRangeChange} />
      </div>
      <div style={{ width: '100%', height: 320 }} aria-label="Daily token activity stacked area chart">
        <ResponsiveContainer>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              stroke="var(--text-secondary)"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: string) => formatDateTick(v, range)}
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
            <Area
              type="monotone"
              dataKey="input"
              stackId="1"
              stroke={colors.input}
              fill={colors.input}
              fillOpacity={0.4}
            />
            <Area
              type="monotone"
              dataKey="output"
              stackId="1"
              stroke={colors.output}
              fill={colors.output}
              fillOpacity={0.4}
            />
            <Area
              type="monotone"
              dataKey="reasoning"
              stackId="1"
              stroke={colors.reasoning}
              fill={colors.reasoning}
              fillOpacity={0.4}
            />
            <Area
              type="monotone"
              dataKey="cache"
              stackId="1"
              stroke={colors.cache}
              fill={colors.cache}
              fillOpacity={0.4}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { TimeRange, DailyCostPoint } from '../types/index.ts'
import TimeRangeSelector from './TimeRangeSelector.tsx'
import { formatCost } from '../utils/costCalculator.ts'

interface CostTrendChartProps {
  data: DailyCostPoint[]
  range: TimeRange
  onRangeChange: (range: TimeRange) => void
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

export default function CostTrendChart({ data, range, onRangeChange }: CostTrendChartProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>Cost Trend</h3>
        <TimeRangeSelector value={range} onChange={onRangeChange} />
      </div>
      <div style={{ width: '100%', height: 320 }} aria-label="Daily cost trend area chart">
        <ResponsiveContainer>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              stroke="var(--text-secondary)"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: string) => formatDateTick(v, range)}
            />
            <YAxis
              stroke="var(--text-secondary)"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => formatCost(v)}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-primary)',
              }}
              formatter={(value) => [formatCost(typeof value === 'number' ? value : 0), 'Cost']}
              labelFormatter={(label) => formatDateTick(String(label), range)}
            />
            <Area
              type="monotone"
              dataKey="cost"
              stroke="var(--accent)"
              fill="var(--accent)"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

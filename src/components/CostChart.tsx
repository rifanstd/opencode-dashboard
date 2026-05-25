import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { Granularity, DailyCostPoint } from '../types/index.ts'
import GranularityFilter from './GranularityFilter.tsx'
import { formatNumber, formatCost, formatDateTick } from '../utils/costCalculator.ts'

interface CostChartProps {
  data: DailyCostPoint[]
  granularity: Granularity
  onGranularityChange: (g: Granularity) => void
}

export default function CostChart({
  data,
  granularity,
  onGranularityChange,
}: CostChartProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>Cost</h3>
        <GranularityFilter value={granularity} onChange={onGranularityChange} />
      </div>
      <div style={{ width: '100%', height: 320 }} aria-label="Cost line chart">
        {data.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            No cost data
          </div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={data} margin={{ left: 0, right: 8, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                stroke="var(--text-secondary)"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => formatDateTick(v, granularity)}
              />
              <YAxis
                stroke="var(--text-secondary)"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => '$' + formatNumber(v)}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                }}
                formatter={(value) => [
                  formatCost(typeof value === 'number' ? value : 0),
                  'Cost',
                ]}
                labelFormatter={(label) => formatDateTick(String(label), granularity)}
              />
              <Line
                type="monotone"
                dataKey="cost"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

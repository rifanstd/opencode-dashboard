import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { Granularity, TokenUsageChartPoint } from '../types/index.ts'
import GranularityFilter from './GranularityFilter.tsx'
import { formatNumber, formatDateTick } from '../utils/costCalculator.ts'

interface TokenUsageChartProps {
  data: TokenUsageChartPoint[]
  granularity: Granularity
  onGranularityChange: (g: Granularity) => void
}

const lineConfigs = [
  { dataKey: 'inputTotal', name: 'Input Tokens',   stroke: 'var(--chart-1)' },
  { dataKey: 'cacheRead',  name: 'Cache Read',      stroke: 'var(--chart-4)' },
  { dataKey: 'cacheMiss',  name: 'Cache Miss',      stroke: 'var(--chart-5)' },
  { dataKey: 'output',     name: 'Output Tokens',   stroke: 'var(--chart-2)' },
  { dataKey: 'reasoning',  name: 'Reasoning',       stroke: 'var(--chart-3)' },
]

export default function TokenUsageChart({
  data,
  granularity,
  onGranularityChange,
}: TokenUsageChartProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>Token Usage</h3>
        <GranularityFilter value={granularity} onChange={onGranularityChange} />
      </div>
      <div style={{ width: '100%', height: 320 }} aria-label="Token usage line chart with 5 series">
        {data.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            No data available
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
                tickFormatter={(v: number) => formatNumber(v)}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                }}
                formatter={(value, name) => [
                  formatNumber(typeof value === 'number' ? value : 0),
                  String(name),
                ]}
                labelFormatter={(label) => formatDateTick(String(label), granularity)}
              />
              <Legend />
              {lineConfigs.map((cfg) => (
                <Line
                  key={cfg.dataKey}
                  type="monotone"
                  dataKey={cfg.dataKey}
                  name={cfg.name}
                  stroke={cfg.stroke}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

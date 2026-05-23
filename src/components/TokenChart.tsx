import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts'
import type { TokenUsageData, TimeSeriesData } from '../types/index.ts'

interface TokenChartProps {
  type: 'bar' | 'line' | 'area'
  data: TokenUsageData[] | TimeSeriesData[]
}

const colors = {
  input: 'var(--chart-1)',
  output: 'var(--chart-2)',
  reasoning: 'var(--chart-3)',
  cache: 'var(--chart-4)',
}

export default function TokenChart({ type, data }: TokenChartProps) {
  const chartData = data as unknown as Array<Record<string, string | number>>

  const renderChart = () => {
    if (type === 'bar') {
      return (
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
          <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-primary)',
            }}
          />
          <Legend />
          <Bar dataKey="input" stackId="a" fill={colors.input} />
          <Bar dataKey="output" stackId="a" fill={colors.output} />
          <Bar dataKey="reasoning" stackId="a" fill={colors.reasoning} />
          <Bar dataKey="cache" stackId="a" fill={colors.cache} />
        </BarChart>
      )
    }

    if (type === 'line') {
      return (
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
          <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-primary)',
            }}
          />
          <Legend />
          <Line type="monotone" dataKey="input" stroke={colors.input} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="output" stroke={colors.output} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="reasoning" stroke={colors.reasoning} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="cache" stroke={colors.cache} strokeWidth={2} dot={false} />
        </LineChart>
      )
    }

    return (
      <AreaChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
        <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text-primary)',
          }}
        />
        <Legend />
        <Area type="monotone" dataKey="input" stackId="1" stroke={colors.input} fill={colors.input} fillOpacity={0.4} />
        <Area type="monotone" dataKey="output" stackId="1" stroke={colors.output} fill={colors.output} fillOpacity={0.4} />
        <Area type="monotone" dataKey="reasoning" stackId="1" stroke={colors.reasoning} fill={colors.reasoning} fillOpacity={0.4} />
        <Area type="monotone" dataKey="cache" stackId="1" stroke={colors.cache} fill={colors.cache} fillOpacity={0.4} />
      </AreaChart>
    )
  }

  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer>{renderChart()}</ResponsiveContainer>
    </div>
  )
}

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { DonutSegment } from '../types/index.ts'
import { formatNumber } from '../utils/costCalculator.ts'

interface TokenCompositionChartProps {
  data: DonutSegment[]
}

function CustomTooltip({ active, payload }: Record<string, unknown>) {
  if (!active || !payload || !Array.isArray(payload) || payload.length === 0) return null
  const entry = payload[0] as Record<string, unknown>
  return (
    <div
      style={{
        background: '#1c2128',
        border: '1px solid #30363d',
        borderRadius: 6,
        padding: '8px 12px',
        fontFamily: 'var(--mono)',
        fontSize: 12,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ color: String(entry.color ?? 'var(--text-secondary)') }}>
        {String(entry.name ?? '')}: {formatNumber(typeof entry.value === 'number' ? entry.value as number : 0)}
      </div>
    </div>
  )
}

export default function TokenCompositionChart({ data }: TokenCompositionChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const hasData = total > 0

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <span
          style={{
            fontFamily: 'var(--sans)',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          Token Composition
        </span>
      </div>
      <div style={{ width: '100%', height: 300 }} aria-label="Token composition donut chart">
        {!hasData ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              fontFamily: 'var(--sans)',
              fontSize: 13,
            }}
          >
            No data available
          </div>
        ) : (
          <ResponsiveContainer>
            <PieChart margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="65%"
                outerRadius="80%"
                paddingAngle={0}
                dataKey="value"
                nameKey="name"
                stroke="none"
                animationDuration={700}
                animationEasing="ease-out"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={CustomTooltip} />
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="central"
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 18,
                  fontWeight: 500,
                  fill: 'var(--text-primary)',
                }}
              >
                {formatNumber(total)}
              </text>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      {hasData && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '4px 16px',
            marginTop: 8,
          }}
        >
          {data.map((seg) => {
            const pct = total > 0 ? ((seg.value / total) * 100).toFixed(1) : '0.0'
            return (
              <div
                key={seg.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: seg.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--sans)',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {seg.name}{' '}
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
                    {pct}%
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

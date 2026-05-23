import { useState, useMemo } from 'react'
import type { HeatmapData } from '../types/index.ts'

interface ActivityHeatmapProps {
  data: HeatmapData
}

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getCssVariable(name: string): string {
  if (typeof window === 'undefined') return '#6366f1'
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || '#6366f1'
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16)
    const g = parseInt(clean[1] + clean[1], 16)
    const b = parseInt(clean[2] + clean[2], 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null)

  const maxVal = Math.max(1, ...data.flat())

  const accentColor = useMemo(() => getCssVariable('--accent'), [])

  return (
    <div aria-label="Activity heatmap showing message distribution by day and hour">
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>Activity Heatmap</h3>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 360 }}>
          {/* Header row */}
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <div style={{ width: 40, flexShrink: 0 }} />
            <div style={{ display: 'flex', flex: 1, gap: 2 }}>
              {Array.from({ length: 24 }, (_, h) => (
                <div
                  key={h}
                  style={{
                    flex: 1,
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    visibility: h % 4 === 0 ? 'visible' : 'hidden',
                  }}
                >
                  {h.toString().padStart(2, '0')}
                </div>
              ))}
            </div>
          </div>

          {/* Data rows */}
          {data.map((row, rowIndex) => (
            <div key={rowIndex} style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <div
                style={{
                  width: 40,
                  flexShrink: 0,
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  textAlign: 'right',
                  paddingRight: 8,
                }}
              >
                {dayLabels[rowIndex]}
              </div>
              <div style={{ display: 'flex', flex: 1, gap: 2 }}>
                {row.map((val, colIndex) => {
                  const intensity = val / maxVal
                  return (
                    <div
                      key={colIndex}
                      title={`${dayLabels[rowIndex]} ${colIndex.toString().padStart(2, '0')}:00 — ${val} messages`}
                      onMouseEnter={() => setHovered({ row: rowIndex, col: colIndex })}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        flex: 1,
                        aspectRatio: '1',
                        borderRadius: 2,
                        background: hexToRgba(accentColor, Math.max(0.08, intensity)),
                        cursor: 'default',
                        transition: 'background 0.15s',
                        border:
                          hovered?.row === rowIndex && hovered?.col === colIndex
                            ? '1px solid var(--accent)'
                            : '1px solid transparent',
                      }}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

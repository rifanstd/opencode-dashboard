import type { ReactNode } from 'react'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  width?: string
  numeric?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  sortKey?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (key: string) => void
  keyExtractor: (row: T) => string
  onRowClick?: (row: T) => void
}

export default function DataTable<T>({
  columns,
  data,
  sortKey,
  sortOrder,
  onSort,
  keyExtractor,
  onRowClick,
}: DataTableProps<T>) {
  const empty = data.length === 0

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ minWidth: '100%' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  width: col.width,
                  cursor: onSort ? 'pointer' : undefined,
                  userSelect: 'none',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                  background: 'var(--bg-primary)',
                  padding: '10px 16px',
                  fontFamily: 'var(--sans)',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: 600,
                }}
                onClick={() => onSort?.(col.key)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {col.header}
                  {sortKey === col.key && (
                    <span style={{ fontSize: 10 }}>{sortOrder === 'asc' ? '\u25B2' : '\u25BC'}</span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  textAlign: 'center',
                  padding: '40px 16px',
                  fontFamily: 'var(--sans)',
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  borderBottom: 'none',
                }}
              >
                No data
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick?.(row)}
                style={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {columns.map((col) => {
                  const cellStyle: React.CSSProperties = {
                    padding: '12px 16px',
                    fontFamily: col.numeric ? 'var(--mono)' : 'var(--sans)',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    fontVariantNumeric: col.numeric ? 'tabular-nums' : undefined,
                  }
                  return (
                    <td key={col.key} style={cellStyle}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

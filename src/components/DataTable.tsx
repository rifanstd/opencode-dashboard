import type { ReactNode } from 'react'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  width?: string
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
  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
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
                }}
                onClick={() => onSort?.(col.key)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {col.header}
                  {sortKey === col.key && (
                    <span style={{ fontSize: 10 }}>{sortOrder === 'asc' ? '▲' : '▼'}</span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={keyExtractor(row)}
              onClick={() => onRowClick?.(row)}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map((col) => (
                <td key={col.key}>
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

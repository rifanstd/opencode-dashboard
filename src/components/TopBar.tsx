import { useAppStore } from '../stores/appStore.ts'

interface TopBarProps {
  onSync: () => void
  onToggleSidebar?: () => void
  showSidebarToggle?: boolean
}

export default function TopBar({ onSync, onToggleSidebar, showSidebarToggle }: TopBarProps) {
  const isSyncing = useAppStore((s) => s.isSyncing)

  return (
    <header
      style={{
        height: 56,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {showSidebarToggle && (
          <button
            type="button"
            onClick={onToggleSidebar}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg-primary)',
              color: 'var(--text-secondary)',
              fontSize: 16,
              cursor: 'pointer',
              lineHeight: 1,
            }}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
        )}
        <h1
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Dashboard
        </h1>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="button"
          onClick={onSync}
          disabled={isSyncing}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 13,
            cursor: isSyncing ? 'not-allowed' : 'pointer',
            opacity: isSyncing ? 0.7 : 1,
          }}
        >
          {isSyncing ? 'Syncing…' : 'Sync'}
        </button>
      </div>
    </header>
  )
}

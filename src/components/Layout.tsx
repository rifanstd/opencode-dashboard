import { useState, useEffect, type ReactNode } from 'react'
import Sidebar from './Sidebar.tsx'
import TopBar from './TopBar.tsx'

interface LayoutProps {
  children: ReactNode
  onSync: () => void
}

export default function Layout({ children, onSync }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1400)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1399px)')
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarOpen(false)
      else setSidebarOpen(true)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--bg-primary)',
      }}
    >
      {sidebarOpen && <Sidebar />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar
          onSync={onSync}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          showSidebarToggle={window.innerWidth < 1400}
        />
        <main
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 24,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}

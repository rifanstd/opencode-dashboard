import { useState, useEffect, type ReactNode } from 'react'
import TopBar from './TopBar.tsx'
import { getOverviewStats } from '../utils/overviewCache.ts'

interface LayoutProps {
  children: ReactNode
  onSync: () => void
}

interface QuickStats {
  totalSessions: number
  totalTokens: number
  totalCost: number
}

export default function Layout({ children, onSync }: LayoutProps) {
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null)

  useEffect(() => {
    getOverviewStats().then((data) => {
      setQuickStats({
        totalSessions: data.totalSessions,
        totalTokens:
          data.totalInputTokens +
          data.totalOutputTokens +
          data.totalReasoningTokens +
          data.totalCacheTokens,
        totalCost: data.totalCost,
      })
    }).catch(() => {
      setQuickStats(null)
    })
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--bg-primary)',
      }}
    >
      <TopBar onSync={onSync} quickStats={quickStats} />
      <main
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '32px 40px',
        }}
        className="layout-main"
      >
        {children}
      </main>
      <style>{`
        @media (max-width: 768px) {
          .layout-main {
            padding: 20px !important;
          }
        }
      `}</style>
    </div>
  )
}

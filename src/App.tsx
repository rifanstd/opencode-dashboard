import { useEffect, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAppStore } from './stores/appStore.ts'
import { handleSync } from './utils/sync.ts'
import Layout from './components/Layout.tsx'
import LoadingOverlay from './components/LoadingOverlay.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import Overview from './pages/Overview.tsx'
import TokenUsage from './pages/TokenUsage.tsx'
import SessionsList from './pages/SessionsList.tsx'
import SessionDetail from './pages/SessionDetail.tsx'
import Providers from './pages/Providers.tsx'
import Models from './pages/Models.tsx'
import Agents from './pages/Agents.tsx'
import Skills from './pages/Skills.tsx'
import Logs from './pages/Logs.tsx'

function AppContent() {
  const isLoading = useAppStore((s) => s.isLoading)
  const isSyncing = useAppStore((s) => s.isSyncing)
  const setLoading = useAppStore((s) => s.setLoading)

  const [dataReady, setDataReady] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      // Data is loaded on-demand by each page, but we wait a tick
      // so the loading overlay shows briefly on first mount
      await new Promise((resolve) => setTimeout(resolve, 300))
      setDataReady(true)
      setLoading(false)
    }
    load()
  }, [setLoading])

  const onSync = useCallback(async () => {
    await handleSync()
    window.location.reload()
  }, [])

  if (!dataReady) {
    return <LoadingOverlay message="Loading dashboard…" />
  }

  return (
    <>
      {(isLoading || isSyncing) && <LoadingOverlay message={isSyncing ? 'Syncing…' : 'Loading…'} />}
      <Layout onSync={onSync}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/tokens" element={<TokenUsage />} />
            <Route path="/sessions" element={<SessionsList />} />
            <Route path="/sessions/:id" element={<SessionDetail />} />
            <Route path="/providers" element={<Providers />} />
            <Route path="/models" element={<Models />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/skills" element={<Skills />} />
            <Route path="/logs" element={<Logs />} />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

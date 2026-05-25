import { useEffect, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useAppStore } from './stores/appStore.ts'
import { handleSync } from './utils/sync.ts'
import Layout from './components/Layout.tsx'
import LoadingOverlay from './components/LoadingOverlay.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import Overview from './pages/Overview.tsx'
import SessionsList from './pages/SessionsList.tsx'
import SessionDetail from './pages/SessionDetail.tsx'
import Resources from './pages/Resources.tsx'
import Agents from './pages/Agents.tsx'
import Skills from './pages/Skills.tsx'

function AppRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6, transition: { duration: 0.15, ease: 'easeIn' } }}
        transition={{
          duration: 0.2,
          ease: [0.16, 1, 0.3, 1],
          delay: 0.05,
        }}
      >
        <Routes location={location}>
          <Route path="/" element={<Overview />} />
          <Route path="/sessions" element={<SessionsList />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/providers-models" element={<Resources />} />
          <Route path="/providers" element={<Resources />} />
          <Route path="/models" element={<Resources />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/skills" element={<Skills />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

function AppContent() {
  const isLoading = useAppStore((s) => s.isLoading)
  const isSyncing = useAppStore((s) => s.isSyncing)
  const setLoading = useAppStore((s) => s.setLoading)

  const [dataReady, setDataReady] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
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
          <AppRoutes />
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

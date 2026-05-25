import { useEffect, useState, useMemo } from 'react'
import { motion } from 'motion/react'
import { loadTokenUsage, loadSessions, loadModels, loadProviders } from '../utils/dataLoader.ts'
import { getOverviewStats } from '../utils/overviewCache.ts'
import {
  buildPricingMap,
  computeKeyMetrics,
  computeTokenComposition,
  aggregateTokenUsageForChart,
  aggregateCostForChart,
  computeTopModelsForBar,
} from '../utils/overviewDataProcessor.ts'
import SummaryCard from '../components/SummaryCard.tsx'
import ErrorMessage from '../components/ErrorMessage.tsx'
import TokenUsageChart from '../components/TokenUsageChart.tsx'
import ModelUsageChart from '../components/ModelUsageChart.tsx'
import CostChart from '../components/CostChart.tsx'
import TokenCompositionChart from '../components/TokenCompositionChart.tsx'
import type { OverviewStats, Session, ModelInfo, ProviderInfo, Granularity } from '../types/index.ts'
import type { TokenUsageData } from '../utils/dataLoader.ts'

function useViewportWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return width
}

function relativeTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hours ago`
  const days = Math.floor(hours / 24)
  return `${days} days ago`
}

function isValidOverview(data: unknown): data is OverviewStats {
  return (
    typeof data === 'object' &&
    data !== null &&
    !Array.isArray(data) &&
    'totalSessions' in data &&
    typeof (data as Record<string, unknown>).totalSessions === 'number'
  )
}

function isValidTokenUsage(data: unknown): data is TokenUsageData {
  return (
    typeof data === 'object' &&
    data !== null &&
    !Array.isArray(data) &&
    'byDay' in data &&
    Array.isArray((data as Record<string, unknown>).byDay)
  )
}

export default function Overview() {
  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [tokenUsage, setTokenUsage] = useState<TokenUsageData | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tokenGranularity, setTokenGranularity] = useState<Granularity>('daily')
  const [costGranularity, setCostGranularity] = useState<Granularity>('daily')
  const [loadedAt, setLoadedAt] = useState<number | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())
  const viewportWidth = useViewportWidth()

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true)
        setError(null)
        const [ov, tu, ses, mod, prov] = await Promise.all([
          getOverviewStats(),
          loadTokenUsage(),
          loadSessions(),
          loadModels(),
          loadProviders(),
        ])

        if (!isValidOverview(ov)) {
          throw new Error('Failed to load overview stats: invalid data')
        }
        if (!isValidTokenUsage(tu)) {
          throw new Error('Failed to load token usage: invalid data')
        }

        setOverview(ov)
        setTokenUsage(tu)
        setSessions(Array.isArray(ses) ? ses : [])
        setModels(Array.isArray(mod) ? mod : [])
        setProviders(Array.isArray(prov) ? prov : [])
        setLoadedAt(Date.now())
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [])

  const pricingMap = useMemo(() => buildPricingMap(models), [models])

  const configuredProviderIds = useMemo(
    () => new Set(providers.filter((p) => p.configured).map((p) => p.id)),
    [providers],
  )

  const modelsCount = useMemo(
    () => models.filter((m) => configuredProviderIds.has(m.provider)).length,
    [models, configuredProviderIds],
  )

  const providersCount = providers.filter((p) => p.configured).length

  const metrics = useMemo(() => {
    if (!overview || !tokenUsage) return []
    return computeKeyMetrics(sessions, overview, tokenUsage, pricingMap, modelsCount, providersCount)
  }, [sessions, overview, tokenUsage, pricingMap, modelsCount, providersCount])

  const tokenUsageChartData = useMemo(() => {
    if (!tokenUsage) return []
    return aggregateTokenUsageForChart(tokenUsage, tokenGranularity)
  }, [tokenUsage, tokenGranularity])

  const costChartData = useMemo(() => {
    return aggregateCostForChart(sessions, pricingMap, costGranularity)
  }, [sessions, pricingMap, costGranularity])

  const modelUsageData = useMemo(() => {
    if (!tokenUsage) return []
    return computeTopModelsForBar(tokenUsage)
  }, [tokenUsage])

  const donutData = useMemo(() => {
    if (!tokenUsage) return []
    return computeTokenComposition(tokenUsage)
  }, [tokenUsage])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--sans)' }}>Loading overview…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 style={{ marginBottom: 24, fontFamily: 'var(--sans)' }}>Overview</h1>
        <ErrorMessage message={error} />
      </div>
    )
  }

  const chartContainerStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    borderRadius: 6,
    padding: 20,
  }

  const isMobile = viewportWidth < 768

  const lastSyncText = loadedAt ? relativeTime(now - loadedAt) : 'just now'

  const summaryTokens = overview
    ? overview.totalInputTokens + overview.totalOutputTokens + overview.totalReasoningTokens + overview.totalCacheTokens
    : 0

  return (
    <div>
      <h1
        style={{
          fontFamily: 'var(--sans)',
          fontSize: 24,
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.5px',
          marginBottom: 20,
        }}
      >
        Overview
      </h1>

      {/* Summary Strip */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0 }}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 16px',
          paddingBottom: 12,
          marginBottom: 24,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-muted)' }}>
          Last sync:{' '}
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
            {lastSyncText}
          </span>
        </span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-muted)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
            · {overview ? overview.totalSessions.toLocaleString() : '—'}
          </span>{' '}
          sessions
        </span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-muted)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
            · {overview ? summaryTokens.toLocaleString() : '—'}
          </span>{' '}
          tokens
        </span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-muted)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
            · {overview ? `$${overview.totalCost.toFixed(2)}` : '—'}
          </span>{' '}
          this month
        </span>
      </motion.div>

      {/* Section 1: Key Metrics */}
      <section style={{ marginBottom: 32 }}>
        <h2
          style={{
            fontFamily: 'var(--sans)',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 16,
          }}
        >
          Key Metrics
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <SummaryCard
                label={m.label}
                value={m.value}
                subLabel={m.subLabel}
                trend={m.trend}
              />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Section 2: Charts */}
      <section style={{ marginBottom: 32 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 12,
          }}
        >
          <motion.div
            style={chartContainerStyle}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0 }}
          >
            <TokenUsageChart
              data={tokenUsageChartData}
              granularity={tokenGranularity}
              onGranularityChange={setTokenGranularity}
            />
          </motion.div>
          <motion.div
            style={chartContainerStyle}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08 }}
          >
            <CostChart
              data={costChartData}
              granularity={costGranularity}
              onGranularityChange={setCostGranularity}
            />
          </motion.div>
          <motion.div
            style={chartContainerStyle}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.16 }}
          >
            <ModelUsageChart data={modelUsageData} />
          </motion.div>
          <motion.div
            style={chartContainerStyle}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.24 }}
          >
            <TokenCompositionChart data={donutData} />
          </motion.div>
        </div>
      </section>
    </div>
  )
}

import { useEffect, useState, useMemo } from 'react'
import {
  Coins,
  ArrowDownToLine,
  DatabaseZap,
  HardDrive,
  ArrowUpFromLine,
  ScrollText,
  Server,
  Cpu,
  DollarSign,
} from 'lucide-react'
import {
  loadOverviewStats,
  loadTokenUsage,
  loadSessions,
  loadModels,
  loadProviders,
} from '../utils/dataLoader.ts'
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
  const viewportWidth = useViewportWidth()

  const iconMap: Record<string, React.ReactNode> = {
    'Total Tokens':    <Coins size={28} />,
    'Input Tokens':     <ArrowDownToLine size={28} />,
    'Cache Miss':       <DatabaseZap size={28} />,
    'Cache Read':       <HardDrive size={28} />,
    'Output Tokens':    <ArrowUpFromLine size={28} />,
    'Total Sessions':   <ScrollText size={28} />,
    'Providers':        <Server size={28} />,
    'Models':           <Cpu size={28} />,
    'Estimated Cost':   <DollarSign size={28} />,
  }

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true)
        setError(null)
        const [ov, tu, ses, mod, prov] = await Promise.all([
          loadOverviewStats(),
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
        <span style={{ color: 'var(--text-secondary)' }}>Loading overview…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 style={{ marginBottom: 24 }}>Overview</h1>
        <ErrorMessage message={error} />
      </div>
    )
  }

  const chartContainerStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    borderRadius: 10,
    padding: 16,
    border: '1px solid var(--border)',
  }

  const isMobile = viewportWidth < 768

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Overview</h1>

      {/* Section 1: Key Metrics */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Key Metrics</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {metrics.map((m) => (
            <SummaryCard
              key={m.label}
              label={m.label}
              value={m.value}
              subLabel={m.subLabel}
              trend={m.trend}
              icon={iconMap[m.label]}
            />
          ))}
        </div>
      </section>

      {/* Section 2: Charts */}
      <section style={{ marginBottom: 32 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 16,
          }}
        >
          <div style={chartContainerStyle}>
            <TokenUsageChart
              data={tokenUsageChartData}
              granularity={tokenGranularity}
              onGranularityChange={setTokenGranularity}
            />
          </div>
          <div style={chartContainerStyle}>
            <CostChart
              data={costChartData}
              granularity={costGranularity}
              onGranularityChange={setCostGranularity}
            />
          </div>
          <div style={chartContainerStyle}>
            <ModelUsageChart data={modelUsageData} />
          </div>
          <div style={chartContainerStyle}>
            <TokenCompositionChart data={donutData} />
          </div>
        </div>
      </section>
    </div>
  )
}

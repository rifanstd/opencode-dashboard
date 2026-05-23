import { useEffect, useState, useMemo } from 'react'
import {
  loadOverviewStats,
  loadTokenUsage,
  loadSessions,
  loadMessages,
  loadParts,
  loadModels,
} from '../utils/dataLoader.ts'
import {
  buildPricingMap,
  computeKeyMetrics,
  computeTokenComposition,
  computeDailyActivity,
  computeDailyCost,
  computeTopModels,
  computeTopProjects,
  computeRecentSessions,
  computeActivityHeatmap,
} from '../utils/overviewDataProcessor.ts'
import SummaryCard from '../components/SummaryCard.tsx'
import ErrorMessage from '../components/ErrorMessage.tsx'
import TokenCompositionChart from '../components/TokenCompositionChart.tsx'
import DailyActivityChart from '../components/DailyActivityChart.tsx'
import CostTrendChart from '../components/CostTrendChart.tsx'
import TopModelsChart from '../components/TopModelsChart.tsx'
import ProjectActivityChart from '../components/ProjectActivityChart.tsx'
import ActivityHeatmap from '../components/ActivityHeatmap.tsx'
import RecentSessionsList from '../components/RecentSessionsList.tsx'
import type { OverviewStats, TimeRange, Session, Message, Part, ModelInfo } from '../types/index.ts'
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
  const [messages, setMessages] = useState<Message[]>([])
  const [parts, setParts] = useState<Part[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activityRange, setActivityRange] = useState<TimeRange>('30d')
  const [costRange, setCostRange] = useState<TimeRange>('30d')
  const [modelSortBy, setModelSortBy] = useState<'tokens' | 'cost'>('tokens')
  const viewportWidth = useViewportWidth()

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true)
        setError(null)
        const [ov, tu, ses, msg, prt, mod] = await Promise.all([
          loadOverviewStats(),
          loadTokenUsage(),
          loadSessions(),
          loadMessages(),
          loadParts(),
          loadModels(),
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
        setMessages(Array.isArray(msg) ? msg : [])
        setParts(Array.isArray(prt) ? prt : [])
        setModels(Array.isArray(mod) ? mod : [])
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [])

  const pricingMap = useMemo(() => buildPricingMap(models), [models])

  const metrics = useMemo(() => {
    if (!overview || !tokenUsage) return []
    return computeKeyMetrics(sessions, messages, parts, models, overview, tokenUsage, pricingMap)
  }, [sessions, messages, parts, models, overview, tokenUsage, pricingMap])

  const tokenComposition = useMemo(() => {
    if (!tokenUsage) return []
    return computeTokenComposition(tokenUsage)
  }, [tokenUsage])

  const dailyActivity = useMemo(() => {
    if (!tokenUsage) return []
    return computeDailyActivity(tokenUsage, activityRange)
  }, [tokenUsage, activityRange])

  const dailyCost = useMemo(() => {
    return computeDailyCost(sessions, pricingMap, costRange)
  }, [sessions, pricingMap, costRange])

  const topModels = useMemo(() => {
    if (!tokenUsage) return []
    return computeTopModels(tokenUsage, pricingMap, modelSortBy)
  }, [tokenUsage, pricingMap, modelSortBy])

  const topProjects = useMemo(() => {
    if (!tokenUsage) return []
    return computeTopProjects(tokenUsage)
  }, [tokenUsage])

  const recentSessions = useMemo(() => {
    return computeRecentSessions(sessions, pricingMap, 10)
  }, [sessions, pricingMap])

  const heatmapData = useMemo(() => {
    return computeActivityHeatmap(messages)
  }, [messages])

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
          {metrics.map((m, i) => (
            <SummaryCard
              key={i}
              label={m.label}
              value={m.value}
              subLabel={m.subLabel}
              trend={m.trend}
            />
          ))}
        </div>
      </section>

      {/* Section 2: Trends */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Trends</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 16,
          }}
        >
          <div style={chartContainerStyle}>
            <DailyActivityChart
              data={dailyActivity}
              range={activityRange}
              onRangeChange={setActivityRange}
            />
          </div>
          <div style={chartContainerStyle}>
            <CostTrendChart
              data={dailyCost}
              range={costRange}
              onRangeChange={setCostRange}
            />
          </div>
        </div>
      </section>

      {/* Section 3: Breakdowns */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Breakdowns</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 16,
          }}
        >
          <div style={chartContainerStyle}>
            <TokenCompositionChart data={tokenComposition} />
          </div>
          <div style={chartContainerStyle}>
            <TopModelsChart
              data={topModels}
              sortBy={modelSortBy}
              onSortChange={setModelSortBy}
            />
          </div>
          <div style={chartContainerStyle}>
            <ProjectActivityChart data={topProjects} />
          </div>
        </div>
      </section>

      {/* Section 4: Recent Activity */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Recent Activity</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={chartContainerStyle}>
            <ActivityHeatmap data={heatmapData} />
          </div>
          <div style={chartContainerStyle}>
            <RecentSessionsList sessions={recentSessions} models={models} />
          </div>
        </div>
      </section>
    </div>
  )
}

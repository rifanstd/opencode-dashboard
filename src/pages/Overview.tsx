import { useEffect, useState } from 'react'
import { loadOverviewStats, loadModels, loadSessions } from '../utils/dataLoader.ts'
import { loadPricing, calculateCost, formatCost } from '../utils/costCalculator.ts'
import SummaryCard from '../components/SummaryCard.tsx'
import ErrorMessage from '../components/ErrorMessage.tsx'
import type { OverviewStats } from '../types/index.ts'

export default function Overview() {
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true)
        setError(null)
        const overview = await loadOverviewStats()
        const models = await loadModels()
        const pricingMap = loadPricing(models)

        // We need sessions to compute cost. If overview has totalCost, use it.
        // Otherwise compute from loaded data. Since the sync script doesn't
        // compute totalCost in overview, we compute it here.
        let totalCost = 0

        const sessions = await loadSessions()
        for (const s of sessions) {
          if (s.model_id && pricingMap.has(s.model_id)) {
            const pricing = pricingMap.get(s.model_id)!
            totalCost += calculateCost(
              {
                input: s.input_tokens,
                output: s.output_tokens,
                reasoning: s.reasoning_tokens,
                cache: s.cache_tokens,
              },
              pricing
            )
          }
        }

        setStats({ ...overview, totalCost })
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <span style={{ color: 'var(--text-secondary)' }}>Loading overview…</span>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Overview</h1>
      {error && <ErrorMessage message={error} />}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          <SummaryCard label="Total Sessions" value={stats.totalSessions.toLocaleString()} />
          <SummaryCard label="Input Tokens" value={stats.totalInputTokens.toLocaleString()} />
          <SummaryCard label="Output Tokens" value={stats.totalOutputTokens.toLocaleString()} />
          <SummaryCard label="Reasoning Tokens" value={stats.totalReasoningTokens.toLocaleString()} />
          <SummaryCard label="Cache Tokens" value={stats.totalCacheTokens.toLocaleString()} />
          <SummaryCard label="Estimated Cost" value={formatCost(stats.totalCost)} />
          <SummaryCard label="Most Used Model" value={stats.mostUsedModel} />
          <SummaryCard label="Active Projects" value={stats.activeProjects} />
        </div>
      )}
    </div>
  )
}

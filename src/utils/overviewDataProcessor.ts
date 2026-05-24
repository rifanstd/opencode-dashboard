import type {
  Session,
  Message,
  ModelInfo,
  OverviewStats,
  TimeRange,
  MetricCardData,
  DonutSegment,
  DailyCostPoint,
  ModelBreakdownItem,
  ProjectBreakdownItem,
  RecentSessionRow,
  HeatmapData,
  TimeSeriesData,
} from '../types/index.ts'
import type { TokenUsageData } from '../utils/dataLoader.ts'
import { calculateCost, formatCost, formatNumber } from './costCalculator.ts'
import type { Pricing } from './costCalculator.ts'

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getToday(): string {
  return toISODate(new Date())
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00.000Z')
  d.setUTCDate(d.getUTCDate() + days)
  return toISODate(d)
}

function getDateRange(range: TimeRange): { start: string; end: string } {
  const end = getToday()
  if (range === 'all') {
    return { start: '1970-01-01', end }
  }
  const days = range === '7d' ? 6 : range === '30d' ? 29 : 89
  return { start: addDays(end, -days), end }
}

function countInDateRange<T extends { created_at: string }>(
  items: T[],
  start: string,
  end: string
): number {
  let count = 0
  for (const item of items) {
    const d = item.created_at.slice(0, 10)
    if (d >= start && d <= end) count++
  }
  return count
}

function sumTokensInRangeExcludingReasoning<T extends { created_at: string; input_tokens: number; output_tokens: number; cache_tokens: number }>(
  items: T[],
  start: string,
  end: string
): number {
  let sum = 0
  for (const item of items) {
    const d = item.created_at.slice(0, 10)
    if (d >= start && d <= end) {
      sum += item.input_tokens + item.output_tokens + item.cache_tokens
    }
  }
  return sum
}

function sumTokenFieldInRange<T extends { created_at: string }>(
  items: T[],
  field: (item: T) => number,
  start: string,
  end: string
): number {
  let sum = 0
  for (const item of items) {
    const d = item.created_at.slice(0, 10)
    if (d >= start && d <= end) sum += field(item)
  }
  return sum
}

function computeCostInRange(
  sessions: Session[],
  pricingMap: Map<string, Pricing>,
  start: string,
  end: string
): number {
  let total = 0
  for (const s of sessions) {
    const d = s.created_at.slice(0, 10)
    if (d < start || d > end) continue
    if (s.model_id && pricingMap.has(s.model_id)) {
      const pricing = pricingMap.get(s.model_id)!
      total += calculateCost(
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
  return total
}

function buildPricingMap(models: ModelInfo[]): Map<string, Pricing> {
  const map = new Map<string, Pricing>()
  for (const m of models) {
    const pricing: Pricing = {
      input: m.input_price ?? 0,
      output: m.output_price ?? 0,
      reasoning: m.reasoning_price != null ? Number(m.reasoning_price) : undefined,
      cache: m.cache_price != null ? Number(m.cache_price) : undefined,
    }
    map.set(m.id, pricing)
  }
  return map
}

export function filterByTimeRange<T extends { date: string }>(
  data: T[],
  range: TimeRange
): T[] {
  if (range === 'all') return data
  const { start, end } = getDateRange(range)
  return data.filter((d) => d.date >= start && d.date <= end)
}

export function computeKeyMetrics(
  sessions: Session[],
  overview: OverviewStats,
  tokenUsage: TokenUsageData,
  pricingMap: Map<string, Pricing>,
  modelsCount: number,
  providersCount: number
): MetricCardData[] {
  const today = getToday()

  // Totals
  const totalTokens =
    tokenUsage.byDay.reduce((sum, d) => sum + d.input + d.output + d.cache, 0)

  // Total input tokens from byDay (for Input Tokens card)
  const totalInputTokens =
    tokenUsage.byDay.reduce((sum, d) => sum + d.input, 0)

  // Total cache tokens from byDay (for Cache card)
  const totalCacheTokens =
    tokenUsage.byDay.reduce((sum, d) => sum + d.cache, 0)

  // Total cost computed from sessions
  let totalCost = 0
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

  // Period windows
  const last7Start = addDays(today, -6)
  const prev7Start = addDays(today, -13)
  const prev7End = addDays(today, -7)
  const last30Start = addDays(today, -29)
  const prev30Start = addDays(today, -59)
  const prev30End = addDays(today, -30)

  // Comparisons
  const sessions30d = countInDateRange(sessions, last30Start, today)
  const sessionsPrev30d = countInDateRange(sessions, prev30Start, prev30End)
  const sessions30dDiff = sessions30d - sessionsPrev30d

  const tokens7d = sumTokensInRangeExcludingReasoning(sessions, last7Start, today)
  const tokensPrev7d = sumTokensInRangeExcludingReasoning(sessions, prev7Start, prev7End)
  const tokensPct = tokensPrev7d > 0 ? Math.round(((tokens7d - tokensPrev7d) / tokensPrev7d) * 100) : 0

  const inputTokens7d = sumTokenFieldInRange(sessions, (s) => s.input_tokens, last7Start, today)
  const inputTokensPrev7d = sumTokenFieldInRange(sessions, (s) => s.input_tokens, prev7Start, prev7End)
  const inputTokensPct = inputTokensPrev7d > 0
    ? Math.round(((inputTokens7d - inputTokensPrev7d) / inputTokensPrev7d) * 100)
    : 0

  const cacheTokens7d = sumTokenFieldInRange(sessions, (s) => s.cache_tokens, last7Start, today)
  const cacheTokensPrev7d = sumTokenFieldInRange(sessions, (s) => s.cache_tokens, prev7Start, prev7End)
  const cacheTokensPct = cacheTokensPrev7d > 0
    ? Math.round(((cacheTokens7d - cacheTokensPrev7d) / cacheTokensPrev7d) * 100)
    : 0

  const cost7d = computeCostInRange(sessions, pricingMap, last7Start, today)
  const costPrev7d = computeCostInRange(sessions, pricingMap, prev7Start, prev7End)
  const costPct = costPrev7d > 0 ? Math.round(((cost7d - costPrev7d) / costPrev7d) * 100) : 0

  const cards: MetricCardData[] = [
    {
      label: 'Total Sessions',
      value: formatNumber(overview.totalSessions),
      subLabel: sessions30dDiff !== 0 ? `${sessions30dDiff > 0 ? '+' : ''}${sessions30dDiff} vs last 30 days` : undefined,
      trend: sessions30dDiff > 0 ? 'up' : sessions30dDiff < 0 ? 'down' : 'neutral',
    },
    {
      label: 'Total Tokens',
      value: formatNumber(totalTokens),
      subLabel: tokensPct !== 0 ? `${tokensPct > 0 ? '+' : ''}${tokensPct}% vs last 7 days` : undefined,
      trend: tokensPct > 0 ? 'up' : tokensPct < 0 ? 'down' : 'neutral',
    },
    {
      label: 'Input Tokens',
      value: formatNumber(totalInputTokens),
      subLabel: inputTokensPct !== 0 ? `${inputTokensPct > 0 ? '+' : ''}${inputTokensPct}% vs last 7 days` : undefined,
      trend: inputTokensPct > 0 ? 'up' : inputTokensPct < 0 ? 'down' : 'neutral',
    },
    {
      label: 'Cache',
      value: formatNumber(totalCacheTokens),
      subLabel: cacheTokensPct !== 0 ? `${cacheTokensPct > 0 ? '+' : ''}${cacheTokensPct}% vs last 7 days` : undefined,
      trend: cacheTokensPct > 0 ? 'up' : cacheTokensPct < 0 ? 'down' : 'neutral',
    },
    {
      label: 'Models',
      value: formatNumber(modelsCount),
      subLabel: 'Available models from all providers',
    },
    {
      label: 'Providers',
      value: formatNumber(providersCount),
      subLabel: 'Connected providers',
    },
    {
      label: 'Estimated Cost',
      value: totalCost < 1000 ? formatCost(totalCost) : '$' + formatNumber(totalCost),
      subLabel: costPct !== 0 ? `${costPct > 0 ? '+' : ''}${costPct}% vs last 7 days` : undefined,
      trend: costPct > 0 ? 'up' : costPct < 0 ? 'down' : 'neutral',
    },
  ]

  return cards
}

export function computeTokenComposition(tokenUsage: TokenUsageData): DonutSegment[] {
  const input = tokenUsage.byDay.reduce((sum, d) => sum + d.input, 0)
  const output = tokenUsage.byDay.reduce((sum, d) => sum + d.output, 0)
  const cache = tokenUsage.byDay.reduce((sum, d) => sum + d.cache, 0)
  const total = input + output + cache

  if (total === 0) {
    return [
      { name: 'Input', value: 0, color: 'var(--chart-1)' },
      { name: 'Output', value: 0, color: 'var(--chart-2)' },
      { name: 'Cache', value: 0, color: 'var(--chart-4)' },
    ]
  }

  return [
    { name: 'Input', value: input, color: 'var(--chart-1)' },
    { name: 'Output', value: output, color: 'var(--chart-2)' },
    { name: 'Cache', value: cache, color: 'var(--chart-4)' },
  ]
}

export function computeDailyActivity(
  tokenUsage: TokenUsageData,
  range: TimeRange
): TimeSeriesData[] {
  return filterByTimeRange(tokenUsage.byDay, range)
}

export function computeDailyCost(
  sessions: Session[],
  pricingMap: Map<string, Pricing>,
  range: TimeRange
): DailyCostPoint[] {
  const { start: rangeStart, end: rangeEnd } = getDateRange(range)
  const map = new Map<string, number>()
  for (const s of sessions) {
    const date = s.created_at.slice(0, 10)
    if (range !== 'all' && (date < rangeStart || date > rangeEnd)) continue
    let cost = 0
    if (s.model_id && pricingMap.has(s.model_id)) {
      const pricing = pricingMap.get(s.model_id)!
      cost = calculateCost(
        {
          input: s.input_tokens,
          output: s.output_tokens,
          reasoning: s.reasoning_tokens,
          cache: s.cache_tokens,
        },
        pricing
      )
    }
    map.set(date, (map.get(date) ?? 0) + cost)
  }

  const result: DailyCostPoint[] = []
  for (const [date, cost] of map.entries()) {
    result.push({ date, cost })
  }
  result.sort((a, b) => a.date.localeCompare(b.date))
  return result
}

export function computeTopModels(
  tokenUsage: TokenUsageData,
  pricingMap: Map<string, Pricing>,
  sortBy: 'tokens' | 'cost'
): ModelBreakdownItem[] {
  const items: ModelBreakdownItem[] = tokenUsage.byModel.map((m) => {
    const totalTokens = m.input + m.output + m.reasoning + m.cache
    let totalCost = 0
    if (pricingMap.has(m.label)) {
      const pricing = pricingMap.get(m.label)!
      totalCost = calculateCost(
        { input: m.input, output: m.output, reasoning: m.reasoning, cache: m.cache },
        pricing
      )
    }
    return {
      label: m.label,
      input: m.input,
      output: m.output,
      reasoning: m.reasoning,
      cache: m.cache,
      totalTokens,
      totalCost,
    }
  })

  if (sortBy === 'tokens') {
    items.sort((a, b) => b.totalTokens - a.totalTokens)
  } else {
    items.sort((a, b) => b.totalCost - a.totalCost)
  }

  return items.slice(0, 5)
}

export function computeTopProjects(tokenUsage: TokenUsageData): ProjectBreakdownItem[] {
  const items: ProjectBreakdownItem[] = tokenUsage.byProject
    .map((p) => {
      const totalTokens = p.input + p.output + p.reasoning + p.cache
      return {
        label: p.label,
        input: p.input,
        output: p.output,
        reasoning: p.reasoning,
        cache: p.cache,
        totalTokens,
      }
    })
    .filter((p) => p.totalTokens > 0)

  items.sort((a, b) => b.totalTokens - a.totalTokens)
  return items.slice(0, 5)
}

export function computeRecentSessions(
  sessions: Session[],
  pricingMap: Map<string, Pricing>,
  limit = 10
): RecentSessionRow[] {
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const result: RecentSessionRow[] = []
  for (const s of sorted.slice(0, limit)) {
    let computedCost = 0
    if (s.model_id && pricingMap.has(s.model_id)) {
      const pricing = pricingMap.get(s.model_id)!
      computedCost = calculateCost(
        {
          input: s.input_tokens,
          output: s.output_tokens,
          reasoning: s.reasoning_tokens,
          cache: s.cache_tokens,
        },
        pricing
      )
    }
    result.push({
      id: s.id,
      title: s.title,
      model_id: s.model_id,
      total_tokens: s.total_tokens,
      computedCost,
      created_at: s.created_at,
    })
  }

  return result
}

export function computeActivityHeatmap(messages: Message[]): HeatmapData {
  // 7 rows (Mon-Sun) x 24 columns (00-23)
  const grid: HeatmapData = Array.from({ length: 7 }, () => Array(24).fill(0))

  for (const msg of messages) {
    const d = new Date(msg.created_at)
    const day = d.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
    const row = day === 0 ? 6 : day - 1 // Mon=0, ..., Sun=6
    const hour = d.getUTCHours()
    grid[row][hour]++
  }

  return grid
}

export { buildPricingMap }

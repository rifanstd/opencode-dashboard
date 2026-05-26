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
  Granularity,
  TokenUsageChartPoint,
  ModelUsageBarItem,
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

/**
 * Select the correct pre-aggregated array and transform into 5-line chart format.
 * - inputTotal = input + cache (all tokens sent to model)
 * - cacheRead = cache tokens only
 * - cacheMiss = input tokens only
 * - output = output tokens only
 * - reasoning = reasoning tokens only
 */
export function aggregateTokenUsageForChart(
  tokenUsage: TokenUsageData,
  granularity: Granularity
): TokenUsageChartPoint[] {
  let source: typeof tokenUsage.byDay

  switch (granularity) {
    case 'weekly':
      source = tokenUsage.byWeek
      break
    case 'monthly':
      source = tokenUsage.byMonth
      break
    case 'year':
      source = tokenUsage.byYear
      break
    case 'daily':
    case 'all':
    default:
      source = tokenUsage.byDay
      break
  }

  return source.map((d) => ({
    date: d.date,
    inputTotal: d.input + d.cache,
    cacheRead: d.cache,
    cacheMiss: d.input,
    output: d.output,
    reasoning: d.reasoning,
  }))
}

/**
 * Aggregate session costs by time granularity for the Cost chart.
 * Cost is computed client-side from sessions because cost data is not in token-usage.json.
 */
export function aggregateCostForChart(
  sessions: Session[],
  pricingMap: Map<string, Pricing>,
  granularity: Granularity
): DailyCostPoint[] {
  const map = new Map<string, number>()

  for (const s of sessions) {
    const date = new Date(s.created_at)
    if (isNaN(date.getTime())) continue

    let key: string
    switch (granularity) {
      case 'weekly':
        key = getISOWeekKey(date)
        break
      case 'monthly':
        key = date.toISOString().slice(0, 7)
        break
      case 'year':
        key = String(date.getFullYear())
        break
      case 'daily':
      case 'all':
      default:
        key = date.toISOString().slice(0, 10)
        break
    }

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
    map.set(key, (map.get(key) ?? 0) + cost)
  }

  const result: DailyCostPoint[] = []
  for (const [date, cost] of map.entries()) {
    result.push({ date, cost })
  }
  result.sort((a, b) => a.date.localeCompare(b.date))
  return result
}

/** Helper: compute ISO week key "YYYY-Www" for a Date */
function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

/**
 * Get top 4 models by total token count for the Model Usage bar chart.
 */
export function computeTopModelsForBar(
  tokenUsage: TokenUsageData
): ModelUsageBarItem[] {
  const items = tokenUsage.byModel.map((m) => ({
    label: m.label,
    totalTokens: m.input + m.output + m.reasoning + m.cache,
    providers: m.providers,
  }))

  items.sort((a, b) => b.totalTokens - a.totalTokens)
  return items.slice(0, 4)
}

export function computeKeyMetrics(
  _sessions: Session[],
  overview: OverviewStats,
  tokenUsage: TokenUsageData,
  _pricingMap: Map<string, Pricing>,
  modelsCount: number,
  providersCount: number
): MetricCardData[] {

  // Totals
  const totalTokens =
    tokenUsage.byDay.reduce((sum, d) => sum + d.input + d.output + d.reasoning + d.cache, 0)

  // Total input tokens from byDay (for Input Tokens card)
  const totalInputTokens =
    tokenUsage.byDay.reduce((sum, d) => sum + d.input, 0)

  // Total output tokens from byDay (for Output Tokens card)
  const totalOutputTokens =
    tokenUsage.byDay.reduce((sum, d) => sum + d.output, 0)

  // Total cache tokens from byDay (for Cache card)
  const totalCacheTokens =
    tokenUsage.byDay.reduce((sum, d) => sum + d.cache, 0)

  // Cache miss = non-cached input tokens (additive model: input and cache are separate columns)
  const totalCacheMissTokens = totalInputTokens

  // Total cost from pre-computed overview (consistent with summary strip)
  const totalCost = overview.totalCost

  const cards: MetricCardData[] = [
    {
      label: 'Total Tokens',
      value: formatNumber(totalTokens),
      subLabel: 'All tokens across sessions',
    },
    {
      label: 'Input Tokens',
      value: formatNumber(totalInputTokens + totalCacheTokens),
      subLabel: 'Prompt + cache tokens',
    },
    {
      label: 'Cache Miss',
      value: formatNumber(totalCacheMissTokens),
      subLabel: 'Sent to models (not cached)',
    },
    {
      label: 'Cache Read',
      value: formatNumber(totalCacheTokens),
      subLabel: 'Served from prompt cache',
    },
    {
      label: 'Output Tokens',
      value: formatNumber(totalOutputTokens),
      subLabel: 'Generated by models',
    },
    {
      label: 'Total Sessions',
      value: formatNumber(overview.totalSessions),
      subLabel: 'Global sessions',
    },
    {
      label: 'Providers',
      value: formatNumber(providersCount),
      subLabel: 'Connected providers',
    },
    {
      label: 'Models',
      value: formatNumber(modelsCount),
      subLabel: 'From configured providers',
    },
    {
      label: 'Estimated Cost',
      value: totalCost < 1000 ? formatCost(totalCost) : '$' + formatNumber(totalCost),
      subLabel: 'Based on token pricing',
    },
  ]

  return cards
}

export function computeTokenComposition(tokenUsage: TokenUsageData): DonutSegment[] {
  const input = tokenUsage.byDay.reduce((sum, d) => sum + d.input, 0)
  const output = tokenUsage.byDay.reduce((sum, d) => sum + d.output, 0)
  const reasoning = tokenUsage.byDay.reduce((sum, d) => sum + d.reasoning, 0)
  const cache = tokenUsage.byDay.reduce((sum, d) => sum + d.cache, 0)
  const cacheMiss = input
  const total = input + output + reasoning + cache

  if (total === 0) {
    return [
      { name: 'Input',      value: 0, color: 'var(--chart-1)' },
      { name: 'Output',     value: 0, color: 'var(--chart-2)' },
      { name: 'Reasoning',  value: 0, color: 'var(--chart-3)' },
      { name: 'Cache Read', value: 0, color: 'var(--chart-4)' },
      { name: 'Cache Miss', value: 0, color: 'var(--chart-5)' },
    ]
  }

  return [
    { name: 'Input',      value: input,     color: 'var(--chart-1)' },
    { name: 'Output',     value: output,    color: 'var(--chart-2)' },
    { name: 'Reasoning',  value: reasoning, color: 'var(--chart-3)' },
    { name: 'Cache Read', value: cache,     color: 'var(--chart-4)' },
    { name: 'Cache Miss', value: cacheMiss, color: 'var(--chart-5)' },
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
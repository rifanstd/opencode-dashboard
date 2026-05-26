import type { Granularity } from '../types/index.ts'

export interface Pricing {
  input: number
  output: number
  reasoning?: number
  cache?: number
}

export function calculateCost(
  tokens: { input: number; output: number; reasoning?: number; cache?: number },
  pricing: Pricing
): number {
  const cacheReadTokens = tokens.cache ?? 0
  const inputCost = tokens.input * (pricing.input ?? 0)
  const outputCost = tokens.output * (pricing.output ?? 0)
  const reasoningCost = (tokens.reasoning ?? 0) * (pricing.reasoning ?? 0)
  const cacheCost = cacheReadTokens * (pricing.cache ?? 0)
  return inputCost + outputCost + reasoningCost + cacheCost
}

export function formatCost(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0'

  if (value >= 1000) {
    return '$' + formatNumber(value)
  }

  // value < 1000: format with 2dp, strip trailing zeros
  const formatted = value.toFixed(2)
  const stripped = formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted
  return '$' + stripped
}

/**
 * Formats a number with K/M/B suffix for compact display.
 * - < 1000: standard locale formatting (e.g., "999")
 * - >= 1000 and < 1000000: X.XXK with trailing zeros stripped (e.g., 1500 → "1.5K", 1250 → "1.25K", 1000 → "1K")
 * - >= 1000000 and < 1000000000: X.XXM with trailing zeros stripped (e.g., 2500000 → "2.5M", 1250000 → "1.25M")
 * - >= 1000000000: X.XXB with trailing zeros stripped (e.g., 2500000000 → "2.5B", 1000000000 → "1B")
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (value < 1000) return Math.round(value).toLocaleString()

  const strip = (n: string) => n.includes('.') ? n.replace(/\.?0+$/, '') : n

  if (value < 1000000) {
    return strip((value / 1000).toFixed(2)) + 'K'
  }
  if (value < 1000000000) {
    return strip((value / 1000000).toFixed(2)) + 'M'
  }
  return strip((value / 1000000000).toFixed(2)) + 'B'
}

/** ISO week pattern: YYYY-Www */
const isoWeekPattern = /^(\d{4})-W(\d{2})$/

function parseISOWeekMonday(weekStr: string): Date | null {
  const match = weekStr.match(isoWeekPattern)
  if (!match) return null
  const year = parseInt(match[1], 10)
  const weekNum = parseInt(match[2], 10)
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const mondayOfWeek1 = new Date(jan4)
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1))
  const target = new Date(mondayOfWeek1)
  target.setUTCDate(mondayOfWeek1.getUTCDate() + (weekNum - 1) * 7)
  return target
}

/**
 * Formats a date string for chart X-axis tick labels based on granularity.
 * Handles "YYYY-MM-DD", "YYYY-MM", "YYYY", and "YYYY-Www" formats.
 */
export function formatDateTick(dateStr: string, granularity: Granularity): string {
  let d: Date
  if (isoWeekPattern.test(dateStr)) {
    d = parseISOWeekMonday(dateStr) ?? new Date(NaN)
  } else {
    d = new Date(dateStr.length === 4 ? dateStr + '-01-01T00:00:00.000Z' : dateStr + 'T00:00:00.000Z')
  }

  if (isNaN(d.getTime())) return dateStr
  const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  const day = d.getUTCDate()
  const year = d.getUTCFullYear()

  switch (granularity) {
    case 'year':
      return String(year)
    case 'monthly':
      return `${month} ${year}`
    case 'weekly':
    case 'daily':
      return `${month} ${day}`
    case 'all':
    default:
      return `${month} ${day}`
  }
}

export function loadPricing(modelsJson: unknown): Map<string, Pricing> {
  const map = new Map<string, Pricing>()
  if (!modelsJson || typeof modelsJson !== 'object') return map

  const models = modelsJson as Record<string, unknown>
  for (const [key, model] of Object.entries(models)) {
    if (!model || typeof model !== 'object') continue
    const m = model as Record<string, unknown>
    const pricing: Pricing = {
      input: Number(m.input_price ?? m.inputPrice ?? 0),
      output: Number(m.output_price ?? m.outputPrice ?? 0),
      reasoning: m.reasoning_price != null ? Number(m.reasoning_price) : undefined,
      cache: m.cache_price != null ? Number(m.cache_price) : undefined,
    }
    map.set(key, pricing)
  }
  return map
}

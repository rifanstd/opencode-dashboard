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
  if (!Number.isFinite(value)) return '$0.00'
  if (value === 0) return '$0.00'
  if (value < 1) {
    return `$${value.toFixed(4)}`
  }
  return `$${value.toFixed(2)}`
}

/**
 * Formats a number with K/M suffix for compact display.
 * - < 1000: standard locale formatting (e.g., "999")
 * - >= 1000 and < 1000000: X.XK with trailing ".0" stripped (e.g., 1500 → "1.5K", 1000 → "1K")
 * - >= 1000000: X.XM with trailing ".0" stripped (e.g., 2500000 → "2.5M", 2000000 → "2M")
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (value < 1000) return Math.round(value).toLocaleString()
  if (value < 1000000) {
    const k = value / 1000
    const formatted = k.toFixed(1)
    return formatted.endsWith('.0') ? formatted.slice(0, -2) + 'K' : formatted + 'K'
  }
  const m = value / 1000000
  const formatted = m.toFixed(1)
  return formatted.endsWith('.0') ? formatted.slice(0, -2) + 'M' : formatted + 'M'
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

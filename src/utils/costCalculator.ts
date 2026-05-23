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
  const inputCost = tokens.input * (pricing.input ?? 0)
  const outputCost = tokens.output * (pricing.output ?? 0)
  const reasoningCost = (tokens.reasoning ?? 0) * (pricing.reasoning ?? 0)
  const cacheCost = (tokens.cache ?? 0) * (pricing.cache ?? 0)
  return inputCost + outputCost + reasoningCost + cacheCost
}

export function formatCost(value: number): string {
  if (value < 1) {
    return `$${value.toFixed(4)}`
  }
  return `$${value.toFixed(2)}`
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

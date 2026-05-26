export function shortenModelName(
  modelId: string | null,
  modelProvider?: string | null
): string {
  if (!modelId) return '—'

  // Pattern 1: accounts/<provider>/models/<model>
  const accountsMatch = modelId.match(/^accounts\/([^/]+)\/models\/(.+)$/)
  if (accountsMatch) {
    return `${accountsMatch[1]}/${accountsMatch[2]}`
  }

  // Pattern 2: already has provider prefix
  const slashMatch = modelId.match(/^([^/]+)\/(.+)$/)
  if (slashMatch) {
    return modelId
  }

  // Pattern 3: generic name — add provider hint if available
  if (modelProvider) {
    return `${modelProvider}/${modelId}`
  }

  // Fallback: unrecognizable, keep as-is
  return modelId
}

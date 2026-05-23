export function extractAgentInfo(content: string): { name: string; description: string } {
  const lines = content.split('\n')
  let name = 'Unnamed Agent'
  let description = ''

  // Find first H1
  for (const line of lines) {
    const match = line.match(/^#\s+(.+)$/)
    if (match) {
      name = match[1].trim()
      break
    }
  }

  // Find first non-empty, non-heading, non-code-block line
  let inCodeBlock = false
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue
    if (line.trim().startsWith('#')) continue
    if (line.trim() === '') continue
    description = line.trim()
    break
  }

  return { name, description }
}

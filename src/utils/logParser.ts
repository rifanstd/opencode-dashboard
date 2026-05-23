import type { LogEntry } from '../types/index.ts'

export function parseLogFile(content: string, source: string): LogEntry[] {
  const entries: LogEntry[] = []
  const lines = content.split('\n')

  for (const line of lines) {
    if (!line.trim()) continue

    // Try ISO timestamp + level + message
    const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)\s+(INFO|WARN|ERROR|DEBUG)\s+(.*)$/i)
    if (match) {
      entries.push({
        timestamp: match[1],
        level: match[2].toUpperCase() as LogEntry['level'],
        message: match[3].trim(),
        source,
      })
      continue
    }

    // Try simpler format: [LEVEL] message
    const simpleMatch = line.match(/^\[(INFO|WARN|ERROR|DEBUG)\]\s+(.*)$/i)
    if (simpleMatch) {
      entries.push({
        timestamp: new Date().toISOString(),
        level: simpleMatch[1].toUpperCase() as LogEntry['level'],
        message: simpleMatch[2].trim(),
        source,
      })
      continue
    }

    // Fallback: treat as plain message
    entries.push({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: line.trim(),
      source,
    })
  }

  return entries
}

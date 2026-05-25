import type {
  Session,
  Project,
  Message,
  Part,
  ModelInfo,
  ProviderInfo,
  AgentInfo,
  SkillInfo,
  LogEntry,
  OverviewStats,
} from '../types/index.ts'

export interface TokenUsageData {
  byModel: Array<{
    label: string
    input: number
    output: number
    reasoning: number
    cache: number
  }>
  byProvider: Array<{
    label: string
    input: number
    output: number
    reasoning: number
    cache: number
  }>
  byProject: Array<{
    label: string
    input: number
    output: number
    reasoning: number
    cache: number
  }>
  byDay: Array<{
    date: string
    input: number
    output: number
    reasoning: number
    cache: number
  }>
  byWeek: Array<{
    date: string
    input: number
    output: number
    reasoning: number
    cache: number
  }>
  byMonth: Array<{
    date: string
    input: number
    output: number
    reasoning: number
    cache: number
  }>
  byYear: Array<{
    date: string
    input: number
    output: number
    reasoning: number
    cache: number
  }>
}

async function loadJson<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return [] as unknown as T
    }
    return (await response.json()) as T
  } catch {
    return [] as unknown as T
  }
}

export function loadSessions(): Promise<Session[]> {
  return loadJson<Session[]>('/data/sessions.json')
}

export function loadProjects(): Promise<Project[]> {
  return loadJson<Project[]>('/data/projects.json')
}

export function loadMessages(): Promise<Message[]> {
  return loadJson<Message[]>('/data/messages.json')
}

export function loadParts(): Promise<Part[]> {
  return loadJson<Part[]>('/data/parts.json')
}

export function loadProviders(): Promise<ProviderInfo[]> {
  return loadJson<ProviderInfo[]>('/data/providers.json')
}

export function loadModels(): Promise<ModelInfo[]> {
  return loadJson<ModelInfo[]>('/data/models.json')
}

export function loadAgents(): Promise<AgentInfo[]> {
  return loadJson<AgentInfo[]>('/data/agents.json')
}

export function loadSkills(): Promise<SkillInfo[]> {
  return loadJson<SkillInfo[]>('/data/skills.json')
}

export function loadLogs(): Promise<LogEntry[]> {
  return loadJson<LogEntry[]>('/data/logs.json')
}

export function loadOverviewStats(): Promise<OverviewStats> {
  return loadJson<OverviewStats>('/data/overview.json')
}

export function loadTokenUsage(): Promise<TokenUsageData> {
  return loadJson<TokenUsageData>('/data/token-usage.json')
}

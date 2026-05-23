export interface Session {
  id: string
  title: string
  project_id: string | null
  model_id: string | null
  created_at: string
  updated_at: string
  input_tokens: number
  output_tokens: number
  reasoning_tokens: number
  cache_tokens: number
  total_tokens: number
  cost: number | null
}

export interface Project {
  id: string
  name: string
  path: string | null
  created_at: string
}

export interface Message {
  id: string
  session_id: string
  role: string
  content: string | null
  created_at: string
  model_id: string | null
  input_tokens: number
  output_tokens: number
  reasoning_tokens: number
  cache_tokens: number
}

export interface Part {
  id: string
  message_id: string
  type: string
  content: string | null
  tool_name: string | null
  tool_input: string | null
  tool_output: string | null
  created_at: string
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  capabilities: string[]
  input_price: number
  output_price: number
  reasoning_price?: number
  cache_price?: number
  context_window: number
}

export interface ProviderInfo {
  id: string
  name: string
  apiKey: string | null
  baseUrl: string | null
  configured: boolean
}

export interface AgentInfo {
  name: string
  description: string
  filename: string
}

export interface SkillInfo {
  name: string
  version: string
  source: string
}

export interface LogEntry {
  timestamp: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
  message: string
  source: string
}

export interface TokenBreakdown {
  input: number
  output: number
  reasoning: number
  cache: number
}

export interface CostEstimate {
  total: number
  formatted: string
}

export interface OverviewStats {
  totalSessions: number
  totalInputTokens: number
  totalOutputTokens: number
  totalReasoningTokens: number
  totalCacheTokens: number
  totalCost: number
  mostUsedModel: string
  activeProjects: number
}

export interface SessionFilters {
  search?: string
  project?: string
  model?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface PaginatedSessions {
  sessions: Session[]
  total: number
}

export interface TokenUsageData {
  label: string
  input: number
  output: number
  reasoning: number
  cache: number
}

export interface TimeSeriesData {
  date: string
  input: number
  output: number
  reasoning: number
  cache: number
}

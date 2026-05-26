import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sqlite3 from 'sqlite3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, '..', 'public', 'data')

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function detectOpencodePaths() {
  const paths = {
    local: null,
    cache: null,
    config: null,
  }

  const home = process.env.USERPROFILE || process.env.HOME

  if (home) {
    const candidates = {
      local: [
        path.join(home, '.local', 'share', 'opencode'),
        path.join(home, 'AppData', 'Local', 'opencode'),
        path.join(home, '.opencode'),
        path.join(home, 'AppData', 'Local', 'OpenCode'),
        path.join(home, 'opencode'),
      ],
      cache: [
        path.join(home, '.cache', 'opencode'),
        path.join(home, 'AppData', 'Local', 'opencode', 'Cache'),
        path.join(home, '.opencode', 'cache'),
        path.join(home, 'AppData', 'Local', 'OpenCode', 'Cache'),
      ],
      config: [
        path.join(home, '.config', 'opencode'),
        path.join(home, 'AppData', 'Roaming', 'opencode'),
        path.join(home, '.opencode'),
        path.join(home, 'AppData', 'Roaming', 'OpenCode'),
      ],
    }

    for (const type of Object.keys(candidates)) {
      for (const candidate of candidates[type]) {
        if (fs.existsSync(candidate)) {
          paths[type] = candidate
          break
        }
      }
    }
  }

  const envPath = process.env.OPENCODE_DATA_PATH
  if (envPath) {
    if (fs.existsSync(envPath)) {
      const base = path.basename(envPath)
      if (base === 'opencode') {
        const localSub = path.join(envPath, 'local')
        const cacheSub = path.join(envPath, 'cache')
        const configSub = path.join(envPath, 'config')
        if (fs.existsSync(localSub)) paths.local = localSub
        if (fs.existsSync(cacheSub)) paths.cache = cacheSub
        if (fs.existsSync(configSub)) paths.config = configSub
        if (!paths.local) paths.local = envPath
      } else {
        paths.local = envPath
      }
    }
  }

  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--local' && args[i + 1]) {
      paths.local = args[i + 1]
      i++
    } else if (args[i] === '--cache' && args[i + 1]) {
      paths.cache = args[i + 1]
      i++
    } else if (args[i] === '--config' && args[i + 1]) {
      paths.config = args[i + 1]
      i++
    } else if (!args[i].startsWith('--') && fs.existsSync(args[i])) {
      paths.local = args[i]
    }
  }

  return paths
}

function readJsonSafe(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(text)
  } catch {
    return null
  }
}

function readTextFiles(dirPath, ext) {
  const results = []
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(ext)) {
        const content = fs.readFileSync(path.join(dirPath, entry.name), 'utf-8')
        results.push({ name: entry.name, content })
      }
    }
  } catch {
    // ignore
  }
  return results
}

/**
 * Normalize a raw model identifier into:
 * - shortName: provider-prefixed form for display (e.g., "fireworks/kimi-k2p6")
 * - modelName: bare model name for aggregation (e.g., "kimi-k2p6")
 */
function normalizeModelName(modelId, providerHint) {
  if (!modelId || typeof modelId !== 'string') {
    return { shortName: modelId, modelName: modelId }
  }

  // Pattern 1: accounts/<provider>/models/<model>
  const accountsMatch = modelId.match(/^accounts\/([^/]+)\/models\/(.+)$/)
  if (accountsMatch) {
    const provider = accountsMatch[1]
    const modelName = accountsMatch[2]
    return { shortName: `${provider}/${modelName}`, modelName }
  }

  // Pattern 2: already has provider prefix (<provider>/<model>)
  const slashMatch = modelId.match(/^([^/]+)\/(.+)$/)
  if (slashMatch) {
    return { shortName: modelId, modelName: slashMatch[2] }
  }

  // Pattern 3: generic name — add provider hint if available
  if (providerHint) {
    return { shortName: `${providerHint}/${modelId}`, modelName: modelId }
  }

  // Fallback: unrecognizable, keep as-is
  return { shortName: modelId, modelName: modelId }
}

function readLogFiles(dirPath) {
  const results = []
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.log')) {
        const content = fs.readFileSync(path.join(dirPath, entry.name), 'utf-8')
        results.push({ name: entry.name, content })
      }
    }
  } catch {
    // ignore
  }
  return results
}

function runQuery(dbPath, sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        reject(err)
        return
      }
      db.all(sql, params, (err2, rows) => {
        db.close()
        if (err2) {
          reject(err2)
        } else {
          resolve(rows || [])
        }
      })
    })
  })
}

function msToIso(ms) {
  if (!ms) return null
  try {
    return new Date(ms).toISOString()
  } catch {
    return null
  }
}

async function exportDatabase(dbPath) {
  // Sessions
  const rawSessions = await runQuery(dbPath, 'SELECT * FROM session ORDER BY time_created DESC')
  const sessions = rawSessions.map((s) => {
    let modelId = s.model ?? null
    let modelProvider = null
    if (modelId && typeof modelId === 'string' && modelId.startsWith('{')) {
      try {
        const parsed = JSON.parse(modelId)
        modelId = parsed.id ?? parsed.modelID ?? modelId
        modelProvider = parsed.provider ?? null
      } catch {
        // keep original
      }
    }
    return {
      id: s.id,
      title: s.title ?? 'Untitled',
      project_id: s.project_id ?? null,
      model_id: modelId,
      model_provider: modelProvider,
      created_at: msToIso(s.time_created) ?? '',
      updated_at: msToIso(s.time_updated) ?? '',
      input_tokens: s.tokens_input ?? 0,
      output_tokens: s.tokens_output ?? 0,
      reasoning_tokens: s.tokens_reasoning ?? 0,
      cache_tokens: (s.tokens_cache_read ?? 0),
      total_tokens: (s.tokens_input ?? 0) + (s.tokens_output ?? 0) + (s.tokens_reasoning ?? 0) + (s.tokens_cache_read ?? 0),
      cost: s.cost ?? null,
    }
  })

  // Projects
  const rawProjects = await runQuery(dbPath, 'SELECT * FROM project')
  const projects = rawProjects.map((p) => ({
    id: p.id,
    name: p.name ?? p.worktree ?? p.id,
    path: p.worktree ?? null,
    created_at: msToIso(p.time_created) ?? '',
  }))

  // Messages
  const rawMessages = await runQuery(dbPath, 'SELECT * FROM message ORDER BY time_created ASC')
  const messages = rawMessages.map((m) => {
    let data = {}
    try {
      data = JSON.parse(m.data)
    } catch {
      // ignore
    }

    const tokens = data.tokens || {}
    const cache = tokens.cache || {}

    return {
      id: m.id,
      session_id: m.session_id,
      role: data.role ?? 'unknown',
      content: null,
      created_at: msToIso(m.time_created) ?? '',
      model_id: data.model?.modelID ?? data.modelID ?? null,
      input_tokens: tokens.input ?? 0,
      output_tokens: tokens.output ?? 0,
      reasoning_tokens: tokens.reasoning ?? 0,
      cache_tokens: (cache.read ?? 0),
    }
  })

  // Parts
  const rawParts = await runQuery(dbPath, 'SELECT * FROM part ORDER BY time_created ASC')
  const parts = rawParts.map((p) => {
    let data = {}
    try {
      data = JSON.parse(p.data)
    } catch {
      // ignore
    }

    const toolInput = data.state?.input ? JSON.stringify(data.state.input) : null
    const toolOutput = data.state?.output ? JSON.stringify(data.state.output) : null

    return {
      id: p.id,
      message_id: p.message_id,
      type: data.type ?? 'unknown',
      content: data.text ?? null,
      tool_name: data.tool ?? null,
      tool_input: toolInput,
      tool_output: toolOutput,
      created_at: msToIso(p.time_created) ?? '',
    }
  })

  // Overview stats
  const totalSessions = sessions.length
  const totalInputTokens = sessions.reduce((sum, s) => sum + s.input_tokens, 0)
  const totalOutputTokens = sessions.reduce((sum, s) => sum + s.output_tokens, 0)
  const totalReasoningTokens = sessions.reduce((sum, s) => sum + s.reasoning_tokens, 0)
  const totalCacheTokens = sessions.reduce((sum, s) => sum + s.cache_tokens, 0)

  const modelCounts = {}
  for (const s of sessions) {
    if (s.model_id) {
      const normalized = normalizeModelName(s.model_id, s.model_provider)
      modelCounts[normalized.modelName] = (modelCounts[normalized.modelName] || 0) + 1
    }
  }
  let mostUsedModel = 'N/A'
  let maxCount = 0
  for (const [model, count] of Object.entries(modelCounts)) {
    if (count > maxCount) {
      maxCount = count
      mostUsedModel = model
    }
  }

  const overview = {
    totalSessions,
    totalInputTokens,
    totalOutputTokens,
    totalReasoningTokens,
    totalCacheTokens,
    totalCost: sessions.reduce((sum, s) => sum + (s.cost ?? 0), 0),
    mostUsedModel,
    activeProjects: projects.length,
  }

  // Token usage by model (normalized + aggregated across providers)
  const modelMap = {}
  for (const s of sessions) {
    if (!s.model_id) continue
    const normalized = normalizeModelName(s.model_id, s.model_provider)
    const modelName = normalized.modelName
    // When normalizeModelName couldn't resolve a provider prefix, mark as unknown
    const provider = normalized.shortName === normalized.modelName
      ? 'unknown'
      : (normalized.shortName.split('/')[0] || 'unknown')

    if (!modelMap[modelName]) {
      modelMap[modelName] = {
        label: modelName,
        input: 0,
        output: 0,
        reasoning: 0,
        cache: 0,
        providers: [],
      }
    }

    modelMap[modelName].input += s.input_tokens
    modelMap[modelName].output += s.output_tokens
    modelMap[modelName].reasoning += s.reasoning_tokens
    modelMap[modelName].cache += s.cache_tokens

    // Accumulate per-provider breakdown
    const existing = modelMap[modelName].providers.find((p) => p.provider === provider)
    if (existing) {
      existing.input += s.input_tokens
      existing.output += s.output_tokens
      existing.reasoning += s.reasoning_tokens
      existing.cache += s.cache_tokens
    } else {
      modelMap[modelName].providers.push({
        provider,
        input: s.input_tokens,
        output: s.output_tokens,
        reasoning: s.reasoning_tokens,
        cache: s.cache_tokens,
      })
    }
  }
  const byModel = Object.values(modelMap).sort((a, b) => (b.input + b.output) - (a.input + a.output))

  // Token usage by provider
  const providerMap = {}
  for (const s of sessions) {
    if (!s.model_id) continue
    const label =
      s.model_id.startsWith('gpt-') || s.model_id.startsWith('o1') || s.model_id.startsWith('o3')
        ? 'openai'
        : s.model_id.startsWith('claude-')
        ? 'anthropic'
        : s.model_id.startsWith('gemini-')
        ? 'google'
        : s.model_id.startsWith('llama') || s.model_id.startsWith('mixtral')
        ? 'meta/mistral'
        : 'other'
    if (!providerMap[label]) {
      providerMap[label] = { label, input: 0, output: 0, reasoning: 0, cache: 0 }
    }
    providerMap[label].input += s.input_tokens
    providerMap[label].output += s.output_tokens
    providerMap[label].reasoning += s.reasoning_tokens
    providerMap[label].cache += s.cache_tokens
  }
  const byProvider = Object.values(providerMap).sort((a, b) => (b.input + b.output) - (a.input + a.output))

  // Token usage by project
  const projectMap = {}
  for (const s of sessions) {
    const label = s.project_id ?? 'No Project'
    if (!projectMap[label]) {
      projectMap[label] = { label, input: 0, output: 0, reasoning: 0, cache: 0 }
    }
    projectMap[label].input += s.input_tokens
    projectMap[label].output += s.output_tokens
    projectMap[label].reasoning += s.reasoning_tokens
    projectMap[label].cache += s.cache_tokens
  }
  const byProject = Object.values(projectMap).sort((a, b) => (b.input + b.output) - (a.input + a.output))

  // Token usage over time
  const dayMap = {}
  const weekMap = {}
  const monthMap = {}
  const yearMap = {}
  for (const s of sessions) {
    const date = new Date(s.created_at)
    if (isNaN(date.getTime())) continue

    const dayKey = date.toISOString().slice(0, 10)
    const weekKey = `${date.getFullYear()}-W${String(getWeek(date)).padStart(2, '0')}`
    const monthKey = date.toISOString().slice(0, 7)
    const yearKey = String(date.getFullYear())

    for (const [map, key] of [[dayMap, dayKey], [weekMap, weekKey], [monthMap, monthKey], [yearMap, yearKey]]) {
      if (!map[key]) {
        map[key] = { date: key, input: 0, output: 0, reasoning: 0, cache: 0 }
      }
      map[key].input += s.input_tokens
      map[key].output += s.output_tokens
      map[key].reasoning += s.reasoning_tokens
      map[key].cache += s.cache_tokens
    }
  }

  function getWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }

  const byDay = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date))
  const byWeek = Object.values(weekMap).sort((a, b) => a.date.localeCompare(b.date))
  const byMonth = Object.values(monthMap).sort((a, b) => a.date.localeCompare(b.date))
  const byYear = Object.values(yearMap).sort((a, b) => a.date.localeCompare(b.date))

  return {
    sessions,
    projects,
    messages,
    parts,
    overview,
    tokenUsage: {
      byModel,
      byProvider,
      byProject,
      byDay,
      byWeek,
      byMonth,
      byYear,
    },
  }
}

function exportJsonFiles(paths) {
  const providers = []
  const models = []
  const agents = []
  const skills = []
  const logs = []

  // Providers from auth.json
  if (paths.local) {
    const authPath = path.join(paths.local, 'auth.json')
    console.log(`  Attempting auth.json from local: ${authPath}`)
    const authJson = readJsonSafe(authPath)
    if (authJson) {
      console.log(`  auth.json found in local (${Array.isArray(authJson) ? authJson.length : Object.keys(authJson).length} entries)`)
    } else {
      console.log(`  auth.json not found or unreadable in local`)
    }
    if (authJson && typeof authJson === 'object') {
      if (Array.isArray(authJson)) {
        console.log(`  auth.json is an array (${authJson.length} entries), iterating as providers`)
        authJson.forEach((value, index) => {
          if (value && typeof value === 'object') {
            const id = value.id ?? value.name ?? `provider-${index}`
            providers.push({
              id,
              name: value.name ?? id,
              apiKey: value.apiKey ?? value.api_key ?? value.key ?? value.token ?? value.secret ?? value.apiToken ?? null,
              baseUrl: value.baseUrl ?? value.base_url ?? null,
              configured: !!(value.apiKey || value.api_key || value.key || value.token || value.secret || value.apiToken),
            })
          }
        })
      } else {
        for (const [key, value] of Object.entries(authJson)) {
          if (value && typeof value === 'object') {
            providers.push({
              id: key,
              name: value.name ?? key,
              apiKey: value.apiKey ?? value.api_key ?? value.key ?? value.token ?? value.secret ?? value.apiToken ?? null,
              baseUrl: value.baseUrl ?? value.base_url ?? null,
              configured: !!(value.apiKey || value.api_key || value.key || value.token || value.secret || value.apiToken),
            })
          }
        }
      }
    }
  }

  // Providers from auth.json in paths.config (fallback)
  if (paths.config) {
    const configAuthPath = path.join(paths.config, 'auth.json')
    const localAuthPath = paths.local ? path.join(paths.local, 'auth.json') : null
    if (configAuthPath !== localAuthPath) {
      console.log(`  Attempting auth.json from config: ${configAuthPath}`)
      const configAuthJson = readJsonSafe(configAuthPath)
      if (configAuthJson) {
        console.log(`  auth.json found in config (${Array.isArray(configAuthJson) ? configAuthJson.length : Object.keys(configAuthJson).length} entries)`)
        const existingIds = new Set(providers.map(p => p.id))
        const entries = Array.isArray(configAuthJson)
          ? configAuthJson.map((value, index) => [value.id ?? value.name ?? `provider-${index}`, value])
          : Object.entries(configAuthJson)
        for (const [key, value] of entries) {
          if (existingIds.has(key)) {
            console.log(`  Provider "${key}" from config skipped (already in local)`)
            continue
          }
          if (value && typeof value === 'object') {
            providers.push({
              id: key,
              name: value.name ?? key,
              apiKey: value.apiKey ?? value.api_key ?? value.key ?? value.token ?? value.secret ?? value.apiToken ?? null,
              baseUrl: value.baseUrl ?? value.base_url ?? null,
              configured: !!(value.apiKey || value.api_key || value.key || value.token || value.secret || value.apiToken),
            })
          }
        }
      } else {
        console.log(`  auth.json not found or unreadable in config`)
      }
    } else {
      console.log(`  config auth.json path same as local, skipping duplicate read`)
    }
  }

  // Models from models.json (nested provider → models structure)
  if (paths.cache) {
    const modelsPath = path.join(paths.cache, 'models.json')
    const modelsJson = readJsonSafe(modelsPath)
    if (modelsJson && typeof modelsJson === 'object') {
      for (const [providerId, providerData] of Object.entries(modelsJson)) {
        // providerData is the provider container: { name, models: { ... } }
        if (!providerData || typeof providerData !== 'object') continue

        const providerModels = providerData.models
        if (!providerModels || typeof providerModels !== 'object') continue

        for (const [modelId, modelData] of Object.entries(providerModels)) {
          if (!modelData || typeof modelData !== 'object') continue
          if (modelData.status === 'deprecated') continue

          // Pricing from modelData.cost.{input,output,cache_read} (per-1M-tokens)
          // Values are already in per-1M-tokens format - pass through without conversion
          const cost = modelData.cost
          const rawInputPrice = Number(cost?.input ?? modelData.input_price ?? modelData.inputPrice ?? 0)
          const rawOutputPrice = Number(cost?.output ?? modelData.output_price ?? modelData.outputPrice ?? 0)
          const rawCacheReadPrice = Number(cost?.cache_read ?? modelData.cache_price ?? 0)
          const rawReasoningPrice = modelData.reasoning_price != null ? Number(modelData.reasoning_price) : undefined

          models.push({
            id: modelId,
            name: modelData.name ?? modelId,
            provider: providerId,
            capabilities: Array.isArray(modelData.capabilities) ? modelData.capabilities : [],
            input_price: rawInputPrice,
            output_price: rawOutputPrice,
            reasoning_price: rawReasoningPrice != null ? rawReasoningPrice : undefined,
            cache_price: rawCacheReadPrice,
            context_window: Number(modelData.context_window ?? modelData.contextWindow ?? 0),
          })
        }
      }
    }
  }

  // Agents from agents/*.md
  if (paths.config) {
    const agentsDir = path.join(paths.config, 'agents')
    const agentFiles = readTextFiles(agentsDir, '.md')
    for (const file of agentFiles) {
      const lines = file.content.split('\n')
      let name = 'Unnamed Agent'
      let description = ''
      for (const line of lines) {
        const match = line.match(/^#\s+(.+)$/)
        if (match) {
          name = match[1].trim()
          break
        }
      }
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
      agents.push({ name, description, filename: file.name })
    }
  }

  // Skills from skills-lock.json
  if (paths.config) {
    const skillsPath = path.join(paths.config, 'skills-lock.json')
    const skillsJson = readJsonSafe(skillsPath)
    if (skillsJson && typeof skillsJson === 'object') {
      for (const [key, value] of Object.entries(skillsJson)) {
        if (value && typeof value === 'object') {
          skills.push({
            name: key,
            version: value.version ?? '—',
            source: value.source ?? value.origin ?? '—',
          })
        }
      }
    }
  }

  // Logs from log/*.log
  if (paths.local) {
    const logDir = path.join(paths.local, 'log')
    const logFiles = readLogFiles(logDir)
    for (const file of logFiles) {
      const lines = file.content.split('\n')
      for (const line of lines) {
        if (!line.trim()) continue
        const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)\s+(INFO|WARN|ERROR|DEBUG)\s+(.*)$/i)
        if (match) {
          logs.push({
            timestamp: match[1],
            level: match[2].toUpperCase(),
            message: match[3].trim(),
            source: file.name,
          })
          continue
        }
        const simpleMatch = line.match(/^\[(INFO|WARN|ERROR|DEBUG)\]\s+(.*)$/i)
        if (simpleMatch) {
          logs.push({
            timestamp: new Date().toISOString(),
            level: simpleMatch[1].toUpperCase(),
            message: simpleMatch[2].trim(),
            source: file.name,
          })
          continue
        }
        logs.push({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: line.trim(),
          source: file.name,
        })
      }
    }
  }

  return { providers, models, agents, skills, logs }
}

async function main() {
  console.log('Detecting opencode data folders…')
  const paths = detectOpencodePaths()

  console.log('  local:', paths.local ?? 'not found')
  console.log('  cache:', paths.cache ?? 'not found')
  console.log('  config:', paths.config ?? 'not found')

  if (!paths.local && !paths.cache && !paths.config) {
    console.error('\nCould not auto-detect opencode data folders.')
    console.error('Set OPENCODE_DATA_PATH environment variable or pass paths as arguments:')
    console.error('  node scripts/sync-opencode-data.js --local <path> --cache <path> --config <path>')
    process.exit(1)
  }

  ensureDir(DATA_DIR)

  // Export database
  if (paths.local) {
    const dbPath = path.join(paths.local, 'opencode.db')
    if (fs.existsSync(dbPath)) {
      console.log('Reading opencode.db…')
      try {
        const dbData = await exportDatabase(dbPath)
        fs.writeFileSync(path.join(DATA_DIR, 'sessions.json'), JSON.stringify(dbData.sessions))
        fs.writeFileSync(path.join(DATA_DIR, 'projects.json'), JSON.stringify(dbData.projects))
        fs.writeFileSync(path.join(DATA_DIR, 'messages.json'), JSON.stringify(dbData.messages))
        fs.writeFileSync(path.join(DATA_DIR, 'parts.json'), JSON.stringify(dbData.parts))
        fs.writeFileSync(path.join(DATA_DIR, 'overview.json'), JSON.stringify(dbData.overview))
        fs.writeFileSync(path.join(DATA_DIR, 'token-usage.json'), JSON.stringify(dbData.tokenUsage))
        console.log(`  Exported ${dbData.sessions.length} sessions, ${dbData.messages.length} messages, ${dbData.parts.length} parts`)
      } catch (err) {
        console.error('  Failed to read database:', err.message)
      }
    } else {
      console.log('  opencode.db not found in local directory')
    }
  }

  // Export JSON files
  console.log('Exporting auxiliary data…')
  const auxData = exportJsonFiles(paths)
  fs.writeFileSync(path.join(DATA_DIR, 'providers.json'), JSON.stringify(auxData.providers))
  fs.writeFileSync(path.join(DATA_DIR, 'models.json'), JSON.stringify(auxData.models))
  fs.writeFileSync(path.join(DATA_DIR, 'agents.json'), JSON.stringify(auxData.agents))
  fs.writeFileSync(path.join(DATA_DIR, 'skills.json'), JSON.stringify(auxData.skills))
  fs.writeFileSync(path.join(DATA_DIR, 'logs.json'), JSON.stringify(auxData.logs))
  console.log(`  Exported ${auxData.providers.length} providers, ${auxData.models.length} models, ${auxData.agents.length} agents, ${auxData.skills.length} skills, ${auxData.logs.length} log entries`)

  console.log('\nSync complete. Data written to public/data/')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

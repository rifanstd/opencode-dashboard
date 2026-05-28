# AGENTS.md — opencode-dashboard

## Commands

```bash
npm run dev      # Start Vite dev server (serves /api/sync endpoint)
npm run build    # Type-check (tsc -b) then Vite build — types block on failure
npm run lint     # ESLint (flat config) across entire project
npm run preview  # Preview production build locally
npm run sync     # Export opencode data → public/data/*.json
```

**Build order matters:** `tsc -b` runs first; type errors block the Vite build.

## Data Architecture

**Client-side dashboard** — all data comes from static JSON in `public/data/`. No backend, no File System Access API.

1. `scripts/sync-opencode-data.js` reads the local opencode SQLite DB + config, exports 11 JSON files to `public/data/`
2. Pages load data on-demand via `src/utils/dataLoader.ts` → `fetch('/data/*.json')`
3. "Sync" button in the UI → `fetch('/api/sync')` (Vite middleware spawns `node scripts/sync-opencode-data.js`) → page reloads

**Critical:** `public/data/` is in `.gitignore`. Never commit generated JSON — it contains user-specific data.

### First-time setup

```bash
npm install
npm run sync   # Required — creates public/data/ JSON files
npm run dev
```

### Production build

```bash
npm run sync   # Required before build
npm run build
```

## Sync output (11 JSON files)

The sync script produces exactly these files in `public/data/`:

- `sessions.json`, `projects.json`, `messages.json`, `parts.json` — from SQLite
- `overview.json`, `token-usage.json` — computed aggregates from DB
- `providers.json` — from `auth.json` (local + config fallback)
- `models.json` — from `models.json` in cache dir
- `agents.json` — from `agents/*.md` in config dir
- `skills.json` — from `skills-lock.json` in config dir
- `logs.json` — from `log/*.log` in local dir

The sync script auto-detects opencode paths on Windows. Override via `OPENCODE_DATA_PATH` env var or `--local`, `--cache`, `--config` CLI args.

## Data Sources (Detailed)

### 1. `sessions.json` — `opencode.db` (SQLite)
- **Table**: `session`
- **Fields**: `id`, `title`, `project_id`, `model_id`, `tokens_input`, `tokens_output`, `tokens_reasoning`, `tokens_cache_read`, `cost`, `time_created`, `time_updated`
- **Notes**: `model_id` is parsed from JSON if stored as a JSON string. `model_provider` is extracted from the model object. Token and cost fields are aggregated directly from the session record.

### 2. `projects.json` — `opencode.db` (SQLite)
- **Table**: `project`
- **Fields**: `id`, `name` (falls back to `worktree` or `id`), `worktree` (path), `time_created`
- **Notes**: All projects are exported regardless of session count.

### 3. `messages.json` — `opencode.db` (SQLite)
- **Table**: `message`
- **Fields**: `id`, `session_id`, `role`, `created_at`, `model_id`, `input_tokens`, `output_tokens`, `reasoning_tokens`, `cache_tokens`
- **Notes**: The `data` column is JSON-parsed to extract `role`, `tokens` (input/output/reasoning), `cache` (read), and `modelID`. The actual message `content` is intentionally set to `null` (not exported) to keep the file size small.

### 4. `parts.json` — `opencode.db` (SQLite)
- **Table**: `part`
- **Fields**: `id`, `message_id`, `type`, `content`, `tool_name`, `tool_input`, `tool_output`, `created_at`
- **Notes**: The `data` column is JSON-parsed. `type` comes from `data.type`, `content` from `data.text`, `tool_name` from `data.tool`, and `tool_input`/`tool_output` are serialized from `data.state.input/output`.

### 5. `overview.json` — Computed from `sessions.json` and `projects.json`
- **Computed fields**:
  - `totalSessions` — count of all sessions
  - `totalInputTokens` / `totalOutputTokens` / `totalReasoningTokens` / `totalCacheTokens` — sum of respective token fields across all sessions
  - `totalCost` — sum of `cost` from all sessions
  - `mostUsedModel` — model name with the highest session count (derived from `model_id` after normalization)
  - `activeProjects` — count of all projects
- **Notes**: This is a pure aggregate — no raw rows, just summarized numbers.

### 6. `token-usage.json` — Computed from `sessions.json` (in-memory aggregation)
- **Structure**:
  - `byModel` — tokens aggregated per model (normalized model name), with nested `providers` array showing per-provider breakdown
  - `byProvider` — tokens aggregated using hardcoded heuristics based on `model_id` prefix:
    - `gpt-*`, `o1*`, `o3*` → `openai`
    - `claude-*` → `anthropic`
    - `gemini-*` → `google`
    - `llama*`, `mixtral*` → `meta/mistral`
    - everything else → `other`
  - `byProject` — tokens aggregated by `project_id` (or `"No Project"`)
  - `byDay` / `byWeek` / `byMonth` / `byYear` — tokens aggregated by time buckets derived from `created_at`
- **Notes**: This is the primary source for the Token Usage dashboard charts. It does NOT read from `providers.json` — provider names are inferred from model IDs, not from the auth config.

### 7. `providers.json` — `auth.json` (Local + Config fallback)
- **Primary source**: `local/auth.json` (inside the detected `local` opencode path)
- **Fallback source**: `config/auth.json` (inside the detected `config` opencode path)
- **Fields**: `id`, `name`, `apiKey`, `baseUrl`, `configured`
- **Notes**: `configured` is a boolean derived from the presence of any API key field. If the same provider ID exists in both `local` and `config`, the local one takes precedence and the config one is skipped.
- **Important**: Removing a provider from `auth.json` means it disappears from this file, but **historical session/message data in the SQLite DB is unaffected**. The Token Usage page will still show historical tokens for that provider under `byProvider` (as `other`) or `byModel` (with the provider name derived from the model ID), even if the provider is no longer listed in `providers.json`.

### 8. `models.json` — `cache/models.json`
- **Source**: The `models.json` file inside the detected `cache` opencode path
- **Fields**: `id`, `name`, `provider`, `capabilities`, `input_price`, `output_price`, `reasoning_price`, `cache_price`, `context_window`
- **Notes**: The sync script reads a nested structure (`provider → { name, models: { modelId → modelData } }`). Models with `status: "deprecated"` are skipped. Pricing values are read directly from `cost.input`, `cost.output`, `cost.cache_read` (per-1M-tokens format) without conversion.

### 9. `agents.json` — `config/agents/*.md`
- **Source**: Markdown files (`*.md`) inside the `agents` subdirectory of the detected `config` opencode path
- **Fields**: `name`, `description`, `filename`
- **Notes**: `name` is extracted from the first `# Heading` line. `description` is the first non-empty, non-heading, non-code-block line. Only files ending in `.md` are read.

### 10. `skills.json` — Scanned `SKILL.md` files + `skills-lock.json`
- **Primary source**: Scanned directories containing `SKILL.md` files:
  - Project-local: `CWD/.opencode/skills/`, `CWD/.claude/skills/`, `CWD/.agents/skills/`
  - Global: `~/.config/opencode/skills/`, `~/.claude/skills/`, `~/.agents/skills/`
- **Supplementary metadata**: `skills-lock.json` (both in `config` path and project root)
- **Fields**: `name`, `description`, `path`
- **Notes**: Skill metadata is parsed from YAML frontmatter in each `SKILL.md` (keys: `name`, `description`). If the same skill name exists in multiple locations, the first one found wins. `skills-lock.json` is only used for source/origin metadata, not for the list of skills itself.

### 11. `logs.json` — `local/log/*.log`
- **Source**: `.log` files inside the `log` subdirectory of the detected `local` opencode path
- **Fields**: `timestamp`, `level` (`INFO`/`WARN`/`ERROR`/`DEBUG`), `message`, `source` (filename)
- **Notes**: The sync script attempts multiple parsing strategies:
  1. `YYYY-MM-DDTHH:mm:ss... LEVEL message` (with ISO timestamp)
  2. `[LEVEL] message` (falls back to current timestamp)
  3. Any other line → `INFO` level with the full line as message

## Global Data Sources (Dashboard-Level)

The following describes where each type of data displayed in the dashboard originates from, and how it is produced.

### Sessions, Messages, Parts, Projects
- **Origin**: SQLite database `opencode.db` (in the `local` directory).
- **How it is read**: The sync script runs SQL queries on the `session`, `message`, `part`, and `project` tables and exports the results as JSON. The dashboard then fetches these JSON files.
- **What it contains**: Session titles, token counts, costs, message metadata, project names, and tool usage parts.

### Token Usage (Overview, Charts, Statistics)
- **Origin**: Computed in-memory from the `sessions` data during sync.
- **How it is calculated**: The sync script iterates over all sessions and aggregates tokens by model, provider, project, day, week, month, and year.
- **What it contains**: Total input/output/reasoning/cache tokens, grouped by different dimensions.
- **Important**: Token usage does **not** depend on `providers.json`. Provider names are derived from `model_id` prefixes (e.g., `gpt-*` → `openai`, `claude-*` → `anthropic`).

### Cost (Session Cost, Chart Cost, Estimated Cost)
- **Origin**: Two possible sources:
  1. **Pre-calculated cost** from the `cost` field in the `session` table (SQLite).
  2. **Client-side computed cost** from tokens × model pricing.
- **How it is calculated**: The dashboard uses `models.json` pricing (`input_price`, `output_price`, `reasoning_price`, `cache_price`) to multiply by token counts. This is done client-side in `src/utils/costCalculator.ts` and `src/utils/overviewDataProcessor.ts`.
- **What it contains**: Estimated cost per session and aggregated cost over time.

### Providers (Provider List, Configuration Status)
- **Origin**: `auth.json` in the `local` directory (primary) + `auth.json` in the `config` directory (fallback).
- **How it is read**: The sync script reads `auth.json` and extracts provider names, API keys, and base URLs. The dashboard uses this to show the provider list and configuration status.
- **What it contains**: Provider name, whether it is configured (`configured`), API key, and base URL.
- **Important**: Removing a provider from `auth.json` removes it from the provider list, but **does not** affect historical session data in the database.

### Models (Model List, Pricing, Capabilities)
- **Origin**: `models.json` in the `cache` directory.
- **How it is read**: The sync script reads the nested `models.json` (provider → models) and flattens it into a list. The dashboard uses this to display model names, pricing, and capabilities.
- **What it contains**: Model name, provider ID, pricing (per-1M tokens), context window, and capabilities.

### Agents
- **Origin**: Markdown files (`*.md`) in the `agents` subdirectory of the `config` directory.
- **How it is read**: The sync script scans `agents/*.md`, extracts the first `# Heading` as the agent name, and the first non-empty paragraph as the description.
- **What it contains**: Agent name, description, and filename.

### Skills
- **Origin**: Two sources:
  1. **Primary**: Scanned directories containing `SKILL.md` files (project-local and global paths).
  2. **Supplementary**: `skills-lock.json` for metadata about source/origin.
- **How it is read**: The sync script scans directories, reads `SKILL.md` files, and parses YAML frontmatter (`name`, `description`). The dashboard displays the name and description.
- **What it contains**: Skill name, description, and path.

### Logs
- **Origin**: `.log` files in the `log` subdirectory of the `local` directory.
- **How it is read**: The sync script reads each `.log` file line by line and attempts to parse timestamps and log levels.
- **What it contains**: Log timestamp, level (`INFO`/`WARN`/`ERROR`/`DEBUG`), message, and source filename.

## TypeScript strictness

- **Project references**: `tsconfig.json` solution → `tsconfig.app.json` (`src/`) + `tsconfig.node.json` (`vite.config.ts`)
- **`verbatimModuleSyntax: true`** — use `import type` for type-only imports or the build fails
- **`erasableSyntaxOnly: true`** — no `enum`, `namespace`, parameter properties
- **`noUnusedLocals` / `noUnusedParameters: true`** — unused imports/vars block `tsc -b`
- **`noFallthroughCasesInSwitch: true`** — every case needs `break` or `return`

## Gotchas

- **No test runner, CI, or env files** in this repo.
- **`dataLoader.ts` silently returns `[]` on fetch failures** — pages render empty states instead of crashing. Don't add redundant error boundaries for missing data.
- **`/api/sync` only works in dev mode** (Vite middleware in `vite.config.ts`). Production builds serve static files only.
- **`src/hooks/` and `src/workers/` are empty** — leftover from earlier implementations.
- **`prompt.md`** (root) is the project-level opencode context file — currently empty, may be populated later.
- **Windows-first path detection** in sync script (`%USERPROFILE%`, `AppData/Local`, `AppData/Roaming`).

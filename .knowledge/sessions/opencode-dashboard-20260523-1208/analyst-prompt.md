You are the Analyst agent. Analyze the following project requirements and produce a comprehensive requirements document.

## Project Context

**Goal**: Build a client-side dashboard website to visualize opencode (AI coding assistant) usage analytics from local data.

**Technology Stack**: React + TypeScript + Vite (existing project at D:\projects\opencode-dashboard)

**Data Access Method**: File System Access API (Chrome/Edge only). The user will select their opencode data folder, and the website will read files directly from disk using this browser API.

**Data Sources** (all local, client-side only):
1. `~/.local/share/opencode/opencode.db` — SQLite database (~196MB) containing:
   - `session` table: sessions with token usage (input/output/reasoning/cache), cost, model info, project, title, directory, timestamps
   - `project` table: projects with worktree, vcs, name, timestamps
   - `message` table: messages with role, agent, model provider, data (JSON)
   - `part` table: message parts with type (text, step-start, tool-call, etc.), data (JSON)
   - `account` table: account info
   - `workspace` table: workspaces
   - `todo` table: todos
   - `event` table: events
   - `session_message` table: session messages
   - `session_share` table: shared sessions
2. `~/.local/share/opencode/auth.json` — providers & API keys (local only, contains sensitive data)
3. `~/.cache/opencode/models.json` — model definitions with pricing, capabilities, limits
4. `~/.config/opencode/agents/*.md` — agent definitions (markdown files)
5. `~/.config/opencode/skills-lock.json` — installed skills with versions and sources
6. `~/.local/share/opencode/log/*.log` — activity and error logs

**Features Requested** (all must be included):
1. **Overview Dashboard** — summary cards: total sessions, total tokens (input/output/reasoning/cache), total cost, most used model, active projects, etc.
2. **Token Usage Analytics** — breakdown per model, per provider, per project, per day/week/month with charts
3. **Sessions List** — table/grid of all sessions with filtering, search, sorting; columns: title, project, model, tokens, cost, date
4. **Session Detail** — drill-down view showing messages, parts, tool calls, token breakdown for a specific session
5. **Providers** — list of connected providers from auth.json (API keys masked), status
6. **Models** — list of available models from models.json with capabilities, pricing, context limits
7. **Agents** — list of defined agents from agents/*.md with descriptions
8. **Skills** — list of installed skills from skills-lock.json with versions and sources
9. **Logs/Activity** — view log files content with filtering by date/level
10. **Cost Estimation** — calculate and display estimated costs based on token usage and model pricing

**Constraints**:
- Client-side only, no backend server
- Data never leaves the browser (privacy)
- Chrome/Edge only (File System Access API)
- Must handle large SQLite file (~196MB) efficiently in browser using sql.js (SQLite WASM)
- Data is scattered across 3 parent directories: ~/.local/share/opencode/, ~/.cache/opencode/, ~/.config/opencode/
- User must select these folders manually via browser picker

**Design Questions to Address**:
- Single-page vs multi-page layout?
- How to handle folder selection UX for 3 separate directories?
- How to handle large DB file loading without blocking UI?
- Charting library recommendation?
- State management approach?
- Error handling for unsupported browsers?

## Your Task

1. Read the existing project files at D:\projects\opencode-dashboard to understand current structure
2. Analyze all requirements above
3. Produce a comprehensive requirements document at: D:\projects\opencode-dashboard\.knowledge\sessions\opencode-dashboard-20260523-1208\requirements.md

The requirements.md must follow this format:
```
# Requirements: Opencode Dashboard
## Context
## Functional Requirements
## Non-Functional Requirements
## Constraints
## Open Questions
```

4. After writing, do a spec self-review for placeholders, contradictions, ambiguity, and scope.
5. Report back to the Orchestrator that requirements are complete.

Do NOT proceed to planning or implementation. Stop after producing requirements.md.

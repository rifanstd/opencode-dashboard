You are the Planner agent. Create a detailed implementation plan based on the approved requirements.

## Input
Read the requirements document at:
D:\projects\opencode-dashboard\.knowledge\sessions\opencode-dashboard-20260523-1208\requirements.md

## Project Context
- Existing React + TypeScript + Vite project at D:\projects\opencode-dashboard
- Current dependencies: react, react-dom, vite, typescript, eslint
- Strict TypeScript config: verbatimModuleSyntax, erasableSyntaxOnly, noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch
- ESM only ("type": "module" in package.json)
- No test runner configured
- No backend server — pure client-side

## Data Sources (all local files)
1. `~/.local/share/opencode/opencode.db` — SQLite database (~196MB) with tables: session, project, message, part, account, workspace, todo, event, session_message, session_share
2. `~/.local/share/opencode/auth.json` — providers & API keys
3. `~/.cache/opencode/models.json` — model definitions with pricing
4. `~/.config/opencode/agents/*.md` — agent definitions
5. `~/.config/opencode/skills-lock.json` — installed skills
6. `~/.local/share/opencode/log/*.log` — activity logs

## Key Technical Decisions Needed
- File System Access API for reading local files
- sql.js (SQLite WASM) for querying the database in browser
- Handle ~196MB file efficiently without blocking UI
- Data scattered across 3 directories

## Your Task
1. Read the requirements document
2. Read the existing project files (package.json, tsconfig files, src/ directory) to understand current structure
3. Create a comprehensive implementation plan at:
   D:\projects\opencode-dashboard\.knowledge\sessions\opencode-dashboard-20260523-1208\plan.md

The plan.md must include:
- Architecture overview
- Component structure
- Data flow and state management approach
- File/directory structure for new code
- Step-by-step implementation tasks (in order)
- Dependencies to install with justification
- Error handling strategy
- Performance considerations for large SQLite file

4. After writing, do a self-review for completeness, feasibility, and consistency with requirements.
5. Report back to the Orchestrator that planning is complete.

Do NOT write any code. Stop after producing plan.md.

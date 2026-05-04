# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development server (watch mode, port 7777)
bun run dev

# Client development (Vite dev server, proxies /api to localhost:7777)
bun run --cwd packages/client dev

# Production build (client output to packages/client/dist)
bun run build

# Run the CLI (start server daemon and open browser)
bun run start [path]
bun run bin/jjgui.ts stop
```

There is no test framework yet.

## Architecture

Web GUI for the Jujutsu (jj) version control system. Bun monorepo (`packages/*` workspaces).

### Client (`packages/client`)
- React 18 + Vite SPA
- `App.tsx` owns the overall state: rows (commit graph), error, and the rebase state machine
- Rebase workflow: `idle → source-selected → confirming → executing` (`RebaseState` type)
- `utils/graph.ts` uses BFS to calculate descendants and validate rebase targets
- Receives server `refresh` events via SSE (`EventSource`) and automatically calls `fetchLog`

### Server (`packages/server`)
- Bun.serve HTTP server (port 7777)
- `jj.ts`: jj CLI wrapper. Runs jj commands through Bun's `$` shell and parses logs with a custom template (`\x1f` delimiter)
- `routes.ts`: API handlers and per-cwd SSE client management
- `index.ts`: server boot, per-cwd recursive `fs.watch`, static file serving, and SPA fallback
- PID file: `/tmp/jjgui.pid`

### CLI (`bin/jjgui.ts`)
- Daemon manager: health check → spawn server as a detached subprocess if absent → open browser

### Data Flow
1. The client passes the repository path through the `?cwd=` query
2. The server runs jj commands in that cwd and returns results as `GraphRow[]`
3. File changes trigger `fs.watch` → SSE `refresh` → automatic client refresh

### Key Types
- `GraphRow`: `{ type: 'commit' | 'edge' | 'elided', graphChars, indent, laneColors, commit? }`
- `CommitInfo`: changeId, commitId, parents, bookmarks, workspaces, isWorkingCopy, isImmutable, and related fields
- Graph characters: `○` = regular commit, `◆` = immutable, `@` = working copy

### API
- `GET /api/log` — commit graph
- `GET /api/show/:changeId` — changed file list
- `POST /api/edit`, `/api/new`, `/api/rebase`, `/api/undo` — commit operations
- `GET /api/events` — SSE stream
- All APIs require `?cwd=`

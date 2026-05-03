import { handleRequest } from './routes'
import { notifyClients } from './routes'
import { watch, type FSWatcher } from 'fs'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'

const PORT = 7777
const DIST = join(import.meta.dir, '../../client/dist')
const PID_FILE = '/tmp/jjgui.pid'

// Manage file watchers by cwd.
const watchers = new Map<string, FSWatcher>()

export function ensureWatcher(cwd: string) {
  if (watchers.has(cwd)) return
  const watcher = watch(cwd, { recursive: true }, (_event, filename) => {
    if (filename && !filename.includes('.jj')) {
      notifyClients(cwd)
    }
  })
  watchers.set(cwd, watcher)
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    // health check
    if (url.pathname === '/health') {
      return Response.json({ ok: true, pid: process.pid })
    }

    // Handle API requests.
    if (url.pathname.startsWith('/api/')) {
      // Register a watcher when cwd is present.
      const cwd = url.searchParams.get('cwd')
      if (cwd) ensureWatcher(cwd)
      return handleRequest(req)
    }

    // Serve static files.
    const filePath = url.pathname === '/' ? '/index.html' : url.pathname
    const file = Bun.file(join(DIST, filePath))
    if (await file.exists()) {
      return new Response(file)
    }

    // SPA fallback
    return new Response(Bun.file(join(DIST, 'index.html')))
  },
})

// Write PID file.
writeFileSync(PID_FILE, String(process.pid))

// SIGTERM handler.
process.on('SIGTERM', () => {
  try { unlinkSync(PID_FILE) } catch {}
  process.exit(0)
})

console.log(`visual-jj running at http://localhost:${server.port}`)

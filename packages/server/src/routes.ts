import { getGraphLog, getChangedFiles, editCommit, newCommit, rebaseCommit, restoreOperation } from './jj'

// cwd별 SSE 클라이언트 관리
const sseClients = new Map<string, Set<ReadableStreamDefaultController>>()

export function notifyClients(cwd: string) {
  const clients = sseClients.get(cwd)
  if (!clients) return
  for (const ctrl of clients) {
    try {
      ctrl.enqueue('event: refresh\ndata: {}\n\n')
    } catch {
      clients.delete(ctrl)
    }
  }
}

function getCwd(url: URL): string | null {
  return url.searchParams.get('cwd')
}

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url)

  // GET /api/log?cwd=...
  if (url.pathname === '/api/log') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      return Response.json(await getGraphLog(cwd))
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 })
    }
  }

  // GET /api/show/:changeId?cwd=...
  if (url.pathname.startsWith('/api/show/')) {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    const changeId = url.pathname.slice('/api/show/'.length)
    try {
      return Response.json(await getChangedFiles(cwd, changeId))
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 })
    }
  }

  // POST /api/edit?cwd=...
  if (req.method === 'POST' && url.pathname === '/api/edit') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      const body = await req.json()
      await editCommit(cwd, body.changeId)
      return Response.json({ ok: true })
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 })
    }
  }

  // POST /api/new?cwd=...
  if (req.method === 'POST' && url.pathname === '/api/new') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      const body = await req.json()
      await newCommit(cwd, body.changeId)
      return Response.json({ ok: true })
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 })
    }
  }

  // POST /api/rebase?cwd=...
  if (req.method === 'POST' && url.pathname === '/api/rebase') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      const body = await req.json()
      const beforeOpId = await rebaseCommit(cwd, body.sourceChangeId, body.destinationChangeId, body.mode ?? 'source')
      return Response.json({ ok: true, beforeOpId })
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 })
    }
  }

  // POST /api/undo?cwd=...
  if (req.method === 'POST' && url.pathname === '/api/undo') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      const body = await req.json()
      await restoreOperation(cwd, body.operationId)
      return Response.json({ ok: true })
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 })
    }
  }

  // GET /api/events?cwd=...
  if (url.pathname === '/api/events') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })

    const stream = new ReadableStream({
      start(ctrl) {
        if (!sseClients.has(cwd)) sseClients.set(cwd, new Set())
        sseClients.get(cwd)!.add(ctrl)
        req.signal.addEventListener('abort', () => {
          sseClients.get(cwd)?.delete(ctrl)
          ctrl.close()
        })
      },
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  return new Response('Not Found', { status: 404 })
}

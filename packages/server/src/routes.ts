import { getGraphLog, getChangedFiles, editCommit, newCommit, rebaseCommit, restoreOperation, getFullDescription, describeCommit, bookmarkCreate, bookmarkMove, bookmarkDelete, bookmarkRename, bookmarkList, bookmarkSet, splitCommit, squashCommit, discardFileChanges, moveChanges, getRemotes, pushBookmark, fetchAllRemotes } from './jj'

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
  if (req.method === 'GET' && url.pathname === '/api/log') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      return Response.json(await getGraphLog(cwd))
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 })
    }
  }

  // GET /api/show/:changeId?cwd=...
  if (req.method === 'GET' && url.pathname.startsWith('/api/show/')) {
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

  // GET /api/description/:changeId?cwd=...
  if (req.method === 'GET' && url.pathname.startsWith('/api/description/')) {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    const changeId = url.pathname.slice('/api/description/'.length)
    try {
      const description = await getFullDescription(cwd, changeId)
      return Response.json({ description })
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 })
    }
  }

  // POST /api/describe?cwd=...
  if (req.method === 'POST' && url.pathname === '/api/describe') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      const body = await req.json()
      await describeCommit(cwd, body.changeId, body.message)
      notifyClients(cwd)
      return Response.json({ ok: true })
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 })
    }
  }

  // GET /api/bookmarks?cwd=...
  if (req.method === 'GET' && url.pathname === '/api/bookmarks') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      const bookmarks = await bookmarkList(cwd)
      return Response.json({ bookmarks })
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 })
    }
  }

  // POST /api/bookmark/set?cwd=...
  if (req.method === 'POST' && url.pathname === '/api/bookmark/set') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      const body = await req.json()
      await bookmarkSet(cwd, body.name, body.changeId, body.allowBackwards ?? false)
      return Response.json({ ok: true })
    } catch (e) {
      return Response.json({ ok: false, error: String(e) }, { status: 500 })
    }
  }

  // POST /api/bookmark/create?cwd=...
  if (req.method === 'POST' && url.pathname === '/api/bookmark/create') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      const body = await req.json()
      await bookmarkCreate(cwd, body.name, body.changeId)
      return Response.json({ ok: true })
    } catch (e) {
      return Response.json({ ok: false, error: String(e) }, { status: 500 })
    }
  }

  // POST /api/bookmark/move?cwd=...
  if (req.method === 'POST' && url.pathname === '/api/bookmark/move') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      const body = await req.json()
      const beforeOpId = await bookmarkMove(cwd, body.name, body.destinationChangeId)
      return Response.json({ ok: true, beforeOpId })
    } catch (e) {
      return Response.json({ ok: false, error: String(e) }, { status: 500 })
    }
  }

  // POST /api/bookmark/delete?cwd=...
  if (req.method === 'POST' && url.pathname === '/api/bookmark/delete') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      const body = await req.json()
      await bookmarkDelete(cwd, body.name)
      return Response.json({ ok: true })
    } catch (e) {
      return Response.json({ ok: false, error: String(e) }, { status: 500 })
    }
  }

  // POST /api/bookmark/rename?cwd=...
  if (req.method === 'POST' && url.pathname === '/api/bookmark/rename') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      const body = await req.json()
      await bookmarkRename(cwd, body.oldName, body.newName)
      return Response.json({ ok: true })
    } catch (e) {
      return Response.json({ ok: false, error: String(e) }, { status: 500 })
    }
  }

  // POST /api/split?cwd=...
  if (req.method === 'POST' && url.pathname === '/api/split') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      const body = await req.json()
      const beforeOpId = await splitCommit(cwd, body.changeId, body.paths)
      return Response.json({ ok: true, beforeOpId })
    } catch (e) {
      return Response.json({ ok: false, error: String(e) }, { status: 500 })
    }
  }

  // POST /api/squash?cwd=...
  if (req.method === 'POST' && url.pathname === '/api/squash') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      const body = await req.json()
      const beforeOpId = await squashCommit(cwd, body.changeId)
      return Response.json({ ok: true, beforeOpId })
    } catch (e) {
      return Response.json({ ok: false, error: String(e) }, { status: 500 })
    }
  }

  // POST /api/discard-file?cwd=...
  if (req.method === 'POST' && url.pathname === '/api/discard-file') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      const body = await req.json()
      const beforeOpId = await discardFileChanges(cwd, body.changeId, body.path)
      return Response.json({ ok: true, beforeOpId })
    } catch (e) {
      return Response.json({ ok: false, error: String(e) }, { status: 500 })
    }
  }

  // POST /api/move-changes?cwd=...
  if (req.method === 'POST' && url.pathname === '/api/move-changes') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      const body = await req.json()
      const beforeOpId = await moveChanges(cwd, body.fromChangeId, body.toChangeId, body.paths)
      return Response.json({ ok: true, beforeOpId })
    } catch (e) {
      return Response.json({ ok: false, error: String(e) }, { status: 500 })
    }
  }

  // GET /api/remotes?cwd=...
  if (req.method === 'GET' && url.pathname === '/api/remotes') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      const remotes = await getRemotes(cwd)
      return Response.json({ remotes })
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 })
    }
  }

  // POST /api/push?cwd=...
  if (req.method === 'POST' && url.pathname === '/api/push') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      const body = await req.json()
      const scope = body.scope === 'subtree' ? 'subtree' : 'bookmark'
      const output = await pushBookmark(cwd, body.bookmark, body.remote, scope)
      return Response.json({ ok: true, output })
    } catch (e) {
      return Response.json({ ok: false, error: String(e) }, { status: 500 })
    }
  }

  // POST /api/fetch?cwd=...
  if (req.method === 'POST' && url.pathname === '/api/fetch') {
    const cwd = getCwd(url)
    if (!cwd) return Response.json({ error: 'cwd required' }, { status: 400 })
    try {
      const result = await fetchAllRemotes(cwd)
      if (result.results.some((item) => item.ok)) {
        notifyClients(cwd)
      }
      return Response.json({ ok: true, ...result })
    } catch (e) {
      return Response.json({ ok: false, error: String(e) }, { status: 500 })
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

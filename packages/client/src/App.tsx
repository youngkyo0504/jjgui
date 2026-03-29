import { useCallback, useEffect, useMemo, useState } from 'react'
import LogView from './components/LogView'
import RebaseBanner from './components/RebaseBanner'
import BookmarkMoveBanner from './components/BookmarkMoveBanner'
import BookmarkModal from './components/BookmarkModal'
import ErrorBanner from './components/ErrorBanner'
import { buildChildrenMap, getDescendants } from './utils/graph'
import './components/styles.css'

interface CommitInfo {
  changeId: string
  commitId: string
  description: string
  author: string
  timestamp: string
  workspaces: string[]
  bookmarks: string[]
  parents: string[]
  isWorkingCopy: boolean
  isImmutable: boolean
  hasConflict: boolean
  isEmpty: boolean
  isHidden: boolean
}

interface GraphRow {
  graphChars: string
  type: 'commit' | 'edge' | 'elided'
  indent: number
  laneColors?: string[]
  commit?: CommitInfo
}

export type RebasePhase = 'idle' | 'source-selected' | 'confirming' | 'executing'

export interface RebaseState {
  phase: RebasePhase
  sourceChangeId?: string
  sourceDescription?: string
  destinationChangeId?: string
  destinationDescription?: string
  descendants?: Set<string>
  lastAction?: 'rebase'
  beforeOpId?: string
}

export type BookmarkMovePhase = 'idle' | 'selecting-destination' | 'confirming' | 'executing'

export interface BookmarkMoveState {
  phase: BookmarkMovePhase
  bookmarkName?: string
  sourceChangeId?: string
  destinationChangeId?: string
  destinationDescription?: string
  lastAction?: 'bookmark-move'
  beforeOpId?: string
}

export default function App() {
  const [rows, setRows] = useState<GraphRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [rebase, setRebase] = useState<RebaseState>({ phase: 'idle' })
  const [bookmarkMove, setBookmarkMove] = useState<BookmarkMoveState>({ phase: 'idle' })
  const [describingChangeId, setDescribingChangeId] = useState<string | null>(null)
  const [bookmarkModal, setBookmarkModal] = useState<{ mode: 'create' | 'rename'; changeId?: string; bookmarkName?: string } | null>(null)

  const cwd = new URLSearchParams(window.location.search).get('cwd') ?? ''

  const childrenMap = useMemo(() => buildChildrenMap(rows), [rows])

  const fetchLog = async () => {
    if (!cwd) {
      setError('cwd query parameter is required. Usage: ?cwd=/path/to/repo')
      return
    }
    try {
      const res = await fetch(`/api/log?cwd=${encodeURIComponent(cwd)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRows(data)
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }

  const handleRebaseStart = useCallback((changeId: string, description: string) => {
    const descendants = getDescendants(changeId, childrenMap)
    setRebase({
      phase: 'source-selected',
      sourceChangeId: changeId,
      sourceDescription: description,
      descendants,
    })
  }, [childrenMap])

  const handleRebaseCancel = useCallback(() => {
    setRebase({ phase: 'idle' })
  }, [])

  const handleDestinationSelect = useCallback((changeId: string, description: string) => {
    setRebase((prev) => ({
      ...prev,
      phase: 'confirming',
      destinationChangeId: changeId,
      destinationDescription: description,
    }))
  }, [])

  const handleRebaseConfirm = useCallback(async () => {
    if (!rebase.sourceChangeId || !rebase.destinationChangeId) return
    setRebase((prev) => ({ ...prev, phase: 'executing' }))
    try {
      const res = await fetch(`/api/rebase?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceChangeId: rebase.sourceChangeId,
          destinationChangeId: rebase.destinationChangeId,
          mode: 'source',
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setRebase({ phase: 'idle', lastAction: 'rebase', beforeOpId: data.beforeOpId })
      await fetchLog()
    } catch (e) {
      setError(String(e))
      setRebase({ phase: 'idle' })
    }
  }, [rebase.sourceChangeId, rebase.destinationChangeId, cwd])

  const handleEdit = useCallback(async (changeId: string) => {
    setEditError(null)
    try {
      const res = await fetch(`/api/edit?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeId }),
      })
      if (!res.ok) {
        const text = await res.text()
        let message = `HTTP ${res.status}`
        try { message = JSON.parse(text).error || message } catch { message = text || message }
        throw new Error(message)
      }
      await fetchLog()
    } catch (e) {
      setEditError(String(e))
    }
  }, [cwd])

  const handleNew = useCallback(async (changeId: string) => {
    setEditError(null)
    try {
      const res = await fetch(`/api/new?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeId }),
      })
      if (!res.ok) {
        const text = await res.text()
        let message = `HTTP ${res.status}`
        try { message = JSON.parse(text).error || message } catch { message = text || message }
        throw new Error(message)
      }
      await fetchLog()
    } catch (e) {
      setEditError(String(e))
    }
  }, [cwd])

  const handleDescribeStart = useCallback((changeId: string) => {
    setDescribingChangeId(changeId)
  }, [])

  const handleDescribeCancel = useCallback(() => {
    setDescribingChangeId(null)
  }, [])

  const handleDescribeSave = useCallback(async (changeId: string, message: string) => {
    try {
      const res = await fetch(`/api/describe?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeId, message }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setDescribingChangeId(null)
    } catch (e) {
      setEditError(String(e))
    }
  }, [cwd])

  // Bookmark handlers
  const handleBookmarkCreate = useCallback(async (name: string, changeId: string) => {
    try {
      const res = await fetch(`/api/bookmark/create?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, changeId }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setBookmarkModal(null)
      await fetchLog()
    } catch (e) {
      setEditError(String(e))
    }
  }, [cwd])

  const handleBookmarkDelete = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/bookmark/delete?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`)
      await fetchLog()
    } catch (e) {
      setEditError(String(e))
    }
  }, [cwd])

  const handleBookmarkRename = useCallback(async (oldName: string, newName: string) => {
    try {
      const res = await fetch(`/api/bookmark/rename?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setBookmarkModal(null)
      await fetchLog()
    } catch (e) {
      setEditError(String(e))
    }
  }, [cwd])

  const handleBookmarkMoveStart = useCallback((bookmarkName: string, sourceChangeId: string) => {
    if (rebase.phase !== 'idle') return
    setBookmarkMove({
      phase: 'selecting-destination',
      bookmarkName,
      sourceChangeId,
    })
  }, [rebase.phase])

  const handleBookmarkMoveDestinationSelect = useCallback((changeId: string, description: string) => {
    setBookmarkMove((prev) => ({
      ...prev,
      phase: 'confirming',
      destinationChangeId: changeId,
      destinationDescription: description,
    }))
  }, [])

  const handleBookmarkMoveCancel = useCallback(() => {
    setBookmarkMove({ phase: 'idle' })
  }, [])

  const handleBookmarkMoveConfirm = useCallback(async () => {
    if (!bookmarkMove.bookmarkName || !bookmarkMove.destinationChangeId) return
    setBookmarkMove((prev) => ({ ...prev, phase: 'executing' }))
    try {
      const res = await fetch(`/api/bookmark/move?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: bookmarkMove.bookmarkName, destinationChangeId: bookmarkMove.destinationChangeId }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setBookmarkMove({ phase: 'idle', lastAction: 'bookmark-move', beforeOpId: data.beforeOpId })
      await fetchLog()
    } catch (e) {
      setEditError(String(e))
      setBookmarkMove({ phase: 'idle' })
    }
  }, [bookmarkMove.bookmarkName, bookmarkMove.destinationChangeId, cwd])

  const handleBookmarkMoveUndo = useCallback(async () => {
    if (!bookmarkMove.beforeOpId) return
    try {
      const res = await fetch(`/api/undo?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId: bookmarkMove.beforeOpId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setBookmarkMove({ phase: 'idle' })
      await fetchLog()
    } catch (e) {
      setError(String(e))
    }
  }, [cwd, bookmarkMove.beforeOpId])

  const handleUndo = useCallback(async () => {
    if (!rebase.beforeOpId) return
    try {
      const res = await fetch(`/api/undo?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId: rebase.beforeOpId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setRebase({ phase: 'idle' })
      await fetchLog()
    } catch (e) {
      setError(String(e))
    }
  }, [cwd, rebase.beforeOpId])

  // ESC 키로 rebase/bookmark move 모드 취소
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (rebase.phase !== 'idle' && rebase.phase !== 'executing') {
          handleRebaseCancel()
        }
        if (bookmarkMove.phase !== 'idle' && bookmarkMove.phase !== 'executing') {
          handleBookmarkMoveCancel()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [rebase.phase, handleRebaseCancel, bookmarkMove.phase, handleBookmarkMoveCancel])

  useEffect(() => {
    fetchLog()

    if (!cwd) return

    const es = new EventSource(`/api/events?cwd=${encodeURIComponent(cwd)}`)
    es.addEventListener('refresh', () => fetchLog())
    es.onerror = () => es.close()

    return () => es.close()
  }, [cwd])

  if (error) return <div className="app-error">Error: {error}</div>

  return (
    <div className="app">
      <div className="app-header">visual-jj — {cwd}</div>
      {editError && <ErrorBanner message={editError} onClose={() => setEditError(null)} />}
      <RebaseBanner
        rebase={rebase}
        onCancel={handleRebaseCancel}
        onConfirm={handleRebaseConfirm}
        onUndo={handleUndo}
      />
      <BookmarkMoveBanner
        bookmarkMove={bookmarkMove}
        onCancel={handleBookmarkMoveCancel}
        onConfirm={handleBookmarkMoveConfirm}
        onUndo={handleBookmarkMoveUndo}
      />
      <LogView
        rows={rows}
        cwd={cwd}
        rebase={rebase}
        bookmarkMove={bookmarkMove}
        describingChangeId={describingChangeId}
        onRebaseStart={handleRebaseStart}
        onDestinationSelect={handleDestinationSelect}
        onBookmarkMoveDestinationSelect={handleBookmarkMoveDestinationSelect}
        onEdit={handleEdit}
        onNew={handleNew}
        onDescribeStart={handleDescribeStart}
        onDescribeCancel={handleDescribeCancel}
        onDescribeSave={handleDescribeSave}
        onBookmarkCreate={(changeId) => setBookmarkModal({ mode: 'create', changeId })}
        onBookmarkDelete={handleBookmarkDelete}
        onBookmarkRename={(name) => setBookmarkModal({ mode: 'rename', bookmarkName: name })}
        onBookmarkMoveStart={handleBookmarkMoveStart}
      />
      {bookmarkModal && (
        <BookmarkModal
          mode={bookmarkModal.mode}
          initialName={bookmarkModal.mode === 'rename' ? bookmarkModal.bookmarkName : ''}
          onSubmit={(name) => {
            if (bookmarkModal.mode === 'create' && bookmarkModal.changeId) {
              handleBookmarkCreate(name, bookmarkModal.changeId)
            } else if (bookmarkModal.mode === 'rename' && bookmarkModal.bookmarkName) {
              handleBookmarkRename(bookmarkModal.bookmarkName, name)
            }
          }}
          onCancel={() => setBookmarkModal(null)}
        />
      )}
    </div>
  )
}

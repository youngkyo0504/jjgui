import { useCallback, useEffect, useMemo, useState } from 'react'
import LogView from './components/LogView'
import RebaseBanner from './components/RebaseBanner'
import BookmarkMoveBanner from './components/BookmarkMoveBanner'
import MoveChangesBanner from './components/MoveChangesBanner'
import BookmarkModal from './components/BookmarkModal'
import FileSelectModal from './components/FileSelectModal'
import ConfirmModal from './components/ConfirmModal'
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

export type MoveChangesPhase = 'idle' | 'selecting-destination' | 'confirming' | 'executing'

export interface MoveChangesState {
  phase: MoveChangesPhase
  fromChangeId?: string
  selectedPaths?: string[]
  toChangeId?: string
  toDescription?: string
  lastAction?: 'move-changes' | 'split' | 'squash'
  beforeOpId?: string
}

export default function App() {
  const [rows, setRows] = useState<GraphRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [rebase, setRebase] = useState<RebaseState>({ phase: 'idle' })
  const [bookmarkMove, setBookmarkMove] = useState<BookmarkMoveState>({ phase: 'idle' })
  const [moveChanges, setMoveChanges] = useState<MoveChangesState>({ phase: 'idle' })
  const [describingChangeId, setDescribingChangeId] = useState<string | null>(null)
  const [bookmarkModal, setBookmarkModal] = useState<{ mode: 'create' | 'rename'; changeId?: string; bookmarkName?: string } | null>(null)
  const [fileSelectModal, setFileSelectModal] = useState<{ type: 'split' | 'move-changes'; changeId: string; files: { path: string; status: string }[] } | null>(null)
  const [squashConfirm, setSquashConfirm] = useState<{ changeId: string; description: string; parentDescription: string } | null>(null)
  const [pushingBookmarks, setPushingBookmarks] = useState<Set<string>>(new Set())
  const [pushResult, setPushResult] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [remoteSelect, setRemoteSelect] = useState<{ bookmark: string; remotes: string[] } | null>(null)
  const [forcePushConfirm, setForcePushConfirm] = useState<{ bookmark: string; remote: string; error: string } | null>(null)

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

  // Split/Squash/MoveChanges handlers
  const handleSplitStart = useCallback(async (changeId: string) => {
    try {
      const res = await fetch(`/api/show/${changeId}?cwd=${encodeURIComponent(cwd)}`)
      const files = await res.json()
      if (files.length === 0) { setEditError('No files to split'); return }
      setFileSelectModal({ type: 'split', changeId, files })
    } catch (e) {
      setEditError(String(e))
    }
  }, [cwd])

  const handleSplitConfirm = useCallback(async (changeId: string, selectedPaths: string[]) => {
    setFileSelectModal(null)
    try {
      // GUI: 사용자가 "새 커밋으로 빼낼 파일"을 선택 → 선택하지 않은 파일을 jj split paths로 전달
      const allFiles = await fetch(`/api/show/${changeId}?cwd=${encodeURIComponent(cwd)}`).then((r) => r.json())
      const remainPaths = allFiles.filter((f: { path: string }) => !selectedPaths.includes(f.path)).map((f: { path: string }) => f.path)
      const res = await fetch(`/api/split?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeId, paths: remainPaths }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setMoveChanges({ phase: 'idle', lastAction: 'split', beforeOpId: data.beforeOpId })
      await fetchLog()
    } catch (e) {
      setEditError(String(e))
    }
  }, [cwd])

  const handleSquashStart = useCallback((changeId: string, description: string, parentDescription: string) => {
    setSquashConfirm({ changeId, description, parentDescription })
  }, [])

  const handleSquashConfirm = useCallback(async () => {
    if (!squashConfirm) return
    setSquashConfirm(null)
    try {
      const res = await fetch(`/api/squash?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeId: squashConfirm.changeId }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setMoveChanges({ phase: 'idle', lastAction: 'squash', beforeOpId: data.beforeOpId })
      await fetchLog()
    } catch (e) {
      setEditError(String(e))
    }
  }, [cwd, squashConfirm])

  const handleMoveChangesStart = useCallback(async (changeId: string) => {
    try {
      const res = await fetch(`/api/show/${changeId}?cwd=${encodeURIComponent(cwd)}`)
      const files = await res.json()
      if (files.length === 0) { setEditError('No files to move'); return }
      setFileSelectModal({ type: 'move-changes', changeId, files })
    } catch (e) {
      setEditError(String(e))
    }
  }, [cwd])

  const handleMoveChangesFileSelect = useCallback((changeId: string, selectedPaths: string[]) => {
    setFileSelectModal(null)
    if (rebase.phase !== 'idle' || bookmarkMove.phase !== 'idle') return
    setMoveChanges({
      phase: 'selecting-destination',
      fromChangeId: changeId,
      selectedPaths,
    })
  }, [rebase.phase, bookmarkMove.phase])

  const handleMoveChangesDestinationSelect = useCallback((changeId: string, description: string) => {
    setMoveChanges((prev) => ({
      ...prev,
      phase: 'confirming',
      toChangeId: changeId,
      toDescription: description,
    }))
  }, [])

  const handleMoveChangesCancel = useCallback(() => {
    setMoveChanges({ phase: 'idle' })
  }, [])

  const handleMoveChangesConfirm = useCallback(async () => {
    if (!moveChanges.fromChangeId || !moveChanges.toChangeId || !moveChanges.selectedPaths) return
    setMoveChanges((prev) => ({ ...prev, phase: 'executing' }))
    try {
      const res = await fetch(`/api/move-changes?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromChangeId: moveChanges.fromChangeId, toChangeId: moveChanges.toChangeId, paths: moveChanges.selectedPaths }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setMoveChanges({ phase: 'idle', lastAction: 'move-changes', beforeOpId: data.beforeOpId })
      await fetchLog()
    } catch (e) {
      setEditError(String(e))
      setMoveChanges({ phase: 'idle' })
    }
  }, [moveChanges.fromChangeId, moveChanges.toChangeId, moveChanges.selectedPaths, cwd])

  const handleMoveChangesUndo = useCallback(async () => {
    if (!moveChanges.beforeOpId) return
    try {
      const res = await fetch(`/api/undo?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId: moveChanges.beforeOpId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setMoveChanges({ phase: 'idle' })
      await fetchLog()
    } catch (e) {
      setError(String(e))
    }
  }, [cwd, moveChanges.beforeOpId])

  // Push handlers
  const doPush = useCallback(async (bookmark: string, remote: string, force: boolean = false) => {
    setPushingBookmarks((prev) => new Set(prev).add(bookmark))
    setPushResult(null)
    setForcePushConfirm(null)
    try {
      const res = await fetch(`/api/push?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmark, remote, force }),
      })
      const data = await res.json()
      if (!data.ok) {
        const errStr = data.error || ''
        if (errStr.includes('non-fast-forward') || errStr.includes('rejected')) {
          setForcePushConfirm({ bookmark, remote, error: errStr })
        } else {
          setPushResult({ type: 'error', message: errStr })
        }
        return
      }
      const output = data.output || ''
      if (output.includes('Nothing changed') || output.includes('already up to date')) {
        setPushResult({ type: 'info', message: `${bookmark}: already up to date` })
      } else {
        setPushResult({ type: 'success', message: `${bookmark} pushed to ${remote}` })
      }
      await fetchLog()
    } catch (e) {
      setPushResult({ type: 'error', message: String(e) })
    } finally {
      setPushingBookmarks((prev) => { const next = new Set(prev); next.delete(bookmark); return next })
    }
  }, [cwd])

  const handlePushBookmark = useCallback(async (bookmark: string) => {
    try {
      const res = await fetch(`/api/remotes?cwd=${encodeURIComponent(cwd)}`)
      const data = await res.json()
      const remotes: string[] = data.remotes || []
      if (remotes.length === 0) {
        setPushResult({ type: 'error', message: 'No remotes configured' })
      } else if (remotes.length === 1) {
        doPush(bookmark, remotes[0])
      } else {
        setRemoteSelect({ bookmark, remotes })
      }
    } catch (e) {
      setPushResult({ type: 'error', message: String(e) })
    }
  }, [cwd, doPush])

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

  // ESC 키로 rebase/bookmark move/move changes 모드 취소
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (rebase.phase !== 'idle' && rebase.phase !== 'executing') {
          handleRebaseCancel()
        }
        if (bookmarkMove.phase !== 'idle' && bookmarkMove.phase !== 'executing') {
          handleBookmarkMoveCancel()
        }
        if (moveChanges.phase !== 'idle' && moveChanges.phase !== 'executing') {
          handleMoveChangesCancel()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [rebase.phase, handleRebaseCancel, bookmarkMove.phase, handleBookmarkMoveCancel, moveChanges.phase, handleMoveChangesCancel])

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
      <MoveChangesBanner
        moveChanges={moveChanges}
        onCancel={handleMoveChangesCancel}
        onConfirm={handleMoveChangesConfirm}
        onUndo={handleMoveChangesUndo}
      />
      <LogView
        rows={rows}
        cwd={cwd}
        rebase={rebase}
        bookmarkMove={bookmarkMove}
        moveChanges={moveChanges}
        describingChangeId={describingChangeId}
        onRebaseStart={handleRebaseStart}
        onDestinationSelect={handleDestinationSelect}
        onBookmarkMoveDestinationSelect={handleBookmarkMoveDestinationSelect}
        onMoveChangesDestinationSelect={handleMoveChangesDestinationSelect}
        onEdit={handleEdit}
        onNew={handleNew}
        onDescribeStart={handleDescribeStart}
        onDescribeCancel={handleDescribeCancel}
        onDescribeSave={handleDescribeSave}
        onBookmarkCreate={(changeId) => setBookmarkModal({ mode: 'create', changeId })}
        onBookmarkDelete={handleBookmarkDelete}
        onBookmarkRename={(name) => setBookmarkModal({ mode: 'rename', bookmarkName: name })}
        onBookmarkMoveStart={handleBookmarkMoveStart}
        onSplitStart={handleSplitStart}
        onSquashStart={handleSquashStart}
        onMoveChangesStart={handleMoveChangesStart}
        onPushBookmark={handlePushBookmark}
        pushingBookmarks={pushingBookmarks}
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
      {fileSelectModal && (
        <FileSelectModal
          title={fileSelectModal.type === 'split' ? 'Split: 새 커밋으로 빼낼 파일 선택' : 'Move changes: 이동할 파일 선택'}
          files={fileSelectModal.files}
          minUnselected={fileSelectModal.type === 'split' ? 1 : 0}
          onSubmit={(paths) => {
            if (fileSelectModal.type === 'split') {
              handleSplitConfirm(fileSelectModal.changeId, paths)
            } else {
              handleMoveChangesFileSelect(fileSelectModal.changeId, paths)
            }
          }}
          onCancel={() => setFileSelectModal(null)}
        />
      )}
      {squashConfirm && (
        <ConfirmModal
          title="Squash into parent"
          message={`"${squashConfirm.description || '(no description)'}" → parent "${squashConfirm.parentDescription || '(no description)'}"`}
          confirmLabel="Squash"
          onConfirm={handleSquashConfirm}
          onCancel={() => setSquashConfirm(null)}
        />
      )}
      {remoteSelect && (
        <div className="modal-overlay" onClick={() => setRemoteSelect(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Select remote for {remoteSelect.bookmark}</div>
            <div className="remote-list">
              {remoteSelect.remotes.map((r) => (
                <button key={r} className="remote-item" onClick={() => { doPush(remoteSelect.bookmark, r); setRemoteSelect(null) }}>
                  {r}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="describe-btn describe-btn--cancel" onClick={() => setRemoteSelect(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {forcePushConfirm && (
        <ConfirmModal
          title="Force push?"
          message={`Push failed: ${forcePushConfirm.error}\n\nForce push ${forcePushConfirm.bookmark} to ${forcePushConfirm.remote}?`}
          confirmLabel="Force Push"
          onConfirm={() => { doPush(forcePushConfirm.bookmark, forcePushConfirm.remote, true); setForcePushConfirm(null) }}
          onCancel={() => setForcePushConfirm(null)}
        />
      )}
      {pushResult && (
        <div className={`push-toast push-toast--${pushResult.type}`} onClick={() => setPushResult(null)}>
          {pushResult.message}
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import LogView from './components/LogView'
import RebaseBanner from './components/RebaseBanner'
import MoveChangesBanner from './components/MoveChangesBanner'
import FetchBanner from './components/FetchBanner'
import BookmarkModal from './components/BookmarkModal'
import SetBookmarkModal from './components/SetBookmarkModal'
import FileSelectModal from './components/FileSelectModal'
import ConfirmModal from './components/ConfirmModal'
import ErrorBanner from './components/ErrorBanner'
import { buildChildrenMap, getDescendants } from './utils/graph'
import type { GraphRow } from './types'
import './components/styles.css'

interface ChangedFile {
  path: string
  status: string
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

export type MoveChangesPhase = 'idle' | 'selecting-destination' | 'confirming' | 'executing'

export interface MoveChangesState {
  phase: MoveChangesPhase
  fromChangeId?: string
  selectedPaths?: string[]
  toChangeId?: string
  toDescription?: string
  lastAction?: 'move-changes' | 'split' | 'squash' | 'discard-file'
  beforeOpId?: string
}

export type FetchPhase = 'idle' | 'executing'

export interface FetchRemoteResult {
  remote: string
  ok: boolean
  output: string
}

export interface FetchState {
  phase: FetchPhase
  results?: FetchRemoteResult[]
  beforeOpId?: string | null
}

export type PushScope = 'bookmark' | 'subtree'

interface PushResult {
  type: 'success' | 'error' | 'info'
  message: string
}

function getPushTargetLabel(bookmark: string, scope: PushScope): string {
  return scope === 'subtree' ? `${bookmark} subtree` : bookmark
}

function isPushUpToDate(output: string): boolean {
  const normalized = output.toLowerCase()
  return normalized.includes('nothing changed') || normalized.includes('already up to date')
}

export default function App() {
  const [rows, setRows] = useState<GraphRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [showRemoteBookmarks, setShowRemoteBookmarks] = useState(false)
  const [logRefreshKey, setLogRefreshKey] = useState(0)
  const [rebase, setRebase] = useState<RebaseState>({ phase: 'idle' })
  const [moveChanges, setMoveChanges] = useState<MoveChangesState>({ phase: 'idle' })
  const [fetchState, setFetchState] = useState<FetchState>({ phase: 'idle' })
  const [describingChangeId, setDescribingChangeId] = useState<string | null>(null)
  const [bookmarkModal, setBookmarkModal] = useState<{ mode: 'set'; changeId: string } | { mode: 'rename'; bookmarkName: string } | null>(null)
  const [fileSelectModal, setFileSelectModal] = useState<{ type: 'split' | 'move-changes'; changeId: string; files: ChangedFile[] } | null>(null)
  const [squashConfirm, setSquashConfirm] = useState<{ changeId: string; description: string; parentDescription: string } | null>(null)
  const [pushingBookmarks, setPushingBookmarks] = useState<Set<string>>(new Set())
  const [pushResult, setPushResult] = useState<PushResult | null>(null)
  const [subtreePushConfirm, setSubtreePushConfirm] = useState<{ bookmark: string } | null>(null)
  const [remoteSelect, setRemoteSelect] = useState<{ bookmark: string; remotes: string[]; scope: PushScope } | null>(null)

  const cwd = new URLSearchParams(window.location.search).get('cwd') ?? ''

  const childrenMap = useMemo(() => buildChildrenMap(rows), [rows])
  const hasRemoteBookmarks = useMemo(
    () => rows.some((row) => row.type === 'commit' && row.commit?.bookmarks.some((bookmark) => bookmark.isRemote)),
    [rows],
  )

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
      setLogRefreshKey((prev) => prev + 1)
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
      await fetchLog()
      setDescribingChangeId(null)
    } catch (e) {
      setEditError(String(e))
    }
  }, [cwd])

  // Bookmark handlers
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

  const handleSplitConfirm = useCallback(async (changeId: string, selectedPaths: string[], allFiles: ChangedFile[]) => {
    setFileSelectModal(null)
    try {
      // GUI: 사용자가 "새 커밋으로 빼낼 파일"을 선택 → 선택하지 않은 파일을 jj split paths로 전달
      const remainPaths = allFiles.filter((f) => !selectedPaths.includes(f.path)).map((f) => f.path)
      if (remainPaths.length === 0) { setEditError('At least one file must remain in the original commit'); return }
      setMoveChanges({
        phase: 'executing',
        lastAction: 'split',
        fromChangeId: changeId,
        selectedPaths,
      })
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
      setMoveChanges({ phase: 'idle' })
    }
  }, [cwd])

  const handleSquashStart = useCallback((changeId: string, description: string, parentDescription: string) => {
    setSquashConfirm({ changeId, description, parentDescription })
  }, [])

  const handleSquashConfirm = useCallback(async () => {
    if (!squashConfirm) return
    setSquashConfirm(null)
    try {
      setMoveChanges({
        phase: 'executing',
        lastAction: 'squash',
        fromChangeId: squashConfirm.changeId,
      })
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
      setMoveChanges({ phase: 'idle' })
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
    if (rebase.phase !== 'idle') return
    setMoveChanges({
      phase: 'selecting-destination',
      fromChangeId: changeId,
      selectedPaths,
    })
  }, [rebase.phase])

  const handleMoveSingleFile = useCallback((changeId: string, path: string) => {
    if (rebase.phase !== 'idle') return
    setEditError(null)
    setMoveChanges({
      phase: 'selecting-destination',
      fromChangeId: changeId,
      selectedPaths: [path],
    })
  }, [rebase.phase])

  const handleDiscardFile = useCallback(async (changeId: string, path: string) => {
    setEditError(null)
    setMoveChanges({
      phase: 'executing',
      lastAction: 'discard-file',
      fromChangeId: changeId,
      selectedPaths: [path],
    })
    try {
      const res = await fetch(`/api/discard-file?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeId, path }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setMoveChanges({
        phase: 'idle',
        lastAction: 'discard-file',
        fromChangeId: changeId,
        selectedPaths: [path],
        beforeOpId: data.beforeOpId,
      })
      await fetchLog()
    } catch (e) {
      setEditError(String(e))
      setMoveChanges({ phase: 'idle' })
    }
  }, [cwd])

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
    setMoveChanges((prev) => ({ ...prev, phase: 'executing', lastAction: 'move-changes' }))
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

  const handleFetch = useCallback(async () => {
    setFetchState({ phase: 'executing' })
    try {
      const res = await fetch(`/api/fetch?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setFetchState({
        phase: 'idle',
        results: data.results || [],
        beforeOpId: data.beforeOpId ?? null,
      })
      await fetchLog()
    } catch (e) {
      setFetchState({
        phase: 'idle',
        results: [{ remote: 'fetch', ok: false, output: String(e) }],
        beforeOpId: null,
      })
    }
  }, [cwd])

  const handleFetchUndo = useCallback(async () => {
    if (!fetchState.beforeOpId) return
    try {
      const res = await fetch(`/api/undo?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId: fetchState.beforeOpId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setFetchState({ phase: 'idle' })
      await fetchLog()
    } catch (e) {
      setEditError(String(e))
    }
  }, [cwd, fetchState.beforeOpId])

  // Push handlers
  const doPush = useCallback(async (bookmark: string, remote: string, scope: PushScope = 'bookmark') => {
    setPushingBookmarks((prev) => new Set(prev).add(bookmark))
    setPushResult(null)
    try {
      const res = await fetch(`/api/push?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmark, remote, scope }),
      })
      const data = await res.json()
      if (!data.ok) {
        setPushResult({ type: 'error', message: data.error || 'Push failed' })
        return
      }
      const output = data.output || ''
      const targetLabel = getPushTargetLabel(bookmark, scope)
      if (isPushUpToDate(output)) {
        setPushResult({ type: 'info', message: `${targetLabel}: already up to date` })
      } else {
        setPushResult({ type: 'success', message: `${targetLabel} pushed to ${remote}` })
      }
      await fetchLog()
    } catch (e) {
      setPushResult({ type: 'error', message: String(e) })
    } finally {
      setPushingBookmarks((prev) => { const next = new Set(prev); next.delete(bookmark); return next })
    }
  }, [cwd])

  const beginPush = useCallback(async (bookmark: string, scope: PushScope = 'bookmark') => {
    try {
      const res = await fetch(`/api/remotes?cwd=${encodeURIComponent(cwd)}`)
      const data = await res.json()
      const remotes: string[] = data.remotes || []
      if (remotes.length === 0) {
        setPushResult({ type: 'error', message: 'No remotes configured' })
      } else if (remotes.length === 1) {
        doPush(bookmark, remotes[0], scope)
      } else {
        setRemoteSelect({ bookmark, remotes, scope })
      }
    } catch (e) {
      setPushResult({ type: 'error', message: String(e) })
    }
  }, [cwd, doPush])

  const handlePushBookmark = useCallback((bookmark: string) => {
    void beginPush(bookmark, 'bookmark')
  }, [beginPush])

  const handlePushBookmarkSubtree = useCallback((bookmark: string) => {
    setSubtreePushConfirm({ bookmark })
  }, [])

  const handlePushBookmarkSubtreeConfirm = useCallback(() => {
    if (!subtreePushConfirm) return
    const { bookmark } = subtreePushConfirm
    setSubtreePushConfirm(null)
    void beginPush(bookmark, 'subtree')
  }, [beginPush, subtreePushConfirm])

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

  // ESC 키로 rebase/move changes 모드 취소
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (rebase.phase !== 'idle' && rebase.phase !== 'executing') {
          handleRebaseCancel()
        }
        if (moveChanges.phase !== 'idle' && moveChanges.phase !== 'executing') {
          handleMoveChangesCancel()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [rebase.phase, handleRebaseCancel, moveChanges.phase, handleMoveChangesCancel])

  useEffect(() => {
    fetchLog()

    if (!cwd) return

    const es = new EventSource(`/api/events?cwd=${encodeURIComponent(cwd)}`)
    es.addEventListener('refresh', () => fetchLog())
    es.onerror = () => es.close()

    return () => es.close()
  }, [cwd])

  if (error) return <div className="app-error">Error: {error}</div>

  const isFetchDisabled = fetchState.phase === 'executing' || rebase.phase !== 'idle' || moveChanges.phase !== 'idle'

  return (
    <div className="app">
      <div className="app-toolbar">
        <div className="app-header">visual-jj — {cwd}</div>
        {hasRemoteBookmarks && (
          <button
            className={`app-toolbar-btn ${showRemoteBookmarks ? 'app-toolbar-btn--active' : ''}`}
            onClick={() => setShowRemoteBookmarks((prev) => !prev)}
          >
            Remote refs {showRemoteBookmarks ? 'On' : 'Off'}
          </button>
        )}
        <button className="app-toolbar-btn" onClick={handleFetch} disabled={isFetchDisabled}>
          {fetchState.phase === 'executing' ? 'Fetching...' : 'Fetch'}
        </button>
      </div>
      {editError && <ErrorBanner message={editError} onClose={() => setEditError(null)} />}
      <FetchBanner
        fetchState={fetchState}
        onUndo={handleFetchUndo}
        onDismiss={() => setFetchState({ phase: 'idle' })}
      />
      <RebaseBanner
        rebase={rebase}
        onCancel={handleRebaseCancel}
        onConfirm={handleRebaseConfirm}
        onUndo={handleUndo}
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
        logRefreshKey={logRefreshKey}
        rebase={rebase}
        moveChanges={moveChanges}
        describingChangeId={describingChangeId}
        onRebaseStart={handleRebaseStart}
        onDestinationSelect={handleDestinationSelect}
        onMoveChangesDestinationSelect={handleMoveChangesDestinationSelect}
        onEdit={handleEdit}
        onNew={handleNew}
        onDescribeStart={handleDescribeStart}
        onDescribeCancel={handleDescribeCancel}
        onDescribeSave={handleDescribeSave}
        onSetBookmark={(changeId) => setBookmarkModal({ mode: 'set', changeId })}
        onBookmarkDelete={handleBookmarkDelete}
        onBookmarkRename={(name) => setBookmarkModal({ mode: 'rename', bookmarkName: name })}
        onSplitStart={handleSplitStart}
        onSquashStart={handleSquashStart}
        onMoveChangesStart={handleMoveChangesStart}
        onMoveSingleFile={handleMoveSingleFile}
        onDiscardFile={handleDiscardFile}
        onPushBookmark={handlePushBookmark}
        onPushBookmarkSubtree={handlePushBookmarkSubtree}
        pushingBookmarks={pushingBookmarks}
        showRemoteBookmarks={showRemoteBookmarks}
      />
      {bookmarkModal && bookmarkModal.mode === 'rename' && (
        <BookmarkModal
          mode="rename"
          initialName={bookmarkModal.bookmarkName}
          onSubmit={(name) => {
            handleBookmarkRename(bookmarkModal.bookmarkName, name)
          }}
          onCancel={() => setBookmarkModal(null)}
        />
      )}
      {bookmarkModal && bookmarkModal.mode === 'set' && (
        <SetBookmarkModal
          changeId={bookmarkModal.changeId}
          cwd={cwd}
          onSuccess={async () => { setBookmarkModal(null); await fetchLog() }}
          onCancel={() => setBookmarkModal(null)}
          onError={(err) => { setBookmarkModal(null); setEditError(err) }}
        />
      )}
      {fileSelectModal && (
        <FileSelectModal
          title={fileSelectModal.type === 'split' ? 'Split: 새 커밋으로 빼낼 파일 선택' : 'Move changes: 이동할 파일 선택'}
          files={fileSelectModal.files}
          minUnselected={fileSelectModal.type === 'split' ? 1 : 0}
          onSubmit={(paths) => {
            if (fileSelectModal.type === 'split') {
              handleSplitConfirm(fileSelectModal.changeId, paths, fileSelectModal.files)
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
      {subtreePushConfirm && (
        <ConfirmModal
          title="Push bookmark subtree?"
          message={`This will push ${subtreePushConfirm.bookmark} and any descendant bookmarks that point into its subtree.`}
          confirmLabel="Continue"
          onConfirm={handlePushBookmarkSubtreeConfirm}
          onCancel={() => setSubtreePushConfirm(null)}
        />
      )}
      {remoteSelect && (
        <div className="modal-overlay" onClick={() => setRemoteSelect(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Select remote for {getPushTargetLabel(remoteSelect.bookmark, remoteSelect.scope)}</div>
            <div className="remote-list">
              {remoteSelect.remotes.map((r) => (
                <button key={r} className="remote-item" onClick={() => { doPush(remoteSelect.bookmark, r, remoteSelect.scope); setRemoteSelect(null) }}>
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
      {pushResult && (
        <div className={`push-toast push-toast--${pushResult.type}`}>
          <span className="push-toast-message">{pushResult.message}</span>
          <button className="push-toast-close" onClick={() => setPushResult(null)}>&times;</button>
        </div>
      )}
    </div>
  )
}

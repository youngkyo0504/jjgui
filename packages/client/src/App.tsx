import { useCallback, useEffect, useMemo, useState } from 'react'
import LogView from './components/LogView'
import RebaseBanner from './components/RebaseBanner'
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

export default function App() {
  const [rows, setRows] = useState<GraphRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [rebase, setRebase] = useState<RebaseState>({ phase: 'idle' })

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
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
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
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      await fetchLog()
    } catch (e) {
      setEditError(String(e))
    }
  }, [cwd])

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

  // ESC 키로 rebase 모드 취소
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && rebase.phase !== 'idle' && rebase.phase !== 'executing') {
        handleRebaseCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [rebase.phase, handleRebaseCancel])

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
      <LogView
        rows={rows}
        cwd={cwd}
        rebase={rebase}
        onRebaseStart={handleRebaseStart}
        onDestinationSelect={handleDestinationSelect}
        onEdit={handleEdit}
        onNew={handleNew}
      />
    </div>
  )
}

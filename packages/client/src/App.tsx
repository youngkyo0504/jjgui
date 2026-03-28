import { useEffect, useState } from 'react'
import LogView from './components/LogView'
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

export default function App() {
  const [rows, setRows] = useState<GraphRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const cwd = new URLSearchParams(window.location.search).get('cwd') ?? ''

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
      <LogView rows={rows} cwd={cwd} />
    </div>
  )
}

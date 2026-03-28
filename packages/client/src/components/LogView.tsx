import React, { useState } from 'react'
import CommitRow from './CommitRow'
import EdgeRow from './EdgeRow'
import ElidedRow from './ElidedRow'

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

interface Props {
  rows: GraphRow[]
  cwd: string
}

export default function LogView({ rows, cwd }: Props) {
  const [confirmEdit, setConfirmEdit] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const handleDoubleClick = (changeId: string) => {
    setConfirmEdit(changeId)
  }

  const handleConfirmEdit = async () => {
    if (!confirmEdit) return
    setEditing(true)
    try {
      await fetch(`/api/edit?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeId: confirmEdit }),
      })
    } catch (e) {
      console.error('jj edit failed:', e)
    } finally {
      setEditing(false)
      setConfirmEdit(null)
    }
  }

  return (
    <div className="log-view">
      {rows.map((row, i) => {
        if (row.type === 'commit' && row.commit) {
          return (
            <CommitRow
              key={`${row.commit.changeId}-${i}`}
              graphChars={row.graphChars}
              laneColors={row.laneColors}
              commit={row.commit}
              cwd={cwd}
              onDoubleClick={handleDoubleClick}
            />
          )
        }
        if (row.type === 'elided') {
          return <ElidedRow key={`elided-${i}`} graphChars={row.graphChars} laneColors={row.laneColors} />
        }
        return <EdgeRow key={`edge-${i}`} graphChars={row.graphChars} laneColors={row.laneColors} />
      })}

      {confirmEdit && (
        <div className="dialog-overlay" onClick={() => setConfirmEdit(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">jj edit</div>
            <div className="dialog-message">
              워킹카피를 <strong>{confirmEdit}</strong> 커밋으로 이동할까요?
            </div>
            <div className="dialog-actions">
              <button className="dialog-btn" onClick={() => setConfirmEdit(null)} disabled={editing}>
                취소
              </button>
              <button className="dialog-btn dialog-btn--confirm" onClick={handleConfirmEdit} disabled={editing}>
                {editing ? '실행 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

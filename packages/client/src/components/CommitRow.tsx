import React, { useState } from 'react'
import GraphLine from './GraphLine'
import Badge from './Badge'
import FileList from './FileList'

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

interface Props {
  graphChars: string
  laneColors?: string[]
  commit: CommitInfo
  cwd: string
  onDoubleClick: (changeId: string) => void
}

export default function CommitRow({ graphChars, laneColors, commit, cwd, onDoubleClick }: Props) {
  const [expanded, setExpanded] = useState(false)

  const rowClass = [
    'graph-row',
    'graph-row--commit',
    commit.isWorkingCopy && 'graph-row--working-copy',
    commit.isImmutable && 'graph-row--immutable',
  ].filter(Boolean).join(' ')

  return (
    <div>
      <div
        className={rowClass}
        onClick={() => setExpanded(!expanded)}
        onDoubleClick={(e) => {
          e.preventDefault()
          onDoubleClick(commit.changeId)
        }}
      >
        <GraphLine graphChars={graphChars} laneColors={laneColors} />
        <div className="commit-info">
          <span className="commit-change-id">{commit.changeId}</span>

          {commit.workspaces.map((ws) => (
            <Badge key={ws} label={ws} variant="workspace" />
          ))}
          {commit.bookmarks.map((bm) => (
            <Badge key={bm} label={bm} variant="bookmark" />
          ))}
          {commit.hasConflict && <Badge label="conflict" variant="conflict" />}
          {commit.isEmpty && <Badge label="empty" variant="empty" />}

          <span className="commit-id">{commit.commitId}</span>

          <span className={`commit-description${!commit.description ? ' commit-description--empty' : ''}`}>
            {commit.description || '(no description)'}
          </span>

          <span className="commit-author">{commit.author}</span>
          <span className="commit-timestamp">{commit.timestamp}</span>
        </div>
      </div>

      {expanded && (
        <div className="graph-row" style={{ paddingLeft: graphChars.length + 'ch' }}>
          <FileList changeId={commit.changeId} cwd={cwd} />
        </div>
      )}
    </div>
  )
}

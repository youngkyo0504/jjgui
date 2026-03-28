import { useState } from 'react'
import GraphLine from './GraphLine'
import Badge from './Badge'
import FileList from './FileList'
import { formatRelativeTime } from '../utils/format'

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
}

export default function CommitRow({ graphChars, laneColors, commit, cwd }: Props) {
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
      >
        <GraphLine graphChars={graphChars} laneColors={laneColors} />
        <div className="commit-info">
          {commit.isWorkingCopy && <Badge label="Editing" variant="editing" />}
          {commit.workspaces.map((ws) => (
            <Badge key={ws} label={ws} variant="workspace" />
          ))}
          {commit.bookmarks.map((bm) => (
            <Badge key={bm} label={bm} variant="bookmark" />
          ))}
          {commit.hasConflict && <Badge label="conflict" variant="conflict" />}
          {commit.isEmpty && <Badge label="empty" variant="empty" />}

          <span className="commit-description">
            {commit.description}
          </span>

          <span className="commit-timestamp">{formatRelativeTime(commit.timestamp)}</span>
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

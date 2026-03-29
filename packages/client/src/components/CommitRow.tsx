import { useState } from 'react'
import GraphLine from './GraphLine'
import Badge from './Badge'
import FileList from './FileList'
import ContextMenu from './ContextMenu'
import { formatRelativeTime } from '../utils/format'
import type { RebaseState } from '../App'

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
  rebase: RebaseState
  onRebaseStart: (changeId: string, description: string) => void
  onDestinationSelect: (changeId: string, description: string) => void
  onEdit: (changeId: string) => void
  onNew: (changeId: string) => void
}

export default function CommitRow({ graphChars, laneColors, commit, cwd, rebase, onRebaseStart, onDestinationSelect, onEdit, onNew }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const isSource = rebase.sourceChangeId === commit.changeId
  const isDescendant = rebase.descendants?.has(commit.changeId) ?? false
  const isInSubtree = isSource || isDescendant
  const isRebaseMode = rebase.phase === 'source-selected' || rebase.phase === 'confirming'
  const isDisabledTarget = isRebaseMode && isInSubtree
  const isDestination = rebase.destinationChangeId === commit.changeId

  const handleClick = () => {
    if (rebase.phase === 'source-selected' && !isInSubtree) {
      onDestinationSelect(commit.changeId, commit.description)
      return
    }
    if (!isRebaseMode) {
      setExpanded(!expanded)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isRebaseMode) return
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const rowClass = [
    'graph-row',
    'graph-row--commit',
    commit.isWorkingCopy && 'graph-row--working-copy',
    commit.isImmutable && 'graph-row--immutable',
    isSource && 'graph-row--rebase-source',
    isDescendant && 'graph-row--rebase-descendant',
    isDisabledTarget && 'graph-row--rebase-disabled',
    isDestination && 'graph-row--rebase-destination',
    isRebaseMode && !isInSubtree && 'graph-row--rebase-target',
  ].filter(Boolean).join(' ')

  return (
    <div>
      <div className={rowClass} onClick={handleClick} onContextMenu={handleContextMenu}>
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
          <span className="commit-change-id">{commit.changeId.slice(0, 3)}</span>
        </div>
      </div>

      {expanded && !isRebaseMode && (
        <div className="graph-row" style={{ paddingLeft: graphChars.length + 'ch' }}>
          <FileList changeId={commit.changeId} cwd={cwd} />
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            ...(!commit.isWorkingCopy ? [{
              label: 'Edit this commit',
              disabled: commit.isImmutable,
              onClick: () => onEdit(commit.changeId),
            }] : []),
            {
              label: 'New commit on top',
              onClick: () => onNew(commit.changeId),
            },
            {
              label: 'Rebase this subtree',
              disabled: commit.isImmutable,
              onClick: () => onRebaseStart(commit.changeId, commit.description),
            },
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

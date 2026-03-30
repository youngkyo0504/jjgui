import { useState, useEffect, useRef } from 'react'
import SvgGraphCell from './SvgGraphCell'
import Badge from './Badge'
import FileList from './FileList'
import ContextMenu from './ContextMenu'
import { formatRelativeTime } from '../utils/format'
import type { RebaseState, MoveChangesState } from '../App'

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
  moveChanges: MoveChangesState
  describingChangeId: string | null
  onRebaseStart: (changeId: string, description: string) => void
  onDestinationSelect: (changeId: string, description: string) => void
  onMoveChangesDestinationSelect: (changeId: string, description: string) => void
  onEdit: (changeId: string) => void
  onNew: (changeId: string) => void
  onDescribeStart: (changeId: string) => void
  onDescribeCancel: () => void
  onDescribeSave: (changeId: string, message: string) => void
  onSetBookmark: (changeId: string) => void
  onBookmarkDelete: (name: string) => void
  onBookmarkRename: (name: string) => void
  onSplitStart: (changeId: string) => void
  onSquashStart: (changeId: string, description: string, parentDescription: string) => void
  onMoveChangesStart: (changeId: string) => void
  onPushBookmark: (bookmark: string) => void
  onPushBookmarkSubtree: (bookmark: string) => void
  pushingBookmarks: Set<string>
}

export default function CommitRow({ graphChars, laneColors, commit, cwd, rebase, moveChanges, describingChangeId, onRebaseStart, onDestinationSelect, onMoveChangesDestinationSelect, onEdit, onNew, onDescribeStart, onDescribeCancel, onDescribeSave, onSetBookmark, onBookmarkDelete, onBookmarkRename, onSplitStart, onSquashStart, onMoveChangesStart, onPushBookmark, onPushBookmarkSubtree, pushingBookmarks }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [bookmarkContextMenu, setBookmarkContextMenu] = useState<{ x: number; y: number; name: string } | null>(null)
  const [describeText, setDescribeText] = useState('')
  const [describeLoading, setDescribeLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isDescribing = describingChangeId === commit.changeId

  // describe 편집 시작 시 전체 description fetch
  useEffect(() => {
    if (!isDescribing) return
    setDescribeLoading(true)
    fetch(`/api/description/${commit.changeId}?cwd=${encodeURIComponent(cwd)}`)
      .then((res) => res.json())
      .then((data) => {
        const desc = data.description === '(no description set)' ? '' : (data.description ?? '')
        setDescribeText(desc)
        setDescribeLoading(false)
        setTimeout(() => textareaRef.current?.focus(), 0)
      })
      .catch(() => {
        setDescribeText('')
        setDescribeLoading(false)
      })
  }, [isDescribing, commit.changeId, cwd])

  const isSource = rebase.sourceChangeId === commit.changeId
  const isDescendant = rebase.descendants?.has(commit.changeId) ?? false
  const isInSubtree = isSource || isDescendant
  const isRebaseMode = rebase.phase === 'source-selected' || rebase.phase === 'confirming'
  const isMoveChangesMode = moveChanges.phase === 'selecting-destination' || moveChanges.phase === 'confirming'
  const isAnyMoveMode = isRebaseMode || isMoveChangesMode
  const isDisabledTarget = isRebaseMode && isInSubtree
  const isDestination = rebase.destinationChangeId === commit.changeId
  const isMoveChangesDestination = moveChanges.toChangeId === commit.changeId

  const handleClick = () => {
    if (rebase.phase === 'source-selected' && !isInSubtree) {
      onDestinationSelect(commit.changeId, commit.description)
      return
    }
    if (moveChanges.phase === 'selecting-destination') {
      onMoveChangesDestinationSelect(commit.changeId, commit.description)
      return
    }
    if (!isAnyMoveMode) {
      setExpanded(!expanded)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isAnyMoveMode) return
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleBookmarkContextMenu = (e: React.MouseEvent, name: string) => {
    if (isAnyMoveMode) return
    e.preventDefault()
    e.stopPropagation()
    setBookmarkContextMenu({ x: e.clientX, y: e.clientY, name })
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
    isMoveChangesDestination && 'graph-row--rebase-destination',
    isRebaseMode && !isInSubtree && 'graph-row--rebase-target',
    isMoveChangesMode && 'graph-row--rebase-target',
  ].filter(Boolean).join(' ')

  return (
    <div>
      <div className={rowClass} onClick={handleClick} onContextMenu={handleContextMenu}>
        <SvgGraphCell graphChars={graphChars} laneColors={laneColors} />
        <div className="commit-info">
          {commit.isWorkingCopy && <Badge label="Editing" variant="editing" />}
          {commit.workspaces.map((ws) => (
            <Badge key={ws} label={ws} variant="workspace" />
          ))}
          {commit.bookmarks.map((bm) => (
            <span key={bm} onContextMenu={(e) => handleBookmarkContextMenu(e, bm)} className={pushingBookmarks.has(bm) ? 'badge-pushing' : ''}>
              <Badge label={pushingBookmarks.has(bm) ? `${bm} (pushing...)` : bm} variant="bookmark" />
            </span>
          ))}
          {commit.hasConflict && <Badge label="conflict" variant="conflict" />}
          {commit.isEmpty && <Badge label="empty" variant="empty" />}

          {!isAnyMoveMode && (
            <span className="commit-chevron">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                {expanded
                  ? <path d="M4.427 5.427a.75.75 0 0 1 1.06-.013L8 7.846l2.513-2.432a.75.75 0 1 1 1.042 1.08l-3.034 2.933a.75.75 0 0 1-1.042 0L4.445 6.494a.75.75 0 0 1-.018-1.067z" />
                  : <path d="M5.427 11.573a.75.75 0 0 1-.013-1.06L7.846 8 5.414 5.487a.75.75 0 1 1 1.08-1.042l2.933 3.034a.75.75 0 0 1 0 1.042L6.494 11.555a.75.75 0 0 1-1.067.018z" />
                }
              </svg>
            </span>
          )}
          <span className="commit-description">
            {commit.description}
          </span>

          <span className="commit-timestamp">{formatRelativeTime(commit.timestamp)}</span>
          <span className="commit-change-id">{commit.changeId.slice(0, 3)}</span>
        </div>
      </div>

      {expanded && !isRebaseMode && !isDescribing && (
        <div className="graph-row graph-row--file-list">
          <SvgGraphCell graphChars={graphChars} laneColors={laneColors} lineOnly />
          <FileList changeId={commit.changeId} cwd={cwd} />
        </div>
      )}

      {isDescribing && (
        <div className="graph-row graph-row--file-list">
          <SvgGraphCell graphChars={graphChars} laneColors={laneColors} lineOnly />
          <div className="describe-editor">
            {describeLoading ? (
              <div className="describe-loading">Loading...</div>
            ) : (
              <>
                <textarea
                  ref={textareaRef}
                  className="describe-textarea"
                  value={describeText}
                  onChange={(e) => setDescribeText(e.target.value)}
                  rows={4}
                  placeholder="Enter commit description..."
                />
                <div className="describe-actions">
                  <button className="describe-btn describe-btn--save" onClick={() => onDescribeSave(commit.changeId, describeText)}>
                    Save
                  </button>
                  <button className="describe-btn describe-btn--cancel" onClick={onDescribeCancel}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            // 커밋 전환
            ...(!commit.isWorkingCopy ? [{
              label: 'Edit this commit',
              disabled: commit.isImmutable,
              onClick: () => onEdit(commit.changeId),
            }] : []),
            {
              label: 'New commit on top',
              onClick: () => onNew(commit.changeId),
            },
            // 커밋 수정
            { type: 'separator' as const },
            {
              label: 'Describe',
              disabled: commit.isImmutable,
              onClick: () => onDescribeStart(commit.changeId),
            },
            {
              label: 'Split',
              disabled: commit.isImmutable || commit.isEmpty,
              onClick: () => onSplitStart(commit.changeId),
            },
            {
              label: 'Squash into parent',
              disabled: commit.isImmutable,
              onClick: () => onSquashStart(commit.changeId, commit.description, commit.parents[0] ?? ''),
            },
            // 이동·재배치
            { type: 'separator' as const },
            {
              label: 'Move changes from here',
              disabled: commit.isImmutable || commit.isEmpty,
              onClick: () => onMoveChangesStart(commit.changeId),
            },
            {
              label: 'Rebase this subtree',
              disabled: commit.isImmutable,
              onClick: () => onRebaseStart(commit.changeId, commit.description),
            },
            // 북마크
            { type: 'separator' as const },
            {
              label: 'Set bookmark',
              onClick: () => onSetBookmark(commit.changeId),
            },
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}

      {bookmarkContextMenu && (
        <ContextMenu
          x={bookmarkContextMenu.x}
          y={bookmarkContextMenu.y}
          items={[
            {
              label: pushingBookmarks.has(bookmarkContextMenu.name) ? 'Pushing...' : 'Push this bookmark',
              disabled: pushingBookmarks.has(bookmarkContextMenu.name),
              onClick: () => onPushBookmark(bookmarkContextMenu.name),
            },
            {
              label: 'Push with descendants',
              disabled: pushingBookmarks.has(bookmarkContextMenu.name),
              onClick: () => onPushBookmarkSubtree(bookmarkContextMenu.name),
            },
            { type: 'separator' as const },
            {
              label: 'Rename bookmark',
              onClick: () => onBookmarkRename(bookmarkContextMenu.name),
            },
            {
              label: 'Delete bookmark',
              onClick: () => onBookmarkDelete(bookmarkContextMenu.name),
            },
          ]}
          onClose={() => setBookmarkContextMenu(null)}
        />
      )}
    </div>
  )
}

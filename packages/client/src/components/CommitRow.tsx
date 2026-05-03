import { useEffect, useRef, useState } from 'react'
import GraphSlot from './GraphSlot'
import Badge from './Badge'
import FileList from './FileList'
import ContextMenu from './ContextMenu'
import { usePointerThresholdDrag } from './usePointerThresholdDrag'
import { formatRelativeTime } from '../utils/format'
import type { BookmarkRef } from '../types'
import type { CommitRowViewModel } from '../repo/useRepoScreen'

interface Props {
  row: CommitRowViewModel
}

export default function CommitRow({ row }: Props) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [bookmarkContextMenu, setBookmarkContextMenu] = useState<{ x: number; y: number; bookmark: BookmarkRef } | null>(null)
  const [describeText, setDescribeText] = useState(row.describeValue)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!row.isDescribing) return
    setDescribeText(row.describeValue)
    if (!row.describeLoading) {
      setTimeout(() => textareaRef.current?.focus(), 0)
    }
  }, [row.isDescribing, row.describeLoading, row.describeValue, row.commit.changeId])

  const handleContextMenu = (event: React.MouseEvent) => {
    if (row.state.isContextMenuLocked) return
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY })
  }

  const handleBookmarkContextMenu = (event: React.MouseEvent, bookmark: BookmarkRef) => {
    if (row.state.isContextMenuLocked || bookmark.isRemote) return
    event.preventDefault()
    event.stopPropagation()
    setBookmarkContextMenu({ x: event.clientX, y: event.clientY, bookmark })
  }

  const handleCommitPointerDown = usePointerThresholdDrag({
    disabled: row.actionsDisabled,
    onDragStart: row.actions.onCommitDragStart,
    onDragMove: (pointer, target) => row.actions.onDragMove(pointer, target?.changeId, target?.description),
    onDragEnd: (_pointer, target) => {
      row.actions.onDragMove(_pointer, target?.changeId, target?.description)
      row.actions.onDragDrop()
    },
    onDragCancel: row.actions.onDragCancel,
  })

  const rowClass = [
    'graph-row',
    'graph-row--commit',
    row.commit.isWorkingCopy && 'graph-row--working-copy',
    row.commit.isImmutable && 'graph-row--immutable',
    row.state.isSource && 'graph-row--rebase-source',
    row.state.isDescendant && 'graph-row--rebase-descendant',
    row.state.isDisabledTarget && 'graph-row--rebase-disabled',
    row.state.isDestination && 'graph-row--rebase-destination',
    row.state.isMoveChangesDestination && 'graph-row--rebase-destination',
    row.state.isRebaseMode && !row.state.isSource && !row.state.isDescendant && 'graph-row--rebase-target',
    row.state.isMoveChangesMode && 'graph-row--rebase-target',
    row.state.isDragSource && 'graph-row--drag-source',
    row.state.isDragDescendant && 'graph-row--drag-descendant',
    row.state.isDragHoverTarget && 'graph-row--drag-target',
    row.state.isDragInvalidTarget && 'graph-row--drag-invalid',
  ].filter(Boolean).join(' ')

  const isAnyMoveMode = row.state.isRebaseMode || row.state.isMoveChangesMode || !!row.moveSelection
  const commitDropTargetProps = {
    'data-commit-drop-target': 'true',
    'data-change-id': row.commit.changeId,
    'data-description': row.commit.description,
  } as const

  return (
    <div>
      <div className={rowClass} onClick={row.actions.onRowClick} onContextMenu={handleContextMenu}>
        <GraphSlot graphChars={row.graphChars} />
        <div
          className="commit-info"
          {...commitDropTargetProps}
          onPointerDown={handleCommitPointerDown}
        >
          {row.commit.isWorkingCopy && <Badge label="Editing" variant="editing" />}
          {row.commit.workspaces.map((workspace) => (
            <Badge key={workspace} label={workspace} variant="workspace" />
          ))}
          {row.visibleBookmarks.map((bookmark) => (
            <span
              key={bookmark.displayName}
              onContextMenu={(event) => handleBookmarkContextMenu(event, bookmark)}
              className={!bookmark.isRemote && row.pushingBookmarks.has(bookmark.name) ? 'badge-pushing' : ''}
              title={bookmark.isRemote && bookmark.remote ? `Remote bookmark from ${bookmark.remote}` : undefined}
            >
              <Badge
                label={!bookmark.isRemote && row.pushingBookmarks.has(bookmark.name)
                  ? `${bookmark.displayName} (pushing...)`
                  : bookmark.displayName}
                variant={bookmark.isRemote ? 'bookmark-remote' : 'bookmark'}
              />
            </span>
          ))}
          {row.commit.hasConflict && <Badge label="conflict" variant="conflict" />}
          {row.commit.isEmpty && <Badge label="empty" variant="empty" />}

          {!isAnyMoveMode && (
            <span className="commit-chevron">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                {row.isExpanded
                  ? <path d="M4.427 5.427a.75.75 0 0 1 1.06-.013L8 7.846l2.513-2.432a.75.75 0 1 1 1.042 1.08l-3.034 2.933a.75.75 0 0 1-1.042 0L4.445 6.494a.75.75 0 0 1-.018-1.067z" />
                  : <path d="M5.427 11.573a.75.75 0 0 1-.013-1.06L7.846 8 5.414 5.487a.75.75 0 1 1 1.08-1.042l2.933 3.034a.75.75 0 0 1 0 1.042L6.494 11.555a.75.75 0 0 1-1.067.018z" />
                }
              </svg>
            </span>
          )}
          <span className="commit-description">{row.commit.description}</span>
          <span className="commit-timestamp">{formatRelativeTime(row.commit.timestamp)}</span>
          <span className="commit-change-id">{row.commit.changeId.slice(0, 3)}</span>
        </div>
      </div>

      {row.inlinePanel && (
        <div className="graph-row graph-row--file-list" {...commitDropTargetProps}>
          <GraphSlot graphChars={row.graphChars} />
          <div className={`inline-action-panel inline-action-panel--${row.inlinePanel.tone}`}>
            <div className="inline-action-panel-title">{row.inlinePanel.title}</div>
            {row.inlinePanel.details.length > 0 && (
              <div className="inline-action-panel-details">
                {row.inlinePanel.details.map((detail) => (
                  <div key={detail}>{detail}</div>
                ))}
              </div>
            )}
            {(row.inlinePanel.onCancel || row.inlinePanel.onConfirm) && (
              <div className="inline-action-panel-actions">
                {row.inlinePanel.onCancel && (
                  <button className="describe-btn describe-btn--cancel" onClick={row.inlinePanel.onCancel}>
                    Cancel
                  </button>
                )}
                {row.inlinePanel.onConfirm && row.inlinePanel.confirmLabel && (
                  <button className="describe-btn describe-btn--save" onClick={row.inlinePanel.onConfirm}>
                    {row.inlinePanel.confirmLabel}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {row.state.showFileList && (
        <div className="graph-row graph-row--file-list" {...commitDropTargetProps}>
          <GraphSlot graphChars={row.graphChars} />
          <FileList
            files={row.files}
            loading={row.filesLoading}
            actionsDisabled={row.actionsDisabled}
            readOnly={row.state.isReadOnlyFileList}
            dragSourcePaths={row.dragSourcePaths}
            onFileDragStart={row.actions.onFileDragStart}
            onDragMove={row.actions.onDragMove}
            onDragDrop={row.actions.onDragDrop}
            onDragCancel={row.actions.onDragCancel}
            onDiscardFile={row.actions.onDiscardFile}
            onMoveFile={row.actions.onMoveSingleFile}
            onViewDiff={row.actions.onViewFileDiff}
            moveSelection={row.moveSelection}
          />
        </div>
      )}

      {row.isDescribing && (
        <div className="graph-row graph-row--file-list" {...commitDropTargetProps}>
          <GraphSlot graphChars={row.graphChars} />
          <div className="describe-editor">
            {row.describeLoading ? (
              <div className="describe-loading">Loading...</div>
            ) : (
              <>
                <textarea
                  ref={textareaRef}
                  className="describe-textarea"
                  value={describeText}
                  onChange={(event) => setDescribeText(event.target.value)}
                  rows={4}
                  placeholder="Enter commit description..."
                />
                <div className="describe-actions">
                  <button className="describe-btn describe-btn--save" onClick={() => row.actions.onDescribeSave(describeText)}>
                    Save
                  </button>
                  <button className="describe-btn describe-btn--cancel" onClick={row.actions.onDescribeCancel}>
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
            ...(!row.commit.isWorkingCopy ? [{
              label: 'Edit this commit',
              disabled: row.commit.isImmutable,
              onClick: row.actions.onEdit,
            }] : []),
            {
              label: 'New commit on top',
              onClick: row.actions.onNew,
            },
            { type: 'separator' as const },
            {
              label: 'Describe',
              disabled: row.commit.isImmutable,
              onClick: row.actions.onDescribeStart,
            },
            {
              label: 'Split',
              disabled: row.commit.isImmutable || row.commit.isEmpty,
              onClick: row.actions.onSplitStart,
            },
            {
              label: 'Squash into parent',
              disabled: row.commit.isImmutable,
              onClick: row.actions.onSquashStart,
            },
            {
              label: 'Rebase this subtree',
              disabled: row.commit.isImmutable,
              onClick: row.actions.onRebaseStart,
            },
            { type: 'separator' as const },
            {
              label: 'Abandon commit...',
              disabled: row.commit.isImmutable || row.commit.isWorkingCopy,
              onClick: row.actions.onAbandonStart,
            },
            {
              label: 'Abandon subtree...',
              disabled: row.state.isSubtreeAbandonDisabled,
              onClick: row.actions.onAbandonSubtreeStart,
            },
            { type: 'separator' as const },
            {
              label: 'Set bookmark',
              onClick: row.actions.onSetBookmark,
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
              label: row.pushingBookmarks.has(bookmarkContextMenu.bookmark.name) ? 'Pushing...' : 'Push this bookmark',
              disabled: row.pushingBookmarks.has(bookmarkContextMenu.bookmark.name),
              onClick: () => row.actions.onPushBookmark(bookmarkContextMenu.bookmark.name),
            },
            {
              label: 'Push with descendants',
              disabled: row.pushingBookmarks.has(bookmarkContextMenu.bookmark.name),
              onClick: () => row.actions.onPushBookmarkSubtree(bookmarkContextMenu.bookmark.name),
            },
            { type: 'separator' as const },
            {
              label: 'Rename bookmark',
              onClick: () => row.actions.onBookmarkRename(bookmarkContextMenu.bookmark.name),
            },
            {
              label: 'Delete bookmark',
              onClick: () => row.actions.onBookmarkDelete(bookmarkContextMenu.bookmark.name),
            },
          ]}
          onClose={() => setBookmarkContextMenu(null)}
        />
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import ContextMenu from './ContextMenu'
import { usePointerThresholdDrag } from './usePointerThresholdDrag'
import type { ChangedFile } from '../repo/types'
import type { DragPointer } from '../repo/types'
import type { MoveSelectionViewModel } from '../repo/useRepoScreen'

interface Props {
  files: ChangedFile[]
  loading: boolean
  actionsDisabled: boolean
  readOnly: boolean
  dragSourcePaths: string[]
  onFileDragStart: (path: string, pointer: DragPointer) => void
  onDragMove: (pointer: DragPointer, targetChangeId?: string, targetDescription?: string) => void
  onDragDrop: () => void
  onDragCancel: () => void
  onDiscardFile: (path: string) => void
  onMoveFile: (path: string) => void
  onViewDiff: (path: string) => void
  moveSelection: MoveSelectionViewModel | null
}

interface DraggableFileItemProps {
  file: ChangedFile
  actionsDisabled: boolean
  readOnly: boolean
  isDragSource: boolean
  onFileDragStart: (path: string, pointer: DragPointer) => void
  onDragMove: (pointer: DragPointer, targetChangeId?: string, targetDescription?: string) => void
  onDragDrop: () => void
  onDragCancel: () => void
  onContextMenu(event: MouseEvent<HTMLDivElement>): void
}

function DraggableFileItem({
  file,
  actionsDisabled,
  readOnly,
  isDragSource,
  onFileDragStart,
  onDragMove,
  onDragDrop,
  onDragCancel,
  onContextMenu,
}: DraggableFileItemProps) {
  const handleFilePointerDown = usePointerThresholdDrag({
    disabled: actionsDisabled || readOnly,
    onDragStart: (pointer) => onFileDragStart(file.path, pointer),
    onDragMove: (pointer, target) => onDragMove(pointer, target?.changeId, target?.description),
    onDragEnd: (pointer, target) => {
      onDragMove(pointer, target?.changeId, target?.description)
      onDragDrop()
    },
    onDragCancel,
  })

  return (
    <div
      className={[
        'file-list-item',
        file.isConflict && 'file-list-item--conflict',
        readOnly && 'file-list-item--readonly',
        isDragSource && 'file-list-item--drag-source',
      ].filter(Boolean).join(' ')}
      title={file.path}
      onPointerDown={handleFilePointerDown}
      onContextMenu={onContextMenu}
    >
      <span className={`file-status file-status--${file.status}`}>{file.status}</span>
      <span className="file-path">{file.path}</span>
      {file.isConflict && <span className="file-conflict-badge">conflict</span>}
    </div>
  )
}

export default function FileList({
  files,
  loading,
  actionsDisabled,
  readOnly,
  dragSourcePaths,
  onFileDragStart,
  onDragMove,
  onDragDrop,
  onDragCancel,
  onDiscardFile,
  onMoveFile,
  onViewDiff,
  moveSelection,
}: Props) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: ChangedFile } | null>(null)

  useEffect(() => {
    setContextMenu(null)
  }, [actionsDisabled, files, moveSelection, readOnly])

  if (moveSelection) {
    const selected = new Set(moveSelection.selectedPaths)
    const allSelected = files.length > 0 && selected.size === files.length

    const updateSelection = (next: Set<string>) => {
      moveSelection.onSelectionChange([...next])
    }

    const toggleFile = (path: string) => {
      const next = new Set(selected)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      updateSelection(next)
    }

    const toggleAll = () => {
      updateSelection(allSelected ? new Set() : new Set(files.map((file) => file.path)))
    }

    return (
      <div className="file-list file-list--selecting">
        <div className="file-selection-summary">Select files to move from this commit</div>
        {loading && <div className="file-list-loading">refreshing changed files...</div>}
        {files.length > 0 && (
          <div className="file-select-list file-select-list--inline">
            <label className="file-select-item file-select-item--all">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={loading} />
              <span className="file-select-label">Select all ({files.length} files)</span>
            </label>
            {files.map((file) => (
              <label key={file.path} className="file-select-item">
                <input
                  type="checkbox"
                  checked={selected.has(file.path)}
                  onChange={() => toggleFile(file.path)}
                  disabled={loading}
                />
                <span className={`file-status file-status--${file.status}`}>{file.status}</span>
                <span className="file-select-path">{file.path}</span>
              </label>
            ))}
          </div>
        )}
        {!loading && files.length === 0 && <div className="file-list-empty">no changed files</div>}
        {moveSelection.notice && <div className="file-selection-note">{moveSelection.notice}</div>}
        <div className="file-selection-actions">
          <span className="file-selection-count">{selected.size} selected</span>
          <button
            className="describe-btn describe-btn--save"
            onClick={moveSelection.onContinue}
            disabled={selected.size === 0 || loading}
          >
            Continue
          </button>
          <button className="describe-btn describe-btn--cancel" onClick={moveSelection.onCancel}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (loading) return <div className="file-list-loading">loading...</div>
  if (files.length === 0) return <div className="file-list-empty">no changed files</div>

  return (
    <div className={`file-list${readOnly ? ' file-list--readonly' : ''}`}>
      {readOnly && (
        <div className="file-list-note">Resolve conflicted files in the terminal.</div>
      )}
      {files.map((file) => (
        <DraggableFileItem
          key={file.path}
          file={file}
          actionsDisabled={actionsDisabled}
          readOnly={readOnly}
          isDragSource={dragSourcePaths.includes(file.path)}
          onFileDragStart={onFileDragStart}
          onDragMove={onDragMove}
          onDragDrop={onDragDrop}
          onDragCancel={onDragCancel}
          onContextMenu={(event) => {
            if (actionsDisabled || readOnly) return
            event.preventDefault()
            event.stopPropagation()
            setContextMenu({ x: event.clientX, y: event.clientY, file })
          }}
        />
      ))}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            {
              label: 'Discard file changes',
              disabled: actionsDisabled,
              onClick: () => onDiscardFile(contextMenu.file.path),
            },
            {
              label: 'Move selected file to another commit',
              disabled: actionsDisabled,
              onClick: () => onMoveFile(contextMenu.file.path),
            },
            {
              label: 'View diff',
              disabled: actionsDisabled,
              onClick: () => onViewDiff(contextMenu.file.path),
            },
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

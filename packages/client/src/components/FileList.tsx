import { useEffect, useState } from 'react'
import ContextMenu from './ContextMenu'
import type { ChangedFile } from '../repo/types'
import type { MoveSelectionViewModel } from '../repo/useRepoScreen'

interface Props {
  files: ChangedFile[]
  loading: boolean
  actionsDisabled: boolean
  onDiscardFile: (path: string) => void
  onMoveFile: (path: string) => void
  moveSelection: MoveSelectionViewModel | null
}

export default function FileList({ files, loading, actionsDisabled, onDiscardFile, onMoveFile, moveSelection }: Props) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: ChangedFile } | null>(null)

  useEffect(() => {
    setContextMenu(null)
  }, [files, moveSelection])

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
    <div className="file-list">
      {files.map((file) => (
        <div
          key={file.path}
          className="file-list-item"
          title={file.path}
          onContextMenu={(event) => {
            if (actionsDisabled) return
            event.preventDefault()
            event.stopPropagation()
            setContextMenu({ x: event.clientX, y: event.clientY, file })
          }}
        >
          <span className={`file-status file-status--${file.status}`}>{file.status}</span>
          <span className="file-path">{file.path}</span>
        </div>
      ))}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            {
              label: '파일 변경사항 취소',
              disabled: actionsDisabled,
              onClick: () => onDiscardFile(contextMenu.file.path),
            },
            {
              label: '파일 선택해서 다른 커밋으로 옮기기',
              disabled: actionsDisabled,
              onClick: () => onMoveFile(contextMenu.file.path),
            },
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

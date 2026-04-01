import { useEffect, useState } from 'react'
import ContextMenu from './ContextMenu'
import type { ChangedFile } from '../repo/types'

interface Props {
  files: ChangedFile[]
  loading: boolean
  actionsDisabled: boolean
  onDiscardFile: (path: string) => void
  onMoveFile: (path: string) => void
}

export default function FileList({ files, loading, actionsDisabled, onDiscardFile, onMoveFile }: Props) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: ChangedFile } | null>(null)

  useEffect(() => {
    setContextMenu(null)
  }, [files])

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
              label: '다른 커밋으로 옮기기',
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

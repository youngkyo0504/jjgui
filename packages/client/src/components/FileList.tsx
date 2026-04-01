import { useEffect, useState } from 'react'
import ContextMenu from './ContextMenu'

interface ChangedFile {
  path: string
  status: string
}

interface Props {
  changeId: string
  cwd: string
  refreshKey: number
  actionsDisabled: boolean
  onDiscardFile: (changeId: string, path: string) => void
  onMoveFile: (changeId: string, path: string) => void
}

export default function FileList({ changeId, cwd, refreshKey, actionsDisabled, onDiscardFile, onMoveFile }: Props) {
  const [files, setFiles] = useState<ChangedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: ChangedFile } | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/show/${changeId}?cwd=${encodeURIComponent(cwd)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => setFiles(Array.isArray(data) ? data : []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false))
  }, [changeId, cwd, refreshKey])

  useEffect(() => {
    setContextMenu(null)
  }, [files])

  if (loading) return <div className="file-list-loading">loading...</div>
  if (files.length === 0) return <div className="file-list-empty">no changed files</div>

  return (
    <div className="file-list">
      {files.map((f) => (
        <div
          key={f.path}
          className="file-list-item"
          title={f.path}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setContextMenu({ x: e.clientX, y: e.clientY, file: f })
          }}
        >
          <span className={`file-status file-status--${f.status}`}>{f.status}</span>
          <span className="file-path">{f.path}</span>
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
              onClick: () => onDiscardFile(changeId, contextMenu.file.path),
            },
            {
              label: '다른 커밋으로 옮기기',
              disabled: actionsDisabled,
              onClick: () => onMoveFile(changeId, contextMenu.file.path),
            },
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

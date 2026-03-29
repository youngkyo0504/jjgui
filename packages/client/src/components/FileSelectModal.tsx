import { useState } from 'react'

interface ChangedFile {
  path: string
  status: string
}

interface Props {
  title: string
  files: ChangedFile[]
  onSubmit: (selectedPaths: string[]) => void
  onCancel: () => void
  minUnselected?: number // split에서 최소 1개는 원래 커밋에 남아야 함
}

export default function FileSelectModal({ title, files, onSubmit, onCancel, minUnselected = 0 }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const allSelected = selected.size === files.length
  const canSubmit = selected.size > 0 && (files.length - selected.size) >= minUnselected

  const toggleFile = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(files.map((f) => f.path)))
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="file-select-list">
          <label className="file-select-item file-select-item--all">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            <span className="file-select-label">Select all ({files.length} files)</span>
          </label>
          {files.map((file) => (
            <label key={file.path} className="file-select-item">
              <input
                type="checkbox"
                checked={selected.has(file.path)}
                onChange={() => toggleFile(file.path)}
              />
              <span className={`file-status file-status--${file.status}`}>{file.status}</span>
              <span className="file-select-path">{file.path}</span>
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button className="describe-btn describe-btn--save" onClick={() => onSubmit([...selected])} disabled={!canSubmit}>
            Confirm ({selected.size})
          </button>
          <button className="describe-btn describe-btn--cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

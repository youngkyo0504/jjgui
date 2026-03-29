import { useState, useEffect, useRef } from 'react'

interface Props {
  mode: 'create' | 'rename'
  initialName?: string
  onSubmit: (name: string) => void
  onCancel: () => void
}

export default function BookmarkModal({ mode, initialName = '', onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initialName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    if (mode === 'rename') inputRef.current?.select()
  }, [mode])

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          {mode === 'create' ? 'Create bookmark' : 'Rename bookmark'}
        </div>
        <input
          ref={inputRef}
          className="modal-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
            if (e.key === 'Escape') onCancel()
          }}
          placeholder="Bookmark name"
        />
        <div className="modal-actions">
          <button className="describe-btn describe-btn--save" onClick={handleSubmit} disabled={!name.trim()}>
            {mode === 'create' ? 'Create' : 'Rename'}
          </button>
          <button className="describe-btn describe-btn--cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

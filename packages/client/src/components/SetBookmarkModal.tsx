import { useState, useEffect } from 'react'
import { Command } from 'cmdk'

interface Props {
  changeId: string
  cwd: string
  onSuccess: () => void
  onCancel: () => void
  onError: (error: string) => void
}

export default function SetBookmarkModal({ changeId, cwd, onSuccess, onCancel, onError }: Props) {
  const [search, setSearch] = useState('')
  const [bookmarks, setBookmarks] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [backwardsConfirm, setBackwardsConfirm] = useState<{ name: string } | null>(null)

  useEffect(() => {
    fetch(`/api/bookmarks?cwd=${encodeURIComponent(cwd)}`)
      .then((res) => res.json())
      .then((data) => {
        setBookmarks(data.bookmarks ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [cwd])

  const handleSelect = async (name: string, allowBackwards = false) => {
    try {
      const res = await fetch(`/api/bookmark/set?cwd=${encodeURIComponent(cwd)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, changeId, allowBackwards }),
      })
      const data = await res.json()
      if (!data.ok) {
        const err = data.error || ''
        if (err.includes('backwards') || err.includes('sideways')) {
          setBackwardsConfirm({ name })
          return
        }
        throw new Error(err || `HTTP ${res.status}`)
      }
      onSuccess()
    } catch (e) {
      onError(String(e))
    }
  }

  const trimmed = search.trim()
  const exactMatch = bookmarks.some((b) => b === trimmed)
  const showCreate = trimmed.length > 0 && !exactMatch

  if (backwardsConfirm) {
    return (
      <div className="modal-overlay" onClick={onCancel}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-title">Bookmark을 뒤로 이동하시겠습니까?</div>
          <div className="modal-message">
            <strong>{backwardsConfirm.name}</strong> bookmark이 현재 위치보다 뒤로 또는 옆으로 이동합니다.
            <br />계속하시겠습니까?
          </div>
          <div className="modal-actions">
            <button className="describe-btn describe-btn--save" onClick={() => handleSelect(backwardsConfirm.name, true)}>
              이동
            </button>
            <button className="describe-btn describe-btn--cancel" onClick={onCancel}>
              취소
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal set-bookmark-modal" onClick={(e) => e.stopPropagation()}>
        <Command label="Set bookmark" shouldFilter={true} onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}>
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Bookmark name..."
            autoFocus
          />
          <Command.List>
            {loading && <Command.Loading>Loading...</Command.Loading>}
            <Command.Empty>No bookmarks found</Command.Empty>
            {showCreate && (
              <Command.Item
                className="cmdk-item--create"
                value={`create-new-${trimmed}`}
                onSelect={() => handleSelect(trimmed)}
              >
                Create new bookmark: <strong>{trimmed}</strong>
              </Command.Item>
            )}
            {bookmarks.map((bm) => (
              <Command.Item
                key={bm}
                value={bm}
                onSelect={() => handleSelect(bm)}
              >
                {bm}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}

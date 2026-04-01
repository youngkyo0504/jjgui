import { useCallback, useEffect, useRef, useState } from 'react'
import { Command } from 'cmdk'

interface Props {
  bookmarks: string[]
  loading: boolean
  onSubmit: (name: string) => void | Promise<void>
  onCancel: () => void | Promise<void>
}

export default function SetBookmarkModal({ bookmarks, loading, onSubmit, onCancel }: Props) {
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollPositionRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    scrollPositionRef.current = { x: window.scrollX, y: window.scrollY }
    inputRef.current?.focus()
  }, [])

  const restoreViewport = useCallback(() => {
    const { x, y } = scrollPositionRef.current
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ left: x, top: y })
      })
    })
  }, [])

  const closeWithStableViewport = useCallback(async (callback: () => void | Promise<void>) => {
    inputRef.current?.blur()
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    try {
      await callback()
    } finally {
      restoreViewport()
    }
  }, [restoreViewport])

  const handleSelect = (name: string) => {
    void closeWithStableViewport(() => onSubmit(name))
  }

  const handleCancel = useCallback(() => {
    void closeWithStableViewport(onCancel)
  }, [closeWithStableViewport, onCancel])

  const trimmed = search.trim()
  const exactMatch = bookmarks.some((bookmark) => bookmark === trimmed)
  const showCreate = trimmed.length > 0 && !exactMatch

  return (
    <Command.Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) handleCancel()
      }}
      overlayClassName="modal-overlay"
      contentClassName="modal set-bookmark-modal"
      label="Set bookmark"
      shouldFilter={true}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          handleCancel()
        }
      }}
    >
      <Command.Input
        ref={inputRef}
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
        {bookmarks.map((bookmark) => (
          <Command.Item
            key={bookmark}
            value={bookmark}
            onSelect={() => handleSelect(bookmark)}
          >
            {bookmark}
          </Command.Item>
        ))}
      </Command.List>
    </Command.Dialog>
  )
}

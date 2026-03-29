import type { BookmarkMoveState } from '../App'

interface Props {
  bookmarkMove: BookmarkMoveState
  onCancel: () => void
  onConfirm: () => void
  onUndo: () => void
}

export default function BookmarkMoveBanner({ bookmarkMove, onCancel, onConfirm, onUndo }: Props) {
  if (bookmarkMove.phase === 'selecting-destination') {
    return (
      <div className="rebase-banner">
        <span className="rebase-banner-text">
          Move bookmark: <strong>{bookmarkMove.bookmarkName}</strong> — destination 커밋을 클릭하세요.
        </span>
        <button className="rebase-banner-btn rebase-banner-btn--cancel" onClick={onCancel}>
          Cancel (ESC)
        </button>
      </div>
    )
  }

  if (bookmarkMove.phase === 'confirming') {
    return (
      <div className="rebase-banner rebase-banner--confirm">
        <span className="rebase-banner-text">
          <strong>{bookmarkMove.bookmarkName}</strong>
          {' → '}
          <strong>{bookmarkMove.destinationChangeId}</strong>
          {bookmarkMove.destinationDescription ? ` "${bookmarkMove.destinationDescription}"` : ''}
        </span>
        <button className="rebase-banner-btn rebase-banner-btn--confirm" onClick={onConfirm}>
          Move
        </button>
        <button className="rebase-banner-btn rebase-banner-btn--cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    )
  }

  if (bookmarkMove.phase === 'executing') {
    return (
      <div className="rebase-banner">
        <span className="rebase-banner-text">Bookmark 이동 중...</span>
      </div>
    )
  }

  if (bookmarkMove.phase === 'idle' && bookmarkMove.lastAction === 'bookmark-move') {
    return (
      <div className="rebase-banner rebase-banner--success">
        <span className="rebase-banner-text">Bookmark 이동 완료</span>
        <button className="rebase-banner-btn rebase-banner-btn--undo" onClick={onUndo}>
          Undo
        </button>
      </div>
    )
  }

  return null
}

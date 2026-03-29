import type { MoveChangesState } from '../App'

interface Props {
  moveChanges: MoveChangesState
  onCancel: () => void
  onConfirm: () => void
  onUndo: () => void
}

export default function MoveChangesBanner({ moveChanges, onCancel, onConfirm, onUndo }: Props) {
  if (moveChanges.phase === 'selecting-destination') {
    return (
      <div className="rebase-banner">
        <span className="rebase-banner-text">
          Move changes: <strong>{moveChanges.fromChangeId}</strong> ({moveChanges.selectedPaths?.length} files) — destination 커밋을 클릭하세요.
        </span>
        <button className="rebase-banner-btn rebase-banner-btn--cancel" onClick={onCancel}>
          Cancel (ESC)
        </button>
      </div>
    )
  }

  if (moveChanges.phase === 'confirming') {
    return (
      <div className="rebase-banner rebase-banner--confirm">
        <span className="rebase-banner-text">
          <strong>{moveChanges.fromChangeId}</strong>
          {' → '}
          <strong>{moveChanges.toChangeId}</strong>
          {moveChanges.toDescription ? ` "${moveChanges.toDescription}"` : ''}
          {` (${moveChanges.selectedPaths?.length} files)`}
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

  if (moveChanges.phase === 'executing') {
    return (
      <div className="rebase-banner">
        <span className="rebase-banner-text">변경사항 이동 중...</span>
      </div>
    )
  }

  if (moveChanges.phase === 'idle' && moveChanges.lastAction === 'move-changes') {
    return (
      <div className="rebase-banner rebase-banner--success">
        <span className="rebase-banner-text">변경사항 이동 완료</span>
        <button className="rebase-banner-btn rebase-banner-btn--undo" onClick={onUndo}>
          Undo
        </button>
      </div>
    )
  }

  return null
}

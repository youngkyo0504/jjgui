import type { RebaseState } from '../repo/types'

interface Props {
  rebase: RebaseState
  onCancel: () => void
  onConfirm: () => void
  onUndo: () => void
}

export default function RebaseBanner({ rebase, onCancel, onConfirm, onUndo }: Props) {
  if (rebase.phase === 'source-selected') {
    return (
      <div className="rebase-banner">
        <span className="rebase-banner-text">
          Rebase: move the subtree from <strong>{rebase.sourceChangeId}</strong>. Click a destination commit.
        </span>
        <button className="rebase-banner-btn rebase-banner-btn--cancel" onClick={onCancel}>
          Cancel (ESC)
        </button>
      </div>
    )
  }

  if (rebase.phase === 'confirming') {
    return (
      <div className="rebase-banner rebase-banner--confirm">
        <span className="rebase-banner-text">
          <strong>{rebase.sourceChangeId}</strong>
          {rebase.sourceDescription ? ` "${rebase.sourceDescription}"` : ''}
          {' → '}
          <strong>{rebase.destinationChangeId}</strong>
          {rebase.destinationDescription ? ` "${rebase.destinationDescription}"` : ''}
          {rebase.descendants ? ` (${rebase.descendants.size + 1} commits)` : ''}
        </span>
        <button className="rebase-banner-btn rebase-banner-btn--confirm" onClick={onConfirm}>
          Rebase
        </button>
        <button className="rebase-banner-btn rebase-banner-btn--cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    )
  }

  if (rebase.phase === 'executing') {
    return (
      <div className="rebase-banner">
        <span className="rebase-banner-text">Rebasing...</span>
      </div>
    )
  }

  if (rebase.phase === 'idle' && rebase.lastAction === 'rebase') {
    return (
      <div className="rebase-banner rebase-banner--success">
        <span className="rebase-banner-text">Rebase complete</span>
        <button className="rebase-banner-btn rebase-banner-btn--undo" onClick={onUndo}>
          Undo
        </button>
      </div>
    )
  }

  return null
}

import type { MoveChangesState } from '../repo/types'

interface Props {
  moveChanges: MoveChangesState
  onCancel: () => void
  onConfirm: () => void
  onUndo: () => void
}

export default function MoveChangesBanner({ moveChanges, onCancel, onConfirm, onUndo }: Props) {
  const getExecutingMessage = () => {
    switch (moveChanges.lastAction) {
      case 'discard-file':
        return 'Discarding file changes...'
      case 'split':
        return 'Splitting commit...'
      case 'squash':
        return 'Squashing changes...'
      case 'abandon':
        return 'Abandoning commit...'
      case 'abandon-subtree':
        return 'Abandoning subtree...'
      default:
        return 'Moving changes...'
    }
  }

  const getSuccessMessage = () => {
    switch (moveChanges.lastAction) {
      case 'discard-file':
        return 'File changes discarded'
      case 'split':
        return 'Commit split complete'
      case 'squash':
        return 'Changes squashed'
      case 'abandon':
        return 'Commit abandoned'
      case 'abandon-subtree':
        return 'Subtree abandoned'
      case 'move-changes':
        return 'Changes moved'
      default:
        return ''
    }
  }

  if (moveChanges.phase === 'selecting-destination') {
    return (
      <div className="rebase-banner">
        <span className="rebase-banner-text">
          Move changes: <strong>{moveChanges.fromChangeId}</strong> ({moveChanges.selectedPaths?.length} files) - click a destination commit.
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
        <span className="rebase-banner-text">{getExecutingMessage()}</span>
      </div>
    )
  }

  if (moveChanges.phase === 'idle' && moveChanges.lastAction) {
    return (
      <div className="rebase-banner rebase-banner--success">
        <span className="rebase-banner-text">{getSuccessMessage()}</span>
        <button className="rebase-banner-btn rebase-banner-btn--undo" onClick={onUndo}>
          Undo
        </button>
      </div>
    )
  }

  return null
}

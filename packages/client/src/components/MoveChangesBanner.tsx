import type { MoveChangesState } from '../App'

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
        return '파일 변경사항 취소 중...'
      case 'split':
        return '커밋 분할 중...'
      case 'squash':
        return '변경사항 합치는 중...'
      default:
        return '변경사항 이동 중...'
    }
  }

  const getSuccessMessage = () => {
    switch (moveChanges.lastAction) {
      case 'discard-file':
        return '파일 변경사항 취소 완료'
      case 'split':
        return '커밋 분할 완료'
      case 'squash':
        return '변경사항 합치기 완료'
      case 'move-changes':
        return '변경사항 이동 완료'
      default:
        return ''
    }
  }

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

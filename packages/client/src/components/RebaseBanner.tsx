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
          Rebase: <strong>{rebase.sourceChangeId}</strong> 의 서브트리를 이동합니다. destination 커밋을 클릭하세요.
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
          {rebase.descendants ? ` (${rebase.descendants.size + 1}개 커밋)` : ''}
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
        <span className="rebase-banner-text">Rebase 실행 중...</span>
      </div>
    )
  }

  if (rebase.phase === 'idle' && rebase.lastAction === 'rebase') {
    return (
      <div className="rebase-banner rebase-banner--success">
        <span className="rebase-banner-text">Rebase 완료</span>
        <button className="rebase-banner-btn rebase-banner-btn--undo" onClick={onUndo}>
          Undo
        </button>
      </div>
    )
  }

  return null
}

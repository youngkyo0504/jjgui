import type { OperationItemViewModel } from '../repo/useRepoScreen'

interface Props {
  isOpen: boolean
  items: OperationItemViewModel[]
  loading: boolean
  onClose: () => void
}

function getPreviewText(previewSummary: string | undefined): string {
  const text = previewSummary?.trim()
  return text && text.length > 0 ? text : 'No changed commits or files were reported.'
}

function getStatusLabel(status: OperationItemViewModel['status']): string {
  if (status === 'running') return 'Running'
  if (status === 'failed') return 'Needs attention'
  return 'Recorded'
}

export default function OperationDrawer({ isOpen, items, loading, onClose }: Props) {
  if (!isOpen) return null

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside
        className="operation-drawer"
        onClick={(event) => event.stopPropagation()}
        aria-label="Operations"
      >
        <div className="operation-drawer-header">
          <div className="operation-drawer-title">Operations</div>
          <button className="app-toolbar-btn" onClick={onClose}>Close</button>
        </div>

        <div className="operation-drawer-body">
          <div className="operation-drawer-intro">
            Pick an operation, inspect the impact, then decide whether reverting is worth the risk.
          </div>

          {loading && <div className="operation-drawer-empty">Loading operations...</div>}
          {!loading && items.length === 0 && <div className="operation-drawer-empty">No reviewable operations yet.</div>}

          {!loading && items.map((item) => (
            <div
              key={item.key}
              className={[
                'operation-item',
                `operation-item--${item.status}`,
                item.revertOperationId && 'operation-item--reviewable',
                item.revertPreview && 'operation-item--preview-open',
              ].filter(Boolean).join(' ')}
            >
              <div className="operation-item-top">
                <span className={`operation-item-status operation-item-status--${item.status}`}>
                  {getStatusLabel(item.status)}
                </span>
                <span className="operation-item-time">{item.relativeTime}</span>
              </div>
              <div className="operation-item-main">
                <div>
                  <div className="operation-item-title">{item.title}</div>
                  <div className="operation-item-summary">{item.summary}</div>
                </div>
                {item.revertOperationId && item.onPreviewRevert && !item.revertPreview && (
                  <button className="operation-preview-trigger" onClick={item.onPreviewRevert}>
                    Preview revert
                  </button>
                )}
              </div>
              {item.details && (
                <details className="operation-item-details">
                  <summary>Details</summary>
                  <pre>{item.details}</pre>
                </details>
              )}
              {item.revertPreview && (
                <div className={`operation-preview operation-preview--${item.revertPreview.status}`}>
                  <div className="operation-preview-eyebrow">Revert preview</div>
                  <div className="operation-preview-title">What will change</div>
                  {item.revertPreview.status === 'loading' && (
                    <div className="operation-preview-body">Preparing operation impact...</div>
                  )}
                  {item.revertPreview.status === 'failed' && (
                    <div className="operation-preview-body operation-preview-body--error">
                      {item.revertPreview.error}
                    </div>
                  )}
                  {item.revertPreview.status === 'ready' && (
                    <>
                      <pre className="operation-preview-summary">{getPreviewText(item.revertPreview.previewSummary)}</pre>
                      <div className="operation-preview-title">Risk / uncertainty</div>
                      <ul className="operation-preview-risk">
                        <li>This reverts only this operation. Later work stays in place.</li>
                        <li>If later work touched the same commits or files, jj may create conflicts.</li>
                      </ul>
                      <div className="operation-preview-title">Affected operation</div>
                      <div className="operation-preview-meta">
                        <span>{item.revertPreview.operationId}</span>
                        <span>{item.revertPreview.title}</span>
                      </div>
                    </>
                  )}
                  <div className="operation-preview-actions">
                    <button className="describe-btn describe-btn--cancel" onClick={item.revertPreview.onCancel}>
                      Cancel
                    </button>
                    {item.revertPreview.onConfirm && (
                      <button className="describe-btn describe-btn--save" onClick={item.revertPreview.onConfirm}>
                        Revert operation
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}

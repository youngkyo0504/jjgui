import type { OperationItemViewModel } from '../repo/useRepoScreen'

interface Props {
  isOpen: boolean
  items: OperationItemViewModel[]
  loading: boolean
  onClose: () => void
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
          {loading && <div className="operation-drawer-empty">Loading operations...</div>}
          {!loading && items.length === 0 && <div className="operation-drawer-empty">No recent operations.</div>}

          {!loading && items.map((item) => (
            <div key={item.key} className={`operation-item operation-item--${item.status}`}>
              <div className="operation-item-top">
                <span className={`operation-item-status operation-item-status--${item.status}`}>
                  {item.status === 'running' ? 'Running' : item.status === 'failed' ? 'Failed' : 'Done'}
                </span>
                <span className="operation-item-time">{item.relativeTime}</span>
              </div>
              <div className="operation-item-title">{item.title}</div>
              <div className="operation-item-summary">{item.summary}</div>
              {item.details && (
                <details className="operation-item-details">
                  <summary>Details</summary>
                  <pre>{item.details}</pre>
                </details>
              )}
              {item.restoreOperationId && item.onRestore && (
                <div className="operation-item-actions">
                  <button className="describe-btn describe-btn--save" onClick={item.onRestore}>
                    Restore
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}

import LogView from './components/LogView'
import BookmarkModal from './components/BookmarkModal'
import SetBookmarkModal from './components/SetBookmarkModal'
import FileSelectModal from './components/FileSelectModal'
import ConfirmModal from './components/ConfirmModal'
import ErrorBanner from './components/ErrorBanner'
import OperationDrawer from './components/OperationDrawer'
import DragFloatingLabel from './components/DragFloatingLabel'
import { useRepoScreen } from './repo/useRepoScreen'
import './components/styles.css'

export default function App() {
  const cwd = new URLSearchParams(window.location.search).get('cwd') ?? ''
  const screen = useRepoScreen(cwd)

  if (screen.appError) return <div className="app-error">Error: {screen.appError}</div>

  return (
    <div className="app">
      <div className="app-toolbar">
        <div className="app-header">visual-jj — {screen.toolbar.cwd}</div>
        {screen.toolbar.hasRemoteBookmarks && (
          <button
            className={`app-toolbar-btn ${screen.toolbar.showRemoteBookmarks ? 'app-toolbar-btn--active' : ''}`}
            onClick={screen.toolbar.onToggleRemoteBookmarks}
          >
            Remote refs {screen.toolbar.showRemoteBookmarks ? 'On' : 'Off'}
          </button>
        )}
        <button
          className="app-toolbar-btn"
          onClick={screen.toolbar.onFetch}
          disabled={screen.toolbar.fetchDisabled}
        >
          {screen.toolbar.fetchLabel}
        </button>
        <button
          className={`app-toolbar-btn app-toolbar-btn--ops app-toolbar-btn--ops-${screen.toolbar.operationsChip.status}`}
          onClick={screen.toolbar.operationsChip.onClick}
        >
          {screen.toolbar.operationsChip.label}
        </button>
      </div>

      {screen.errorBanner && (
        <ErrorBanner
          message={screen.errorBanner.message}
          onClose={screen.errorBanner.onClose}
        />
      )}

      <LogView rows={screen.logRows} />
      {screen.dragPreview && <DragFloatingLabel preview={screen.dragPreview} />}
      <OperationDrawer
        isOpen={screen.operationsDrawer.isOpen}
        items={screen.operationsDrawer.items}
        loading={screen.operationsDrawer.loading}
        onClose={screen.operationsDrawer.onClose}
      />

      {screen.bookmarkModal?.kind === 'rename' && (
        <BookmarkModal
          mode="rename"
          initialName={screen.bookmarkModal.initialName}
          onSubmit={screen.bookmarkModal.onSubmit}
          onCancel={screen.bookmarkModal.onCancel}
        />
      )}

      {screen.bookmarkModal?.kind === 'set' && (
        <SetBookmarkModal
          bookmarks={screen.bookmarkModal.bookmarks}
          loading={screen.bookmarkModal.loading}
          onSubmit={screen.bookmarkModal.onSubmit}
          onCancel={screen.bookmarkModal.onCancel}
        />
      )}

      {screen.fileSelectModal && (
        <FileSelectModal
          title={screen.fileSelectModal.title}
          files={screen.fileSelectModal.files}
          minUnselected={screen.fileSelectModal.minUnselected}
          onSubmit={screen.fileSelectModal.onSubmit}
          onCancel={screen.fileSelectModal.onCancel}
        />
      )}

      {screen.confirmModal && (
        <ConfirmModal
          title={screen.confirmModal.title}
          message={screen.confirmModal.message}
          confirmLabel={screen.confirmModal.confirmLabel}
          onConfirm={screen.confirmModal.onConfirm}
          onCancel={screen.confirmModal.onCancel}
        />
      )}

      {screen.remoteSelect && (
        <div className="modal-overlay" onClick={screen.remoteSelect.onCancel}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-title">{screen.remoteSelect.title}</div>
            <div className="remote-list">
              {screen.remoteSelect.remotes.map((remote) => (
                <button
                  key={remote}
                  className="remote-item"
                  onClick={() => screen.remoteSelect?.onSelect(remote)}
                >
                  {remote}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="describe-btn describe-btn--cancel" onClick={screen.remoteSelect.onCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {screen.pushToast && (
        <div className={`push-toast push-toast--${screen.pushToast.type}`}>
          <div className="push-toast-body">
            <span className="push-toast-message">{screen.pushToast.message}</span>
            {screen.pushToast.type === 'success' && screen.pushToast.reviewUrl && (
              <a
                className="push-toast-link"
                href={screen.pushToast.reviewUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open review link
              </a>
            )}
          </div>
          <button className="push-toast-close" onClick={screen.pushToast.onClose}>&times;</button>
        </div>
      )}
    </div>
  )
}

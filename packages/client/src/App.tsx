import { useEffect, useMemo, useRef, useState } from 'react'
import type { CommitInfo } from './types'
import CommitDiffScreen from './components/CommitDiffScreen'
import LogView from './components/LogView'
import BookmarkModal from './components/BookmarkModal'
import SetBookmarkModal from './components/SetBookmarkModal'
import FileSelectModal from './components/FileSelectModal'
import ConfirmModal from './components/ConfirmModal'
import ErrorBanner from './components/ErrorBanner'
import OperationDrawer from './components/OperationDrawer'
import DragFloatingLabel from './components/DragFloatingLabel'
import { useRepoScreen } from './repo/useRepoScreen'
import { parseAppRoute } from './utils/commitDiffRoute'
import './components/styles.css'

function normalizePath(path: string): string {
  return path.replace(/[\\/]+$/, '')
}

function getRepoName(cwd: string): string {
  const normalized = normalizePath(cwd)
  if (!normalized) return 'jjgui'
  const name = normalized.split(/[\\/]/).filter(Boolean).at(-1) ?? normalized
  return name === 'visual-jj-webview' ? 'jjgui' : name
}

function formatRepoPath(cwd: string): string {
  const normalized = normalizePath(cwd)
  if (!normalized) return ''

  const unixHomeMatch = normalized.match(/^\/(?:Users|home)\/[^/]+(?=\/|$)/)
  if (unixHomeMatch) {
    return normalized.replace(unixHomeMatch[0], '~')
  }

  return normalized
}

export default function App() {
  const [route, setRoute] = useState(() => parseAppRoute(window.location.search))
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false)
  const toolbarActionsRef = useRef<HTMLDivElement>(null)
  const cwd = new URLSearchParams(window.location.search).get('cwd') ?? ''
  const screen = useRepoScreen(cwd)

  useEffect(() => {
    const syncRoute = () => setRoute(parseAppRoute(window.location.search))
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  useEffect(() => {
    if (!toolbarMenuOpen) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && toolbarActionsRef.current?.contains(target)) return
      setToolbarMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setToolbarMenuOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [toolbarMenuOpen])

  const commits = useMemo(
    () => screen.logRows.flatMap((row) => (row.type === 'commit' ? [row.row.commit] : [])) as CommitInfo[],
    [screen.logRows],
  )
  const repoName = useMemo(() => getRepoName(screen.toolbar.cwd), [screen.toolbar.cwd])
  const repoPath = useMemo(() => formatRepoPath(screen.toolbar.cwd), [screen.toolbar.cwd])
  const surfacedOperation = screen.toolbar.operationsChip.status === 'running'
    || screen.toolbar.operationsChip.status === 'failed'
    ? screen.toolbar.operationsChip
    : null

  if (screen.appError) return <div className="app-error">Error: {screen.appError}</div>

  if (route.view === 'commit-diff') {
    return (
      <div className="app app--commit-diff">
        {screen.errorBanner && (
          <ErrorBanner
            message={screen.errorBanner.message}
            onClose={screen.errorBanner.onClose}
          />
        )}
        <CommitDiffScreen cwd={cwd} route={route} commits={commits} />
      </div>
    )
  }

  return (
    <div className="app">
      <div className="app-toolbar">
        <div className="app-toolbar-identity">
          <div className="app-toolbar-title">{repoName}</div>
          {repoPath && <div className="app-toolbar-path" title={screen.toolbar.cwd}>{repoPath}</div>}
        </div>
        <div className="app-toolbar-actions" ref={toolbarActionsRef}>
          {surfacedOperation && (
            <button
              className={`app-toolbar-status app-toolbar-status--${surfacedOperation.status}`}
              onClick={surfacedOperation.onClick}
            >
              {surfacedOperation.label}
            </button>
          )}
          <button
            className="app-toolbar-menu-btn"
            aria-label="Open toolbar actions"
            aria-expanded={toolbarMenuOpen}
            onClick={() => setToolbarMenuOpen((open) => !open)}
          >
            &middot;&middot;&middot;
          </button>
          {toolbarMenuOpen && (
            <div className="app-toolbar-menu" role="menu">
              {screen.toolbar.hasRemoteBookmarks && (
                <button
                  className={`app-toolbar-menu-item ${screen.toolbar.showRemoteBookmarks ? 'app-toolbar-menu-item--active' : ''}`}
                  onClick={() => {
                    screen.toolbar.onToggleRemoteBookmarks()
                    setToolbarMenuOpen(false)
                  }}
                  role="menuitem"
                >
                  <span>Remote refs</span>
                  <span>{screen.toolbar.showRemoteBookmarks ? 'On' : 'Off'}</span>
                </button>
              )}
              <button
                className="app-toolbar-menu-item"
                onClick={() => {
                  screen.toolbar.onFetch()
                  setToolbarMenuOpen(false)
                }}
                disabled={screen.toolbar.fetchDisabled}
                role="menuitem"
              >
                <span>Fetch</span>
                <span>{screen.toolbar.fetchLabel}</span>
              </button>
              <button
                className={`app-toolbar-menu-item app-toolbar-menu-item--ops-${screen.toolbar.operationsChip.status}`}
                onClick={() => {
                  screen.toolbar.operationsChip.onClick()
                  setToolbarMenuOpen(false)
                }}
                role="menuitem"
              >
                <span>Operations</span>
                <span>{screen.toolbar.operationsChip.label}</span>
              </button>
            </div>
          )}
        </div>
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
          wide={screen.confirmModal.wide}
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

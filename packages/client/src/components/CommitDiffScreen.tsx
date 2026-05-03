import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CommitInfo } from '../types'
import { createHttpRepoApi } from '../repo/httpRepoApi'
import type { ChangedFile, CommitFileContents, CommitFileDiff } from '../repo/types'
import type { CommitDiffTreeNode } from '../utils/commitDiffFileTree'
import {
  buildCommitDiffFileTree,
  compactCommitDiffFileTree,
  collectFolderPaths,
  getAncestorFolderPaths,
} from '../utils/commitDiffFileTree'
import { formatRelativeTime } from '../utils/format'
import type { CommitDiffRoute } from '../utils/commitDiffRoute'
import { leaveCommitDiffRoute, replaceCommitDiffRoute } from '../utils/commitDiffRoute'
import JjDiffViewer from './JjDiffViewer'

interface Props {
  cwd: string
  route: CommitDiffRoute
  commits: CommitInfo[]
}

interface AsyncState<T> {
  status: 'idle' | 'loading' | 'ready' | 'error'
  value: T
  error: string | null
}

const emptyContents: CommitFileContents = {
  oldContent: null,
  newContent: null,
}

function createAsyncState<T>(value: T): AsyncState<T> {
  return {
    status: 'idle',
    value,
    error: null,
  }
}

async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard API is unavailable.')
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, text.length)

  const didCopy = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!didCopy) {
    throw new Error('Copy command failed.')
  }
}

interface CommitDiffTreeProps {
  nodes: CommitDiffTreeNode[]
  depth: number
  expandedFolders: ReadonlySet<string>
  selectedPath: string | null
  onToggleFolder(path: string): void
  onSelectFile(path: string): void
}

function CommitDiffTree({
  nodes,
  depth,
  expandedFolders,
  selectedPath,
  onToggleFolder,
  onSelectFile,
}: CommitDiffTreeProps) {
  return (
    <>
      {nodes.map((node) => {
        if (node.kind === 'folder') {
          const isExpanded = expandedFolders.has(node.path)
          const containsSelected = selectedPath?.startsWith(`${node.path}/`) ?? false
          const folderNameClass = [
            'commit-diff-folder-name',
            node.name.includes('/') && 'commit-diff-folder-name--compact',
          ].filter(Boolean).join(' ')

          return (
            <div key={node.path} className="commit-diff-tree-node">
              <button
                type="button"
                className={[
                  'commit-diff-folder-item',
                  containsSelected && 'commit-diff-folder-item--selected-ancestor',
                ].filter(Boolean).join(' ')}
                onClick={() => onToggleFolder(node.path)}
                style={{ '--tree-depth': depth } as CSSProperties}
                title={node.path}
                aria-expanded={isExpanded}
              >
                <span className={`commit-diff-folder-chevron${isExpanded ? ' commit-diff-folder-chevron--expanded' : ''}`}>
                  ▸
                </span>
                <span className={folderNameClass}>{node.name}</span>
              </button>
              {isExpanded && (
                <div className="commit-diff-tree-children">
                  <CommitDiffTree
                    nodes={node.children}
                    depth={depth + 1}
                    expandedFolders={expandedFolders}
                    selectedPath={selectedPath}
                    onToggleFolder={onToggleFolder}
                    onSelectFile={onSelectFile}
                  />
                </div>
              )}
            </div>
          )
        }

        return (
          <button
            key={node.path}
            type="button"
            className={[
              'commit-diff-file-item',
              'commit-diff-file-item--nested',
              selectedPath === node.path && 'commit-diff-file-item--active',
              node.file.isConflict && 'commit-diff-file-item--conflict',
            ].filter(Boolean).join(' ')}
            onClick={() => onSelectFile(node.path)}
            style={{ '--tree-depth': depth } as CSSProperties}
            title={node.path}
          >
            <span className={`file-status file-status--${node.file.status}`}>{node.file.status}</span>
            <span className="commit-diff-file-name">{node.name}</span>
            {node.file.isConflict && <span className="file-conflict-badge">conflict</span>}
          </button>
        )
      })}
    </>
  )
}

export default function CommitDiffScreen({ cwd, route, commits }: Props) {
  const api = useMemo(() => createHttpRepoApi(), [])
  const commit = useMemo(
    () => commits.find((item) => item.changeId === route.changeId) ?? null,
    [commits, route.changeId],
  )

  const [filesState, setFilesState] = useState<AsyncState<ChangedFile[]>>(() => createAsyncState([]))
  const [diffState, setDiffState] = useState<AsyncState<CommitFileDiff | null>>(() => createAsyncState(null))
  const [contentsState, setContentsState] = useState<AsyncState<CommitFileContents>>(() => createAsyncState(emptyContents))
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle')
  const hasInitializedTree = useRef(false)

  useEffect(() => {
    let cancelled = false

    setFilesState({
      status: 'loading',
      value: [],
      error: null,
    })

    api.loadChangedFiles(cwd, route.changeId)
      .then((files) => {
        if (cancelled) return
        setFilesState({
          status: 'ready',
          value: files,
          error: null,
        })
      })
      .catch((error) => {
        if (cancelled) return
        setFilesState({
          status: 'error',
          value: [],
          error: String(error),
        })
      })

    return () => {
      cancelled = true
    }
  }, [api, cwd, route.changeId])

  const files = filesState.value
  const rawFileTree = useMemo(() => buildCommitDiffFileTree(files), [files])
  const fileTree = useMemo(() => compactCommitDiffFileTree(rawFileTree), [rawFileTree])
  const allFolderPaths = useMemo(() => collectFolderPaths(fileTree), [fileTree])
  const selectedPath = useMemo(() => {
    if (files.length === 0) return null
    if (route.path && files.some((file) => file.path === route.path)) {
      return route.path
    }
    return files[0].path
  }, [files, route.path])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const available = new Set(allFolderPaths)
    const selectedAncestors = selectedPath ? getAncestorFolderPaths(selectedPath) : []

    setExpandedFolders((previous) => {
      if (!hasInitializedTree.current) {
        hasInitializedTree.current = true
        return new Set([...allFolderPaths, ...selectedAncestors])
      }

      const next = new Set<string>()
      for (const path of previous) {
        if (available.has(path)) next.add(path)
      }
      for (const path of selectedAncestors) {
        if (available.has(path)) next.add(path)
      }
      return next
    })
  }, [allFolderPaths, selectedPath])

  useEffect(() => {
    if (filesState.status !== 'ready') return
    if (!selectedPath) return
    if (route.path === selectedPath) return
    replaceCommitDiffRoute(route.changeId, selectedPath)
  }, [filesState.status, route.changeId, route.path, selectedPath])

  useEffect(() => {
    setCopyState('idle')
  }, [selectedPath])

  useEffect(() => {
    if (copyState === 'idle') return
    const timeoutId = window.setTimeout(() => {
      setCopyState('idle')
    }, 1600)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [copyState])

  useEffect(() => {
    if (!selectedPath) {
      setDiffState({
        status: 'ready',
        value: null,
        error: null,
      })
      setContentsState({
        status: 'ready',
        value: emptyContents,
        error: null,
      })
      return
    }

    let cancelled = false

    setDiffState({
      status: 'loading',
      value: null,
      error: null,
    })
    setContentsState({
      status: 'idle',
      value: emptyContents,
      error: null,
    })

    api.loadCommitDiff(cwd, route.changeId, selectedPath)
      .then(async (diff) => {
        if (cancelled) return

        setDiffState({
          status: 'ready',
          value: diff,
          error: null,
        })

        if (!diff.canExpandContext) {
          setContentsState({
            status: 'ready',
            value: emptyContents,
            error: null,
          })
          return
        }

        setContentsState({
          status: 'loading',
          value: emptyContents,
          error: null,
        })

        try {
          const contents = await api.loadCommitFileContent(cwd, route.changeId, selectedPath)
          if (cancelled) return
          setContentsState({
            status: 'ready',
            value: contents,
            error: null,
          })
        } catch (error) {
          if (cancelled) return
          setContentsState({
            status: 'error',
            value: emptyContents,
            error: String(error),
          })
        }
      })
      .catch((error) => {
        if (cancelled) return
        setDiffState({
          status: 'error',
          value: null,
          error: String(error),
        })
      })

    return () => {
      cancelled = true
    }
  }, [api, cwd, route.changeId, selectedPath])

  const diff = diffState.value
  const fileCountLabel = filesState.status === 'ready'
    ? `${files.length} file${files.length === 1 ? '' : 's'}`
    : 'Loading files...'

  const toggleFolder = (path: string) => {
    setExpandedFolders((previous) => {
      const next = new Set(previous)
      if (selectedPath?.startsWith(`${path}/`)) {
        next.add(path)
        return next
      }
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleCopyPath = async () => {
    if (!selectedPath) return

    try {
      await copyText(selectedPath)
      setCopyState('success')
    } catch {
      setCopyState('error')
    }
  }

  return (
    <div className="commit-diff-screen">
      <div className="commit-diff-header">
        <button type="button" className="commit-diff-back-btn" onClick={leaveCommitDiffRoute}>
          Back
        </button>
        <div className="commit-diff-header-body">
          <div className="commit-diff-title-row">
            <h1 className="commit-diff-title">{commit?.description || 'Commit diff review'}</h1>
            {commit && <span className="commit-diff-timestamp">{formatRelativeTime(commit.timestamp)}</span>}
          </div>
          <div className="commit-diff-subtitle">
            <span>change {route.changeId}</span>
            <span>·</span>
            <span>{fileCountLabel}</span>
            {selectedPath && (
              <>
                <span>·</span>
                <span>{selectedPath}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="commit-diff-layout">
        <aside className="commit-diff-sidebar">
          <div className="commit-diff-sidebar-header">Files in this commit</div>
          <div className="commit-diff-file-list">
            {filesState.status === 'loading' && <div className="file-list-loading">loading files...</div>}
            {filesState.status === 'error' && <div className="commit-diff-error">{filesState.error}</div>}
            {filesState.status === 'ready' && files.length === 0 && (
              <div className="file-list-empty">no changed files</div>
            )}
            <CommitDiffTree
              nodes={fileTree}
              depth={0}
              expandedFolders={expandedFolders}
              selectedPath={selectedPath}
              onToggleFolder={toggleFolder}
              onSelectFile={(path) => replaceCommitDiffRoute(route.changeId, path)}
            />
          </div>
        </aside>

        <section className="commit-diff-panel">
          <div className="commit-diff-panel-header">
            <div className="commit-diff-panel-title-row">
              <div className="commit-diff-panel-title">{selectedPath ?? 'Select a file'}</div>
              <button
                type="button"
                className="commit-diff-copy-btn"
                onClick={handleCopyPath}
                disabled={!selectedPath}
                title={selectedPath ? 'Copy relative file path' : 'Select a file first'}
              >
                {copyState === 'success' ? 'Copied' : copyState === 'error' ? 'Retry copy' : 'Copy path'}
              </button>
            </div>
            <div className="commit-diff-panel-meta">
              {contentsState.status === 'loading' && diff?.canExpandContext
                ? 'Loading additional context...'
                : copyState === 'error'
                  ? 'Could not copy path.'
                  : null}
            </div>
          </div>
          <div className="commit-diff-panel-body">
            {diffState.status === 'loading' && <div className="commit-diff-empty">loading diff...</div>}
            {diffState.status === 'error' && <div className="commit-diff-error">{diffState.error}</div>}
            {diffState.status === 'ready' && !selectedPath && (
              <div className="commit-diff-empty">Select a file to review its diff.</div>
            )}
            {diffState.status === 'ready' && diff && !diff.patch.trim() && (
              <div className="commit-diff-empty">There is no visible diff for this file.</div>
            )}
            {diffState.status === 'ready' && diff && diff.patch.trim() && (
              <>
                {diff.isMerge && (
                  <div className="commit-diff-note">
                    Merge commits do not support expanded context, so only the patch diff is shown.
                  </div>
                )}
                {!diff.canExpandContext && !diff.isMerge && (
                  <div className="commit-diff-note">
                    Expanded context is not available for this commit.
                  </div>
                )}
                {contentsState.status === 'error' && (
                  <div className="commit-diff-note commit-diff-note--warning">
                    Could not load expanded context, so only the patch diff is shown.
                  </div>
                )}
                <JjDiffViewer
                  filePath={diff.path}
                  oldPath={diff.oldPath}
                  patch={diff.patch}
                  canExpandContext={diff.canExpandContext}
                  oldContent={contentsState.value.oldContent}
                  newContent={contentsState.value.newContent}
                />
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

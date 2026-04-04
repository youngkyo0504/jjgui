import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { BookmarkRef, CommitInfo } from '../types'
import { formatRelativeTime } from '../utils/format'
import { createRepoApp } from './createRepoApp'
import { createEventSourceRepoEvents } from './eventSourceRepoEvents'
import { createHttpRepoApi } from './httpRepoApi'
import type { RepoCommands, RepoDialog, RepoSnapshot } from './createRepoApp'
import type {
  ChangedFile,
  OperationKind,
  OperationStatus,
  PushResult,
} from './types'

export interface InlineActionPanelViewModel {
  tone: 'confirm' | 'running'
  title: string
  details: string[]
  confirmLabel?: string
  onConfirm?(): void
  onCancel?(): void
}

export interface CommitRowViewModel {
  key: string
  graphChars: string
  laneColors?: string[]
  commit: CommitInfo
  visibleBookmarks: BookmarkRef[]
  pushingBookmarks: ReadonlySet<string>
  isExpanded: boolean
  isDescribing: boolean
  describeValue: string
  describeLoading: boolean
  files: ChangedFile[]
  filesLoading: boolean
  actionsDisabled: boolean
  inlinePanel: InlineActionPanelViewModel | null
  state: {
    isSource: boolean
    isDescendant: boolean
    isDisabledTarget: boolean
    isDestination: boolean
    isMoveChangesDestination: boolean
    isRebaseMode: boolean
    isMoveChangesMode: boolean
    isInteractionLocked: boolean
  }
  actions: {
    onRowClick(): void
    onEdit(): void
    onNew(): void
    onDescribeStart(): void
    onDescribeCancel(): void
    onDescribeSave(message: string): void
    onSetBookmark(): void
    onBookmarkDelete(name: string): void
    onBookmarkRename(name: string): void
    onSplitStart(): void
    onSquashStart(): void
    onMoveChangesStart(): void
    onRebaseStart(): void
    onMoveSingleFile(path: string): void
    onDiscardFile(path: string): void
    onPushBookmark(bookmark: string): void
    onPushBookmarkSubtree(bookmark: string): void
  }
}

export type LogRowView =
  | { type: 'commit'; row: CommitRowViewModel }
  | { type: 'edge'; key: string; graphChars: string; laneColors?: string[] }
  | { type: 'elided'; key: string; graphChars: string; laneColors?: string[] }

export interface OperationItemViewModel {
  key: string
  status: OperationStatus
  title: string
  summary: string
  timestamp: string
  relativeTime: string
  details?: string
  restoreOperationId?: string | null
  onRestore?(): void
}

export interface RepoScreenModel {
  appError: string | null
  toolbar: {
    cwd: string
    hasRemoteBookmarks: boolean
    showRemoteBookmarks: boolean
    fetchLabel: string
    fetchDisabled: boolean
    onToggleRemoteBookmarks(): void
    onFetch(): void
    operationsChip: {
      label: string
      status: 'idle' | 'running' | 'success' | 'failed'
      onClick(): void
    }
  }
  errorBanner: { message: string; onClose(): void } | null
  operationsDrawer: {
    isOpen: boolean
    items: OperationItemViewModel[]
    loading: boolean
    onClose(): void
  }
  logRows: LogRowView[]
  bookmarkModal:
    | { kind: 'rename'; initialName: string; onSubmit(name: string): void; onCancel(): void }
    | { kind: 'set'; bookmarks: string[]; loading: boolean; onSubmit(name: string): void; onCancel(): void }
    | null
  fileSelectModal:
    | { title: string; files: ChangedFile[]; minUnselected: number; onSubmit(paths: string[]): void; onCancel(): void }
    | null
  confirmModal:
    | { title: string; message: string; confirmLabel: string; onConfirm(): void; onCancel(): void }
    | null
  remoteSelect:
    | { title: string; remotes: string[]; onSelect(remote: string): void; onCancel(): void }
    | null
  pushToast: (PushResult & { onClose(): void }) | null
}

function getPushTargetLabel(bookmark: string, scope: 'bookmark' | 'subtree'): string {
  return scope === 'subtree' ? `${bookmark} subtree` : bookmark
}

function getOperationVerb(kind: OperationKind): string {
  switch (kind) {
    case 'rebase':
      return 'Rebasing...'
    case 'move-changes':
      return 'Moving...'
    case 'split':
      return 'Splitting...'
    case 'squash':
      return 'Squashing...'
    case 'discard-file':
      return 'Discarding...'
    case 'fetch':
      return 'Fetching...'
    case 'restore':
      return 'Restoring...'
    default:
      return 'Running...'
  }
}

function getMoveChangesExecutingTitle(snapshot: RepoSnapshot): string {
  switch (snapshot.moveChanges.lastAction) {
    case 'discard-file':
      return 'Discarding file changes...'
    case 'split':
      return 'Splitting commit...'
    case 'squash':
      return 'Squashing commit...'
    default:
      return 'Moving changes...'
  }
}

function buildConfirmModal(dialog: RepoDialog | null, commands: RepoCommands): RepoScreenModel['confirmModal'] {
  if (!dialog || dialog.kind !== 'confirm') return null

  if (dialog.confirmKind === 'squash') {
    return {
      title: 'Squash into parent',
      message: `"${dialog.description || '(no description)'}" -> parent "${dialog.parentDescription || '(no description)'}"`,
      confirmLabel: 'Squash',
      onConfirm: () => { void commands.confirmDialog() },
      onCancel: commands.dismissDialog,
    }
  }

  if (dialog.confirmKind === 'subtree-push') {
    return {
      title: 'Push bookmark subtree?',
      message: `This will push ${dialog.bookmark} and any descendant bookmarks that point into its subtree.`,
      confirmLabel: 'Continue',
      onConfirm: () => { void commands.confirmDialog() },
      onCancel: commands.dismissDialog,
    }
  }

  return {
    title: 'Move bookmark backwards?',
    message: `"${dialog.name}" bookmark will move backwards or sideways. Continue?`,
    confirmLabel: 'Move',
    onConfirm: () => { void commands.confirmDialog() },
    onCancel: commands.dismissDialog,
  }
}

function buildRemoteSelect(dialog: RepoDialog | null, commands: RepoCommands): RepoScreenModel['remoteSelect'] {
  if (!dialog || dialog.kind !== 'remote-select') return null

  return {
    title: `Select remote for ${getPushTargetLabel(dialog.bookmark, dialog.scope)}`,
    remotes: dialog.remotes,
    onSelect: (remote) => { void commands.selectRemote(remote) },
    onCancel: commands.dismissDialog,
  }
}

function buildBookmarkModal(snapshot: RepoSnapshot, commands: RepoCommands): RepoScreenModel['bookmarkModal'] {
  const dialog = snapshot.dialog
  if (!dialog) return null

  if (dialog.kind === 'bookmark-rename') {
    return {
      kind: 'rename',
      initialName: dialog.bookmarkName,
      onSubmit: (name) => { void commands.submitBookmarkRename(name) },
      onCancel: commands.dismissDialog,
    }
  }

  if (dialog.kind === 'bookmark-set') {
    return {
      kind: 'set',
      bookmarks: snapshot.resources.bookmarks.bookmarks,
      loading: snapshot.resources.bookmarks.status === 'loading',
      onSubmit: (name) => { void commands.submitBookmarkSet(name) },
      onCancel: commands.dismissDialog,
    }
  }

  return null
}

function buildFileSelectModal(snapshot: RepoSnapshot, commands: RepoCommands): RepoScreenModel['fileSelectModal'] {
  const dialog = snapshot.dialog
  if (!dialog || dialog.kind !== 'file-select') return null

  return {
    title: dialog.mode === 'split' ? 'Split: 새 커밋으로 빼낼 파일 선택' : 'Move changes: 이동할 파일 선택',
    files: dialog.files,
    minUnselected: dialog.mode === 'split' ? 1 : 0,
    onSubmit: (paths) => { void commands.submitFileSelection(paths) },
    onCancel: commands.dismissDialog,
  }
}

function buildInlinePanel(
  snapshot: RepoSnapshot,
  commit: CommitInfo,
  commands: RepoCommands,
): InlineActionPanelViewModel | null {
  if (snapshot.rebase.destinationChangeId === commit.changeId) {
    const commitCount = (snapshot.rebase.descendants?.size ?? 0) + 1
    const details = [
      `source: ${snapshot.rebase.sourceChangeId}${snapshot.rebase.sourceDescription ? ` "${snapshot.rebase.sourceDescription}"` : ''}`,
      `destination: ${snapshot.rebase.destinationChangeId}${snapshot.rebase.destinationDescription ? ` "${snapshot.rebase.destinationDescription}"` : ''}`,
    ]

    if (snapshot.rebase.phase === 'confirming') {
      return {
        tone: 'confirm',
        title: `Rebase ${commitCount} commit${commitCount === 1 ? '' : 's'} onto ${snapshot.rebase.destinationChangeId}`,
        details,
        confirmLabel: 'Rebase',
        onConfirm: () => { void commands.confirmRebase() },
        onCancel: commands.cancelRebase,
      }
    }

    if (snapshot.rebase.phase === 'executing') {
      return {
        tone: 'running',
        title: `Rebasing ${commitCount} commit${commitCount === 1 ? '' : 's'}...`,
        details,
      }
    }
  }

  if (snapshot.moveChanges.toChangeId === commit.changeId) {
    const fileCount = snapshot.moveChanges.selectedPaths?.length ?? 0
    const details = [
      `from: ${snapshot.moveChanges.fromChangeId ?? '-'}`,
      `destination: ${snapshot.moveChanges.toChangeId}${snapshot.moveChanges.toDescription ? ` "${snapshot.moveChanges.toDescription}"` : ''}`,
    ]

    if (snapshot.moveChanges.phase === 'confirming') {
      return {
        tone: 'confirm',
        title: `Move ${fileCount} file${fileCount === 1 ? '' : 's'} into ${snapshot.moveChanges.toChangeId}`,
        details,
        confirmLabel: 'Move',
        onConfirm: () => { void commands.confirmMoveChanges() },
        onCancel: commands.cancelMoveChanges,
      }
    }

    if (snapshot.moveChanges.phase === 'executing' && snapshot.moveChanges.lastAction === 'move-changes') {
      return {
        tone: 'running',
        title: 'Moving changes...',
        details,
      }
    }
  }

  if (snapshot.moveChanges.phase === 'executing' && snapshot.moveChanges.fromChangeId === commit.changeId) {
    if (snapshot.moveChanges.lastAction === 'discard-file' || snapshot.moveChanges.lastAction === 'split' || snapshot.moveChanges.lastAction === 'squash') {
      return {
        tone: 'running',
        title: getMoveChangesExecutingTitle(snapshot),
        details: snapshot.moveChanges.selectedPaths?.map((path) => `path: ${path}`) ?? [],
      }
    }
  }

  return null
}

function buildLogRows(snapshot: RepoSnapshot, commands: RepoCommands): LogRowView[] {
  return snapshot.rows.map((row, index) => {
    if (row.type !== 'commit' || !row.commit) {
      return {
        type: row.type,
        key: `${row.type}-${index}`,
        graphChars: row.graphChars,
        laneColors: row.laneColors,
      }
    }

    const commit = row.commit
    const isSource = snapshot.rebase.sourceChangeId === commit.changeId
    const isDescendant = snapshot.rebase.descendants?.has(commit.changeId) ?? false
    const isInSubtree = isSource || isDescendant
    const isRebaseMode = snapshot.rebase.phase === 'source-selected' || snapshot.rebase.phase === 'confirming'
    const isMoveChangesMode = snapshot.moveChanges.phase === 'selecting-destination' || snapshot.moveChanges.phase === 'confirming'
    const isInteractionLocked = snapshot.rebase.phase !== 'idle' || snapshot.moveChanges.phase !== 'idle'
    const visibleBookmarks = snapshot.showRemoteBookmarks
      ? commit.bookmarks
      : commit.bookmarks.filter((bookmark) => !bookmark.isRemote)
    const descriptionResource = snapshot.resources.descriptions[commit.changeId]
    const fileResource = snapshot.resources.files[commit.changeId]

    return {
      type: 'commit',
      row: {
        key: `${commit.changeId}-${index}`,
        graphChars: row.graphChars,
        laneColors: row.laneColors,
        commit,
        visibleBookmarks,
        pushingBookmarks: snapshot.pushingBookmarks,
        isExpanded: snapshot.expandedChangeIds.has(commit.changeId),
        isDescribing: snapshot.describingChangeId === commit.changeId,
        describeValue: descriptionResource?.value ?? '',
        describeLoading: snapshot.describingChangeId === commit.changeId && descriptionResource?.status === 'loading',
        files: fileResource?.files ?? [],
        filesLoading: fileResource?.status === 'loading',
        actionsDisabled: commit.isImmutable || isInteractionLocked,
        inlinePanel: buildInlinePanel(snapshot, commit, commands),
        state: {
          isSource,
          isDescendant,
          isDisabledTarget: isRebaseMode && isInSubtree,
          isDestination: snapshot.rebase.destinationChangeId === commit.changeId,
          isMoveChangesDestination: snapshot.moveChanges.toChangeId === commit.changeId,
          isRebaseMode,
          isMoveChangesMode,
          isInteractionLocked,
        },
        actions: {
          onRowClick: () => commands.handleRowClick(commit.changeId, commit.description),
          onEdit: () => { void commands.edit(commit.changeId) },
          onNew: () => { void commands.createChild(commit.changeId) },
          onDescribeStart: () => commands.startDescribe(commit.changeId),
          onDescribeCancel: () => commands.cancelDescribe(),
          onDescribeSave: (message) => { void commands.saveDescription(commit.changeId, message) },
          onSetBookmark: () => { void commands.openBookmarkSet(commit.changeId) },
          onBookmarkDelete: (name) => { void commands.deleteBookmark(name) },
          onBookmarkRename: (name) => commands.openBookmarkRename(name),
          onSplitStart: () => { void commands.startSplit(commit.changeId) },
          onSquashStart: () => commands.startSquash(commit.changeId, commit.description, commit.parents[0] ?? ''),
          onMoveChangesStart: () => { void commands.startMoveChanges(commit.changeId) },
          onRebaseStart: () => commands.startRebase(commit.changeId, commit.description),
          onMoveSingleFile: (path) => commands.startMoveSingleFile(commit.changeId, path),
          onDiscardFile: (path) => { void commands.discardFile(commit.changeId, path) },
          onPushBookmark: (bookmark) => { void commands.startPushBookmark(bookmark) },
          onPushBookmarkSubtree: (bookmark) => commands.startPushBookmarkSubtree(bookmark),
        },
      },
    }
  })
}

function buildOperationItems(snapshot: RepoSnapshot, commands: RepoCommands): OperationItemViewModel[] {
  const operationItems: OperationItemViewModel[] = []
  const opLogById = new Map(snapshot.resources.operations.items.map((item) => [item.id, item]))

  for (const operation of snapshot.recentOperations) {
    if (operation.afterOpId && opLogById.has(operation.afterOpId)) {
      continue
    }

    operationItems.push({
      key: operation.key,
      status: operation.status,
      title: operation.title,
      summary: operation.summary,
      timestamp: operation.timestamp,
      relativeTime: formatRelativeTime(operation.timestamp),
      details: operation.details,
      restoreOperationId: operation.status === 'success' ? operation.beforeOpId ?? null : null,
      onRestore: operation.beforeOpId ? () => { void commands.restoreOperation(operation.beforeOpId!) } : undefined,
    })
  }

  for (const entry of snapshot.resources.operations.items) {
    const matched = snapshot.recentOperations.find((operation) => operation.afterOpId === entry.id)
    operationItems.push({
      key: entry.id,
      status: matched?.status ?? 'success',
      title: matched?.title ?? entry.description,
      summary: matched?.summary ?? entry.user,
      timestamp: entry.timestamp,
      relativeTime: formatRelativeTime(entry.timestamp),
      details: matched?.details,
      restoreOperationId: matched?.beforeOpId ?? null,
      onRestore: matched?.beforeOpId ? () => { void commands.restoreOperation(matched.beforeOpId!) } : undefined,
    })
  }

  return operationItems
}

function buildOperationsChip(snapshot: RepoSnapshot, commands: RepoCommands): RepoScreenModel['toolbar']['operationsChip'] {
  const activeOperation = snapshot.recentOperations.find((operation) => operation.status === 'running')
  if (activeOperation) {
    return {
      label: `Ops · ${getOperationVerb(activeOperation.kind)}`,
      status: 'running',
      onClick: commands.openOperationDrawer,
    }
  }

  const latestOperation = snapshot.recentOperations[0]
  if (!latestOperation) {
    return {
      label: 'Ops',
      status: 'idle',
      onClick: commands.openOperationDrawer,
    }
  }

  if (latestOperation.status === 'failed') {
    return {
      label: 'Ops · Failed',
      status: 'failed',
      onClick: commands.openOperationDrawer,
    }
  }

  const successfulCount = snapshot.recentOperations.filter((operation) => operation.status === 'success').length
  return {
    label: `Ops · ${successfulCount} recent`,
    status: 'success',
    onClick: commands.openOperationDrawer,
  }
}

function buildScreenModel(snapshot: RepoSnapshot, commands: RepoCommands): RepoScreenModel {
  const hasRemoteBookmarks = snapshot.rows.some(
    (row) => row.type === 'commit' && row.commit?.bookmarks.some((bookmark) => bookmark.isRemote),
  )

  return {
    appError: snapshot.appError,
    toolbar: {
      cwd: snapshot.cwd,
      hasRemoteBookmarks,
      showRemoteBookmarks: snapshot.showRemoteBookmarks,
      fetchLabel: snapshot.fetchState.phase === 'executing' ? 'Fetching...' : 'Fetch',
      fetchDisabled: snapshot.fetchState.phase === 'executing'
        || snapshot.rebase.phase !== 'idle'
        || snapshot.moveChanges.phase !== 'idle',
      onToggleRemoteBookmarks: commands.toggleRemoteBookmarks,
      onFetch: () => { void commands.fetchAll() },
      operationsChip: buildOperationsChip(snapshot, commands),
    },
    errorBanner: snapshot.errorBanner
      ? {
          message: snapshot.errorBanner,
          onClose: commands.closeErrorBanner,
        }
      : null,
    operationsDrawer: {
      isOpen: snapshot.operationDrawerOpen,
      items: buildOperationItems(snapshot, commands),
      loading: snapshot.resources.operations.status === 'loading',
      onClose: commands.closeOperationDrawer,
    },
    logRows: buildLogRows(snapshot, commands),
    bookmarkModal: buildBookmarkModal(snapshot, commands),
    fileSelectModal: buildFileSelectModal(snapshot, commands),
    confirmModal: buildConfirmModal(snapshot.dialog, commands),
    remoteSelect: buildRemoteSelect(snapshot.dialog, commands),
    pushToast: snapshot.pushResult
      ? {
          ...snapshot.pushResult,
          onClose: commands.dismissPushToast,
        }
      : null,
  }
}

export function useRepoScreen(cwd: string): RepoScreenModel {
  const app = useMemo(() => createRepoApp({
    api: createHttpRepoApi(),
    events: createEventSourceRepoEvents(),
  }), [])
  const session = useMemo(() => app.createSession(cwd), [app, cwd])
  const subscribe = useMemo(() => (listener: () => void) => session.subscribe(listener), [session])
  const getSnapshot = useMemo(() => () => session.getSnapshot(), [session])

  useEffect(() => {
    void session.commands.initialize()
    return () => {
      session.dispose()
    }
  }, [session])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (session.getSnapshot().operationDrawerOpen) {
          session.commands.closeOperationDrawer()
          return
        }
        session.commands.cancelInteraction()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [session])

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return useMemo(() => buildScreenModel(snapshot, session.commands), [snapshot, session])
}

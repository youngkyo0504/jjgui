import { buildChildrenMap, getDescendants } from '../utils/graph'
import { interpretSuccessfulPush } from '../utils/pushFeedback'
import type { GraphRow } from '../types'
import type { RepoApiPort, RepoEventsPort } from './ports'
import type {
  ChangedFile,
  DragInteractionState,
  DragPointer,
  FetchState,
  MoveChangesState,
  OperationLogEntry,
  OperationKind,
  RecentOperation,
  PushResult,
  PushScope,
  RebaseState,
} from './types'

type UndoKind = 'rebase' | 'moveChanges' | 'fetch'

type DescriptionResource = {
  status: 'idle' | 'loading' | 'ready'
  value: string
}

type FileResource = {
  status: 'idle' | 'loading' | 'ready'
  files: ChangedFile[]
}

type BookmarkListResource = {
  status: 'idle' | 'loading' | 'ready'
  bookmarks: string[]
}

type OperationLogResource = {
  status: 'idle' | 'loading' | 'ready'
  items: OperationLogEntry[]
}

type SplitFileSelectDialog = {
  kind: 'file-select'
  mode: 'split'
  changeId: string
  files: ChangedFile[]
}

type MoveChangesFileSelectDialog = {
  kind: 'file-select'
  mode: 'move-changes'
  changeId: string
  files: ChangedFile[]
  initialSelectedPaths?: string[]
  selectedPaths: string[]
  notice?: string | null
}

export type RepoDialog =
  | { kind: 'bookmark-set'; changeId: string }
  | { kind: 'bookmark-rename'; bookmarkName: string }
  | SplitFileSelectDialog
  | MoveChangesFileSelectDialog
  | { kind: 'confirm'; confirmKind: 'squash'; changeId: string; description: string; parentDescription: string }
  | { kind: 'confirm'; confirmKind: 'subtree-push'; bookmark: string }
  | { kind: 'confirm'; confirmKind: 'bookmark-backwards'; name: string; changeId: string }
  | { kind: 'remote-select'; bookmark: string; remotes: string[]; scope: PushScope }

export interface RepoSnapshot {
  cwd: string
  rows: GraphRow[]
  appError: string | null
  errorBanner: string | null
  showRemoteBookmarks: boolean
  dragInteraction: DragInteractionState | null
  rebase: RebaseState
  moveChanges: MoveChangesState
  fetchState: FetchState
  dialog: RepoDialog | null
  describingChangeId: string | null
  expandedChangeIds: ReadonlySet<string>
  pushingBookmarks: ReadonlySet<string>
  pushResult: PushResult | null
  operationDrawerOpen: boolean
  recentOperations: RecentOperation[]
  resources: {
    descriptions: Record<string, DescriptionResource>
    files: Record<string, FileResource>
    bookmarks: BookmarkListResource
    operations: OperationLogResource
  }
}

export interface RepoCommands {
  initialize(): Promise<void>
  refresh(): Promise<void>
  toggleRemoteBookmarks(): void
  openOperationDrawer(): void
  closeOperationDrawer(): void
  closeErrorBanner(): void
  dismissDialog(): void
  dismissPushToast(): void
  cancelInteraction(): void
  startRebaseDrag(changeId: string, description: string, pointer: DragPointer): void
  startFileDrag(changeId: string, paths: string[], pointer: DragPointer): void
  updateDrag(pointer: DragPointer, targetChangeId?: string, targetDescription?: string): void
  dropDrag(): void
  cancelDrag(): void
  handleRowClick(changeId: string, description: string): void
  edit(changeId: string): Promise<void>
  createChild(changeId: string): Promise<void>
  startDescribe(changeId: string): void
  cancelDescribe(): void
  saveDescription(changeId: string, message: string): Promise<void>
  openBookmarkSet(changeId: string): Promise<void>
  submitBookmarkSet(name: string): Promise<void>
  openBookmarkRename(name: string): void
  submitBookmarkRename(newName: string): Promise<void>
  deleteBookmark(name: string): Promise<void>
  startSplit(changeId: string): Promise<void>
  setMoveChangesSelection(selectedPaths: string[]): void
  submitFileSelection(selectedPaths: string[]): Promise<void>
  startSquash(changeId: string, description: string, parentDescription: string): void
  startMoveChanges(changeId: string): Promise<void>
  startMoveSingleFile(changeId: string, path: string): Promise<void>
  discardFile(changeId: string, path: string): Promise<void>
  startRebase(changeId: string, description: string): void
  cancelRebase(): void
  selectRebaseDestination(changeId: string, description: string): void
  confirmRebase(): Promise<void>
  selectMoveDestination(changeId: string, description: string): void
  cancelMoveChanges(): void
  confirmMoveChanges(): Promise<void>
  undo(kind: UndoKind): Promise<void>
  restoreOperation(operationId: string): Promise<void>
  fetchAll(): Promise<void>
  startPushBookmark(bookmark: string): Promise<void>
  startPushBookmarkSubtree(bookmark: string): void
  confirmDialog(): Promise<void>
  selectRemote(remote: string): Promise<void>
}

export interface RepoSession {
  getSnapshot(): RepoSnapshot
  subscribe(listener: () => void): () => void
  dispose(): void
  commands: RepoCommands
}

export interface RepoApp {
  createSession(cwd: string): RepoSession
}

function isMoveChangesFileSelectDialog(dialog: RepoDialog | null): dialog is MoveChangesFileSelectDialog {
  return dialog?.kind === 'file-select' && dialog.mode === 'move-changes'
}

function idleRebaseState(): RebaseState {
  return { phase: 'idle' }
}

function idleMoveChangesState(): MoveChangesState {
  return { phase: 'idle' }
}

function idleFetchState(): FetchState {
  return { phase: 'idle' }
}

function initialSnapshot(cwd: string): RepoSnapshot {
  return {
    cwd,
    rows: [],
    appError: null,
    errorBanner: null,
    showRemoteBookmarks: false,
    dragInteraction: null,
    rebase: idleRebaseState(),
    moveChanges: idleMoveChangesState(),
    fetchState: idleFetchState(),
    dialog: null,
    describingChangeId: null,
    expandedChangeIds: new Set<string>(),
    pushingBookmarks: new Set<string>(),
    pushResult: null,
    operationDrawerOpen: false,
    recentOperations: [],
    resources: {
      descriptions: {},
      files: {},
      bookmarks: {
        status: 'idle',
        bookmarks: [],
      },
      operations: {
        status: 'idle',
        items: [],
      },
    },
  }
}

class RepoSessionImpl implements RepoSession {
  private readonly listeners = new Set<() => void>()
  private readonly descriptionRequests = new Map<string, Promise<string>>()
  private readonly fileRequests = new Map<string, Promise<ChangedFile[]>>()
  private bookmarksRequest: Promise<string[]> | null = null
  private unsubscribeEvents: (() => void) | null = null
  private refreshToken = 0
  private initialized = false
  private disposed = false
  private state: RepoSnapshot

  readonly commands: RepoCommands = {
    initialize: () => this.initialize(),
    refresh: () => this.refresh(),
    toggleRemoteBookmarks: () => this.toggleRemoteBookmarks(),
    openOperationDrawer: () => this.openOperationDrawer(),
    closeOperationDrawer: () => this.closeOperationDrawer(),
    closeErrorBanner: () => this.closeErrorBanner(),
    dismissDialog: () => this.dismissDialog(),
    dismissPushToast: () => this.dismissPushToast(),
    cancelInteraction: () => this.cancelInteraction(),
    startRebaseDrag: (changeId, description, pointer) => this.startRebaseDrag(changeId, description, pointer),
    startFileDrag: (changeId, paths, pointer) => this.startFileDrag(changeId, paths, pointer),
    updateDrag: (pointer, targetChangeId, targetDescription) => this.updateDrag(pointer, targetChangeId, targetDescription),
    dropDrag: () => this.dropDrag(),
    cancelDrag: () => this.cancelDrag(),
    handleRowClick: (changeId, description) => this.handleRowClick(changeId, description),
    edit: (changeId) => this.edit(changeId),
    createChild: (changeId) => this.createChild(changeId),
    startDescribe: (changeId) => this.startDescribe(changeId),
    cancelDescribe: () => this.cancelDescribe(),
    saveDescription: (changeId, message) => this.saveDescription(changeId, message),
    openBookmarkSet: (changeId) => this.openBookmarkSet(changeId),
    submitBookmarkSet: (name) => this.submitBookmarkSet(name),
    openBookmarkRename: (name) => this.openBookmarkRename(name),
    submitBookmarkRename: (newName) => this.submitBookmarkRename(newName),
    deleteBookmark: (name) => this.deleteBookmark(name),
    startSplit: (changeId) => this.startSplit(changeId),
    setMoveChangesSelection: (selectedPaths) => this.setMoveChangesSelection(selectedPaths),
    submitFileSelection: (selectedPaths) => this.submitFileSelection(selectedPaths),
    startSquash: (changeId, description, parentDescription) => this.startSquash(changeId, description, parentDescription),
    startMoveChanges: (changeId) => this.startMoveChanges(changeId),
    startMoveSingleFile: (changeId, path) => this.startMoveSingleFile(changeId, path),
    discardFile: (changeId, path) => this.discardFile(changeId, path),
    startRebase: (changeId, description) => this.startRebase(changeId, description),
    cancelRebase: () => this.cancelRebase(),
    selectRebaseDestination: (changeId, description) => this.selectRebaseDestination(changeId, description),
    confirmRebase: () => this.confirmRebase(),
    selectMoveDestination: (changeId, description) => this.selectMoveDestination(changeId, description),
    cancelMoveChanges: () => this.cancelMoveChanges(),
    confirmMoveChanges: () => this.confirmMoveChanges(),
    undo: (kind) => this.undo(kind),
    restoreOperation: (operationId) => this.restoreOperation(operationId),
    fetchAll: () => this.fetchAll(),
    startPushBookmark: (bookmark) => this.startPushBookmark(bookmark),
    startPushBookmarkSubtree: (bookmark) => this.startPushBookmarkSubtree(bookmark),
    confirmDialog: () => this.confirmDialog(),
    selectRemote: (remote) => this.selectRemote(remote),
  }

  constructor(
    private readonly cwd: string,
    private readonly api: RepoApiPort,
    private readonly events: RepoEventsPort,
  ) {
    this.state = initialSnapshot(cwd)
  }

  getSnapshot(): RepoSnapshot {
    return this.state
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  dispose(): void {
    this.disposed = true
    this.unsubscribeEvents?.()
    this.listeners.clear()
  }

  private emit(): void {
    if (this.disposed) return
    for (const listener of this.listeners) {
      listener()
    }
  }

  private setState(updater: (state: RepoSnapshot) => RepoSnapshot): void {
    if (this.disposed) return
    this.state = updater(this.state)
    this.emit()
  }

  private closeErrorBanner(): void {
    this.setState((state) => ({ ...state, errorBanner: null }))
  }

  private dismissDialog(): void {
    this.setState((state) => ({ ...state, dialog: null }))
  }

  private dismissPushToast(): void {
    this.setState((state) => ({ ...state, pushResult: null }))
  }

  private openOperationDrawer(): void {
    this.setState((state) => ({ ...state, operationDrawerOpen: true }))
    void this.loadOperations()
  }

  private closeOperationDrawer(): void {
    this.setState((state) => ({ ...state, operationDrawerOpen: false }))
  }

  private cancelInteraction(): void {
    if (this.state.dragInteraction) {
      this.cancelDrag()
      return
    }
    if (isMoveChangesFileSelectDialog(this.state.dialog)) {
      this.dismissDialog()
      return
    }
    if (this.state.rebase.phase !== 'idle' && this.state.rebase.phase !== 'executing') {
      this.cancelRebase()
    }
    if (this.state.moveChanges.phase !== 'idle' && this.state.moveChanges.phase !== 'executing') {
      this.cancelMoveChanges()
    }
  }

  private toggleRemoteBookmarks(): void {
    this.setState((state) => ({
      ...state,
      showRemoteBookmarks: !state.showRemoteBookmarks,
    }))
  }

  private canStartDrag(): boolean {
    if (this.state.dragInteraction) return false
    if (this.state.dialog) return false
    if (this.state.rebase.phase !== 'idle') return false
    if (this.state.moveChanges.phase !== 'idle') return false
    return true
  }

  private startRebaseDrag(changeId: string, description: string, pointer: DragPointer): void {
    if (!this.canStartDrag()) return

    const descendants = getDescendants(changeId, buildChildrenMap(this.state.rows))
    this.setState((state) => ({
      ...state,
      dragInteraction: {
        kind: 'rebase',
        sourceChangeId: changeId,
        sourceDescription: description,
        descendants,
        pointer,
        targetValidity: 'none',
      },
    }))
  }

  private startFileDrag(changeId: string, paths: string[], pointer: DragPointer): void {
    if (!this.canStartDrag()) return

    const selectedPaths = Array.from(new Set(paths)).filter(Boolean)
    if (selectedPaths.length === 0) return

    this.setState((state) => ({
      ...state,
      dragInteraction: {
        kind: 'move-files',
        sourceChangeId: changeId,
        selectedPaths,
        pointer,
        targetValidity: 'none',
      },
    }))
  }

  private updateDrag(pointer: DragPointer, targetChangeId?: string, targetDescription?: string): void {
    const dragInteraction = this.state.dragInteraction
    if (!dragInteraction) return

    let targetValidity: DragInteractionState['targetValidity'] = 'none'
    if (targetChangeId) {
      if (dragInteraction.kind === 'rebase') {
        const isSource = dragInteraction.sourceChangeId === targetChangeId
        const isDescendant = dragInteraction.descendants.has(targetChangeId)
        targetValidity = isSource || isDescendant ? 'invalid' : 'valid'
      } else {
        targetValidity = dragInteraction.sourceChangeId === targetChangeId ? 'invalid' : 'valid'
      }
    }

    this.setState((state) => ({
      ...state,
      dragInteraction: {
        ...dragInteraction,
        pointer,
        hoveredTargetChangeId: targetChangeId,
        hoveredTargetDescription: targetDescription,
        targetValidity,
      },
    }))
  }

  private dropDrag(): void {
    const dragInteraction = this.state.dragInteraction
    if (!dragInteraction) return

    if (!dragInteraction.hoveredTargetChangeId || dragInteraction.targetValidity !== 'valid') {
      this.cancelDrag()
      return
    }

    if (dragInteraction.kind === 'rebase') {
      this.setState((state) => ({
        ...state,
        dragInteraction: null,
        rebase: {
          phase: 'confirming',
          sourceChangeId: dragInteraction.sourceChangeId,
          sourceDescription: dragInteraction.sourceDescription,
          destinationChangeId: dragInteraction.hoveredTargetChangeId,
          destinationDescription: dragInteraction.hoveredTargetDescription,
          descendants: dragInteraction.descendants,
        },
      }))
      return
    }

    this.setState((state) => ({
      ...state,
      dragInteraction: null,
      moveChanges: {
        phase: 'confirming',
        fromChangeId: dragInteraction.sourceChangeId,
        selectedPaths: dragInteraction.selectedPaths,
        toChangeId: dragInteraction.hoveredTargetChangeId,
        toDescription: dragInteraction.hoveredTargetDescription,
      },
    }))
  }

  private cancelDrag(): void {
    this.setState((state) => ({
      ...state,
      dragInteraction: null,
    }))
  }

  private updateOperationsResource(resource: OperationLogResource): void {
    this.setState((state) => ({
      ...state,
      resources: {
        ...state.resources,
        operations: resource,
      },
    }))
  }

  private trimRecentOperations(items: RecentOperation[]): RecentOperation[] {
    return items.slice(0, 12)
  }

  private createOperationKey(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  private startRecentOperation(
    kind: OperationKind,
    title: string,
    summary: string,
    details?: string,
  ): string {
    const key = this.createOperationKey()
    const operation: RecentOperation = {
      key,
      kind,
      title,
      summary,
      details,
      status: 'running',
      timestamp: new Date().toISOString(),
    }

    this.setState((state) => ({
      ...state,
      recentOperations: this.trimRecentOperations([operation, ...state.recentOperations]),
    }))

    return key
  }

  private finishRecentOperation(
    key: string,
    status: 'success' | 'failed',
    updates: Partial<RecentOperation> = {},
  ): void {
    this.setState((state) => ({
      ...state,
      recentOperations: this.trimRecentOperations(state.recentOperations.map((operation) => (
        operation.key === key
          ? {
              ...operation,
              ...updates,
              status,
              timestamp: updates.timestamp ?? new Date().toISOString(),
            }
          : operation
      ))),
    }))
  }

  private findLatestOperation(kind: UndoKind): RecentOperation | null {
    const targetKind = kind === 'rebase' ? 'rebase' : kind === 'moveChanges' ? null : 'fetch'
    if (kind === 'moveChanges') {
      return this.state.recentOperations.find((operation) => (
        operation.status === 'success'
        && ['move-changes', 'split', 'squash', 'discard-file'].includes(operation.kind)
        && !!operation.beforeOpId
      )) ?? null
    }

    if (!targetKind) return null

    return this.state.recentOperations.find((operation) => (
      operation.status === 'success'
      && operation.kind === targetKind
      && !!operation.beforeOpId
    )) ?? null
  }

  private async loadOperations(): Promise<void> {
    this.updateOperationsResource({
      status: 'loading',
      items: this.state.resources.operations.items,
    })

    try {
      const items = await this.api.loadOperations(this.cwd)
      if (this.disposed) return

      this.updateOperationsResource({
        status: 'ready',
        items,
      })
    } catch {
      if (this.disposed) return

      this.updateOperationsResource({
        status: 'ready',
        items: this.state.resources.operations.items,
      })
    }
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    if (!this.cwd) {
      this.setState((state) => ({
        ...state,
        appError: 'cwd query parameter is required. Usage: ?cwd=/path/to/repo',
      }))
      return
    }

    await this.refresh()
    if (this.disposed) return

    this.unsubscribeEvents = this.events.subscribe(this.cwd, () => {
      void this.refresh()
    })
  }

  private async refresh(): Promise<void> {
    if (!this.cwd) return

    const refreshToken = ++this.refreshToken

    try {
      const rows = await this.api.loadLog(this.cwd)
      if (this.disposed || refreshToken !== this.refreshToken) return

      const commitIds = new Set(
        rows
          .filter((row) => row.type === 'commit' && row.commit)
          .map((row) => row.commit!.changeId),
      )
      const moveSelectionDialog = isMoveChangesFileSelectDialog(this.state.dialog) ? this.state.dialog : null
      const expandedChangeIds = new Set(
        [...this.state.expandedChangeIds].filter((changeId) => commitIds.has(changeId)),
      )
      if (moveSelectionDialog && commitIds.has(moveSelectionDialog.changeId)) {
        expandedChangeIds.add(moveSelectionDialog.changeId)
      }
      const describingChangeId = this.state.describingChangeId && commitIds.has(this.state.describingChangeId)
        ? this.state.describingChangeId
        : null
      const keepMoveSelectionDialog = moveSelectionDialog && commitIds.has(moveSelectionDialog.changeId)

      this.fileRequests.clear()
      this.bookmarksRequest = null

      this.setState((state) => ({
        ...state,
        rows,
        appError: null,
        dialog: keepMoveSelectionDialog ? state.dialog : moveSelectionDialog ? null : state.dialog,
        errorBanner: keepMoveSelectionDialog || !moveSelectionDialog
          ? state.errorBanner
          : 'Move selection was cleared because the source commit disappeared.',
        expandedChangeIds,
        describingChangeId,
        resources: {
          ...state.resources,
          files: {},
          bookmarks: {
            status: 'idle',
            bookmarks: [],
          },
        },
      }))

      void this.loadOperations()

      for (const changeId of expandedChangeIds) {
        void this.loadChangedFiles(changeId, { silent: true })
      }

      if (describingChangeId) {
        void this.loadDescription(describingChangeId)
      }
    } catch (error) {
      if (this.disposed || refreshToken !== this.refreshToken) return
      this.setState((state) => ({
        ...state,
        appError: String(error),
      }))
    }
  }

  private updateDescriptionResource(changeId: string, resource: DescriptionResource): void {
    this.setState((state) => ({
      ...state,
      resources: {
        ...state.resources,
        descriptions: {
          ...state.resources.descriptions,
          [changeId]: resource,
        },
      },
    }))
  }

  private updateFileResource(changeId: string, resource: FileResource): void {
    this.setState((state) => ({
      ...state,
      resources: {
        ...state.resources,
        files: {
          ...state.resources.files,
          [changeId]: resource,
        },
      },
    }))
  }

  private setMoveChangesSelection(selectedPaths: string[]): void {
    this.setState((state) => {
      const dialog = isMoveChangesFileSelectDialog(state.dialog) ? state.dialog : null
      if (!dialog) return state

      const validPaths = new Set(dialog.files.map((file) => file.path))
      const nextSelectedPaths = Array.from(new Set(selectedPaths)).filter((path) => validPaths.has(path))

      return {
        ...state,
        dialog: {
          ...dialog,
          selectedPaths: nextSelectedPaths,
          notice: null,
        },
      }
    })
  }

  private reconcileMoveSelectionFiles(changeId: string, files: ChangedFile[]): void {
    this.setState((state) => {
      const dialog = isMoveChangesFileSelectDialog(state.dialog) ? state.dialog : null
      if (!dialog || dialog.changeId !== changeId) return state

      const validPaths = new Set(files.map((file) => file.path))
      const nextSelectedPaths = dialog.selectedPaths.filter((path) => validPaths.has(path))
      const removedCount = dialog.selectedPaths.length - nextSelectedPaths.length

      return {
        ...state,
        dialog: {
          ...dialog,
          files,
          selectedPaths: nextSelectedPaths,
          notice: removedCount > 0
            ? removedCount === 1
              ? '1 selected file is no longer part of this commit.'
              : `${removedCount} selected files are no longer part of this commit.`
            : null,
        },
      }
    })
  }

  private async loadDescription(changeId: string): Promise<string> {
    const existing = this.state.resources.descriptions[changeId]
    if (existing?.status === 'ready') return existing.value

    const inFlight = this.descriptionRequests.get(changeId)
    if (inFlight) return inFlight

    this.updateDescriptionResource(changeId, {
      status: 'loading',
      value: existing?.value ?? '',
    })

    const request = this.api.loadDescription(this.cwd, changeId)
      .catch(() => '')
      .then((value) => {
        this.descriptionRequests.delete(changeId)
        if (this.disposed) return value

        this.updateDescriptionResource(changeId, {
          status: 'ready',
          value,
        })

        return value
      })

    this.descriptionRequests.set(changeId, request)
    return request
  }

  private async loadChangedFiles(
    changeId: string,
    options: { silent: boolean },
  ): Promise<ChangedFile[]> {
    const existing = this.state.resources.files[changeId]
    if (existing?.status === 'ready') return existing.files

    const inFlight = this.fileRequests.get(changeId)
    if (inFlight) return inFlight

    this.updateFileResource(changeId, {
      status: 'loading',
      files: existing?.files ?? [],
    })

    const request = this.api.loadChangedFiles(this.cwd, changeId)
      .then((files) => {
        this.fileRequests.delete(changeId)
        if (this.disposed) return files

        this.updateFileResource(changeId, {
          status: 'ready',
          files,
        })
        this.reconcileMoveSelectionFiles(changeId, files)

        return files
      })
      .catch((error) => {
        this.fileRequests.delete(changeId)
        if (this.disposed) return []

        this.updateFileResource(changeId, {
          status: 'ready',
          files: [],
        })

        if (!options.silent) {
          throw error
        }

        return []
      })

    this.fileRequests.set(changeId, request)
    return request
  }

  private async loadBookmarks(): Promise<string[]> {
    if (this.state.resources.bookmarks.status === 'ready') {
      return this.state.resources.bookmarks.bookmarks
    }

    if (this.bookmarksRequest) return this.bookmarksRequest

    this.setState((state) => ({
      ...state,
      resources: {
        ...state.resources,
        bookmarks: {
          status: 'loading',
          bookmarks: state.resources.bookmarks.bookmarks,
        },
      },
    }))

    const request = this.api.loadBookmarks(this.cwd)
      .catch(() => [])
      .then((bookmarks) => {
        this.bookmarksRequest = null
        if (this.disposed) return bookmarks

        this.setState((state) => ({
          ...state,
          resources: {
            ...state.resources,
            bookmarks: {
              status: 'ready',
              bookmarks,
            },
          },
        }))

        return bookmarks
      })

    this.bookmarksRequest = request
    return request
  }

  private invalidateBookmarks(): void {
    this.bookmarksRequest = null
    this.setState((state) => ({
      ...state,
      resources: {
        ...state.resources,
        bookmarks: {
          status: 'idle',
          bookmarks: [],
        },
      },
    }))
  }

  private setErrorBanner(message: string | null): void {
    this.setState((state) => ({
      ...state,
      errorBanner: message,
    }))
  }

  private setPushingBookmark(bookmark: string, isPushing: boolean): void {
    this.setState((state) => {
      const next = new Set(state.pushingBookmarks)
      if (isPushing) next.add(bookmark)
      else next.delete(bookmark)
      return {
        ...state,
        pushingBookmarks: next,
      }
    })
  }

  private handleRowClick(changeId: string, description: string): void {
    if (this.state.dragInteraction) return

    if (this.state.rebase.phase === 'source-selected') {
      this.selectRebaseDestination(changeId, description)
      return
    }

    if (this.state.moveChanges.phase === 'selecting-destination') {
      this.selectMoveDestination(changeId, description)
      return
    }

    if (this.state.rebase.phase !== 'idle' || this.state.moveChanges.phase !== 'idle') return

    if (isMoveChangesFileSelectDialog(this.state.dialog) && this.state.dialog.changeId === changeId) {
      return
    }

    const expandedChangeIds = new Set(this.state.expandedChangeIds)
    const isExpanded = expandedChangeIds.has(changeId)

    if (isExpanded) {
      expandedChangeIds.delete(changeId)
    } else {
      expandedChangeIds.add(changeId)
      void this.loadChangedFiles(changeId, { silent: true })
    }

    this.setState((state) => ({
      ...state,
      expandedChangeIds,
    }))
  }

  private async edit(changeId: string): Promise<void> {
    this.setErrorBanner(null)
    try {
      await this.api.edit(this.cwd, changeId)
      await this.refresh()
    } catch (error) {
      this.setErrorBanner(String(error))
    }
  }

  private async createChild(changeId: string): Promise<void> {
    this.setErrorBanner(null)
    try {
      await this.api.createChild(this.cwd, changeId)
      await this.refresh()
    } catch (error) {
      this.setErrorBanner(String(error))
    }
  }

  private startDescribe(changeId: string): void {
    this.setState((state) => ({
      ...state,
      describingChangeId: changeId,
    }))
    void this.loadDescription(changeId)
  }

  private cancelDescribe(): void {
    this.setState((state) => ({
      ...state,
      describingChangeId: null,
    }))
  }

  private async saveDescription(changeId: string, message: string): Promise<void> {
    try {
      await this.api.describe(this.cwd, changeId, message)
      this.updateDescriptionResource(changeId, {
        status: 'ready',
        value: message,
      })
      this.setState((state) => ({
        ...state,
        describingChangeId: null,
      }))
      await this.refresh()
    } catch (error) {
      this.setErrorBanner(String(error))
    }
  }

  private async openBookmarkSet(changeId: string): Promise<void> {
    this.setState((state) => ({
      ...state,
      dialog: { kind: 'bookmark-set', changeId },
    }))
    await this.loadBookmarks()
  }

  private openBookmarkRename(name: string): void {
    this.setState((state) => ({
      ...state,
      dialog: { kind: 'bookmark-rename', bookmarkName: name },
    }))
  }

  private async submitBookmarkRename(newName: string): Promise<void> {
    const dialog = this.state.dialog
    if (!dialog || dialog.kind !== 'bookmark-rename') return

    try {
      await this.api.bookmarkRename(this.cwd, {
        oldName: dialog.bookmarkName,
        newName,
      })
      this.setState((state) => ({
        ...state,
        dialog: null,
      }))
      this.invalidateBookmarks()
      await this.refresh()
    } catch (error) {
      this.setErrorBanner(String(error))
    }
  }

  private async deleteBookmark(name: string): Promise<void> {
    try {
      await this.api.bookmarkDelete(this.cwd, name)
      this.invalidateBookmarks()
      await this.refresh()
    } catch (error) {
      this.setErrorBanner(String(error))
    }
  }

  private async submitBookmarkSet(name: string): Promise<void> {
    const dialog = this.state.dialog
    if (!dialog || dialog.kind !== 'bookmark-set') return

    try {
      const result = await this.api.bookmarkSet(this.cwd, {
        name,
        changeId: dialog.changeId,
        allowBackwards: false,
      })

      if (result.kind === 'requires-backwards-confirm') {
        this.setState((state) => ({
          ...state,
          dialog: {
            kind: 'confirm',
            confirmKind: 'bookmark-backwards',
            name: result.name,
            changeId: dialog.changeId,
          },
        }))
        return
      }

      this.setState((state) => ({
        ...state,
        dialog: null,
      }))
      this.invalidateBookmarks()
      await this.refresh()
    } catch (error) {
      this.setState((state) => ({
        ...state,
        dialog: null,
      }))
      this.setErrorBanner(String(error))
    }
  }

  private async startSplit(changeId: string): Promise<void> {
    this.setErrorBanner(null)
    try {
      const files = await this.loadChangedFiles(changeId, { silent: false })
      if (files.length === 0) {
        this.setErrorBanner('No files to split')
        return
      }

      this.setState((state) => ({
        ...state,
        dialog: { kind: 'file-select', mode: 'split', changeId, files },
      }))
    } catch (error) {
      this.setErrorBanner(String(error))
    }
  }

  private async startMoveChanges(changeId: string, initialSelectedPaths: string[] = []): Promise<void> {
    if (this.state.rebase.phase !== 'idle' || this.state.moveChanges.phase !== 'idle') return

    this.setErrorBanner(null)
    try {
      const files = await this.loadChangedFiles(changeId, { silent: false })
      if (files.length === 0) {
        this.setErrorBanner('No files to move')
        return
      }

      const filePaths = new Set(files.map((file) => file.path))
      const selectedPaths = Array.from(new Set(initialSelectedPaths)).filter((path) => filePaths.has(path))
      const expandedChangeIds = new Set(this.state.expandedChangeIds)
      expandedChangeIds.add(changeId)

      this.setState((state) => ({
        ...state,
        dialog: {
          kind: 'file-select',
          mode: 'move-changes',
          changeId,
          files,
          initialSelectedPaths: selectedPaths,
          selectedPaths,
          notice: null,
        },
        expandedChangeIds,
      }))
    } catch (error) {
      this.setErrorBanner(String(error))
    }
  }

  private async submitFileSelection(selectedPaths: string[]): Promise<void> {
    const dialog = this.state.dialog
    if (!dialog || dialog.kind !== 'file-select') return

    if (dialog.mode === 'split') {
      this.setState((state) => ({
        ...state,
        dialog: null,
      }))

      const remainPaths = dialog.files
        .filter((file) => !selectedPaths.includes(file.path))
        .map((file) => file.path)

      if (remainPaths.length === 0) {
        this.setErrorBanner('At least one file must remain in the original commit')
        return
      }

      this.setState((state) => ({
        ...state,
        moveChanges: {
          phase: 'executing',
          lastAction: 'split',
          fromChangeId: dialog.changeId,
          selectedPaths,
        },
      }))
      const operationKey = this.startRecentOperation(
        'split',
        'Splitting commit',
        `${dialog.changeId} (${selectedPaths.length} selected)`,
      )

      try {
        const result = await this.api.split(this.cwd, {
          changeId: dialog.changeId,
          paths: remainPaths,
        })

        this.setState((state) => ({
          ...state,
          moveChanges: {
            phase: 'idle',
            lastAction: 'split',
          },
        }))
        this.finishRecentOperation(operationKey, 'success', {
          summary: `${dialog.changeId} split into ${selectedPaths.length + 1} parts`,
          beforeOpId: result.beforeOpId,
          afterOpId: result.afterOpId,
        })
        await this.refresh()
      } catch (error) {
        this.setState((state) => ({
          ...state,
          moveChanges: idleMoveChangesState(),
        }))
        this.finishRecentOperation(operationKey, 'failed', {
          details: String(error),
        })
        this.setErrorBanner(String(error))
      }

      return
    }

    if (this.state.rebase.phase !== 'idle') return

    const validPaths = new Set(dialog.files.map((file) => file.path))
    const nextSelectedPaths = selectedPaths.filter((path) => validPaths.has(path))
    if (nextSelectedPaths.length === 0) {
      this.setErrorBanner('Select at least one file to move')
      return
    }

    this.setState((state) => ({
      ...state,
      dialog: null,
      moveChanges: {
        phase: 'selecting-destination',
        fromChangeId: dialog.changeId,
        selectedPaths: nextSelectedPaths,
      },
    }))
  }

  private startSquash(changeId: string, description: string, parentDescription: string): void {
    this.setState((state) => ({
      ...state,
      dialog: {
        kind: 'confirm',
        confirmKind: 'squash',
        changeId,
        description,
        parentDescription,
      },
    }))
  }

  private async startMoveSingleFile(changeId: string, path: string): Promise<void> {
    await this.startMoveChanges(changeId, [path])
  }

  private async discardFile(changeId: string, path: string): Promise<void> {
    this.setErrorBanner(null)
    this.setState((state) => ({
      ...state,
      moveChanges: {
        phase: 'executing',
        lastAction: 'discard-file',
        fromChangeId: changeId,
        selectedPaths: [path],
      },
    }))
    const operationKey = this.startRecentOperation(
      'discard-file',
      'Discarding file changes',
      `${path} from ${changeId}`,
    )

    try {
      const result = await this.api.discardFile(this.cwd, { changeId, path })
      this.setState((state) => ({
        ...state,
        moveChanges: {
          phase: 'idle',
          lastAction: 'discard-file',
          fromChangeId: changeId,
          selectedPaths: [path],
        },
      }))
      this.finishRecentOperation(operationKey, 'success', {
        beforeOpId: result.beforeOpId,
        afterOpId: result.afterOpId,
      })
      await this.refresh()
    } catch (error) {
      this.setState((state) => ({
        ...state,
        moveChanges: idleMoveChangesState(),
      }))
      this.finishRecentOperation(operationKey, 'failed', {
        details: String(error),
      })
      this.setErrorBanner(String(error))
    }
  }

  private startRebase(changeId: string, description: string): void {
    const descendants = getDescendants(changeId, buildChildrenMap(this.state.rows))
    this.setState((state) => ({
      ...state,
      rebase: {
        phase: 'source-selected',
        sourceChangeId: changeId,
        sourceDescription: description,
        descendants,
      },
    }))
  }

  private cancelRebase(): void {
    this.setState((state) => ({
      ...state,
      rebase: idleRebaseState(),
    }))
  }

  private selectRebaseDestination(changeId: string, description: string): void {
    if (this.state.rebase.phase !== 'source-selected') return

    const isSource = this.state.rebase.sourceChangeId === changeId
    const isDescendant = this.state.rebase.descendants?.has(changeId) ?? false
    if (isSource || isDescendant) return

    this.setState((state) => ({
      ...state,
      rebase: {
        ...state.rebase,
        phase: 'confirming',
        destinationChangeId: changeId,
        destinationDescription: description,
      },
    }))
  }

  private async confirmRebase(): Promise<void> {
    const { sourceChangeId, destinationChangeId } = this.state.rebase
    if (!sourceChangeId || !destinationChangeId) return

    this.setState((state) => ({
      ...state,
      rebase: {
        ...state.rebase,
        phase: 'executing',
      },
    }))
    const operationKey = this.startRecentOperation(
      'rebase',
      'Rebasing subtree',
      `${sourceChangeId} -> ${destinationChangeId}`,
    )

    try {
      const result = await this.api.rebase(this.cwd, {
        sourceChangeId,
        destinationChangeId,
        mode: 'source',
      })
      this.setState((state) => ({
        ...state,
        rebase: {
          phase: 'idle',
          lastAction: 'rebase',
        },
      }))
      this.finishRecentOperation(operationKey, 'success', {
        summary: `${sourceChangeId} -> ${destinationChangeId}`,
        beforeOpId: result.beforeOpId,
        afterOpId: result.afterOpId,
      })
      await this.refresh()
    } catch (error) {
      this.setState((state) => ({
        ...state,
        appError: String(error),
        rebase: idleRebaseState(),
      }))
      this.finishRecentOperation(operationKey, 'failed', {
        details: String(error),
      })
    }
  }

  private selectMoveDestination(changeId: string, description: string): void {
    if (this.state.moveChanges.phase !== 'selecting-destination') return
    if (this.state.moveChanges.fromChangeId === changeId) return

    this.setState((state) => ({
      ...state,
      moveChanges: {
        ...state.moveChanges,
        phase: 'confirming',
        toChangeId: changeId,
        toDescription: description,
      },
    }))
  }

  private cancelMoveChanges(): void {
    this.setState((state) => ({
      ...state,
      moveChanges: idleMoveChangesState(),
    }))
  }

  private async confirmMoveChanges(): Promise<void> {
    const { fromChangeId, toChangeId, selectedPaths } = this.state.moveChanges
    if (!fromChangeId || !toChangeId || !selectedPaths) return

    this.setState((state) => ({
      ...state,
      moveChanges: {
        ...state.moveChanges,
        phase: 'executing',
        lastAction: 'move-changes',
      },
    }))
    const operationKey = this.startRecentOperation(
      'move-changes',
      'Moving changes',
      `${fromChangeId} -> ${toChangeId} (${selectedPaths.length} files)`,
    )

    try {
      const result = await this.api.moveChanges(this.cwd, {
        fromChangeId,
        toChangeId,
        paths: selectedPaths,
      })
      this.setState((state) => ({
        ...state,
        moveChanges: {
          phase: 'idle',
          lastAction: 'move-changes',
        },
      }))
      this.finishRecentOperation(operationKey, 'success', {
        beforeOpId: result.beforeOpId,
        afterOpId: result.afterOpId,
      })
      await this.refresh()
    } catch (error) {
      this.setState((state) => ({
        ...state,
        moveChanges: idleMoveChangesState(),
      }))
      this.finishRecentOperation(operationKey, 'failed', {
        details: String(error),
      })
      this.setErrorBanner(String(error))
    }
  }

  private async undo(kind: UndoKind): Promise<void> {
    const operationId = this.findLatestOperation(kind)?.beforeOpId ?? undefined

    if (!operationId) return

    try {
      await this.restoreOperation(operationId)
    } catch (error) {
      if (kind === 'fetch') {
        this.setErrorBanner(String(error))
      } else {
        this.setState((state) => ({
          ...state,
          appError: String(error),
        }))
      }
    }
  }

  private async restoreOperation(operationId: string): Promise<void> {
    const matchedOperation = this.state.recentOperations.find((operation) => operation.beforeOpId === operationId)
    const operationKey = this.startRecentOperation(
      'restore',
      'Restoring operation',
      matchedOperation?.summary ?? operationId,
    )
    this.setErrorBanner(null)

    try {
      await this.api.undo(this.cwd, operationId)
      this.setState((state) => ({
        ...state,
        rebase: idleRebaseState(),
        moveChanges: idleMoveChangesState(),
        fetchState: idleFetchState(),
      }))
      this.finishRecentOperation(operationKey, 'success')
      await this.refresh()
    } catch (error) {
      this.finishRecentOperation(operationKey, 'failed', {
        details: String(error),
      })
      this.setErrorBanner(String(error))
    }
  }

  private async fetchAll(): Promise<void> {
    this.setState((state) => ({
      ...state,
      fetchState: { phase: 'executing' },
    }))
    const operationKey = this.startRecentOperation(
      'fetch',
      'Fetching remotes',
      'All remotes',
    )

    try {
      const result = await this.api.fetchAll(this.cwd)
      this.setState((state) => ({
        ...state,
        fetchState: {
          phase: 'idle',
          results: result.results,
          beforeOpId: result.beforeOpId,
        },
      }))
      const successCount = result.results.filter((item) => item.ok).length
      const failureCount = result.results.length - successCount
      this.finishRecentOperation(operationKey, failureCount === 0 ? 'success' : 'failed', {
        summary: result.results.length === 0
          ? 'No remotes configured'
          : `${successCount} succeeded, ${failureCount} failed`,
        details: result.results.map((item) => (
          `${item.ok ? 'OK' : 'FAIL'} ${item.remote}${item.output ? `\n${item.output}` : ''}`
        )).join('\n\n'),
        beforeOpId: result.beforeOpId,
        afterOpId: result.afterOpId,
      })
      await this.refresh()
    } catch (error) {
      this.setState((state) => ({
        ...state,
        fetchState: {
          phase: 'idle',
          results: [{ remote: 'fetch', ok: false, output: String(error) }],
          beforeOpId: null,
        },
      }))
      this.finishRecentOperation(operationKey, 'failed', {
        summary: 'Fetch failed',
        details: String(error),
      })
    }
  }

  private async startPushBookmark(bookmark: string): Promise<void> {
    await this.beginPush(bookmark, 'bookmark')
  }

  private startPushBookmarkSubtree(bookmark: string): void {
    this.setState((state) => ({
      ...state,
      dialog: {
        kind: 'confirm',
        confirmKind: 'subtree-push',
        bookmark,
      },
    }))
  }

  private async beginPush(bookmark: string, scope: PushScope): Promise<void> {
    try {
      const remotes = await this.api.loadRemotes(this.cwd)
      if (remotes.length === 0) {
        this.setState((state) => ({
          ...state,
          pushResult: { type: 'error', message: 'No remotes configured' },
        }))
        return
      }

      if (remotes.length === 1) {
        await this.push(bookmark, remotes[0], scope)
        return
      }

      this.setState((state) => ({
        ...state,
        dialog: { kind: 'remote-select', bookmark, remotes, scope },
      }))
    } catch (error) {
      this.setState((state) => ({
        ...state,
        pushResult: { type: 'error', message: String(error) },
      }))
    }
  }

  private async selectRemote(remote: string): Promise<void> {
    const dialog = this.state.dialog
    if (!dialog || dialog.kind !== 'remote-select') return

    this.setState((state) => ({
      ...state,
      dialog: null,
    }))
    await this.push(dialog.bookmark, remote, dialog.scope)
  }

  private async push(bookmark: string, remote: string, scope: PushScope): Promise<void> {
    this.setPushingBookmark(bookmark, true)
    this.setState((state) => ({
      ...state,
      pushResult: null,
    }))

    try {
      const { output } = await this.api.push(this.cwd, { bookmark, remote, scope })
      const feedback = interpretSuccessfulPush(output)
      const targetLabel = scope === 'subtree' ? `${bookmark} subtree` : bookmark

      this.setState((state) => ({
        ...state,
        pushResult: feedback.isUpToDate
          ? { type: 'info', message: `${targetLabel}: already up to date` }
          : {
              type: 'success',
              message: `${targetLabel} pushed to ${remote}`,
              reviewUrl: scope === 'bookmark' ? feedback.reviewUrl : null,
            },
      }))

      await this.refresh()
    } catch (error) {
      this.setState((state) => ({
        ...state,
        pushResult: { type: 'error', message: String(error) },
      }))
    } finally {
      this.setPushingBookmark(bookmark, false)
    }
  }

  private async confirmDialog(): Promise<void> {
    const dialog = this.state.dialog
    if (!dialog || dialog.kind !== 'confirm') return

    if (dialog.confirmKind === 'squash') {
      this.setState((state) => ({
        ...state,
        dialog: null,
        moveChanges: {
          phase: 'executing',
          lastAction: 'squash',
          fromChangeId: dialog.changeId,
        },
      }))
      const operationKey = this.startRecentOperation(
        'squash',
        'Squashing commit',
        `${dialog.changeId} into parent`,
      )

      try {
        const result = await this.api.squash(this.cwd, dialog.changeId)
        this.setState((state) => ({
          ...state,
          moveChanges: {
            phase: 'idle',
            lastAction: 'squash',
          },
        }))
        this.finishRecentOperation(operationKey, 'success', {
          beforeOpId: result.beforeOpId,
          afterOpId: result.afterOpId,
        })
        await this.refresh()
      } catch (error) {
        this.setState((state) => ({
          ...state,
          moveChanges: idleMoveChangesState(),
        }))
        this.finishRecentOperation(operationKey, 'failed', {
          details: String(error),
        })
        this.setErrorBanner(String(error))
      }
      return
    }

    if (dialog.confirmKind === 'subtree-push') {
      this.setState((state) => ({
        ...state,
        dialog: null,
      }))
      await this.beginPush(dialog.bookmark, 'subtree')
      return
    }

    if (dialog.confirmKind === 'bookmark-backwards') {
      try {
        const result = await this.api.bookmarkSet(this.cwd, {
          name: dialog.name,
          changeId: dialog.changeId,
          allowBackwards: true,
        })

        if (result.kind !== 'success') return

        this.setState((state) => ({
          ...state,
          dialog: null,
        }))
        this.invalidateBookmarks()
        await this.refresh()
      } catch (error) {
        this.setState((state) => ({
          ...state,
          dialog: null,
        }))
        this.setErrorBanner(String(error))
      }
    }
  }
}

export function createRepoApp(deps: {
  api: RepoApiPort
  events: RepoEventsPort
}): RepoApp {
  return {
    createSession(cwd) {
      return new RepoSessionImpl(cwd, deps.api, deps.events)
    },
  }
}

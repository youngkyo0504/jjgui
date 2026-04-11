import type { GraphRow } from '../types'
import type {
  ChangedFile,
  CommitFileContents,
  CommitFileDiff,
  FetchRemoteResult,
  OperationLogEntry,
  OperationResult,
  PushScope,
} from './types'

export interface BookmarkSetInput {
  name: string
  changeId: string
  allowBackwards: boolean
}

export type BookmarkSetResult =
  | { kind: 'success' }
  | { kind: 'requires-backwards-confirm'; name: string }

export interface FetchAllResult {
  beforeOpId: string | null
  afterOpId: string | null
  results: FetchRemoteResult[]
}

export interface RepoApiPort {
  loadLog(cwd: string): Promise<GraphRow[]>
  loadOperations(cwd: string): Promise<OperationLogEntry[]>
  loadDescription(cwd: string, changeId: string): Promise<string>
  loadChangedFiles(cwd: string, changeId: string): Promise<ChangedFile[]>
  loadCommitDiff(cwd: string, changeId: string, path: string): Promise<CommitFileDiff>
  loadCommitFileContent(cwd: string, changeId: string, path: string): Promise<CommitFileContents>
  loadBookmarks(cwd: string): Promise<string[]>
  loadRemotes(cwd: string): Promise<string[]>

  edit(cwd: string, changeId: string): Promise<void>
  createChild(cwd: string, changeId: string): Promise<void>
  describe(cwd: string, changeId: string, message: string): Promise<void>
  rebase(
    cwd: string,
    input: { sourceChangeId: string; destinationChangeId: string; mode: 'source' },
  ): Promise<OperationResult>
  undo(cwd: string, operationId: string): Promise<void>

  split(cwd: string, input: { changeId: string; paths: string[] }): Promise<OperationResult>
  squash(cwd: string, changeId: string): Promise<OperationResult>
  discardFile(cwd: string, input: { changeId: string; path: string }): Promise<OperationResult>
  moveChanges(
    cwd: string,
    input: { fromChangeId: string; toChangeId: string; paths: string[] },
  ): Promise<OperationResult>

  bookmarkRename(cwd: string, input: { oldName: string; newName: string }): Promise<void>
  bookmarkDelete(cwd: string, name: string): Promise<void>
  bookmarkSet(cwd: string, input: BookmarkSetInput): Promise<BookmarkSetResult>

  fetchAll(cwd: string): Promise<FetchAllResult>
  push(
    cwd: string,
    input: { bookmark: string; remote: string; scope: PushScope },
  ): Promise<{ output: string }>
}

export interface RepoEventsPort {
  subscribe(cwd: string, onRefresh: () => void): () => void
}

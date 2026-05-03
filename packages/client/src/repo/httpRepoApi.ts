import type { GraphRow } from '../types'
import type { RepoApiPort } from './ports'
import type {
  ChangedFile,
  CommitFileContents,
  CommitFileDiff,
  AbandonScope,
  FetchRemoteResult,
  OperationLogEntry,
  OperationResult,
  PushScope,
} from './types'

interface JsonObject {
  [key: string]: unknown
}

function buildUrl(path: string, cwd: string): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}cwd=${encodeURIComponent(cwd)}`
}

async function readResponseData(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function extractErrorMessage(res: Response, data: unknown): string {
  if (typeof data === 'string' && data.trim()) return data
  if (data && typeof data === 'object') {
    const error = (data as JsonObject).error
    if (typeof error === 'string' && error.trim()) return error
  }
  return `HTTP ${res.status}`
}

async function requestJson<T>(path: string, cwd: string, init?: RequestInit): Promise<T> {
  const res = await fetch(buildUrl(path, cwd), init)
  const data = await readResponseData(res)
  if (!res.ok) {
    throw new Error(extractErrorMessage(res, data))
  }
  return data as T
}

async function requestVoid(path: string, cwd: string, init?: RequestInit): Promise<void> {
  const res = await fetch(buildUrl(path, cwd), init)
  const data = await readResponseData(res)
  if (!res.ok) {
    throw new Error(extractErrorMessage(res, data))
  }
}

function jsonBody(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export function createHttpRepoApi(): RepoApiPort {
  return {
    loadLog(cwd) {
      return requestJson<GraphRow[]>('/api/log', cwd)
    },

    loadOperations(cwd) {
      return requestJson<OperationLogEntry[]>('/api/operations', cwd)
    },

    async loadDescription(cwd, changeId) {
      const data = await requestJson<{ description?: string }>(`/api/description/${changeId}`, cwd)
      return data.description === '(no description set)' ? '' : (data.description ?? '')
    },

    loadChangedFiles(cwd, changeId) {
      return requestJson<ChangedFile[]>(`/api/show/${changeId}`, cwd)
    },

    loadCommitDiff(cwd, changeId, path) {
      return requestJson<CommitFileDiff>(`/api/commit-diff/${changeId}?path=${encodeURIComponent(path)}`, cwd)
    },

    loadCommitFileContent(cwd, changeId, path) {
      return requestJson<CommitFileContents>(`/api/commit-file-content/${changeId}?path=${encodeURIComponent(path)}`, cwd)
    },

    async loadBookmarks(cwd) {
      const data = await requestJson<{ bookmarks?: string[] }>('/api/bookmarks', cwd)
      return data.bookmarks ?? []
    },

    async loadRemotes(cwd) {
      const data = await requestJson<{ remotes?: string[] }>('/api/remotes', cwd)
      return data.remotes ?? []
    },

    edit(cwd, changeId) {
      return requestVoid('/api/edit', cwd, jsonBody({ changeId }))
    },

    createChild(cwd, changeId) {
      return requestVoid('/api/new', cwd, jsonBody({ changeId }))
    },

    describe(cwd, changeId, message) {
      return requestVoid('/api/describe', cwd, jsonBody({ changeId, message }))
    },

    rebase(cwd, input) {
      return requestJson<OperationResult>('/api/rebase', cwd, jsonBody(input))
    },

    undo(cwd, operationId) {
      return requestVoid('/api/undo', cwd, jsonBody({ operationId }))
    },

    split(cwd, input) {
      return requestJson<OperationResult>('/api/split', cwd, jsonBody(input))
    },

    squash(cwd, changeId) {
      return requestJson<OperationResult>('/api/squash', cwd, jsonBody({ changeId }))
    },

    abandon(cwd, input: { changeId: string; scope: AbandonScope }) {
      return requestJson<OperationResult>('/api/abandon', cwd, jsonBody(input))
    },

    discardFile(cwd, input) {
      return requestJson<OperationResult>('/api/discard-file', cwd, jsonBody(input))
    },

    moveChanges(cwd, input) {
      return requestJson<OperationResult>('/api/move-changes', cwd, jsonBody(input))
    },

    bookmarkRename(cwd, input) {
      return requestVoid('/api/bookmark/rename', cwd, jsonBody(input))
    },

    bookmarkDelete(cwd, name) {
      return requestVoid('/api/bookmark/delete', cwd, jsonBody({ name }))
    },

    async bookmarkSet(cwd, input) {
      const res = await fetch(buildUrl('/api/bookmark/set', cwd), jsonBody(input))
      const data = await readResponseData(res)
      const ok = !!(data && typeof data === 'object' && (data as JsonObject).ok)

      if (ok) return { kind: 'success' } as const

      const message = extractErrorMessage(res, data)
      if (message.includes('backwards') || message.includes('sideways')) {
        return { kind: 'requires-backwards-confirm', name: input.name } as const
      }

      throw new Error(message)
    },

    async fetchAll(cwd) {
      const data = await requestJson<{ beforeOpId?: string | null; afterOpId?: string | null; results?: FetchRemoteResult[] }>('/api/fetch', cwd, {
        method: 'POST',
      })

      return {
        beforeOpId: data.beforeOpId ?? null,
        afterOpId: data.afterOpId ?? null,
        results: data.results ?? [],
      }
    },

    async push(cwd, input) {
      const res = await fetch(buildUrl('/api/push', cwd), jsonBody(input))
      const data = await readResponseData(res)

      if (!res.ok || !(data && typeof data === 'object' && (data as JsonObject).ok)) {
        throw new Error(extractErrorMessage(res, data))
      }

      return {
        output: typeof (data as JsonObject).output === 'string' ? (data as JsonObject).output as string : '',
      }
    },
  }
}

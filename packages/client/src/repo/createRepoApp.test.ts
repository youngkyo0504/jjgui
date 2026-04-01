import { createRepoApp } from './createRepoApp'
import type { RepoApiPort, RepoEventsPort } from './ports'
import type { GraphRow } from '../types'
import type { ChangedFile, FetchRemoteResult, PushScope } from './types'

function makeCommitRow(changeId: string, parents: string[] = []): GraphRow {
  return {
    type: 'commit',
    graphChars: '○',
    indent: 0,
    laneColors: ['#7aa2f7'],
    commit: {
      changeId,
      commitId: `${changeId}commit`,
      description: changeId,
      author: 'test@example.com',
      timestamp: '2026-04-04 10:00:00',
      workspaces: [],
      bookmarks: [],
      parents,
      isWorkingCopy: false,
      isImmutable: false,
      hasConflict: false,
      isEmpty: false,
      isHidden: false,
    },
  }
}

function createFakeEvents() {
  let onRefresh: (() => void) | null = null

  const events: RepoEventsPort = {
    subscribe(_cwd, callback) {
      onRefresh = callback
      return () => {
        onRefresh = null
      }
    },
  }

  return {
    events,
    emitRefresh() {
      onRefresh?.()
    },
  }
}

function createFakeApi(overrides: Partial<RepoApiPort> = {}): RepoApiPort {
  return {
    loadLog: async () => [],
    loadDescription: async () => '',
    loadChangedFiles: async () => [],
    loadBookmarks: async () => [],
    loadRemotes: async () => [],
    edit: async () => undefined,
    createChild: async () => undefined,
    describe: async () => undefined,
    rebase: async () => ({ beforeOpId: 'rebase-op' }),
    undo: async () => undefined,
    split: async () => ({ beforeOpId: 'split-op' }),
    squash: async () => ({ beforeOpId: 'squash-op' }),
    discardFile: async () => ({ beforeOpId: 'discard-op' }),
    moveChanges: async () => ({ beforeOpId: 'move-op' }),
    bookmarkRename: async () => undefined,
    bookmarkDelete: async () => undefined,
    bookmarkSet: async () => ({ kind: 'success' }),
    fetchAll: async () => ({ beforeOpId: null, results: [] }),
    push: async () => ({ output: '' }),
    ...overrides,
  }
}

test('initialize and SSE refresh both update rows through the session refresh path', async () => {
  const rows1 = [makeCommitRow('aaa')]
  const rows2 = [makeCommitRow('bbb')]
  let loadLogCalls = 0
  const events = createFakeEvents()
  const api = createFakeApi({
    loadLog: async () => {
      loadLogCalls++
      return loadLogCalls === 1 ? rows1 : rows2
    },
  })
  const session = createRepoApp({ api, events: events.events }).createSession('/repo')

  await session.commands.initialize()
  expect(session.getSnapshot().rows).toEqual(rows1)

  events.emitRefresh()
  await Bun.sleep(0)

  expect(session.getSnapshot().rows).toEqual(rows2)
  expect(loadLogCalls).toBe(2)
  session.dispose()
})

test('rebase flow computes descendants and ignores subtree destinations', async () => {
  const rows = [
    makeCommitRow('root'),
    makeCommitRow('source', ['root']),
    makeCommitRow('child', ['source']),
    makeCommitRow('leaf', ['child']),
    makeCommitRow('target', ['root']),
  ]
  const session = createRepoApp({
    api: createFakeApi({ loadLog: async () => rows }),
    events: createFakeEvents().events,
  }).createSession('/repo')

  await session.commands.initialize()
  session.commands.startRebase('source', 'source')

  const afterStart = session.getSnapshot()
  expect(afterStart.rebase.phase).toBe('source-selected')
  expect(afterStart.rebase.descendants?.has('child')).toBe(true)
  expect(afterStart.rebase.descendants?.has('leaf')).toBe(true)

  session.commands.selectRebaseDestination('child', 'child')
  expect(session.getSnapshot().rebase.phase).toBe('source-selected')

  session.commands.selectRebaseDestination('target', 'target')
  expect(session.getSnapshot().rebase.phase).toBe('confirming')
  expect(session.getSnapshot().rebase.destinationChangeId).toBe('target')
  session.dispose()
})

test('split validation stays at the boundary and prevents empty original commits', async () => {
  const files: ChangedFile[] = [
    { path: 'a.ts', status: 'A' },
    { path: 'b.ts', status: 'M' },
  ]
  let splitCalls = 0
  const session = createRepoApp({
    api: createFakeApi({
      loadChangedFiles: async () => files,
      split: async () => {
        splitCalls++
        return { beforeOpId: 'split-op' }
      },
    }),
    events: createFakeEvents().events,
  }).createSession('/repo')

  await session.commands.startSplit('source')
  expect(session.getSnapshot().dialog).toEqual({
    kind: 'file-select',
    mode: 'split',
    changeId: 'source',
    files,
  })

  await session.commands.submitFileSelection(['a.ts', 'b.ts'])
  expect(session.getSnapshot().errorBanner).toBe('At least one file must remain in the original commit')
  expect(splitCalls).toBe(0)
  session.dispose()
})

test('bookmark backwards confirmation is lifted into the app service dialog flow', async () => {
  const bookmarkSetCalls: Array<{ name: string; changeId: string; allowBackwards: boolean }> = []
  let loadLogCalls = 0
  const session = createRepoApp({
    api: createFakeApi({
      loadLog: async () => {
        loadLogCalls++
        return [makeCommitRow('source')]
      },
      loadBookmarks: async () => ['main'],
      bookmarkSet: async (cwd, input) => {
        bookmarkSetCalls.push(input)
        if (!input.allowBackwards) {
          return { kind: 'requires-backwards-confirm', name: input.name }
        }
        return { kind: 'success' }
      },
    }),
    events: createFakeEvents().events,
  }).createSession('/repo')

  await session.commands.initialize()
  await session.commands.openBookmarkSet('source')
  await session.commands.submitBookmarkSet('main')

  expect(session.getSnapshot().dialog).toEqual({
    kind: 'confirm',
    confirmKind: 'bookmark-backwards',
    name: 'main',
    changeId: 'source',
  })

  await session.commands.confirmDialog()

  expect(bookmarkSetCalls).toEqual([
    { name: 'main', changeId: 'source', allowBackwards: false },
    { name: 'main', changeId: 'source', allowBackwards: true },
  ])
  expect(session.getSnapshot().dialog).toBeNull()
  expect(loadLogCalls).toBe(2)
  session.dispose()
})

test('push flow opens remote selection when multiple remotes exist and stores success feedback', async () => {
  const pushCalls: Array<{ bookmark: string; remote: string; scope: PushScope }> = []
  const session = createRepoApp({
    api: createFakeApi({
      loadLog: async () => [makeCommitRow('source')],
      loadRemotes: async () => ['origin', 'backup'],
      push: async (cwd, input) => {
        pushCalls.push(input)
        return { output: 'pushed https://example.com/merge_requests/new' }
      },
    }),
    events: createFakeEvents().events,
  }).createSession('/repo')

  await session.commands.initialize()
  await session.commands.startPushBookmark('main')

  expect(session.getSnapshot().dialog).toEqual({
    kind: 'remote-select',
    bookmark: 'main',
    remotes: ['origin', 'backup'],
    scope: 'bookmark',
  })

  await session.commands.selectRemote('origin')

  expect(pushCalls).toEqual([{ bookmark: 'main', remote: 'origin', scope: 'bookmark' }])
  expect(session.getSnapshot().pushResult).toMatchObject({
    type: 'success',
    message: 'main pushed to origin',
    reviewUrl: 'https://example.com/merge_requests/new',
  })
  session.dispose()
})

test('fetch undo restores the recorded operation id', async () => {
  const undoCalls: string[] = []
  const fetchResults: FetchRemoteResult[] = [{ remote: 'origin', ok: true, output: 'done' }]
  const session = createRepoApp({
    api: createFakeApi({
      fetchAll: async () => ({ beforeOpId: 'fetch-op', results: fetchResults }),
      undo: async (_cwd, operationId) => {
        undoCalls.push(operationId)
      },
    }),
    events: createFakeEvents().events,
  }).createSession('/repo')

  await session.commands.fetchAll()
  expect(session.getSnapshot().fetchState.beforeOpId).toBe('fetch-op')
  expect(session.getSnapshot().fetchState.results).toEqual(fetchResults)

  await session.commands.undo('fetch')

  expect(undoCalls).toEqual(['fetch-op'])
  expect(session.getSnapshot().fetchState.phase).toBe('idle')
  session.dispose()
})

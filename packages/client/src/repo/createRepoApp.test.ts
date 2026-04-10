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
    loadOperations: async () => [],
    loadDescription: async () => '',
    loadChangedFiles: async () => [],
    loadBookmarks: async () => [],
    loadRemotes: async () => [],
    edit: async () => undefined,
    createChild: async () => undefined,
    describe: async () => undefined,
    rebase: async () => ({ beforeOpId: 'rebase-op', afterOpId: 'rebase-after' }),
    undo: async () => undefined,
    split: async () => ({ beforeOpId: 'split-op', afterOpId: 'split-after' }),
    squash: async () => ({ beforeOpId: 'squash-op', afterOpId: 'squash-after' }),
    discardFile: async () => ({ beforeOpId: 'discard-op', afterOpId: 'discard-after' }),
    moveChanges: async () => ({ beforeOpId: 'move-op', afterOpId: 'move-after' }),
    bookmarkRename: async () => undefined,
    bookmarkDelete: async () => undefined,
    bookmarkSet: async () => ({ kind: 'success' }),
    fetchAll: async () => ({ beforeOpId: null, afterOpId: null, results: [] }),
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
        return { beforeOpId: 'split-op', afterOpId: 'split-after' }
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

test('move single file starts inline selection with the clicked file preselected', async () => {
  const files: ChangedFile[] = [
    { path: 'a.ts', status: 'A' },
    { path: 'b.ts', status: 'M' },
  ]
  const session = createRepoApp({
    api: createFakeApi({
      loadLog: async () => [makeCommitRow('source'), makeCommitRow('target')],
      loadChangedFiles: async () => files,
    }),
    events: createFakeEvents().events,
  }).createSession('/repo')

  await session.commands.initialize()
  await session.commands.startMoveSingleFile('source', 'a.ts')

  expect(session.getSnapshot().moveChanges.phase).toBe('idle')
  expect(session.getSnapshot().expandedChangeIds.has('source')).toBe(true)
  expect(session.getSnapshot().dialog).toEqual({
    kind: 'file-select',
    mode: 'move-changes',
    changeId: 'source',
    files,
    initialSelectedPaths: ['a.ts'],
    selectedPaths: ['a.ts'],
    notice: null,
  })
  session.dispose()
})

test('inline move selection continues into destination flow and moves all selected files', async () => {
  const files: ChangedFile[] = [
    { path: 'a.ts', status: 'A' },
    { path: 'b.ts', status: 'M' },
  ]
  const moveCalls: Array<{ fromChangeId: string; toChangeId: string; paths: string[] }> = []
  const session = createRepoApp({
    api: createFakeApi({
      loadLog: async () => [makeCommitRow('source'), makeCommitRow('target')],
      loadChangedFiles: async () => files,
      moveChanges: async (_cwd, input) => {
        moveCalls.push(input)
        return { beforeOpId: 'move-op', afterOpId: 'move-after' }
      },
    }),
    events: createFakeEvents().events,
  }).createSession('/repo')

  await session.commands.initialize()
  await session.commands.startMoveSingleFile('source', 'a.ts')
  session.commands.setMoveChangesSelection(['a.ts', 'b.ts'])

  await session.commands.submitFileSelection(['a.ts', 'b.ts'])
  expect(session.getSnapshot().dialog).toBeNull()
  expect(session.getSnapshot().moveChanges).toMatchObject({
    phase: 'selecting-destination',
    fromChangeId: 'source',
    selectedPaths: ['a.ts', 'b.ts'],
  })

  session.commands.selectMoveDestination('target', 'target')
  expect(session.getSnapshot().moveChanges.phase).toBe('confirming')

  await session.commands.confirmMoveChanges()

  expect(moveCalls).toEqual([{
    fromChangeId: 'source',
    toChangeId: 'target',
    paths: ['a.ts', 'b.ts'],
  }])
  expect(session.getSnapshot().moveChanges).toEqual({
    phase: 'idle',
    lastAction: 'move-changes',
  })
  session.dispose()
})

test('cancelInteraction closes inline move selection without entering moveChanges mode', async () => {
  const files: ChangedFile[] = [{ path: 'a.ts', status: 'A' }]
  const session = createRepoApp({
    api: createFakeApi({
      loadLog: async () => [makeCommitRow('source')],
      loadChangedFiles: async () => files,
    }),
    events: createFakeEvents().events,
  }).createSession('/repo')

  await session.commands.initialize()
  await session.commands.startMoveSingleFile('source', 'a.ts')

  session.commands.cancelInteraction()

  expect(session.getSnapshot().dialog).toBeNull()
  expect(session.getSnapshot().moveChanges.phase).toBe('idle')
  session.dispose()
})

test('inline move selection survives refresh and removes paths that disappear', async () => {
  const events = createFakeEvents()
  let loadChangedFilesCalls = 0
  const session = createRepoApp({
    api: createFakeApi({
      loadLog: async () => [makeCommitRow('source'), makeCommitRow('target')],
      loadChangedFiles: async () => {
        loadChangedFilesCalls++
        return loadChangedFilesCalls === 1
          ? [
              { path: 'a.ts', status: 'A' },
              { path: 'b.ts', status: 'M' },
            ]
          : [
              { path: 'b.ts', status: 'M' },
            ]
      },
    }),
    events: events.events,
  }).createSession('/repo')

  await session.commands.initialize()
  await session.commands.startMoveSingleFile('source', 'a.ts')

  events.emitRefresh()
  await Bun.sleep(0)

  expect(session.getSnapshot().dialog).toEqual({
    kind: 'file-select',
    mode: 'move-changes',
    changeId: 'source',
    files: [{ path: 'b.ts', status: 'M' }],
    initialSelectedPaths: ['a.ts'],
    selectedPaths: [],
    notice: '1 selected file is no longer part of this commit.',
  })
  session.dispose()
})

test('refresh clears inline move selection if the source commit disappears', async () => {
  const events = createFakeEvents()
  let loadLogCalls = 0
  const session = createRepoApp({
    api: createFakeApi({
      loadLog: async () => {
        loadLogCalls++
        return loadLogCalls === 1
          ? [makeCommitRow('source'), makeCommitRow('target')]
          : [makeCommitRow('target')]
      },
      loadChangedFiles: async () => [{ path: 'a.ts', status: 'A' }],
    }),
    events: events.events,
  }).createSession('/repo')

  await session.commands.initialize()
  await session.commands.startMoveSingleFile('source', 'a.ts')

  events.emitRefresh()
  await Bun.sleep(0)

  expect(session.getSnapshot().dialog).toBeNull()
  expect(session.getSnapshot().errorBanner).toBe('Move selection was cleared because the source commit disappeared.')
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
      fetchAll: async () => ({ beforeOpId: 'fetch-op', afterOpId: 'fetch-after', results: fetchResults }),
      undo: async (_cwd, operationId) => {
        undoCalls.push(operationId)
      },
    }),
    events: createFakeEvents().events,
  }).createSession('/repo')

  await session.commands.fetchAll()
  expect(session.getSnapshot().fetchState.results).toEqual(fetchResults)

  await session.commands.undo('fetch')

  expect(undoCalls).toEqual(['fetch-op'])
  expect(session.getSnapshot().fetchState.phase).toBe('idle')
  session.dispose()
})

export interface CommitDiffRoute {
  view: 'commit-diff'
  changeId: string
  path?: string
}

export type AppRoute =
  | { view: 'log' }
  | CommitDiffRoute

const COMMIT_DIFF_STATE_KEY = '__visualJjCommitDiffEntry'

function stringifySearch(params: URLSearchParams): string {
  const search = params.toString()
  return search ? `?${search}` : ''
}

function buildUrl(search: string): string {
  return `${window.location.pathname}${search}${window.location.hash}`
}

function dispatchLocationChange(): void {
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function parseAppRoute(search: string): AppRoute {
  const params = new URLSearchParams(search)
  const view = params.get('view')
  const changeId = params.get('changeId')
  const path = params.get('path') ?? undefined

  if (view === 'commit-diff' && changeId) {
    return {
      view: 'commit-diff',
      changeId,
      path,
    }
  }

  return { view: 'log' }
}

export function buildCommitDiffSearch(
  currentSearch: string,
  input: { changeId: string; path?: string },
): string {
  const params = new URLSearchParams(currentSearch)
  params.set('view', 'commit-diff')
  params.set('changeId', input.changeId)

  if (input.path) {
    params.set('path', input.path)
  } else {
    params.delete('path')
  }

  return stringifySearch(params)
}

export function buildLogSearch(currentSearch: string): string {
  const params = new URLSearchParams(currentSearch)
  params.delete('view')
  params.delete('changeId')
  params.delete('path')
  return stringifySearch(params)
}

export function openCommitDiffRoute(changeId: string, path?: string): void {
  const search = buildCommitDiffSearch(window.location.search, { changeId, path })
  const nextState = {
    ...(window.history.state ?? {}),
    [COMMIT_DIFF_STATE_KEY]: true,
  }
  window.history.pushState(nextState, '', buildUrl(search))
  dispatchLocationChange()
}

export function replaceCommitDiffRoute(changeId: string, path?: string): void {
  const search = buildCommitDiffSearch(window.location.search, { changeId, path })
  const nextState = {
    ...(window.history.state ?? {}),
    [COMMIT_DIFF_STATE_KEY]: Boolean(window.history.state?.[COMMIT_DIFF_STATE_KEY]),
  }
  window.history.replaceState(nextState, '', buildUrl(search))
  dispatchLocationChange()
}

export function leaveCommitDiffRoute(): void {
  if (window.history.state?.[COMMIT_DIFF_STATE_KEY]) {
    window.history.back()
    return
  }

  const search = buildLogSearch(window.location.search)
  window.history.replaceState(null, '', buildUrl(search))
  dispatchLocationChange()
}

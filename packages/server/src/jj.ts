import { $ } from 'bun'

export interface CommitInfo {
  changeId: string
  commitId: string
  description: string
  author: string
  timestamp: string
  workspaces: string[]
  bookmarks: BookmarkRef[]
  parents: string[]
  isWorkingCopy: boolean
  isImmutable: boolean
  hasConflict: boolean
  isEmpty: boolean
  isHidden: boolean
}

export interface BookmarkRef {
  name: string
  remote: string | null
  displayName: string
  isRemote: boolean
}

export interface GraphRow {
  graphChars: string
  type: 'commit' | 'edge' | 'elided'
  indent: number
  laneColors?: string[]
  commit?: CommitInfo
}

export interface ChangedFile {
  path: string
  status: string
}

export interface RemoteFetchResult {
  remote: string
  ok: boolean
  output: string
}

export interface OperationResult {
  beforeOpId: string
  afterOpId: string
}

export interface OperationLogEntry {
  id: string
  user: string
  description: string
  timestamp: string
  isCurrent: boolean
}

export interface FetchAllRemotesResult {
  beforeOpId: string | null
  afterOpId: string | null
  results: RemoteFetchResult[]
}

export type PushScope = 'bookmark' | 'subtree'

const GRAPH_CHARS = new Set([
  '│', '○', '◆', '@', '~', '├', '╯', '─', '╰', '╮', '╭', '┤', '┬', '┴', '┼',
  ' ', '|', '*',
])

const LANE_COLORS = [
  '#7aa2f7', '#9ece6a', '#e0af68', '#f7768e',
  '#bb9af7', '#2ac3de', '#ff9e64', '#73daca',
]

const TEMPLATE = [
  'change_id.short()',
  '"\x1f"',
  'commit_id.short()',
  '"\x1f"',
  'description.first_line()',
  '"\x1f"',
  'author.email()',
  '"\x1f"',
  'committer.timestamp().local().format("%Y-%m-%d %H:%M:%S")',
  '"\x1f"',
  'working_copies',
  '"\x1f"',
  'local_bookmarks.map(|b| b.name()).join(" ")',
  '"\x1f"',
  'remote_bookmarks.map(|b| b.name()).join(" ")',
  '"\x1f"',
  'remote_bookmarks.map(|b| b.remote()).join(" ")',
  '"\x1f"',
  'parents.map(|p| p.change_id().short()).join(" ")',
  '"\x1f"',
  'immutable',
  '"\x1f"',
  'conflict',
  '"\x1f"',
  'empty',
  '"\x1f"',
  'if(hidden, "true", "false")',
].join(' ++ ')

const OP_LOG_TEMPLATE = 'self.id().short() ++ "\\0" ++ self.time().start().format("%Y-%m-%d %H:%M:%S") ++ "\\0" ++ self.user() ++ "\\0" ++ self.description().first_line() ++ "\\0" ++ if(self.current_operation(), "true", "false") ++ "\\n"'

function splitGraphAndData(line: string): { graphPrefix: string; data: string } {
  // commit 라인은 \x1f 구분자를 포함하므로, 첫 \x1f 앞의 changeId 시작 위치를 역추적
  const sepIdx = line.indexOf('\x1f')
  if (sepIdx !== -1) {
    // \x1f 앞에 changeId(알파벳)가 있고, 그 앞이 그래프 영역
    // changeId는 알파벳 소문자로만 구성되므로 알파벳이 시작되는 지점을 찾음
    let dataStart = sepIdx
    while (dataStart > 0 && /[a-z]/.test(line[dataStart - 1])) {
      dataStart--
    }
    return {
      graphPrefix: line.slice(0, dataStart),
      data: line.slice(dataStart),
    }
  }

  // edge/elided 라인: \x1f가 없으므로 기존 방식으로 그래프 문자 소비
  let i = 0
  while (i < line.length) {
    const codePoint = line.codePointAt(i)!
    const char = String.fromCodePoint(codePoint)
    const charLen = char.length

    if (GRAPH_CHARS.has(char)) {
      i += charLen
    } else {
      break
    }
  }
  return {
    graphPrefix: line.slice(0, i),
    data: line.slice(i),
  }
}

function parseCommitData(data: string, graphPrefix: string): CommitInfo {
  const fields = data.split('\x1f')
  const workspacesRaw = fields[5] ?? ''
  const localBookmarksRaw = fields[6] ?? ''
  const remoteBookmarkNamesRaw = fields[7] ?? ''
  const remoteBookmarkRemotesRaw = fields[8] ?? ''
  const parentsRaw = fields[9] ?? ''

  return {
    changeId: fields[0] ?? '',
    commitId: fields[1] ?? '',
    description: fields[2] ?? '',
    author: fields[3] ?? '',
    timestamp: fields[4] ?? '',
    workspaces: workspacesRaw ? workspacesRaw.split(/\s+/).filter((w) => w.endsWith('@')) : [],
    bookmarks: parseBookmarkRefs(localBookmarksRaw, remoteBookmarkNamesRaw, remoteBookmarkRemotesRaw),
    parents: parentsRaw ? parentsRaw.split(/\s+/).filter(Boolean) : [],
    isWorkingCopy: graphPrefix.includes('@'),
    isImmutable: graphPrefix.includes('◆'),
    hasConflict: fields[11] === 'true',
    isEmpty: fields[12] === 'true',
    isHidden: fields[13] === 'true',
  }
}

function parseBookmarkRefs(localBookmarksRaw: string, remoteBookmarkNamesRaw: string, remoteBookmarkRemotesRaw: string): BookmarkRef[] {
  const localBookmarks = localBookmarksRaw
    .split(/\s+/)
    .filter(Boolean)
    .map((name) => ({
      name,
      remote: null,
      displayName: name,
      isRemote: false,
    }))

  const remoteBookmarkNames = remoteBookmarkNamesRaw.split(/\s+/).filter(Boolean)
  const remoteBookmarkRemotes = remoteBookmarkRemotesRaw.split(/\s+/).filter(Boolean)
  const remoteBookmarks = remoteBookmarkNames.flatMap((name, index) => {
    const remote = remoteBookmarkRemotes[index] ?? null
    if (remote === 'git') {
      return []
    }

    return [{
      name,
      remote,
      displayName: remote ? `${name}@${remote}` : name,
      isRemote: true,
    }]
  })

  return [...localBookmarks, ...remoteBookmarks]
}

function computeIndent(graphPrefix: string): number {
  // Count leading spaces/graph chars to determine indent level
  let spaces = 0
  for (const ch of graphPrefix) {
    if (ch === ' ') spaces++
    else break
  }
  return spaces
}

function computeLaneColors(graphPrefix: string, laneColorMap: Map<number, string>, colorIdx: { val: number }): string[] {
  const colors: string[] = []
  let col = 0
  for (const ch of graphPrefix) {
    if (ch === ' ') {
      colors.push('')
      col++
    } else {
      if (!laneColorMap.has(col)) {
        laneColorMap.set(col, LANE_COLORS[colorIdx.val % LANE_COLORS.length])
        colorIdx.val++
      }
      colors.push(laneColorMap.get(col)!)
      col++
    }
  }
  return colors
}

export async function getGraphLog(cwd: string): Promise<GraphRow[]> {
  const result = await $`jj log --color never -T ${TEMPLATE}`.cwd(cwd).text()

  const rows: GraphRow[] = []
  const lines = result.split('\n')
  const laneColorMap = new Map<number, string>()
  const colorIdx = { val: 0 }

  for (const line of lines) {
    if (line === '') continue

    const { graphPrefix, data } = splitGraphAndData(line)
    const indent = computeIndent(graphPrefix)
    const laneColors = computeLaneColors(graphPrefix, laneColorMap, colorIdx)

    if (graphPrefix.includes('~')) {
      rows.push({ graphChars: graphPrefix, type: 'elided', indent, laneColors })
    } else if (data && data.includes('\x1f')) {
      const commit = parseCommitData(data, graphPrefix)
      rows.push({ graphChars: graphPrefix, type: 'commit', indent, laneColors, commit })
    } else {
      rows.push({ graphChars: graphPrefix, type: 'edge', indent, laneColors })
    }
  }

  return rows
}

export async function getChangedFiles(cwd: string, changeId: string): Promise<ChangedFile[]> {
  const result = await $`jj show ${changeId} --summary`.cwd(cwd).text()

  return result
    .split('\n')
    .filter((line) => /^[AMD]\s/.test(line))
    .map((line) => ({
      status: line[0],
      path: line.slice(2).trim(),
    }))
}

export async function editCommit(cwd: string, changeId: string): Promise<void> {
  await $`jj edit ${changeId}`.cwd(cwd)
}

export async function newCommit(cwd: string, changeId: string): Promise<void> {
  await $`jj new ${changeId}`.cwd(cwd)
}

export type RebaseMode = 'source' | 'revision' | 'branch'

function collectCommandOutput(stdout?: { toString(): string }, stderr?: { toString(): string }): string {
  return [stdout?.toString().trim(), stderr?.toString().trim()].filter(Boolean).join('\n')
}

function formatCommandError(e: any): string {
  return collectCommandOutput(e.stdout, e.stderr) || e.message || String(e)
}

/** 현재 최신 operation id를 가져온다 */
async function getCurrentOperationId(cwd: string): Promise<string> {
  const result = await $`jj --ignore-working-copy op log --no-graph -T 'self.id().short() ++ "\n"' --limit 1`.cwd(cwd).text()
  return result.trim()
}

async function captureOperationResult(cwd: string, operation: () => Promise<void>): Promise<OperationResult> {
  const beforeOpId = await getCurrentOperationId(cwd)
  await operation()
  const afterOpId = await getCurrentOperationId(cwd)
  return { beforeOpId, afterOpId }
}

export async function getOperationLog(cwd: string, limit = 30): Promise<OperationLogEntry[]> {
  const result = await $`jj --ignore-working-copy op log --no-graph -T ${OP_LOG_TEMPLATE} --limit ${String(limit)}`.cwd(cwd).text()

  return result
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [id = '', timestamp = '', user = '', description = '', isCurrent = 'false'] = line.split('\0')
      return {
        id,
        timestamp,
        user,
        description,
        isCurrent: isCurrent === 'true',
      }
    })
}

/** rebase 실행 후 이전/이후 operation id를 반환한다 */
export async function rebaseCommit(
  cwd: string,
  sourceChangeId: string,
  destinationChangeId: string,
  mode: RebaseMode = 'source',
) : Promise<OperationResult> {
  const flag = mode === 'source' ? '-s' : mode === 'revision' ? '-r' : '-b'
  return captureOperationResult(cwd, async () => {
    await $`jj rebase ${flag} ${sourceChangeId} -d ${destinationChangeId}`.cwd(cwd)
  })
}

/** 특정 operation 상태로 복원한다 */
export async function restoreOperation(cwd: string, operationId: string): Promise<void> {
  await $`jj op restore ${operationId}`.cwd(cwd)
}

/** 커밋의 전체 description을 가져온다 */
export async function getFullDescription(cwd: string, changeId: string): Promise<string> {
  const result = await $`jj log --no-graph -r ${changeId} -T 'description'`.cwd(cwd).text()
  return result.replace(/\n$/, '')
}

/** 커밋의 description을 변경한다 */
export async function describeCommit(cwd: string, changeId: string, message: string): Promise<void> {
  await $`jj describe ${changeId} -m ${message}`.cwd(cwd)
}

/** 북마크를 생성한다 */
export async function bookmarkCreate(cwd: string, name: string, changeId: string): Promise<void> {
  try {
    await $`jj bookmark create ${name} -r ${changeId}`.cwd(cwd).quiet()
  } catch (e: any) {
    throw new Error(e.stderr?.toString()?.trim() || e.message || String(e))
  }
}

/** 북마크를 이동한다 */
export async function bookmarkMove(cwd: string, name: string, destinationChangeId: string): Promise<string> {
  const beforeOpId = await getCurrentOperationId(cwd)
  await $`jj bookmark move ${name} --to ${destinationChangeId}`.cwd(cwd)
  return beforeOpId
}

/** 북마크를 삭제한다 */
export async function bookmarkDelete(cwd: string, name: string): Promise<void> {
  await $`jj bookmark delete ${name}`.cwd(cwd)
}

/** 북마크 이름을 변경한다 */
export async function bookmarkRename(cwd: string, oldName: string, newName: string): Promise<void> {
  await $`jj bookmark rename ${oldName} ${newName}`.cwd(cwd)
}

/** 커밋을 분할한다 (paths에 해당하는 파일이 첫 번째 커밋에 남음) */
export async function splitCommit(cwd: string, changeId: string, paths: string[]): Promise<OperationResult> {
  // 기존 description을 가져와서 -m으로 전달하여 에디터가 열리지 않도록 함
  const description = await $`jj log --no-graph -r ${changeId} -T 'description'`.cwd(cwd).text()
  const desc = description.replace(/\n$/, '') || '(split)'
  return captureOperationResult(cwd, async () => {
    try {
      await $`jj split -r ${changeId} -m ${desc} ${paths}`.cwd(cwd).quiet()
    } catch (e: any) {
      throw new Error(e.stderr?.toString()?.trim() || e.message || String(e))
    }
  })
}

/** 커밋을 부모로 합친다 */
export async function squashCommit(cwd: string, changeId: string): Promise<OperationResult> {
  return captureOperationResult(cwd, async () => {
    await $`jj squash -r ${changeId}`.cwd(cwd)
  })
}

/** 특정 파일의 변경만 현재 revision에서 제거한다 */
export async function discardFileChanges(cwd: string, changeId: string, path: string): Promise<OperationResult> {
  return captureOperationResult(cwd, async () => {
    await $`jj restore --changes-in ${changeId} --restore-descendants ${path}`.cwd(cwd).quiet()
  })
}

/** 변경사항을 다른 커밋으로 이동한다 */
export async function moveChanges(cwd: string, fromChangeId: string, toChangeId: string, paths: string[]): Promise<OperationResult> {
  return captureOperationResult(cwd, async () => {
    await $`jj squash --keep-emptied --from ${fromChangeId} --into ${toChangeId} ${paths}`.cwd(cwd)
  })
}

/** git remote 목록을 가져온다 */
export async function getRemotes(cwd: string): Promise<string[]> {
  const result = await $`jj --ignore-working-copy git remote list`.cwd(cwd).text()
  return result.split('\n').filter(Boolean).map((line) => line.split(/\s+/)[0])
}

/** 모든 remote를 순차적으로 fetch하고 remote별 결과를 반환한다 */
export async function fetchAllRemotes(cwd: string): Promise<FetchAllRemotesResult> {
  const remotes = await getRemotes(cwd)
  if (remotes.length === 0) {
    return { beforeOpId: null, afterOpId: null, results: [] }
  }

  const beforeOpId = await getCurrentOperationId(cwd)
  const results: RemoteFetchResult[] = []
  let anySuccess = false

  for (const remote of remotes) {
    try {
      const result = await $`jj git fetch --remote ${remote}`.cwd(cwd).quiet()
      results.push({
        remote,
        ok: true,
        output: collectCommandOutput(result.stdout, result.stderr),
      })
      anySuccess = true
    } catch (e: any) {
      results.push({
        remote,
        ok: false,
        output: formatCommandError(e),
      })
    }
  }

  return {
    beforeOpId: anySuccess ? beforeOpId : null,
    afterOpId: anySuccess ? await getCurrentOperationId(cwd) : null,
    results,
  }
}

/** 로컬 bookmark 목록을 가져온다 */
export async function bookmarkList(cwd: string): Promise<string[]> {
  const result = await $`jj bookmark list --template 'name ++ "\x1f" ++ remote ++ "\n"'`.cwd(cwd).text()
  const localBookmarks: string[] = []
  const seen = new Set<string>()

  for (const line of result.split('\n')) {
    if (!line) continue
    const [name, remote = ''] = line.split('\x1f')
    if (!name || remote || seen.has(name)) continue
    seen.add(name)
    localBookmarks.push(name)
  }

  return localBookmarks
}

/** bookmark을 설정한다 (존재하면 move, 없으면 create) */
export async function bookmarkSet(cwd: string, name: string, changeId: string, allowBackwards = false): Promise<void> {
  try {
    if (allowBackwards) {
      await $`jj bookmark set ${name} -r ${changeId} --allow-backwards`.cwd(cwd).quiet()
    } else {
      await $`jj bookmark set ${name} -r ${changeId}`.cwd(cwd).quiet()
    }
  } catch (e: any) {
    throw new Error(e.stderr?.toString()?.trim() || e.message || String(e))
  }
}

/** bookmark 또는 bookmark subtree를 git remote에 push한다 */
export async function pushBookmark(cwd: string, bookmark: string, remote: string, scope: PushScope = 'bookmark'): Promise<string> {
  const result = scope === 'subtree'
    ? await $`jj git push -r ${`${bookmark}::`} --remote ${remote}`.cwd(cwd).quiet()
    : await $`jj git push -b ${bookmark} --remote ${remote}`.cwd(cwd).quiet()

  return collectCommandOutput(result.stdout, result.stderr)
}

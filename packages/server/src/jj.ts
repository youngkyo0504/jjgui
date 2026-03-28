import { $ } from 'bun'

export interface CommitInfo {
  changeId: string
  commitId: string
  description: string
  author: string
  timestamp: string
  workspaces: string[]
  bookmarks: string[]
  parents: string[]
  isWorkingCopy: boolean
  isImmutable: boolean
  hasConflict: boolean
  isEmpty: boolean
  isHidden: boolean
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

const GRAPH_CHARS = new Set([
  '│', '○', '◆', '@', '~', '├', '╯', '─', '╰', '╮', '╭', '┤', '┬', '┴', '┼',
  ' ', '|', 'o', '*',
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
  'bookmarks',
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

function splitGraphAndData(line: string): { graphPrefix: string; data: string } {
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    // Multi-byte unicode chars: check the full character
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
  const bookmarksRaw = fields[6] ?? ''
  const parentsRaw = fields[7] ?? ''

  return {
    changeId: fields[0] ?? '',
    commitId: fields[1] ?? '',
    description: fields[2] ?? '',
    author: fields[3] ?? '',
    timestamp: fields[4] ?? '',
    workspaces: workspacesRaw ? workspacesRaw.split(/\s+/).filter((w) => w.endsWith('@')) : [],
    bookmarks: bookmarksRaw ? bookmarksRaw.split(/\s+/).filter(Boolean) : [],
    parents: parentsRaw ? parentsRaw.split(/\s+/).filter(Boolean) : [],
    isWorkingCopy: graphPrefix.includes('@'),
    isImmutable: graphPrefix.includes('◆'),
    hasConflict: fields[9] === 'true',
    isEmpty: fields[10] === 'true',
    isHidden: fields[11] === 'true',
  }
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

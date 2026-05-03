/**
 * Parse a graphChars string and laneColors array into the structured data
 * needed for SVG rendering.
 */

export type CellType = 'line' | 'node' | 'merge-up' | 'branch-down' | 'curve-right' | 'curve-left' | 'horizontal' | 'empty' | 'elided' | 'tee-right' | 'tee-left'
export type NodeType = 'normal' | 'working-copy' | 'immutable' | 'elided'

export interface GraphCell {
  type: CellType
  color: string
  nodeType?: NodeType
  horizontalColor?: string
  connectsUp?: boolean
  connectsDown?: boolean
}

export interface GraphParseContext {
  previousGraphChars?: string
  nextGraphChars?: string
}

const NODE_CHARS = new Set(['○', '@', '◆', '◉'])
const LINE_CHARS = new Set(['│', '┃', '|'])
const HORIZONTAL_CHARS = new Set(['─', '━', '╶', '╴', '╼', '╾'])
const ELIDED_CHARS = new Set(['~', '⋮'])
const SPACE_CHARS = new Set([' '])
const CONNECTOR_CHARS = new Set([
  ...NODE_CHARS,
  ...LINE_CHARS,
  ...ELIDED_CHARS,
  '├', '┤', '┬', '┴', '┼',
  '╯', '╰', '╮', '╭',
  '┘', '└', '┐', '┌',
])

function getNodeType(ch: string): NodeType {
  if (ch === '@') return 'working-copy'
  if (ch === '◆') return 'immutable'
  if (ch === '◉') return 'elided'
  return 'normal'
}

function findNearestColoredEndpoint(cells: GraphCell[], start: number, step: -1 | 1): GraphCell | null {
  for (let i = start + step; i >= 0 && i < cells.length; i += step) {
    const cell = cells[i]
    if (cell.type === 'empty' || cell.type === 'horizontal') continue
    if (cell.color) return cell
  }
  return null
}

function resolveHorizontalColor(cells: GraphCell[], index: number): string {
  const left = findNearestColoredEndpoint(cells, index, -1)
  const right = findNearestColoredEndpoint(cells, index, 1)

  if (left?.type === 'tee-right' && right?.color) return right.color
  if (right?.type === 'tee-left' && left?.color) return left.color

  if (right?.color && ['merge-up', 'curve-left', 'node'].includes(right.type)) {
    return right.color
  }
  if (left?.color && ['branch-down', 'curve-right', 'node'].includes(left.type)) {
    return left.color
  }

  return right?.color || left?.color || cells[index]?.color || ''
}

function resolveBranchArmColor(cells: GraphCell[], index: number, step: -1 | 1): string {
  const neighbor = cells[index + step]
  if (neighbor?.type === 'horizontal') {
    return resolveHorizontalColor(cells, index + step)
  }

  return findNearestColoredEndpoint(cells, index, step)?.color || cells[index]?.color || ''
}

function getGraphCharAt(graphChars: string | undefined, index: number): string | undefined {
  if (!graphChars) return undefined
  return [...graphChars][index]
}

function hasVerticalConnectionAt(graphChars: string | undefined, index: number): boolean {
  const ch = getGraphCharAt(graphChars, index)
  return !!ch && CONNECTOR_CHARS.has(ch)
}

function getNodeConnections(index: number, context?: GraphParseContext): Pick<GraphCell, 'connectsUp' | 'connectsDown'> {
  if (!context) return {}

  return {
    connectsUp: hasVerticalConnectionAt(context.previousGraphChars, index),
    connectsDown: hasVerticalConnectionAt(context.nextGraphChars, index),
  }
}

export function parseGraphChars(graphChars: string, laneColors: string[] = [], context?: GraphParseContext): GraphCell[] {
  const chars = [...graphChars]
  const cells: GraphCell[] = []
  let colorIdx = 0

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const color = laneColors[colorIdx] || ''
    colorIdx++

    if (NODE_CHARS.has(ch)) {
      cells.push({ type: 'node', color, nodeType: getNodeType(ch), ...getNodeConnections(i, context) })
    } else if (LINE_CHARS.has(ch)) {
      cells.push({ type: 'line', color })
    } else if (ch === '├' || ch === '┤') {
      // tee: vertical line plus horizontal branch
      cells.push({ type: ch === '├' ? 'tee-right' : 'tee-left', color })
    } else if (ch === '╯' || ch === '┘') {
      // Comes up from below and merges left.
      cells.push({ type: 'merge-up', color })
    } else if (ch === '╰' || ch === '└') {
      // Comes down from above and branches left.
      cells.push({ type: 'branch-down', color })
    } else if (ch === '╮' || ch === '┐') {
      // Comes from the left and curves down.
      cells.push({ type: 'curve-right', color })
    } else if (ch === '╭' || ch === '┌') {
      // Comes from the left and curves up.
      cells.push({ type: 'curve-left', color })
    } else if (HORIZONTAL_CHARS.has(ch)) {
      cells.push({ type: 'horizontal', color })
    } else if (ELIDED_CHARS.has(ch)) {
      cells.push({ type: 'elided', color })
    } else if (SPACE_CHARS.has(ch)) {
      cells.push({ type: 'empty', color: '' })
    } else {
      cells.push({ type: 'empty', color: '' })
    }
  }

  return cells.map((cell, index) => {
    if (cell.type === 'horizontal') {
      const color = resolveHorizontalColor(cells, index)
      return color && color !== cell.color ? { ...cell, color } : cell
    }

    if (cell.type === 'tee-right') {
      const horizontalColor = resolveBranchArmColor(cells, index, 1)
      return horizontalColor && horizontalColor !== cell.color ? { ...cell, horizontalColor } : cell
    }

    if (cell.type === 'tee-left') {
      const horizontalColor = resolveBranchArmColor(cells, index, -1)
      return horizontalColor && horizontalColor !== cell.color ? { ...cell, horizontalColor } : cell
    }

    return cell
  })
}

/**
 * graphChars 문자열 + laneColors 배열을 파싱하여
 * SVG 렌더링에 필요한 구조화된 데이터로 변환
 */

export type CellType = 'line' | 'node' | 'merge-up' | 'branch-down' | 'curve-right' | 'curve-left' | 'horizontal' | 'empty' | 'elided' | 'tee-right' | 'tee-left'
export type NodeType = 'normal' | 'working-copy' | 'immutable' | 'elided'

export interface GraphCell {
  type: CellType
  color: string
  nodeType?: NodeType
  horizontalColor?: string
}

const NODE_CHARS = new Set(['○', '@', '◆', '◉'])
const LINE_CHARS = new Set(['│', '┃', '|'])
const HORIZONTAL_CHARS = new Set(['─', '━', '╶', '╴', '╼', '╾'])
const ELIDED_CHARS = new Set(['~', '⋮'])
const SPACE_CHARS = new Set([' '])

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

export function parseGraphChars(graphChars: string, laneColors: string[] = []): GraphCell[] {
  const chars = [...graphChars]
  const cells: GraphCell[] = []
  let colorIdx = 0

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const color = laneColors[colorIdx] || ''
    colorIdx++

    if (NODE_CHARS.has(ch)) {
      cells.push({ type: 'node', color, nodeType: getNodeType(ch) })
    } else if (LINE_CHARS.has(ch)) {
      cells.push({ type: 'line', color })
    } else if (ch === '├' || ch === '┤') {
      // tee: 세로선 + 수평 분기
      cells.push({ type: ch === '├' ? 'tee-right' : 'tee-left', color })
    } else if (ch === '╯' || ch === '┘') {
      // 아래에서 올라와서 왼쪽으로 합류 (merge up-left)
      cells.push({ type: 'merge-up', color })
    } else if (ch === '╰' || ch === '└') {
      // 위에서 내려와서 왼쪽으로 분기 (branch down-left)
      cells.push({ type: 'branch-down', color })
    } else if (ch === '╮' || ch === '┐') {
      // 왼쪽에서 와서 아래로 내려감 (curve-right)
      cells.push({ type: 'curve-right', color })
    } else if (ch === '╭' || ch === '┌') {
      // 왼쪽에서 와서 위로 올라감 (curve-left)
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

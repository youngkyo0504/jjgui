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

  return cells
}

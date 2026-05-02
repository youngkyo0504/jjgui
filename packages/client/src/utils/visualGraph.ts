import { parseGraphChars, type GraphCell } from './graphCharParser'
import {
  GRAPH_DIAMOND_SIZE,
  GRAPH_LANE_WIDTH,
  GRAPH_NODE_RADIUS,
  GRAPH_STROKE_WIDTH,
} from './graphMetrics'

export interface VisualGraphRow {
  graphChars: string
  laneColors?: string[]
  previousGraphChars?: string
  nextGraphChars?: string
  lineOnly?: boolean
}

export interface VisualGraphRowLayout {
  top: number
  height: number
}

export interface VisualPath {
  id: string
  color: string
  d: string
}

export type VisualNodeKind = 'normal' | 'working-copy' | 'immutable' | 'elided'

export interface VisualNode {
  id: string
  row: number
  lane: number
  x: number
  y: number
  color: string
  kind: VisualNodeKind
}

export interface VisualElision {
  id: string
  row: number
  lane: number
  x: number
  y: number
  color: string
}

export interface VisualGraph {
  width: number
  height: number
  paths: VisualPath[]
  nodes: VisualNode[]
  elisions: VisualElision[]
}

function laneX(lane: number): number {
  return lane * GRAPH_LANE_WIDTH + GRAPH_LANE_WIDTH / 2
}

function addPath(pathsByColor: Map<string, string[]>, color: string, d: string): void {
  const key = color || ''
  const paths = pathsByColor.get(key) ?? []
  paths.push(d)
  pathsByColor.set(key, paths)
}

function addCellPaths(pathsByColor: Map<string, string[]>, cell: GraphCell, lane: number, top: number, height: number): void {
  const x = laneX(lane)
  const centerY = top + height / 2
  const bottom = top + height
  const left = lane * GRAPH_LANE_WIDTH
  const right = (lane + 1) * GRAPH_LANE_WIDTH

  switch (cell.type) {
    case 'line':
      addPath(pathsByColor, cell.color, `M ${x} ${top} L ${x} ${bottom}`)
      return
    case 'node': {
      const commands: string[] = []
      if (cell.connectsUp ?? true) {
        commands.push(`M ${x} ${top} L ${x} ${centerY - GRAPH_NODE_RADIUS}`)
      }
      if (cell.connectsDown ?? true) {
        commands.push(`M ${x} ${centerY + GRAPH_NODE_RADIUS} L ${x} ${bottom}`)
      }
      if (commands.length > 0) {
        addPath(pathsByColor, cell.color, commands.join(' '))
      }
      return
    }
    case 'tee-right':
      addPath(pathsByColor, cell.color, `M ${x} ${top} L ${x} ${bottom}`)
      addPath(pathsByColor, cell.horizontalColor ?? cell.color, `M ${x + GRAPH_STROKE_WIDTH} ${centerY} L ${right} ${centerY}`)
      return
    case 'tee-left':
      addPath(pathsByColor, cell.color, `M ${x} ${top} L ${x} ${bottom}`)
      addPath(pathsByColor, cell.horizontalColor ?? cell.color, `M ${left} ${centerY} L ${x - GRAPH_STROKE_WIDTH} ${centerY}`)
      return
    case 'merge-up':
      addPath(pathsByColor, cell.color, `M ${x} ${top} C ${x} ${top + height * 0.4}, ${x} ${centerY}, ${left} ${centerY}`)
      return
    case 'branch-down':
      addPath(pathsByColor, cell.color, `M ${x} ${bottom} C ${x} ${top + height * 0.6}, ${x} ${centerY}, ${left} ${centerY}`)
      return
    case 'curve-right':
      addPath(pathsByColor, cell.color, `M ${left} ${centerY} C ${x} ${centerY}, ${x} ${centerY}, ${x} ${bottom}`)
      return
    case 'curve-left':
      addPath(pathsByColor, cell.color, `M ${right} ${centerY} C ${x} ${centerY}, ${x} ${centerY}, ${x} ${bottom}`)
      return
    case 'horizontal':
      addPath(pathsByColor, cell.color, `M ${left} ${centerY} L ${right} ${centerY}`)
      return
    default:
      return
  }
}

function addLineOnlyCell(pathsByColor: Map<string, string[]>, cell: GraphCell, lane: number, top: number, height: number): void {
  if (cell.type !== 'line' && cell.type !== 'node' && cell.type !== 'tee-right' && cell.type !== 'tee-left') {
    return
  }
  if (cell.type === 'node' && cell.connectsDown === false) return

  const x = laneX(lane)
  addPath(pathsByColor, cell.color, `M ${x} ${top} L ${x} ${top + height}`)
}

function visualNodeKind(cell: GraphCell): VisualNodeKind {
  if (cell.nodeType === 'working-copy') return 'working-copy'
  if (cell.nodeType === 'immutable') return 'immutable'
  if (cell.nodeType === 'elided') return 'elided'
  return 'normal'
}

export function buildVisualGraph(rows: VisualGraphRow[], layouts: VisualGraphRowLayout[]): VisualGraph {
  const pathsByColor = new Map<string, string[]>()
  const nodes: VisualNode[] = []
  const elisions: VisualElision[] = []
  const width = Math.max(0, ...rows.map((row) => [...row.graphChars].length * GRAPH_LANE_WIDTH))
  const height = Math.max(0, ...layouts.map((layout) => layout.top + layout.height))

  rows.forEach((row, rowIndex) => {
    const layout = layouts[rowIndex]
    if (!layout) return

    const cells = parseGraphChars(row.graphChars, row.laneColors, {
      previousGraphChars: row.previousGraphChars ?? rows[rowIndex - 1]?.graphChars,
      nextGraphChars: row.nextGraphChars ?? rows[rowIndex + 1]?.graphChars,
    })

    cells.forEach((cell, lane) => {
      if (row.lineOnly) {
        addLineOnlyCell(pathsByColor, cell, lane, layout.top, layout.height)
        return
      }

      addCellPaths(pathsByColor, cell, lane, layout.top, layout.height)

      if (cell.type === 'node') {
        nodes.push({
          id: `node-${rowIndex}-${lane}`,
          row: rowIndex,
          lane,
          x: laneX(lane),
          y: layout.top + layout.height / 2,
          color: cell.color,
          kind: visualNodeKind(cell),
        })
      }

      if (cell.type === 'elided') {
        elisions.push({
          id: `elision-${rowIndex}-${lane}`,
          row: rowIndex,
          lane,
          x: laneX(lane),
          y: layout.top + layout.height / 2,
          color: cell.color,
        })
      }
    })
  })

  return {
    width,
    height,
    paths: [...pathsByColor.entries()].map(([color, commands], index) => ({
      id: `path-${index}`,
      color,
      d: commands.join(' '),
    })),
    nodes,
    elisions,
  }
}

export function visualNodeRadius(kind: VisualNodeKind): number {
  return kind === 'immutable' ? GRAPH_DIAMOND_SIZE : GRAPH_NODE_RADIUS
}

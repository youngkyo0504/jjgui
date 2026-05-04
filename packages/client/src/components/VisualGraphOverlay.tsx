import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import {
  buildVisualGraph,
  visualNodeRadius,
  type VisualGraphRow,
  type VisualGraphRowLayout,
  type VisualNode,
} from '../utils/visualGraph'
import {
  GRAPH_DIAMOND_SIZE,
  GRAPH_NODE_RADIUS,
  GRAPH_STROKE_WIDTH,
} from '../utils/graphMetrics'

interface Props {
  rows: VisualGraphRow[]
  containerRef: RefObject<HTMLDivElement>
}

interface Measurements {
  height: number
  layouts: VisualGraphRowLayout[]
}

function defaultColor(color: string): string {
  return color || 'var(--fg-dim)'
}

function equalMeasurements(a: Measurements, b: Measurements): boolean {
  if (a.height !== b.height || a.layouts.length !== b.layouts.length) return false
  return a.layouts.every((layout, index) => (
    layout.top === b.layouts[index].top && layout.height === b.layouts[index].height
  ))
}

function renderNode(node: VisualNode): React.ReactNode {
  const color = node.kind === 'working-copy' ? 'var(--green)' : defaultColor(node.color)

  if (node.kind === 'immutable') {
    const s = GRAPH_DIAMOND_SIZE
    return (
      <path
        key={node.id}
        d={`M ${node.x} ${node.y - s} L ${node.x + s} ${node.y} L ${node.x} ${node.y + s} L ${node.x - s} ${node.y} Z`}
        fill={color}
      />
    )
  }

  if (node.kind === 'working-copy') {
    return (
      <g key={node.id}>
        <circle cx={node.x} cy={node.y} r={GRAPH_NODE_RADIUS + 1.5} fill={color} />
        <circle cx={node.x} cy={node.y} r={2.25} fill="var(--bg)" />
      </g>
    )
  }

  return (
    <circle
      key={node.id}
      cx={node.x}
      cy={node.y}
      r={visualNodeRadius(node.kind)}
      fill={color}
    />
  )
}

export default function VisualGraphOverlay({ rows, containerRef }: Props) {
  const [measurements, setMeasurements] = useState<Measurements>({ height: 0, layouts: [] })

  const measure = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const graphRows = Array.from(container.querySelectorAll<HTMLElement>('.graph-row')).slice(0, rows.length)
    const next: Measurements = {
      height: Math.ceil(container.scrollHeight),
      layouts: graphRows.map((row) => {
        const rect = row.getBoundingClientRect()
        return {
          top: Math.round(rect.top - containerRect.top),
          height: Math.round(rect.height),
        }
      }),
    }

    setMeasurements((current) => equalMeasurements(current, next) ? current : next)
  }, [containerRef, rows.length])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    measure()

    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(container)
    const graphRows = Array.from(container.querySelectorAll<HTMLElement>('.graph-row')).slice(0, rows.length)
    graphRows.forEach((row) => resizeObserver.observe(row))

    const mutationObserver = new MutationObserver(measure)
    mutationObserver.observe(container, { childList: true, subtree: true, attributes: true })
    window.addEventListener('resize', measure)

    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [containerRef, measure, rows.length])

  const graph = useMemo(() => (
    measurements.layouts.length === rows.length
      ? buildVisualGraph(rows, measurements.layouts)
      : null
  ), [measurements.layouts, rows])

  if (!graph || graph.width === 0 || measurements.height === 0) return null

  return (
    <svg
      className="visual-graph-overlay"
      width={graph.width}
      height={measurements.height}
      viewBox={`0 0 ${graph.width} ${measurements.height}`}
      aria-hidden="true"
    >
      {graph.paths.map((path) => (
        <path
          key={path.id}
          d={path.d}
          fill="none"
          stroke={defaultColor(path.color)}
          strokeWidth={GRAPH_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {graph.elisions.map((elision) => (
        <g key={elision.id} opacity={0.55}>
          <circle cx={elision.x} cy={elision.y - 5} r={1.6} fill={defaultColor(elision.color)} />
          <circle cx={elision.x} cy={elision.y} r={1.6} fill={defaultColor(elision.color)} />
          <circle cx={elision.x} cy={elision.y + 5} r={1.6} fill={defaultColor(elision.color)} />
        </g>
      ))}
      {graph.nodes.map(renderNode)}
    </svg>
  )
}

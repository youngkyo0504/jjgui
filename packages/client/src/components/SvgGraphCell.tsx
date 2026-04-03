import React, { useRef, useEffect, useState, useCallback } from 'react'
import { parseGraphChars, type GraphCell } from '../utils/graphCharParser'

const LANE_WIDTH = 20
const NODE_RADIUS = 5
const DIAMOND_SIZE = 6
const STROKE_WIDTH = 2

interface Props {
  graphChars: string
  laneColors?: string[]
  lineOnly?: boolean
}

function defaultColor(color: string): string {
  return color || 'var(--fg-dim)'
}

function renderCell(cell: GraphCell, index: number, h: number): React.ReactNode {
  const cx = index * LANE_WIDTH + LANE_WIDTH / 2
  const color = defaultColor(cell.color)
  const cy = h / 2

  switch (cell.type) {
    case 'node': {
      if (cell.nodeType === 'immutable') {
        const s = DIAMOND_SIZE
        return (
          <g key={index}>
            <line x1={cx} y1={0} x2={cx} y2={cy - s} stroke={color} strokeWidth={STROKE_WIDTH} />
            <line x1={cx} y1={cy + s} x2={cx} y2={h} stroke={color} strokeWidth={STROKE_WIDTH} />
            <path d={`M${cx},${cy - s} L${cx + s},${cy} L${cx},${cy + s} L${cx - s},${cy} Z`} fill={color} />
          </g>
        )
      }
      if (cell.nodeType === 'working-copy') {
        const wcColor = 'var(--green)'
        return (
          <g key={index}>
            <line x1={cx} y1={0} x2={cx} y2={cy - NODE_RADIUS} stroke={wcColor} strokeWidth={STROKE_WIDTH} />
            <line x1={cx} y1={cy + NODE_RADIUS} x2={cx} y2={h} stroke={wcColor} strokeWidth={STROKE_WIDTH} />
            <circle cx={cx} cy={cy} r={NODE_RADIUS + 1} fill={wcColor} />
            <circle cx={cx} cy={cy} r={2} fill="var(--bg)" />
          </g>
        )
      }
      return (
        <g key={index}>
          <line x1={cx} y1={0} x2={cx} y2={cy - NODE_RADIUS} stroke={color} strokeWidth={STROKE_WIDTH} />
          <line x1={cx} y1={cy + NODE_RADIUS} x2={cx} y2={h} stroke={color} strokeWidth={STROKE_WIDTH} />
          <circle cx={cx} cy={cy} r={NODE_RADIUS} fill={color} />
        </g>
      )
    }

    case 'line':
      return <line key={index} x1={cx} y1={0} x2={cx} y2={h} stroke={color} strokeWidth={STROKE_WIDTH} />

    case 'tee-right':
      // ├: 세로선 + 오른쪽으로 수평 분기 (중간에서 오른쪽으로)
      return (
        <g key={index}>
          <line x1={cx} y1={0} x2={cx} y2={h} stroke={color} strokeWidth={STROKE_WIDTH} />
          <line
            x1={cx}
            y1={cy}
            x2={(index + 1) * LANE_WIDTH}
            y2={cy}
            stroke={defaultColor(cell.horizontalColor ?? cell.color)}
            strokeWidth={STROKE_WIDTH}
          />
        </g>
      )

    case 'tee-left':
      // ┤: 세로선 + 왼쪽으로 수평 분기
      return (
        <g key={index}>
          <line x1={cx} y1={0} x2={cx} y2={h} stroke={color} strokeWidth={STROKE_WIDTH} />
          <line
            x1={index * LANE_WIDTH}
            y1={cy}
            x2={cx}
            y2={cy}
            stroke={defaultColor(cell.horizontalColor ?? cell.color)}
            strokeWidth={STROKE_WIDTH}
          />
        </g>
      )

    case 'merge-up':
      // ╯: 위에서 내려와서 중간에서 왼쪽으로 꺾임 (위→왼쪽)
      return (
        <path key={index}
          d={`M${cx},0 C${cx},${cy * 0.8} ${cx},${cy} ${index * LANE_WIDTH},${cy}`}
          fill="none" stroke={color} strokeWidth={STROKE_WIDTH} />
      )

    case 'branch-down':
      // ╰: 아래에서 올라와서 중간에서 왼쪽으로 꺾임 (아래→왼쪽)
      return (
        <path key={index}
          d={`M${cx},${h} C${cx},${cy * 1.2} ${cx},${cy} ${index * LANE_WIDTH},${cy}`}
          fill="none" stroke={color} strokeWidth={STROKE_WIDTH} />
      )

    case 'curve-right':
      // ╮: 왼쪽에서 와서 아래로 내려감
      return (
        <path key={index}
          d={`M${index * LANE_WIDTH},${cy} C${cx},${cy} ${cx},${cy} ${cx},${h}`}
          fill="none" stroke={color} strokeWidth={STROKE_WIDTH} />
      )

    case 'curve-left':
      // ╭: 오른쪽에서 와서 아래로 내려감
      return (
        <path key={index}
          d={`M${(index + 1) * LANE_WIDTH},${cy} C${cx},${cy} ${cx},${cy} ${cx},${h}`}
          fill="none" stroke={color} strokeWidth={STROKE_WIDTH} />
      )

    case 'horizontal':
      return (
        <line key={index}
          x1={index * LANE_WIDTH} y1={cy} x2={(index + 1) * LANE_WIDTH} y2={cy}
          stroke={color} strokeWidth={STROKE_WIDTH} />
      )

    case 'elided': {
      return (
        <g key={index} opacity={0.5}>
          <circle cx={cx} cy={cy - 4} r={1.5} fill={color} />
          <circle cx={cx} cy={cy} r={1.5} fill={color} />
          <circle cx={cx} cy={cy + 4} r={1.5} fill={color} />
        </g>
      )
    }

    case 'empty':
    default:
      return null
  }
}

export default function SvgGraphCell({ graphChars, laneColors, lineOnly }: Props) {
  const cells = parseGraphChars(graphChars, laneColors)
  const width = cells.length * LANE_WIDTH
  const wrapRef = useRef<HTMLDivElement>(null)
  const [h, setH] = useState(28)

  const measure = useCallback(() => {
    const el = wrapRef.current?.parentElement
    if (el) setH(el.getBoundingClientRect().height)
  }, [])

  useEffect(() => {
    const el = wrapRef.current?.parentElement
    if (!el) return
    measure()
    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  if (width === 0) return <span className="graph-prefix" />

  return (
    <div ref={wrapRef} className="graph-svg-wrap" style={{ width }}>
      <svg className="graph-svg" width={width} height={h}>
        {lineOnly
          ? cells.map((cell, i) => {
              if (cell.type === 'line' || cell.type === 'node' || cell.type === 'tee-right' || cell.type === 'tee-left') {
                const cx = i * LANE_WIDTH + LANE_WIDTH / 2
                return <line key={i} x1={cx} y1={0} x2={cx} y2={h} stroke={defaultColor(cell.color)} strokeWidth={STROKE_WIDTH} />
              }
              return null
            })
          : cells.map((cell, i) => renderCell(cell, i, h))
        }
      </svg>
    </div>
  )
}

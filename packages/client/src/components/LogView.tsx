import { useMemo, useRef } from 'react'
import CommitRow from './CommitRow'
import EdgeRow from './EdgeRow'
import ElidedRow from './ElidedRow'
import VisualGraphOverlay from './VisualGraphOverlay'
import type { LogRowView } from '../repo/useRepoScreen'
import type { VisualGraphRow } from '../utils/visualGraph'

interface Props {
  rows: LogRowView[]
}

function buildVisualRows(rows: LogRowView[]): VisualGraphRow[] {
  const visualRows: VisualGraphRow[] = []

  for (const row of rows) {
    if (row.type !== 'commit') {
      visualRows.push({
        graphChars: row.graphChars,
        laneColors: row.laneColors,
        previousGraphChars: row.previousGraphChars,
        nextGraphChars: row.nextGraphChars,
      })
      continue
    }

    const commitRow = row.row
    const graphRow = {
      graphChars: commitRow.graphChars,
      laneColors: commitRow.laneColors,
      previousGraphChars: commitRow.previousGraphChars,
      nextGraphChars: commitRow.nextGraphChars,
    }

    visualRows.push(graphRow)
    if (commitRow.inlinePanel) visualRows.push({ ...graphRow, lineOnly: true })
    if (commitRow.state.showFileList) visualRows.push({ ...graphRow, lineOnly: true })
    if (commitRow.isDescribing) visualRows.push({ ...graphRow, lineOnly: true })
  }

  return visualRows
}

export default function LogView({ rows }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const visualRows = useMemo(() => buildVisualRows(rows), [rows])

  return (
    <div className="log-view" ref={ref}>
      <VisualGraphOverlay rows={visualRows} containerRef={ref} />
      {rows.map((row) => {
        if (row.type === 'commit') {
          return <CommitRow key={row.row.key} row={row.row} />
        }
        if (row.type === 'elided') {
          return (
            <ElidedRow
              key={row.key}
              graphChars={row.graphChars}
              laneColors={row.laneColors}
              previousGraphChars={row.previousGraphChars}
              nextGraphChars={row.nextGraphChars}
            />
          )
        }
        return (
          <EdgeRow
            key={row.key}
            graphChars={row.graphChars}
            laneColors={row.laneColors}
            previousGraphChars={row.previousGraphChars}
            nextGraphChars={row.nextGraphChars}
          />
        )
      })}
    </div>
  )
}

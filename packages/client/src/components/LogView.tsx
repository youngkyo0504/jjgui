import CommitRow from './CommitRow'
import EdgeRow from './EdgeRow'
import ElidedRow from './ElidedRow'
import type { LogRowView } from '../repo/useRepoScreen'

interface Props {
  rows: LogRowView[]
}

export default function LogView({ rows }: Props) {
  return (
    <div className="log-view">
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

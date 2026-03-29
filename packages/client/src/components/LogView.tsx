import CommitRow from './CommitRow'
import EdgeRow from './EdgeRow'
import ElidedRow from './ElidedRow'
import type { RebaseState } from '../App'

interface CommitInfo {
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

interface GraphRow {
  graphChars: string
  type: 'commit' | 'edge' | 'elided'
  indent: number
  laneColors?: string[]
  commit?: CommitInfo
}

interface Props {
  rows: GraphRow[]
  cwd: string
  rebase: RebaseState
  describingChangeId: string | null
  onRebaseStart: (changeId: string, description: string) => void
  onDestinationSelect: (changeId: string, description: string) => void
  onEdit: (changeId: string) => void
  onNew: (changeId: string) => void
  onDescribeStart: (changeId: string) => void
  onDescribeCancel: () => void
  onDescribeSave: (changeId: string, message: string) => void
}

export default function LogView({ rows, cwd, rebase, describingChangeId, onRebaseStart, onDestinationSelect, onEdit, onNew, onDescribeStart, onDescribeCancel, onDescribeSave }: Props) {
  return (
    <div className="log-view">
      {rows.map((row, i) => {
        if (row.type === 'commit' && row.commit) {
          return (
            <CommitRow
              key={`${row.commit.changeId}-${i}`}
              graphChars={row.graphChars}
              laneColors={row.laneColors}
              commit={row.commit}
              cwd={cwd}
              rebase={rebase}
              describingChangeId={describingChangeId}
              onRebaseStart={onRebaseStart}
              onDestinationSelect={onDestinationSelect}
              onEdit={onEdit}
              onNew={onNew}
              onDescribeStart={onDescribeStart}
              onDescribeCancel={onDescribeCancel}
              onDescribeSave={onDescribeSave}
            />
          )
        }
        if (row.type === 'elided') {
          return <ElidedRow key={`elided-${i}`} graphChars={row.graphChars} laneColors={row.laneColors} />
        }
        return <EdgeRow key={`edge-${i}`} graphChars={row.graphChars} laneColors={row.laneColors} />
      })}
    </div>
  )
}

import CommitRow from './CommitRow'
import EdgeRow from './EdgeRow'
import ElidedRow from './ElidedRow'
import type { RebaseState, MoveChangesState } from '../App'

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
  moveChanges: MoveChangesState
  describingChangeId: string | null
  onRebaseStart: (changeId: string, description: string) => void
  onDestinationSelect: (changeId: string, description: string) => void
  onMoveChangesDestinationSelect: (changeId: string, description: string) => void
  onEdit: (changeId: string) => void
  onNew: (changeId: string) => void
  onDescribeStart: (changeId: string) => void
  onDescribeCancel: () => void
  onDescribeSave: (changeId: string, message: string) => void
  onSetBookmark: (changeId: string) => void
  onBookmarkDelete: (name: string) => void
  onBookmarkRename: (name: string) => void
  onSplitStart: (changeId: string) => void
  onSquashStart: (changeId: string, description: string, parentDescription: string) => void
  onMoveChangesStart: (changeId: string) => void
  onPushBookmark: (bookmark: string) => void
  pushingBookmarks: Set<string>
}

export default function LogView({ rows, cwd, rebase, moveChanges, describingChangeId, onRebaseStart, onDestinationSelect, onMoveChangesDestinationSelect, onEdit, onNew, onDescribeStart, onDescribeCancel, onDescribeSave, onSetBookmark, onBookmarkDelete, onBookmarkRename, onSplitStart, onSquashStart, onMoveChangesStart, onPushBookmark, pushingBookmarks }: Props) {
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
              moveChanges={moveChanges}
              describingChangeId={describingChangeId}
              onRebaseStart={onRebaseStart}
              onDestinationSelect={onDestinationSelect}
              onMoveChangesDestinationSelect={onMoveChangesDestinationSelect}
              onEdit={onEdit}
              onNew={onNew}
              onDescribeStart={onDescribeStart}
              onDescribeCancel={onDescribeCancel}
              onDescribeSave={onDescribeSave}
              onSetBookmark={onSetBookmark}
              onBookmarkDelete={onBookmarkDelete}
              onBookmarkRename={onBookmarkRename}
              onSplitStart={onSplitStart}
              onSquashStart={onSquashStart}
              onMoveChangesStart={onMoveChangesStart}
              onPushBookmark={onPushBookmark}
              pushingBookmarks={pushingBookmarks}
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

import CommitRow from './CommitRow'
import EdgeRow from './EdgeRow'
import ElidedRow from './ElidedRow'
import type { RebaseState, MoveChangesState } from '../App'
import type { GraphRow } from '../types'

interface Props {
  rows: GraphRow[]
  cwd: string
  logRefreshKey: number
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
  onMoveSingleFile: (changeId: string, path: string) => void
  onDiscardFile: (changeId: string, path: string) => void
  onPushBookmark: (bookmark: string) => void
  onPushBookmarkSubtree: (bookmark: string) => void
  pushingBookmarks: Set<string>
  showRemoteBookmarks: boolean
}

export default function LogView({ rows, cwd, logRefreshKey, rebase, moveChanges, describingChangeId, onRebaseStart, onDestinationSelect, onMoveChangesDestinationSelect, onEdit, onNew, onDescribeStart, onDescribeCancel, onDescribeSave, onSetBookmark, onBookmarkDelete, onBookmarkRename, onSplitStart, onSquashStart, onMoveChangesStart, onMoveSingleFile, onDiscardFile, onPushBookmark, onPushBookmarkSubtree, pushingBookmarks, showRemoteBookmarks }: Props) {
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
              logRefreshKey={logRefreshKey}
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
              onMoveSingleFile={onMoveSingleFile}
              onDiscardFile={onDiscardFile}
              onPushBookmark={onPushBookmark}
              onPushBookmarkSubtree={onPushBookmarkSubtree}
              pushingBookmarks={pushingBookmarks}
              showRemoteBookmarks={showRemoteBookmarks}
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

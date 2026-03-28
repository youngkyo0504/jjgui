import React from 'react'
import GraphLine from './GraphLine'

interface Props {
  graphChars: string
  laneColors?: string[]
}

export default function ElidedRow({ graphChars, laneColors }: Props) {
  return (
    <div className="graph-row">
      <GraphLine graphChars={graphChars} laneColors={laneColors} />
      <span className="elided-data">(elided revisions)</span>
    </div>
  )
}

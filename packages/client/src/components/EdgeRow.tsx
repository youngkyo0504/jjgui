import React from 'react'
import GraphLine from './GraphLine'

interface Props {
  graphChars: string
  laneColors?: string[]
}

export default function EdgeRow({ graphChars, laneColors }: Props) {
  return (
    <div className="graph-row">
      <GraphLine graphChars={graphChars} laneColors={laneColors} />
    </div>
  )
}

import React from 'react'
import GraphSlot from './GraphSlot'

interface Props {
  graphChars: string
  laneColors?: string[]
  previousGraphChars?: string
  nextGraphChars?: string
}

export default function ElidedRow({ graphChars }: Props) {
  return (
    <div className="graph-row">
      <GraphSlot graphChars={graphChars} />
      <span className="elided-data">(elided revisions)</span>
    </div>
  )
}

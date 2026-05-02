import React from 'react'
import GraphSlot from './GraphSlot'

interface Props {
  graphChars: string
  laneColors?: string[]
  previousGraphChars?: string
  nextGraphChars?: string
}

export default function EdgeRow({ graphChars }: Props) {
  return (
    <div className="graph-row">
      <GraphSlot graphChars={graphChars} />
    </div>
  )
}

import React from 'react'
import SvgGraphCell from './SvgGraphCell'

interface Props {
  graphChars: string
  laneColors?: string[]
}

export default function ElidedRow({ graphChars, laneColors }: Props) {
  return (
    <div className="graph-row">
      <SvgGraphCell graphChars={graphChars} laneColors={laneColors} />
      <span className="elided-data">(elided revisions)</span>
    </div>
  )
}

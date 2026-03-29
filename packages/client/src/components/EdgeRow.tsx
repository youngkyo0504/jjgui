import React from 'react'
import SvgGraphCell from './SvgGraphCell'

interface Props {
  graphChars: string
  laneColors?: string[]
}

export default function EdgeRow({ graphChars, laneColors }: Props) {
  return (
    <div className="graph-row">
      <SvgGraphCell graphChars={graphChars} laneColors={laneColors} />
    </div>
  )
}

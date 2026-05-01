import React from 'react'
import SvgGraphCell from './SvgGraphCell'

interface Props {
  graphChars: string
  laneColors?: string[]
  previousGraphChars?: string
  nextGraphChars?: string
}

export default function ElidedRow({ graphChars, laneColors, previousGraphChars, nextGraphChars }: Props) {
  return (
    <div className="graph-row">
      <SvgGraphCell
        graphChars={graphChars}
        laneColors={laneColors}
        previousGraphChars={previousGraphChars}
        nextGraphChars={nextGraphChars}
      />
      <span className="elided-data">(elided revisions)</span>
    </div>
  )
}

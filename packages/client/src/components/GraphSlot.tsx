import { graphColumnWidth } from '../utils/graphMetrics'

interface Props {
  graphChars: string
}

export default function GraphSlot({ graphChars }: Props) {
  return (
    <div
      className="graph-svg-wrap graph-svg-wrap--slot"
      style={{ width: graphColumnWidth(graphChars) }}
    />
  )
}

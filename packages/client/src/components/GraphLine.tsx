import React from 'react'

interface Props {
  graphChars: string
  laneColors?: string[]
}

export default function GraphLine({ graphChars, laneColors }: Props) {
  if (!laneColors || laneColors.length === 0) {
    return <span className="graph-prefix">{graphChars}</span>
  }

  // Render each character with its lane color
  const chars = [...graphChars]
  const elements: React.ReactNode[] = []

  let colorIdx = 0
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const color = laneColors[colorIdx] || ''
    colorIdx++

    if (color) {
      elements.push(
        <span key={i} style={{ color }}>{ch}</span>
      )
    } else {
      elements.push(<span key={i}>{ch}</span>)
    }
  }

  return <span className="graph-prefix">{elements}</span>
}

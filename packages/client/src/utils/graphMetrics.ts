export const GRAPH_LANE_WIDTH = 20
export const GRAPH_NODE_RADIUS = 6
export const GRAPH_DIAMOND_SIZE = 7
export const GRAPH_STROKE_WIDTH = 2.5

export function graphColumnWidth(graphChars: string): number {
  return [...graphChars].length * GRAPH_LANE_WIDTH
}

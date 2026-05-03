interface CommitInfo {
  changeId: string
  parents: string[]
}

interface GraphRow {
  type: 'commit' | 'edge' | 'elided'
  commit?: CommitInfo
}

/**
 * Build a reverse parent-to-children map from GraphRow entries.
 * key: parentChangeId, value: childChangeId[]
 */
export function buildChildrenMap(rows: GraphRow[]): Map<string, string[]> {
  const map = new Map<string, string[]>()

  for (const row of rows) {
    if (row.type !== 'commit' || !row.commit) continue
    const { changeId, parents } = row.commit
    for (const parentId of parents) {
      const children = map.get(parentId)
      if (children) {
        children.push(changeId)
      } else {
        map.set(parentId, [changeId])
      }
    }
  }

  return map
}

/**
 * Calculate all descendants of a commit with BFS.
 * The source commit itself is not included.
 */
export function getDescendants(changeId: string, childrenMap: Map<string, string[]>): Set<string> {
  const descendants = new Set<string>()
  const queue = childrenMap.get(changeId) ?? []

  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]
    if (descendants.has(id)) continue
    descendants.add(id)
    const children = childrenMap.get(id)
    if (children) {
      for (const child of children) {
        queue.push(child)
      }
    }
  }

  return descendants
}

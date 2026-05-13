interface CommitInfo {
  changeId: string
  parents: string[]
  isWorkingCopy?: boolean
  isImmutable?: boolean
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

/**
 * Build a set of changeIds where "abandon subtree" should be disabled.
 * A commit is disabled if it or any of its descendants is a working copy or immutable.
 * Uses reverse-direction BFS from blockers: O(N) instead of O(N²).
 */
export function buildSubtreeAbandonDisabledSet(rows: GraphRow[]): Set<string> {
  const parentMap = new Map<string, string[]>()
  const queue: string[] = []

  for (const row of rows) {
    if (row.type !== 'commit' || !row.commit) continue
    const { changeId, parents, isWorkingCopy, isImmutable } = row.commit
    parentMap.set(changeId, parents)
    if (isWorkingCopy || isImmutable) {
      queue.push(changeId)
    }
  }

  const disabled = new Set<string>()
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]
    if (disabled.has(id)) continue
    disabled.add(id)
    const parents = parentMap.get(id) ?? []
    for (const parentId of parents) {
      queue.push(parentId)
    }
  }

  return disabled
}

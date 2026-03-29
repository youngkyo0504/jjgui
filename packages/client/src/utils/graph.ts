interface CommitInfo {
  changeId: string
  parents: string[]
}

interface GraphRow {
  type: 'commit' | 'edge' | 'elided'
  commit?: CommitInfo
}

/**
 * GraphRow 배열에서 parent → children 역방향 맵을 구축한다.
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
 * 특정 커밋의 모든 descendants를 BFS로 계산한다.
 * source 자신은 포함하지 않는다.
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

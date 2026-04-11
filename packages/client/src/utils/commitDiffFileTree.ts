import type { ChangedFile } from '../repo/types'

export interface CommitDiffFolderNode {
  kind: 'folder'
  name: string
  path: string
  children: CommitDiffTreeNode[]
}

export interface CommitDiffFileNode {
  kind: 'file'
  name: string
  path: string
  file: ChangedFile
}

export type CommitDiffTreeNode = CommitDiffFolderNode | CommitDiffFileNode

interface MutableFolderNode {
  kind: 'folder'
  name: string
  path: string
  folders: Map<string, MutableFolderNode>
  files: CommitDiffFileNode[]
}

function createFolderNode(name: string, path: string): MutableFolderNode {
  return {
    kind: 'folder',
    name,
    path,
    folders: new Map(),
    files: [],
  }
}

function sortByName<T extends { name: string }>(left: T, right: T): number {
  return left.name.localeCompare(right.name)
}

function freezeFolder(node: MutableFolderNode): CommitDiffFolderNode {
  const folders = [...node.folders.values()].sort(sortByName).map(freezeFolder)
  const files = [...node.files].sort((left, right) => left.path.localeCompare(right.path))

  return {
    kind: 'folder',
    name: node.name,
    path: node.path,
    children: [...folders, ...files],
  }
}

export function buildCommitDiffFileTree(files: ChangedFile[]): CommitDiffTreeNode[] {
  const root = createFolderNode('', '')

  for (const file of files) {
    const segments = file.path.split('/').filter(Boolean)
    if (segments.length === 0) continue

    let current = root
    let currentPath = ''

    for (const segment of segments.slice(0, -1)) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      const existing = current.folders.get(segment)
      if (existing) {
        current = existing
        continue
      }

      const next = createFolderNode(segment, currentPath)
      current.folders.set(segment, next)
      current = next
    }

    const name = segments[segments.length - 1]
    current.files.push({
      kind: 'file',
      name,
      path: file.path,
      file,
    })
  }

  return freezeFolder(root).children
}

export function collectFolderPaths(nodes: CommitDiffTreeNode[]): string[] {
  const result: string[] = []

  function visit(node: CommitDiffTreeNode): void {
    if (node.kind !== 'folder') return
    result.push(node.path)
    node.children.forEach(visit)
  }

  nodes.forEach(visit)
  return result
}

export function getAncestorFolderPaths(path: string): string[] {
  const segments = path.split('/').filter(Boolean)
  const ancestors: string[] = []

  for (let index = 0; index < segments.length - 1; index += 1) {
    ancestors.push(segments.slice(0, index + 1).join('/'))
  }

  return ancestors
}

import { expect, test } from 'bun:test'
import type { ChangedFile } from '../repo/types'
import {
  buildCommitDiffFileTree,
  collectFolderPaths,
  getAncestorFolderPaths,
} from './commitDiffFileTree'

const files: ChangedFile[] = [
  { path: 'README.md', status: 'M', isConflict: false },
  { path: 'packages/client/src/App.tsx', status: 'M', isConflict: false },
  { path: 'packages/client/src/components/Button.tsx', status: 'A', isConflict: false },
  { path: 'packages/server/src/index.ts', status: 'D', isConflict: false },
]

test('buildCommitDiffFileTree groups files by folder segments', () => {
  const tree = buildCommitDiffFileTree(files)

  expect(tree.map((node) => `${node.kind}:${node.name}`)).toEqual([
    'folder:packages',
    'file:README.md',
  ])

  const packagesNode = tree[0]
  expect(packagesNode.kind).toBe('folder')
  if (packagesNode.kind !== 'folder') return

  expect(packagesNode.children.map((node) => `${node.kind}:${node.name}`)).toEqual([
    'folder:client',
    'folder:server',
  ])
})

test('collectFolderPaths returns every folder path in the tree', () => {
  const tree = buildCommitDiffFileTree(files)

  expect(collectFolderPaths(tree)).toEqual([
    'packages',
    'packages/client',
    'packages/client/src',
    'packages/client/src/components',
    'packages/server',
    'packages/server/src',
  ])
})

test('getAncestorFolderPaths returns folder paths for the selected file', () => {
  expect(getAncestorFolderPaths('packages/client/src/components/Button.tsx')).toEqual([
    'packages',
    'packages/client',
    'packages/client/src',
    'packages/client/src/components',
  ])
})

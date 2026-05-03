import { expect, test } from 'bun:test'
import type { ChangedFile } from '../repo/types'
import {
  buildCommitDiffFileTree,
  compactCommitDiffFileTree,
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

test('compactCommitDiffFileTree folds single-folder chains', () => {
  const tree = compactCommitDiffFileTree(buildCommitDiffFileTree([
    { path: 'packages/client/src/components/JjDiffViewer.tsx', status: 'M', isConflict: false },
  ]))

  expect(tree.map((node) => `${node.kind}:${node.name}:${node.path}`)).toEqual([
    'folder:packages/client/src/components:packages/client/src/components',
  ])

  const compactFolder = tree[0]
  expect(compactFolder.kind).toBe('folder')
  if (compactFolder.kind !== 'folder') return

  expect(compactFolder.children.map((node) => `${node.kind}:${node.name}`)).toEqual([
    'file:JjDiffViewer.tsx',
  ])
})

test('compactCommitDiffFileTree stops folding at branches and direct files', () => {
  const tree = compactCommitDiffFileTree(buildCommitDiffFileTree(files))

  expect(tree.map((node) => `${node.kind}:${node.name}:${node.path}`)).toEqual([
    'folder:packages:packages',
    'file:README.md:README.md',
  ])

  const packagesNode = tree[0]
  expect(packagesNode.kind).toBe('folder')
  if (packagesNode.kind !== 'folder') return

  expect(packagesNode.children.map((node) => `${node.kind}:${node.name}:${node.path}`)).toEqual([
    'folder:client/src:packages/client/src',
    'folder:server/src:packages/server/src',
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

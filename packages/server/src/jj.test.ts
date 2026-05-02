import { $ } from 'bun'
import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { computeGraphLaneColorRows, getChangedFiles, getCommitFileContents, getCommitFileDiff } from './jj'

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (!dir) continue
    rmSync(dir, { recursive: true, force: true })
  }
})

async function createConflictRepo(): Promise<{ cwd: string; baseChangeId: string; leftChangeId: string }> {
  const dir = mkdtempSync(join(tmpdir(), 'visual-jj-conflict-'))
  tempDirs.push(dir)

  await $`jj git init repo`.cwd(dir).quiet()
  const cwd = join(dir, 'repo')

  writeFileSync(join(cwd, 'file.txt'), 'base\n')
  await $`jj describe -m base`.cwd(cwd).quiet()
  const baseChangeId = (await $`jj log -r @ --no-graph -T 'change_id.short()'`.cwd(cwd).text()).trim()

  await $`jj new`.cwd(cwd).quiet()
  writeFileSync(join(cwd, 'file.txt'), 'left\n')
  await $`jj describe -m left`.cwd(cwd).quiet()
  const leftChangeId = (await $`jj log -r @ --no-graph -T 'change_id.short()'`.cwd(cwd).text()).trim()

  await $`jj new ${baseChangeId}`.cwd(cwd).quiet()
  writeFileSync(join(cwd, 'file.txt'), 'right\n')
  await $`jj describe -m right`.cwd(cwd).quiet()
  const rightChangeId = (await $`jj log -r @ --no-graph -T 'change_id.short()'`.cwd(cwd).text()).trim()

  await $`jj new`.cwd(cwd).quiet()
  await $`jj rebase -r ${leftChangeId} -d ${rightChangeId}`.cwd(cwd).quiet()

  return { cwd, baseChangeId, leftChangeId }
}

async function createCommitDiffRepo(): Promise<{
  cwd: string
  baseChangeId: string
  addModifyChangeId: string
  deleteChangeId: string
  mergeChangeId: string
}> {
  const dir = mkdtempSync(join(tmpdir(), 'visual-jj-diff-'))
  tempDirs.push(dir)

  await $`jj git init repo`.cwd(dir).quiet()
  const cwd = join(dir, 'repo')

  writeFileSync(join(cwd, 'file.txt'), 'base\n')
  await $`jj describe -m base`.cwd(cwd).quiet()
  const baseChangeId = (await $`jj log -r @ --no-graph -T 'change_id.short()'`.cwd(cwd).text()).trim()

  await $`jj new`.cwd(cwd).quiet()
  writeFileSync(join(cwd, 'file.txt'), 'base\nmodified\n')
  writeFileSync(join(cwd, 'added.txt'), 'added\n')
  await $`jj describe -m add-modify`.cwd(cwd).quiet()
  const addModifyChangeId = (await $`jj log -r @ --no-graph -T 'change_id.short()'`.cwd(cwd).text()).trim()

  await $`jj new`.cwd(cwd).quiet()
  writeFileSync(join(cwd, 'file.txt'), 'base\nmodified again\n')
  unlinkSync(join(cwd, 'added.txt'))
  await $`jj describe -m delete`.cwd(cwd).quiet()
  const deleteChangeId = (await $`jj log -r @ --no-graph -T 'change_id.short()'`.cwd(cwd).text()).trim()

  await $`jj new ${baseChangeId}`.cwd(cwd).quiet()
  writeFileSync(join(cwd, 'file.txt'), 'base\nright\n')
  await $`jj describe -m right`.cwd(cwd).quiet()
  const rightChangeId = (await $`jj log -r @ --no-graph -T 'change_id.short()'`.cwd(cwd).text()).trim()

  await $`jj new ${addModifyChangeId} ${rightChangeId}`.cwd(cwd).quiet()
  writeFileSync(join(cwd, 'merged.txt'), 'merged\n')
  await $`jj describe -m merge`.cwd(cwd).quiet()
  const mergeChangeId = (await $`jj log -r @ --no-graph -T 'change_id.short()'`.cwd(cwd).text()).trim()

  return { cwd, baseChangeId, addModifyChangeId, deleteChangeId, mergeChangeId }
}

test('getChangedFiles marks clean commits with isConflict=false', async () => {
  const repo = await createConflictRepo()

  await expect(getChangedFiles(repo.cwd, repo.baseChangeId)).resolves.toEqual([
    { path: 'file.txt', status: 'A', isConflict: false },
  ])
})

test('getChangedFiles marks conflicted files using `jj resolve --list`', async () => {
  const repo = await createConflictRepo()

  await expect(getChangedFiles(repo.cwd, repo.leftChangeId)).resolves.toEqual([
    { path: 'file.txt', status: 'M', isConflict: true },
  ])
})

test('computeGraphLaneColorRows assigns colors by nesting depth, not branch lifetime', () => {
  expect(computeGraphLaneColorRows([
    '○  ',
    '│ ○  ',
    '├─╯',
    '○  ',
    '│ ○  ',
    '├─╯',
  ])).toEqual([
    ['#7aa2f7', '', ''],
    ['#7aa2f7', '', '#9ece6a', '', ''],
    ['#7aa2f7', '', '#9ece6a'],
    ['#7aa2f7', '', ''],
    ['#7aa2f7', '', '#9ece6a', '', ''],
    ['#7aa2f7', '', '#9ece6a'],
  ])
})

test('computeGraphLaneColorRows uses deeper colors for nested branches', () => {
  expect(computeGraphLaneColorRows([
    '@    ',
    '│ ○  ',
    '│ │ ○',
  ])).toEqual([
    ['#7aa2f7', '', '', '', ''],
    ['#7aa2f7', '', '#9ece6a', '', ''],
    ['#7aa2f7', '', '#9ece6a', '', '#e0af68'],
  ])
})

test('computeGraphLaneColorRows keeps a merge-side branch color until it rejoins', () => {
  expect(computeGraphLaneColorRows([
    '@  ',
    '├─╮',
    '│ ○  ',
    '│ │  ',
    '○ │  ',
    '├─╯',
    '○  ',
  ])).toEqual([
    ['#7aa2f7', '', ''],
    ['#7aa2f7', '', '#9ece6a'],
    ['#7aa2f7', '', '#9ece6a', '', ''],
    ['#7aa2f7', '', '#9ece6a', '', ''],
    ['#7aa2f7', '', '#9ece6a', '', ''],
    ['#7aa2f7', '', '#9ece6a'],
    ['#7aa2f7', '', ''],
  ])
})

test('computeGraphLaneColorRows keeps a flow color when it shifts right', () => {
  expect(computeGraphLaneColorRows([
    '○  ',
    '╰─╮',
    '  │',
    '  ○',
  ])).toEqual([
    ['#7aa2f7', '', ''],
    ['#7aa2f7', '', '#7aa2f7'],
    ['', '', '#7aa2f7'],
    ['', '', '#7aa2f7'],
  ])
})

test('computeGraphLaneColorRows keeps a flow color when it shifts left', () => {
  expect(computeGraphLaneColorRows([
    '  ○',
    '╭─╯',
    '│  ',
    '○  ',
  ])).toEqual([
    ['', '', '#7aa2f7'],
    ['#7aa2f7', '', '#7aa2f7'],
    ['#7aa2f7', '', ''],
    ['#7aa2f7', '', ''],
  ])
})

test('getCommitFileDiff returns git patch metadata for a changed file', async () => {
  const repo = await createCommitDiffRepo()

  await expect(getCommitFileDiff(repo.cwd, repo.addModifyChangeId, 'file.txt')).resolves.toMatchObject({
    path: 'file.txt',
    oldPath: 'file.txt',
    isMerge: false,
    canExpandContext: true,
  })

  const diff = await getCommitFileDiff(repo.cwd, repo.addModifyChangeId, 'file.txt')
  expect(diff.patch).toContain('diff --git a/file.txt b/file.txt')
  expect(diff.patch).toContain('+modified')
})

test('getCommitFileContents returns old and new content for modified files', async () => {
  const repo = await createCommitDiffRepo()

  await expect(getCommitFileContents(repo.cwd, repo.addModifyChangeId, 'file.txt')).resolves.toEqual({
    oldContent: 'base\n',
    newContent: 'base\nmodified\n',
  })
})

test('getCommitFileContents returns null old content for added files', async () => {
  const repo = await createCommitDiffRepo()

  await expect(getCommitFileContents(repo.cwd, repo.addModifyChangeId, 'added.txt')).resolves.toEqual({
    oldContent: null,
    newContent: 'added\n',
  })
})

test('getCommitFileContents returns null new content for deleted files', async () => {
  const repo = await createCommitDiffRepo()

  await expect(getCommitFileContents(repo.cwd, repo.deleteChangeId, 'added.txt')).resolves.toEqual({
    oldContent: 'added\n',
    newContent: null,
  })
})

test('getCommitFileDiff disables expandable context for merge commits', async () => {
  const repo = await createCommitDiffRepo()

  await expect(getCommitFileDiff(repo.cwd, repo.mergeChangeId, 'merged.txt')).resolves.toMatchObject({
    path: 'merged.txt',
    isMerge: true,
    canExpandContext: false,
  })

  await expect(getCommitFileContents(repo.cwd, repo.mergeChangeId, 'merged.txt')).resolves.toEqual({
    oldContent: null,
    newContent: null,
  })
})

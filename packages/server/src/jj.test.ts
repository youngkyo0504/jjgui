import { $ } from 'bun'
import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { computeGraphLaneColorRows, getChangedFiles } from './jj'

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

test('computeGraphLaneColorRows assigns new colors by branch lifetime, not column', () => {
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
    ['#7aa2f7', '', '#e0af68', '', ''],
    ['#7aa2f7', '', '#e0af68'],
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

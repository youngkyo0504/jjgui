import { expect, test } from 'bun:test'
import { buildCommitDiffSearch, buildLogSearch, parseAppRoute } from './commitDiffRoute'

test('parseAppRoute returns log view by default', () => {
  expect(parseAppRoute('?cwd=/repo')).toEqual({ view: 'log' })
})

test('parseAppRoute returns commit diff view with selected path', () => {
  expect(parseAppRoute('?cwd=/repo&view=commit-diff&changeId=abc123&path=src/app.ts')).toEqual({
    view: 'commit-diff',
    changeId: 'abc123',
    path: 'src/app.ts',
  })
})

test('buildCommitDiffSearch preserves unrelated query params', () => {
  expect(buildCommitDiffSearch('?cwd=/repo&foo=bar', { changeId: 'abc123', path: 'src/app.ts' })).toBe(
    '?cwd=%2Frepo&foo=bar&view=commit-diff&changeId=abc123&path=src%2Fapp.ts',
  )
})

test('buildLogSearch removes commit diff params and preserves cwd', () => {
  expect(buildLogSearch('?cwd=/repo&foo=bar&view=commit-diff&changeId=abc123&path=src/app.ts')).toBe(
    '?cwd=%2Frepo&foo=bar',
  )
})

import { describe, expect, test } from 'bun:test'
import { buildVisualGraph } from './visualGraph'

describe('buildVisualGraph', () => {
  test('row glyphs are promoted into continuous visual paths', () => {
    const graph = buildVisualGraph([
      { graphChars: '@', laneColors: ['#7aa2f7'], nextGraphChars: '│' },
      { graphChars: '│', laneColors: ['#7aa2f7'] },
      { graphChars: '○', laneColors: ['#7aa2f7'], previousGraphChars: '│' },
    ], [
      { top: 0, height: 28 },
      { top: 28, height: 28 },
      { top: 56, height: 28 },
    ])

    expect(graph.nodes).toMatchObject([
      { row: 0, lane: 0, x: 10, y: 14, kind: 'working-copy' },
      { row: 2, lane: 0, x: 10, y: 70, kind: 'normal' },
    ])
    expect(graph.paths).toHaveLength(1)
    expect(graph.paths[0].d).toContain('M 10 20 L 10 28')
    expect(graph.paths[0].d).toContain('M 10 28 L 10 56')
    expect(graph.paths[0].d).toContain('M 10 56 L 10 64')
  })

  test('branch glyphs become curve and horizontal path commands', () => {
    const graph = buildVisualGraph([
      { graphChars: '│ ○', laneColors: ['#7aa2f7', '', '#9ece6a'], nextGraphChars: '├─╯' },
      { graphChars: '├─╯', laneColors: ['#7aa2f7', '#9ece6a', '#9ece6a'] },
    ], [
      { top: 0, height: 28 },
      { top: 28, height: 28 },
    ])

    expect(graph.nodes).toMatchObject([
      { row: 0, lane: 2, x: 50, y: 14, kind: 'normal' },
    ])
    expect(graph.paths.some((path) => path.d.includes('C 50 39.2, 50 42, 40 42'))).toBe(true)
  })

  test('tee branch arms use the outgoing branch color', () => {
    const graph = buildVisualGraph([
      { graphChars: '├─╯', laneColors: ['#7aa2f7', '#9ece6a', '#9ece6a'] },
    ], [
      { top: 0, height: 28 },
    ])

    const trunkPath = graph.paths.find((path) => path.color === '#7aa2f7')
    const branchPath = graph.paths.find((path) => path.color === '#9ece6a')

    expect(trunkPath?.d).toBe('M 10 0 L 10 28')
    expect(branchPath?.d).toContain('M 12.5 14 L 20 14')
    expect(branchPath?.d).toContain('M 20 14 L 40 14')
  })

  test('lineOnly rows keep only vertical continuity', () => {
    const graph = buildVisualGraph([
      { graphChars: '├─╯', laneColors: ['#7aa2f7', '#9ece6a', '#9ece6a'], lineOnly: true },
    ], [
      { top: 0, height: 40 },
    ])

    expect(graph.nodes).toEqual([])
    expect(graph.paths).toHaveLength(1)
    expect(graph.paths[0].d).toBe('M 10 0 L 10 40')
  })
})

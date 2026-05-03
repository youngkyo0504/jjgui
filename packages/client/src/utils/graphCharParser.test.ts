import { describe, test, expect } from 'bun:test'
import { parseGraphChars } from './graphCharParser'

describe('parseGraphChars', () => {
  test('single vertical line (│) maps to line type', () => {
    const result = parseGraphChars('│', ['#7aa2f7'])
    expect(result).toEqual([{ type: 'line', color: '#7aa2f7' }])
  })

  test('normal commit (○) maps to node(normal) type', () => {
    const result = parseGraphChars('○', ['#9ece6a'])
    expect(result).toEqual([{ type: 'node', color: '#9ece6a', nodeType: 'normal' }])
  })

  test('working copy (@) maps to node(working-copy) type', () => {
    const result = parseGraphChars('@', ['#9ece6a'])
    expect(result).toEqual([{ type: 'node', color: '#9ece6a', nodeType: 'working-copy' }])
  })

  test('immutable (◆) maps to node(immutable) type', () => {
    const result = parseGraphChars('◆', ['#e0af68'])
    expect(result).toEqual([{ type: 'node', color: '#e0af68', nodeType: 'immutable' }])
  })

  test('tee-right (├) maps to tee-right type', () => {
    const result = parseGraphChars('├', ['#7aa2f7'])
    expect(result).toEqual([{ type: 'tee-right', color: '#7aa2f7' }])
  })

  test('merge-up (╯) maps to merge-up type', () => {
    const result = parseGraphChars('╯', ['#bb9af7'])
    expect(result).toEqual([{ type: 'merge-up', color: '#bb9af7' }])
  })

  test('branch-down (╰) maps to branch-down type', () => {
    const result = parseGraphChars('╰', ['#2ac3de'])
    expect(result).toEqual([{ type: 'branch-down', color: '#2ac3de' }])
  })

  test('curve-right (╮) maps to curve-right type', () => {
    const result = parseGraphChars('╮', ['#bb9af7'])
    expect(result).toEqual([{ type: 'curve-right', color: '#bb9af7' }])
  })

  test('curve-left (╭) maps to curve-left type', () => {
    const result = parseGraphChars('╭', ['#2ac3de'])
    expect(result).toEqual([{ type: 'curve-left', color: '#2ac3de' }])
  })

  test('compound pattern (├─╯) maps to tee + horizontal + merge-up', () => {
    const result = parseGraphChars('├─╯', ['#7aa2f7', '#e0af68', '#9ece6a'])
    expect(result).toEqual([
      { type: 'tee-right', color: '#7aa2f7', horizontalColor: '#9ece6a' },
      { type: 'horizontal', color: '#9ece6a' },
      { type: 'merge-up', color: '#9ece6a' },
    ])
  })

  test('compound pattern (╰─┤) uses the left branch color for the horizontal segment', () => {
    const result = parseGraphChars('╰─┤', ['#9ece6a', '#e0af68', '#7aa2f7'])
    expect(result).toEqual([
      { type: 'branch-down', color: '#9ece6a' },
      { type: 'horizontal', color: '#9ece6a' },
      { type: 'tee-left', color: '#7aa2f7', horizontalColor: '#9ece6a' },
    ])
  })

  test('compound pattern (│ ○) maps to line + empty + node', () => {
    const result = parseGraphChars('│ ○', ['#7aa2f7', '', '#9ece6a'])
    expect(result).toEqual([
      { type: 'line', color: '#7aa2f7' },
      { type: 'empty', color: '' },
      { type: 'node', color: '#9ece6a', nodeType: 'normal' },
    ])
  })

  test('horizontal line (─) maps to horizontal type', () => {
    const result = parseGraphChars('─', ['#7aa2f7'])
    expect(result).toEqual([{ type: 'horizontal', color: '#7aa2f7' }])
  })

  test('elided (~) maps to elided type', () => {
    const result = parseGraphChars('~', ['#7aa2f7'])
    expect(result).toEqual([{ type: 'elided', color: '#7aa2f7' }])
  })

  test('missing laneColors uses an empty string color', () => {
    const result = parseGraphChars('│')
    expect(result).toEqual([{ type: 'line', color: '' }])
  })

  test('empty graphChars maps to an empty array', () => {
    const result = parseGraphChars('')
    expect(result).toEqual([])
  })

  test('with context, a tip node only connects down', () => {
    const result = parseGraphChars('○', ['#7aa2f7'], { nextGraphChars: '○' })
    expect(result).toEqual([
      { type: 'node', color: '#7aa2f7', nodeType: 'normal', connectsUp: false, connectsDown: true },
    ])
  })

  test('with context, a middle node connects up and down', () => {
    const result = parseGraphChars('○', ['#7aa2f7'], {
      previousGraphChars: '○',
      nextGraphChars: '○',
    })
    expect(result).toEqual([
      { type: 'node', color: '#7aa2f7', nodeType: 'normal', connectsUp: true, connectsDown: true },
    ])
  })

  test('with context, an end node only connects up', () => {
    const result = parseGraphChars('○', ['#7aa2f7'], { previousGraphChars: '○' })
    expect(result).toEqual([
      { type: 'node', color: '#7aa2f7', nodeType: 'normal', connectsUp: true, connectsDown: false },
    ])
  })

  test('the first node on a side branch connects only down to the edge row', () => {
    const result = parseGraphChars('│ ○', ['#7aa2f7', '', '#9ece6a'], {
      previousGraphChars: '○',
      nextGraphChars: '├─╯',
    })

    expect(result).toEqual([
      { type: 'line', color: '#7aa2f7' },
      { type: 'empty', color: '' },
      { type: 'node', color: '#9ece6a', nodeType: 'normal', connectsUp: false, connectsDown: true },
    ])
  })
})

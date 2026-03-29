import { describe, test, expect } from 'bun:test'
import { parseGraphChars } from './graphCharParser'

describe('parseGraphChars', () => {
  test('단일 세로선 (│) → line 타입', () => {
    const result = parseGraphChars('│', ['#7aa2f7'])
    expect(result).toEqual([{ type: 'line', color: '#7aa2f7' }])
  })

  test('일반 커밋 (○) → node(normal) 타입', () => {
    const result = parseGraphChars('○', ['#9ece6a'])
    expect(result).toEqual([{ type: 'node', color: '#9ece6a', nodeType: 'normal' }])
  })

  test('working copy (@) → node(working-copy) 타입', () => {
    const result = parseGraphChars('@', ['#9ece6a'])
    expect(result).toEqual([{ type: 'node', color: '#9ece6a', nodeType: 'working-copy' }])
  })

  test('immutable (◆) → node(immutable) 타입', () => {
    const result = parseGraphChars('◆', ['#e0af68'])
    expect(result).toEqual([{ type: 'node', color: '#e0af68', nodeType: 'immutable' }])
  })

  test('tee-right (├) → tee-right 타입', () => {
    const result = parseGraphChars('├', ['#7aa2f7'])
    expect(result).toEqual([{ type: 'tee-right', color: '#7aa2f7' }])
  })

  test('merge-up (╯) → merge-up 타입', () => {
    const result = parseGraphChars('╯', ['#bb9af7'])
    expect(result).toEqual([{ type: 'merge-up', color: '#bb9af7' }])
  })

  test('branch-down (╰) → branch-down 타입', () => {
    const result = parseGraphChars('╰', ['#2ac3de'])
    expect(result).toEqual([{ type: 'branch-down', color: '#2ac3de' }])
  })

  test('curve-right (╮) → curve-right 타입', () => {
    const result = parseGraphChars('╮', ['#bb9af7'])
    expect(result).toEqual([{ type: 'curve-right', color: '#bb9af7' }])
  })

  test('curve-left (╭) → curve-left 타입', () => {
    const result = parseGraphChars('╭', ['#2ac3de'])
    expect(result).toEqual([{ type: 'curve-left', color: '#2ac3de' }])
  })

  test('복합 패턴 (├─╯) → tee + horizontal + merge-up', () => {
    const result = parseGraphChars('├─╯', ['#7aa2f7', '#7aa2f7', '#9ece6a'])
    expect(result).toEqual([
      { type: 'tee-right', color: '#7aa2f7' },
      { type: 'horizontal', color: '#7aa2f7' },
      { type: 'merge-up', color: '#9ece6a' },
    ])
  })

  test('복합 패턴 (│ ○) → line + empty + node', () => {
    const result = parseGraphChars('│ ○', ['#7aa2f7', '', '#9ece6a'])
    expect(result).toEqual([
      { type: 'line', color: '#7aa2f7' },
      { type: 'empty', color: '' },
      { type: 'node', color: '#9ece6a', nodeType: 'normal' },
    ])
  })

  test('수평선 (─) → horizontal 타입', () => {
    const result = parseGraphChars('─', ['#7aa2f7'])
    expect(result).toEqual([{ type: 'horizontal', color: '#7aa2f7' }])
  })

  test('elided (~) → elided 타입', () => {
    const result = parseGraphChars('~', ['#7aa2f7'])
    expect(result).toEqual([{ type: 'elided', color: '#7aa2f7' }])
  })

  test('laneColors 없으면 빈 문자열 color', () => {
    const result = parseGraphChars('│')
    expect(result).toEqual([{ type: 'line', color: '' }])
  })

  test('빈 graphChars → 빈 배열', () => {
    const result = parseGraphChars('')
    expect(result).toEqual([])
  })
})

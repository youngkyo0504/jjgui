import { expect, test } from 'bun:test'
import { DEFAULT_PORT, parseConfig, resolvePort, type JjguiConfig } from './config'

const baseConfig: JjguiConfig = {
  port: DEFAULT_PORT,
  opener: 'auto',
  cmux: {
    openMode: 'tab',
    splitDirection: 'right',
  },
}

test('parseConfig reads port from top-level config', () => {
  expect(parseConfig(`
port = 7788
opener = "cmux"

[cmux]
openMode = "split"
splitDirection = "down"
`)).toEqual({
    port: 7788,
    opener: 'cmux',
    cmux: {
      openMode: 'split',
      splitDirection: 'down',
    },
  })
})

test('parseConfig falls back to the default port for invalid values', () => {
  expect(parseConfig('port = "nope"').port).toBe(DEFAULT_PORT)
  expect(parseConfig('port = 0').port).toBe(DEFAULT_PORT)
  expect(parseConfig('port = 65536').port).toBe(DEFAULT_PORT)
})

test('resolvePort prefers the CLI flag over config', () => {
  expect(resolvePort('7789', { ...baseConfig, port: 7788 })).toBe(7789)
  expect(resolvePort(undefined, { ...baseConfig, port: 7788 })).toBe(7788)
})

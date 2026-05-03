/**
 * Loads ~/.jjgui/config.toml.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export interface CmuxConfig {
  openMode: 'tab' | 'split'
  splitDirection: 'right' | 'down'
}

export interface JjguiConfig {
  opener: 'auto' | 'browser' | 'cmux'
  cmux: CmuxConfig
}

const DEFAULT_CONFIG: JjguiConfig = {
  opener: 'auto',
  cmux: {
    openMode: 'tab',
    splitDirection: 'right',
  },
}

/**
 * Simple TOML parser for the small config surface we need.
 * Supports top-level key = "value" and [section] key = "value".
 */
function parseSimpleToml(content: string): Record<string, any> {
  const result: Record<string, any> = {}
  let currentSection = ''

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    // [section] header
    const sectionMatch = line.match(/^\[(\w+)\]$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1]
      if (!result[currentSection]) result[currentSection] = {}
      continue
    }

    // key = "value" or key = value
    const kvMatch = line.match(/^(\w+)\s*=\s*"?([^"]*)"?$/)
    if (kvMatch) {
      const [, key, value] = kvMatch
      if (currentSection) {
        result[currentSection][key] = value
      } else {
        result[key] = value
      }
    }
  }

  return result
}

export function loadConfig(): JjguiConfig {
  const configPath = join(homedir(), '.jjgui', 'config.toml')
  try {
    const content = readFileSync(configPath, 'utf-8')
    const parsed = parseSimpleToml(content)

    const opener = ['auto', 'browser', 'cmux'].includes(parsed.opener)
      ? (parsed.opener as JjguiConfig['opener'])
      : DEFAULT_CONFIG.opener

    const cmux = parsed.cmux || {}
    const openMode = ['tab', 'split'].includes(cmux.openMode)
      ? (cmux.openMode as CmuxConfig['openMode'])
      : DEFAULT_CONFIG.cmux.openMode
    const splitDirection = ['right', 'down'].includes(cmux.splitDirection)
      ? (cmux.splitDirection as CmuxConfig['splitDirection'])
      : DEFAULT_CONFIG.cmux.splitDirection

    return { opener, cmux: { openMode, splitDirection } }
  } catch {
    // Use defaults when the config file does not exist.
    return { ...DEFAULT_CONFIG }
  }
}

/**
 * Resolve the final opener from CLI flags, config, and environment variables.
 * Priority: CLI flag > config file > environment auto-detection > default.
 */
export function resolveOpener(
  cliFlag: string | undefined,
  config: JjguiConfig,
): 'browser' | 'cmux' {
  // 1. CLI flag
  if (cliFlag === 'browser') return 'browser'
  if (cliFlag === 'cmux') return 'cmux'
  if (cliFlag && cliFlag !== 'auto') {
    console.error(`Invalid opener value: ${cliFlag}. Use 'auto', 'browser', or 'cmux'.`)
    process.exit(1)
  }

  // 2. Config file when it is not auto.
  const effective = cliFlag === 'auto' ? 'auto' : config.opener
  if (effective === 'browser') return 'browser'
  if (effective === 'cmux') return 'cmux'

  // 3. auto: detect from environment variables.
  if (process.env.CMUX_SURFACE_ID) return 'cmux'

  // 4. Default.
  return 'browser'
}

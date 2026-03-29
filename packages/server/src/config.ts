/**
 * ~/.jjgui/config.toml 설정 로드 모듈
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
 * 간단한 TOML 파서 (외부 의존성 없이 필요한 설정만 파싱)
 * 지원: 최상위 key = "value", [section] 하위 key = "value"
 */
function parseSimpleToml(content: string): Record<string, any> {
  const result: Record<string, any> = {}
  let currentSection = ''

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    // [section] 헤더
    const sectionMatch = line.match(/^\[(\w+)\]$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1]
      if (!result[currentSection]) result[currentSection] = {}
      continue
    }

    // key = "value" 또는 key = value
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
    // 설정 파일이 없으면 기본값
    return { ...DEFAULT_CONFIG }
  }
}

/**
 * CLI 플래그, 설정 파일, 환경변수를 종합하여 최종 opener 결정
 * 우선순위: CLI 플래그 > 설정 파일 > 환경변수 자동감지 > 기본값
 */
export function resolveOpener(
  cliFlag: string | undefined,
  config: JjguiConfig,
): 'browser' | 'cmux' {
  // 1. CLI 플래그
  if (cliFlag === 'browser') return 'browser'
  if (cliFlag === 'cmux') return 'cmux'
  if (cliFlag && cliFlag !== 'auto') {
    console.error(`Invalid opener value: ${cliFlag}. Use 'auto', 'browser', or 'cmux'.`)
    process.exit(1)
  }

  // 2. 설정 파일 (auto가 아닌 경우)
  const effective = cliFlag === 'auto' ? 'auto' : config.opener
  if (effective === 'browser') return 'browser'
  if (effective === 'cmux') return 'cmux'

  // 3. auto: 환경변수로 자동감지
  if (process.env.CMUX_SURFACE_ID) return 'cmux'

  // 4. 기본값
  return 'browser'
}

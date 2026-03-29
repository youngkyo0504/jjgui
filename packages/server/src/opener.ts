/**
 * 브라우저 열기 모듈
 * opener 설정에 따라 시스템 브라우저 또는 cmux 내장 브라우저로 URL을 연다
 */
import type { JjguiConfig } from './config'

export async function openBrowser(url: string): Promise<void> {
  Bun.spawn(['open', url])
}

export async function openCmux(url: string, config: JjguiConfig): Promise<void> {
  const surfaceId = process.env.CMUX_SURFACE_ID
  if (!surfaceId) {
    console.error('CMUX_SURFACE_ID not set. Falling back to system browser.')
    return openBrowser(url)
  }

  try {
    const args = config.cmux.openMode === 'split'
      ? ['cmux', 'browser', surfaceId, 'split', config.cmux.splitDirection, url]
      : ['cmux', 'browser', surfaceId, 'tab', 'new', url]

    const proc = Bun.spawn(args, { stderr: 'pipe' })
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text()
      console.error(`cmux command failed: ${stderr.trim()}. Falling back to system browser.`)
      return openBrowser(url)
    }
  } catch {
    console.error('cmux command not found. Falling back to system browser.')
    return openBrowser(url)
  }
}

export async function open(url: string, opener: 'browser' | 'cmux', config: JjguiConfig): Promise<void> {
  if (opener === 'cmux') {
    return openCmux(url, config)
  }
  return openBrowser(url)
}

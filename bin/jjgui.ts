#!/usr/bin/env bun
import { resolve } from 'path'
import { readFileSync, unlinkSync, openSync } from 'fs'
import { loadConfig, resolveOpener } from '../packages/server/src/config'
import { open } from '../packages/server/src/opener'

const PORT = 7777
const PID_FILE = '/tmp/jjgui.pid'
const LOG_FILE = '/tmp/jjgui.log'
const HEALTH_URL = `http://localhost:${PORT}/health`

// jjgui 서버가 실행 중인지 /health로 확인
async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL)
    if (!res.ok) return false
    const body = await res.json() as { ok?: boolean }
    return body.ok === true
  } catch {
    return false
  }
}

// stale PID 파일 정리
function cleanStalePid(): void {
  try {
    const pid = Number(readFileSync(PID_FILE, 'utf-8').trim())
    process.kill(pid, 0) // 프로세스 생존 확인
  } catch {
    // 프로세스가 없으면 PID 파일 삭제
    try { unlinkSync(PID_FILE) } catch {}
  }
}

// 서버가 뜰 때까지 폴링 (최대 5초)
async function waitForServer(): Promise<boolean> {
  for (let i = 0; i < 50; i++) {
    if (await isServerRunning()) return true
    await Bun.sleep(100)
  }
  return false
}

// --- stop 모드 ---
if (process.argv[2] === 'stop') {
  try {
    const pid = Number(readFileSync(PID_FILE, 'utf-8').trim())
    process.kill(pid, 'SIGTERM')
    try { unlinkSync(PID_FILE) } catch {}
    console.log(`jjgui 서버 종료 (PID ${pid})`)
  } catch {
    console.log('실행 중인 jjgui 서버가 없습니다.')
  }
  process.exit(0)
}

// --- --opener 플래그 파싱 ---
let openerFlag: string | undefined
let pathArg = '.'

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--opener=')) {
    openerFlag = arg.split('=')[1]
  } else if (!arg.startsWith('--')) {
    pathArg = arg
  }
}

const config = loadConfig()
const opener = resolveOpener(openerFlag, config)

// --- start/connect 모드 ---
const cwd = resolve(pathArg)
const url = `http://localhost:${PORT}/?cwd=${encodeURIComponent(cwd)}`

if (await isServerRunning()) {
  console.log('jjgui 서버가 이미 실행 중입니다. 브라우저를 엽니다.')
  await open(url, opener, config)
  process.exit(0)
}

// stale PID 정리
cleanStalePid()

// 서버를 detached subprocess로 스폰
const serverEntry = resolve(import.meta.dir, '../packages/server/src/index.ts')
const logFd = openSync(LOG_FILE, 'a')

const child = Bun.spawn(['bun', 'run', serverEntry], {
  detached: true,
  stdio: ['ignore', logFd, logFd],
  env: { ...process.env },
})
child.unref()

console.log(`watching: ${cwd}`)

if (await waitForServer()) {
  await open(url, opener, config)
} else {
  console.error('서버 시작 실패. 로그를 확인하세요: /tmp/jjgui.log')
}

process.exit(0)

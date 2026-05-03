#!/usr/bin/env bun
import { resolve } from 'path'
import { readFileSync, unlinkSync, openSync } from 'fs'
import { loadConfig, resolveOpener } from '../packages/server/src/config'
import { open } from '../packages/server/src/opener'

const PORT = 7777
const PID_FILE = '/tmp/jjgui.pid'
const LOG_FILE = '/tmp/jjgui.log'
const HEALTH_URL = `http://localhost:${PORT}/health`

// Check /health to see whether the jjgui server is running.
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

// Clean up stale PID files.
function cleanStalePid(): void {
  try {
    const pid = Number(readFileSync(PID_FILE, 'utf-8').trim())
    process.kill(pid, 0) // Check whether the process is alive.
  } catch {
    // Delete the PID file if the process is gone.
    try { unlinkSync(PID_FILE) } catch {}
  }
}

// Poll until the server starts, up to 5 seconds.
async function waitForServer(): Promise<boolean> {
  for (let i = 0; i < 50; i++) {
    if (await isServerRunning()) return true
    await Bun.sleep(100)
  }
  return false
}

// --- stop mode ---
if (process.argv[2] === 'stop') {
  try {
    const pid = Number(readFileSync(PID_FILE, 'utf-8').trim())
    process.kill(pid, 'SIGTERM')
    try { unlinkSync(PID_FILE) } catch {}
    console.log(`jjgui server stopped (PID ${pid})`)
  } catch {
    console.log('No running jjgui server found.')
  }
  process.exit(0)
}

// --- parse --opener flag ---
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

// --- start/connect mode ---
const cwd = resolve(pathArg)
const url = `http://localhost:${PORT}/?cwd=${encodeURIComponent(cwd)}`

if (await isServerRunning()) {
  console.log('jjgui server is already running. Opening browser.')
  await open(url, opener, config)
  process.exit(0)
}

// Clean stale PID.
cleanStalePid()

// Spawn the server as a detached subprocess.
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
  console.error('Failed to start server. Check logs: /tmp/jjgui.log')
}

process.exit(0)

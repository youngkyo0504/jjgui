#!/usr/bin/env bun
import { resolve } from 'path'
import { readFileSync, unlinkSync, openSync } from 'fs'
import { DEFAULT_PORT, loadConfig, resolveOpener, resolvePort } from '../packages/server/src/config'
import { open } from '../packages/server/src/opener'

const LEGACY_PID_FILE = '/tmp/jjgui.pid'

interface CliArgs {
  command: 'start' | 'stop'
  openerFlag: string | undefined
  portFlag: string | undefined
  pathArg: string
}

function pidFileForPort(port: number): string {
  return `/tmp/jjgui-${port}.pid`
}

function logFileForPort(port: number): string {
  return `/tmp/jjgui-${port}.log`
}

function healthUrlForPort(port: number): string {
  return `http://localhost:${port}/health`
}

function parseCliArgs(args: string[]): CliArgs {
  const parsed: CliArgs = {
    command: 'start',
    openerFlag: undefined,
    portFlag: undefined,
    pathArg: '.',
  }

  for (const arg of args) {
    if (arg === 'stop') {
      parsed.command = 'stop'
    } else if (arg.startsWith('--opener=')) {
      parsed.openerFlag = arg.split('=')[1]
    } else if (arg.startsWith('--port=')) {
      parsed.portFlag = arg.split('=')[1]
    } else if (!arg.startsWith('--') && parsed.command === 'start') {
      parsed.pathArg = arg
    }
  }

  return parsed
}

// Check /health to see whether the jjgui server is running.
async function getServerHealth(port: number): Promise<{ ok?: boolean, pid?: number } | undefined> {
  try {
    const res = await fetch(healthUrlForPort(port))
    if (!res.ok) return undefined
    return await res.json() as { ok?: boolean, pid?: number }
  } catch {
    return undefined
  }
}

async function isServerRunning(port: number): Promise<boolean> {
  const body = await getServerHealth(port)
  return body?.ok === true
}

function pidFilesForPort(port: number): string[] {
  return port === DEFAULT_PORT
    ? [pidFileForPort(port), LEGACY_PID_FILE]
    : [pidFileForPort(port)]
}

function readPidFromFile(pidFile: string): number | undefined {
  try {
    const pid = Number(readFileSync(pidFile, 'utf-8').trim())
    return Number.isInteger(pid) && pid > 0 ? pid : undefined
  } catch {
    return undefined
  }
}

function unlinkPidFiles(port: number): void {
  for (const pidFile of pidFilesForPort(port)) {
    try { unlinkSync(pidFile) } catch {}
  }
}

// Clean up stale PID files.
function cleanStalePid(port: number): void {
  for (const pidFile of pidFilesForPort(port)) {
    const pid = readPidFromFile(pidFile)
    if (pid === undefined) continue
    try {
      process.kill(pid, 0) // Check whether the process is alive.
    } catch {
      // Delete the PID file if the process is gone.
      try { unlinkSync(pidFile) } catch {}
    }
  }
}

// Poll until the server starts, up to 5 seconds.
async function waitForServer(port: number): Promise<boolean> {
  for (let i = 0; i < 50; i++) {
    if (await isServerRunning(port)) return true
    await Bun.sleep(100)
  }
  return false
}

const cliArgs = parseCliArgs(process.argv.slice(2))
const config = loadConfig()
const port = resolvePort(cliArgs.portFlag, config)

// --- stop mode ---
if (cliArgs.command === 'stop') {
  const serverHealth = await getServerHealth(port)
  const pidFromFile = pidFilesForPort(port)
    .map(readPidFromFile)
    .find((pid): pid is number => pid !== undefined)
  const pid = serverHealth?.pid ?? pidFromFile

  if (pid !== undefined) {
    try {
      process.kill(pid, 'SIGTERM')
      unlinkPidFiles(port)
      console.log(`jjgui server stopped on port ${port} (PID ${pid})`)
    } catch {
      unlinkPidFiles(port)
      console.log(`No running jjgui server found on port ${port}.`)
    }
  } else {
    console.log(`No running jjgui server found on port ${port}.`)
  }
  process.exit(0)
}

const opener = resolveOpener(cliArgs.openerFlag, config)

// --- start/connect mode ---
const cwd = resolve(cliArgs.pathArg)
const url = `http://localhost:${port}/?cwd=${encodeURIComponent(cwd)}`

if (await isServerRunning(port)) {
  console.log(`jjgui server is already running on port ${port}. Opening browser.`)
  await open(url, opener, config)
  process.exit(0)
}

// Clean stale PID.
cleanStalePid(port)

// Spawn the server as a detached subprocess.
const serverEntry = resolve(import.meta.dir, '../packages/server/src/index.ts')
const logFile = logFileForPort(port)
const logFd = openSync(logFile, 'a')

const child = Bun.spawn(['bun', 'run', serverEntry], {
  detached: true,
  stdio: ['ignore', logFd, logFd],
  env: { ...process.env, JJGUI_PORT: String(port) },
})
child.unref()

console.log(`watching: ${cwd}`)
console.log(`port: ${port}`)

if (await waitForServer(port)) {
  await open(url, opener, config)
} else {
  console.error(`Failed to start server. Check logs: ${logFile}`)
}

process.exit(0)

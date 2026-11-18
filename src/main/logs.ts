import { app } from 'electron'
import { appendFileSync, existsSync, mkdirSync, openSync, renameSync, statSync } from 'fs'
import { join } from 'path'

// Each log keeps one previous copy (name.log.1), so the folder tops out around 2 x MAX_BYTES per file.
const MAX_BYTES = 5 * 1024 * 1024

export function getLogDir(): string {
  const dir = join(app.getPath('userData'), 'logs')
  mkdirSync(dir, { recursive: true })
  return dir
}

function rotate(file: string): void {
  try {
    if (existsSync(file) && statSync(file).size > MAX_BYTES) renameSync(file, `${file}.1`)
  } catch {
    // A log we cannot rotate is still worth appending to.
  }
}

/** Open a log for appending and return its file descriptor, for a child process's stdout/stderr. */
export function openLogFile(name: string): number | null {
  try {
    const file = join(getLogDir(), name)
    rotate(file)
    return openSync(file, 'a')
  } catch {
    return null
  }
}

/** Copy the main process's console output into app.log; an installed app has no console to read. */
export function captureAppLog(): void {
  let file: string
  try {
    file = join(getLogDir(), 'app.log')
    rotate(file)
  } catch {
    return
  }
  const write = (level: string, args: unknown[]): void => {
    const text = args
      .map(a => (a instanceof Error ? a.stack || a.message : typeof a === 'string' ? a : JSON.stringify(a)))
      .join(' ')
    try {
      appendFileSync(file, `${new Date().toISOString()} ${level} ${text}\n`)
    } catch {
      // Logging must never take the app down.
    }
  }
  for (const level of ['log', 'warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      write(level.toUpperCase(), args)
    }
  }
  write('LOG', [`FireForm ${app.getVersion()} starting on ${process.platform} ${process.arch}`])
}

import { existsSync, createWriteStream } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { spawn, execSync } from 'child_process'
import { get as httpGet } from 'https'

const OLLAMA_HOST = 'http://127.0.0.1:11434'

export async function isOllamaReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

export async function waitForOllama(timeoutMs = 30000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isOllamaReachable()) return true
    await new Promise(r => setTimeout(r, 1000))
  }
  return false
}

export function findLocalOllamaExecutable(): string | null {
  const platform = process.platform

  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || ''
    const candidate1 = join(localAppData, 'Programs', 'Ollama', 'ollama.exe')
    if (existsSync(candidate1)) return candidate1
    const candidate2 = 'C:\\Program Files\\Ollama\\ollama.exe'
    if (existsSync(candidate2)) return candidate2
    try {
      const out = execSync('where ollama', { stdio: 'pipe' }).toString().trim().split('\r\n')[0]
      if (out && existsSync(out)) return out
    } catch {
      // not in PATH
    }
  } else if (platform === 'darwin') {
    const candidate1 = '/usr/local/bin/ollama'
    if (existsSync(candidate1)) return candidate1
    const candidate2 = '/Applications/Ollama.app/Contents/Resources/ollama'
    if (existsSync(candidate2)) return candidate2
    const candidate3 = join(process.env.HOME || '', 'Applications', 'Ollama.app', 'Contents', 'Resources', 'ollama')
    if (existsSync(candidate3)) return candidate3
    try {
      const out = execSync('which ollama', { stdio: 'pipe' }).toString().trim()
      if (out && existsSync(out)) return out
    } catch {
      // not in PATH
    }
  } else if (platform === 'linux') {
    const candidate1 = '/usr/local/bin/ollama'
    if (existsSync(candidate1)) return candidate1
    const candidate2 = '/usr/bin/ollama'
    if (existsSync(candidate2)) return candidate2
    try {
      const out = execSync('which ollama', { stdio: 'pipe' }).toString().trim()
      if (out && existsSync(out)) return out
    } catch {
      // not in PATH
    }
  }

  return null
}

export async function startLocalOllama(): Promise<boolean> {
  const exe = findLocalOllamaExecutable()
  if (!exe) return false

  console.log(`Starting local Ollama service: ${exe} serve`)
  const child = spawn(exe, ['serve'], { detached: true, stdio: 'ignore' })
  child.unref()
  return await waitForOllama(15000)
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath)
    httpGet(url, response => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject)
        return
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: status ${response.statusCode}`))
        return
      }
      response.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
    }).on('error', err => {
      file.close()
      reject(err)
    })
  })
}

export async function installOllamaSilently(): Promise<boolean> {
  const platform = process.platform
  console.log(`Attempting silent Ollama setup on platform: ${platform}`)

  try {
    if (platform === 'win32') {
      const installerPath = join(tmpdir(), 'OllamaSetup.exe')
      console.log('Downloading OllamaSetup.exe...')
      await downloadFile('https://ollama.com/download/OllamaSetup.exe', installerPath)
      console.log('Running OllamaSetup.exe /silent...')
      const proc = spawn(installerPath, ['/silent'], { stdio: 'ignore' })
      await new Promise(resolve => proc.on('exit', resolve))
      return await waitForOllama(30000)
    } else if (platform === 'darwin') {
      if (existsSync('/Applications/Ollama.app')) {
        spawn('open', ['-a', 'Ollama', '--args', '--hidden'])
        return await waitForOllama(20000)
      }
      const bin = findLocalOllamaExecutable()
      if (bin) {
        return await startLocalOllama()
      }
    } else if (platform === 'linux') {
      const bin = findLocalOllamaExecutable()
      if (bin) {
        return await startLocalOllama()
      }
    }
  } catch (err) {
    console.error('Failed silent Ollama installation:', err)
  }

  return false
}

export async function ensureOllamaService(): Promise<void> {
  if (await isOllamaReachable()) {
    console.log('Ollama is already running and ready.')
    return
  }

  console.log('Ollama not running, searching for local executable...')
  const started = await startLocalOllama()
  if (started) {
    console.log('Ollama successfully started in background.')
    return
  }

  console.log('Ollama not found locally, executing silent install...')
  const installed = await installOllamaSilently()
  if (installed) {
    console.log('Ollama installed and running.')
  } else {
    console.warn(
      'Could not auto-start or silently install Ollama. Local LLM will be unavailable until Ollama is started.'
    )
  }
}


import { app, BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { ChildProcess } from 'child_process'
import { spawn } from 'child_process'
import { ensureOllamaService } from './ollama'

let backendProcess: ChildProcess | null = null

function startBackend(): void {
  const ext = process.platform === 'win32' ? '.exe' : ''
  const packagedPath = join(process.resourcesPath, 'bin', `api-backend${ext}`)
  const devBinPath = join(__dirname, '../../bin', `api-backend${ext}`)

  const backendPath = app.isPackaged
    ? packagedPath
    : existsSync(devBinPath)
      ? devBinPath
      : null

  if (backendPath && existsSync(backendPath)) {
    const userDataPath = app.getPath('userData')
    const dataDir = join(userDataPath, 'data')
    const secretsDir = join(userDataPath, 'secrets')
    const dbPath = join(dataDir, 'fireform.db')
    const secretKeyFile = join(secretsDir, 'llm_secret.key')

    mkdirSync(dataDir, { recursive: true })
    mkdirSync(secretsDir, { recursive: true })

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      FIREFORM_DESKTOP: 'true',
      FIREFORM_DATA_DIR: dataDir,
      DATABASE_URL: `sqlite:///${dbPath}`,
      LLM_SECRET_KEY_FILE: secretKeyFile,
      PORT: '8000',
    }

    console.log(`Starting FireForm API backend from ${backendPath}...`)
    backendProcess = spawn(backendPath, [], { env, stdio: 'ignore' })
    backendProcess.on('error', err => {
      console.error('Failed to start backend process.', err)
    })
    backendProcess.on('exit', (code, signal) => {
      console.log(`Backend process exited with code ${code}, signal ${signal}`)
    })
  } else {
    console.log('No bundled binary found; assuming backend running via Docker or local uvicorn.')
  }
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
    },
  })

  // The renderer cancels unload (beforeunload) when Studio has unsaved work; Electron would
  // then silently ignore the close/reload/quit, so ask the user instead.
  win.webContents.on('will-prevent-unload', event => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['Leave', 'Stay'],
      defaultId: 1,
      cancelId: 1,
      message: 'You have unsaved changes in FireForm.',
      detail: 'Leave and discard them?',
    })
    if (choice === 0) event.preventDefault()
  })

  win.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(permission === 'media')
    }
  )

  if (app.isPackaged) {
    win.loadFile(join(__dirname, '../../renderer/index.html'))
  } else {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']!)
    // win.webContents.openDevTools()
  }
}

app.whenReady().then(async () => {
  startBackend()
  void ensureOllamaService()
  createWindow()
})

app.on('will-quit', () => {
  if (backendProcess && backendProcess.pid) {
    if (process.platform === 'win32') {
      try {
        spawn('taskkill', ['/pid', backendProcess.pid.toString(), '/T', '/F'])
      } catch {
        backendProcess.kill()
      }
    } else {
      backendProcess.kill('SIGTERM')
    }
    backendProcess = null
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

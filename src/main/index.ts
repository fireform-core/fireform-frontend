import { app, BrowserWindow, dialog, Menu, shell } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { ChildProcess } from 'child_process'
import { spawn } from 'child_process'
import { ensureOllamaService, stopOwnedOllama } from './ollama'
import { captureAppLog, getLogDir, openLogFile } from './logs'

app.setName('FireForm')

let backendProcess: ChildProcess | null = null
let quitting = false

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
      FIREFORM_TEMPLATE_DIR: join(dataDir, 'inputs'),
      DATABASE_URL: `sqlite:///${dbPath}`,
      LLM_SECRET_KEY_FILE: secretKeyFile,
      PORT: '8000',
    }

    console.log(`Starting FireForm API backend from ${backendPath}...`)
    // The backend's own output is the only record of why it failed to start, so keep it.
    const logFd = openLogFile('backend.log')
    backendProcess = spawn(backendPath, [], {
      env,
      stdio: logFd === null ? 'ignore' : ['ignore', logFd, logFd],
    })
    backendProcess.on('error', err => {
      console.error('Failed to start backend process.', err)
      reportBackendFailure('FireForm could not start its backend.')
    })
    backendProcess.on('exit', (code, signal) => {
      console.log(`Backend process exited with code ${code}, signal ${signal}`)
      if (!quitting) reportBackendFailure('The FireForm backend stopped unexpectedly.')
    })
  } else {
    console.log('No bundled binary found; assuming backend running via Docker or local uvicorn.')
  }
}

function reportBackendFailure(message: string): void {
  const choice = dialog.showMessageBoxSync({
    type: 'error',
    buttons: ['Open Logs Folder', 'Close'],
    defaultId: 0,
    cancelId: 1,
    message,
    detail:
      'Quit and reopen FireForm. If it keeps happening, something else may be using port 8000. ' +
      'The logs folder has backend.log and app.log, which show what went wrong.',
  })
  if (choice === 0) void shell.openPath(getLogDir())
}

// Adds Help > Open Logs Folder to the standard menus.
function buildMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
      { role: 'fileMenu' },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
      {
        role: 'help',
        submenu: [{ label: 'Open Logs Folder', click: () => void shell.openPath(getLogDir()) }],
      },
    ])
  )
}

async function startOllama(): Promise<void> {
  if (await ensureOllamaService()) return
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Get Ollama', 'Not now'],
    defaultId: 0,
    cancelId: 1,
    message: 'FireForm needs Ollama to fill forms.',
    detail:
      'Ollama runs the AI model on this computer, and FireForm could not find or start it. ' +
      'Install it from ollama.com, then reopen FireForm. You can still browse templates without it.',
  })
  if (response === 0) void shell.openExternal('https://ollama.com/download')
}

function createWindow(): void {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
    },
  })

  win.on('ready-to-show', () => {
    win.show()
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
    win.loadFile(join(__dirname, '../renderer/index.html'))
  } else if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    // win.webContents.openDevTools()
  }
}

app.whenReady().then(async () => {
  captureAppLog()
  buildMenu()
  if (process.platform === 'darwin' && app.dock) {
    const dockIconPath = join(__dirname, '../../resources/icon.png')
    if (existsSync(dockIconPath)) {
      app.dock.setIcon(dockIconPath)
    }
  }
  startBackend()
  void startOllama()
  createWindow()
})

app.on('before-quit', () => {
  quitting = true
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
  stopOwnedOllama()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

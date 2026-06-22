import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { spawn, ChildProcess } from 'child_process'

let backendProcess: ChildProcess | null = null

function startBackend(): void {
  if (app.isPackaged) {
    const ext = process.platform === 'win32' ? '.exe' : ''
    const backendPath = join(process.resourcesPath, 'bin', `api-backend${ext}`)
    backendProcess = spawn(backendPath, [], { stdio: 'ignore' })
    backendProcess.on('error', err => {
      console.error('Failed to start backend process.', err)
    })
  } else {
    console.log('Development mode: backend assumed running via Docker.')
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

app.whenReady().then(() => {
  startBackend()
  createWindow()
})

app.on('will-quit', () => {
  backendProcess?.kill()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

import { app, BrowserWindow, dialog, shell } from 'electron'
import { join } from 'path'
import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process'

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

  // Control how window.open(url, '_blank') calls from the renderer are handled.
  //
  // Three cases:
  //   1. Approved HTTPS origins used by the Legal settings page
  //      → open in the system browser via shell.openExternal; deny the child window.
  //   2. blob: URLs and http://localhost (PDF pop-outs in DocumentViewer / PdfPreviewer)
  //      → allow as a child BrowserWindow (existing behaviour, unchanged).
  //   3. Everything else (unexpected schemes or origins)
  //      → deny silently.
  //
  // No contextBridge IPC is needed: the renderer still calls window.open() unchanged;
  // routing is decided entirely here in the main process.
  win.webContents.setWindowOpenHandler(({ url }) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return { action: 'deny' }
    }

    if (parsed.protocol === 'https:') {
      const approvedHosts = [
        'github.com',
        'www.github.com',
        'contributor-covenant.org',
        'www.contributor-covenant.org',
      ]
      if (approvedHosts.includes(parsed.hostname)) {
        shell.openExternal(url).catch(err => {
          console.error('Failed to open external URL:', err)
        })
      }
      // Deny the child BrowserWindow in all HTTPS cases — either shell.openExternal
      // was called above, or the origin is not approved and should be blocked.
      return { action: 'deny' }
    }

    // blob: URLs are created by URL.createObjectURL() for local PDF uploads;
    // http://localhost and http://127.0.0.1 are used by resolvePreviewUrl() and dev servers.
    // Both should open as child BrowserWindows (Electron's PDF viewer).
    if (
      parsed.protocol === 'blob:' ||
      (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'))
    ) {
      return { action: 'allow' }
    }

    return { action: 'deny' }
  })

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

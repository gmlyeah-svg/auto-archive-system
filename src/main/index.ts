import { app, BrowserWindow, protocol, net, shell } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { pathToFileURL } from 'url'
import { initConfig, ensureDataDirs } from './dataDir'
import { initDb } from './db'
import { registerIpc } from './ipc'
import { resolveImagePath } from './images'

// 注册图片自定义协议的权限
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'archiveimg',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: false }
  }
])

function registerImageProtocol(): void {
  protocol.handle('archiveimg', (request) => {
    try {
      const url = new URL(request.url)
      const rel = url.searchParams.get('p')
      if (!rel) return new Response('missing path', { status: 400 })
      const abs = resolveImagePath(rel)
      if (!fs.existsSync(abs)) return new Response('not found', { status: 404 })
      return net.fetch(pathToFileURL(abs).toString())
    } catch (e) {
      return new Response('error: ' + String(e), { status: 500 })
    }
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'AutoArchive',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  initConfig()
  ensureDataDirs()
  await initDb()
  registerImageProtocol()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

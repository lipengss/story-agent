import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join, dirname } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let dataPath = ''

// Default to user's AppData folder
function getDefaultDataPath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'storyagent-data')
}

// Ensure data directory exists
function ensureDataDir(): void {
  if (!dataPath) dataPath = getDefaultDataPath()
  if (!existsSync(dataPath)) {
    mkdirSync(dataPath, { recursive: true })
  }
}

// Read persisted config for data path
function loadConfig(): { dataPath?: string } {
  const configPath = join(app.getPath('userData'), 'storyagent-config.json')
  try {
    if (existsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, 'utf-8'))
    }
  } catch { /* ignore */ }
  return {}
}

// Save config
function saveConfig(config: Record<string, any>): void {
  const configPath = join(app.getPath('userData'), 'storyagent-config.json')
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

// Get path for a data file
function getDataFile(key: string): string {
  ensureDataDir()
  return join(dataPath, `storyagent_${key}.json`)
}

// IPC Handlers
function setupIPC(): void {
  // Read data
  ipcMain.handle('data:read', (_event, key: string) => {
    try {
      const filePath = getDataFile(key)
      if (existsSync(filePath)) {
        const raw = readFileSync(filePath, 'utf-8')
        return JSON.parse(raw)
      }
    } catch { /* ignore */ }
    return null
  })

  // Write data
  ipcMain.handle('data:write', (_event, key: string, data: any) => {
    try {
      const filePath = getDataFile(key)
      writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
      return true
    } catch (e: any) {
      console.error('data:write error:', e.message)
      return false
    }
  })

  // Delete data
  ipcMain.handle('data:delete', (_event, key: string) => {
    try {
      const filePath = getDataFile(key)
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
      return true
    } catch { return false }
  })

  // List all data keys
  ipcMain.handle('data:keys', () => {
    try {
      ensureDataDir()
      return readdirSync(dataPath)
        .filter(f => f.startsWith('storyagent_') && f.endsWith('.json'))
        .map(f => f.replace('storyagent_', '').replace('.json', ''))
    } catch { return [] }
  })

  // Export single file
  ipcMain.handle('data:export-file', async (_event, key: string, content: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '导出文件',
      defaultPath: `${key}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (!result.canceled && result.filePath) {
      writeFileSync(result.filePath, content, 'utf-8')
      return result.filePath
    }
    return null
  })

  // Get/set data path
  ipcMain.handle('config:get-data-path', () => dataPath)
  ipcMain.handle('config:set-data-path', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '选择数据存储文件夹',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (!result.canceled && result.filePaths.length > 0) {
      dataPath = result.filePaths[0]
      ensureDataDir()
      saveConfig({ dataPath })
      return dataPath
    }
    return null
  })

  // Proxy HTTP fetch through main process (no CORS in Node.js)
  ipcMain.handle('api:fetch', async (_event, url: string, options: { headers?: Record<string, string>; body?: string; method?: string }) => {
    try {
      const res = await fetch(url, {
        method: options.method || 'POST',
        headers: options.headers || { 'Content-Type': 'application/json' },
        body: options.body,
      })
      const text = await res.text()
      return { ok: res.ok, status: res.status, text }
    } catch (e: any) {
      return { ok: false, status: 0, text: '', error: e.message }
    }
  })

  // Get app version
  ipcMain.handle('app:version', () => app.getVersion())

  // Get platform info
  ipcMain.handle('app:platform', () => process.platform)
}

function createWindow(): void {
  // vite-plugin-electron sets VITE_DEV_SERVER_URL in dev mode
  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  // Icon path: in dev use public/, in prod use dist/ (copied from public/)
  const iconPath = devServerUrl
    ? join(app.getAppPath(), 'public/logo.png')
    : join(__dirname, '../dist/logo.png')

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    title: 'StoryAgent — AI 写作工具',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl)
    // Open DevTools in dev mode for debugging
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  // Set title
  mainWindow.on('page-title-updated', (e) => e.preventDefault())

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// App lifecycle
app.whenReady().then(() => {
  // Hide the default menu bar
  Menu.setApplicationMenu(null)

  // Load saved config
  const config = loadConfig()
  if (config.dataPath) dataPath = config.dataPath
  else dataPath = getDefaultDataPath()

  setupIPC()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

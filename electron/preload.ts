import { contextBridge, ipcRenderer } from 'electron'

/** Expose safe APIs to the renderer process via contextBridge */
contextBridge.exposeInMainWorld('electronAPI', {
  // Data file operations
  readData: (key: string): Promise<any> => ipcRenderer.invoke('data:read', key),
  writeData: (key: string, data: any): Promise<boolean> => ipcRenderer.invoke('data:write', key, data),
  deleteData: (key: string): Promise<boolean> => ipcRenderer.invoke('data:delete', key),
  listKeys: (): Promise<string[]> => ipcRenderer.invoke('data:keys'),

  // File export
  exportFile: (key: string, content: string): Promise<string | null> => ipcRenderer.invoke('data:export-file', key, content),

  // Config
  getDataPath: (): Promise<string> => ipcRenderer.invoke('config:get-data-path'),
  setDataPath: (): Promise<string | null> => ipcRenderer.invoke('config:set-data-path'),

  // API proxy (no CORS in main process)
  apiFetch: (url: string, options?: { headers?: Record<string, string>; body?: string; method?: string }): Promise<{ ok: boolean; status: number; text: string; error?: string }> =>
    ipcRenderer.invoke('api:fetch', url, options || {}),

  // App info
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  getPlatform: (): Promise<string> => ipcRenderer.invoke('app:platform'),
})

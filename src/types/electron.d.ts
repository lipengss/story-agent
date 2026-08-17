/** Electron API exposed via contextBridge in preload.ts */
export interface ElectronAPI {
  readData(key: string): Promise<any>
  writeData(key: string, data: any): Promise<boolean>
  deleteData(key: string): Promise<boolean>
  listKeys(): Promise<string[]>
  exportFile(key: string, content: string): Promise<string | null>
  getDataPath(): Promise<string>
  setDataPath(): Promise<string | null>
  getVersion(): Promise<string>
  getPlatform(): Promise<string>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}

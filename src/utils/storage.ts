import type { UserPreferences, ProjectMeta, Graph, Skill, LLMConfig, Version } from '@/types'

const STORAGE_PREFIX = 'storyagent_'

// Electron API bridge (available when running in Electron)
const electron = (window as any).electronAPI

export function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data))
  } catch (e) {
    console.error('Storage save failed:', e)
  }
  // Also persist to disk in Electron
  if (electron) {
    // Use JSON round-trip to strip Vue reactivity proxies before IPC
    // (structured clone in IPC cannot handle Proxy objects)
    const plain = JSON.parse(JSON.stringify(data))
    electron.writeData(key, plain).catch((e: any) => console.error('Electron save failed:', e))
  }
}

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

/** Initialize storage — in Electron, sync data from disk to localStorage on startup */
export async function initStorage(): Promise<void> {
  if (!electron) return
  try {
    const keys = await electron.listKeys()
    for (const key of keys) {
      const data = await electron.readData(key)
      if (data !== null && data !== undefined) {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data))
      }
    }
  } catch (e) {
    console.error('Electron storage init failed:', e)
  }
}

// User Preferences
export function loadPreferences(): UserPreferences {
  return loadFromStorage<UserPreferences>('preferences', {
    theme: 'system',
    language: 'zh',
    lastOpenProjectId: null,
    autoSave: true,
  })
}

export function savePreferences(prefs: UserPreferences): void {
  saveToStorage('preferences', prefs)
}

// API Configs
export function loadApiConfigs(): LLMConfig[] {
  const configs = loadFromStorage<LLMConfig[]>('apiConfigs', [])
  // Migrate old model names
  let migrated = false
  for (const c of configs) {
    if (c.model === 'deepseek-chat') { c.model = 'deepseek-v4-pro'; migrated = true }
    if (c.model === 'deepseek-reasoner') { c.model = 'deepseek-v4-flash'; migrated = true }
  }
  if (migrated) saveToStorage('apiConfigs', configs)
  return configs
}

export function saveApiConfigs(configs: LLMConfig[]): void {
  saveToStorage('apiConfigs', configs)
}

// Skills
export function loadSkills(): Skill[] {
  return loadFromStorage<Skill[]>('skills', [])
}

export function saveSkills(skills: Skill[]): void {
  saveToStorage('skills', skills)
}

// Project List
export function loadProjectList(): ProjectMeta[] {
  return loadFromStorage<ProjectMeta[]>('projectList', [])
}

export function saveProjectList(projects: ProjectMeta[]): void {
  saveToStorage('projectList', projects)
}

// Project Data
export function loadGraph(projectId: string): Graph {
  return loadFromStorage<Graph>(`project_${projectId}_graph`, {
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  })
}

export function saveGraph(projectId: string, graph: Graph): void {
  saveToStorage(`project_${projectId}_graph`, graph)
}

export function loadVersions(projectId: string): Version[] {
  return loadFromStorage<Version[]>(`project_${projectId}_versions`, [])
}

export function saveVersions(projectId: string, versions: Version[]): void {
  saveToStorage(`project_${projectId}_versions`, versions)
}

export function loadCurrentContent(projectId: string): string {
  return loadFromStorage<string>(`project_${projectId}_content`, '')
}

export function saveCurrentContent(projectId: string, content: string): void {
  saveToStorage(`project_${projectId}_content`, content)
}

// Delete all data for a project
export function deleteProjectData(projectId: string): void {
  const keys = [
    `project_${projectId}_graph`,
    `project_${projectId}_versions`,
    `project_${projectId}_content`,
  ]
  for (const key of keys) {
    localStorage.removeItem(STORAGE_PREFIX + key)
    // Also remove the persisted disk copy in Electron
    if (electron) {
      electron.deleteData(key).catch((e: any) => console.error('Electron delete failed:', e))
    }
  }
}

// Generate unique ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9)
}

// Simple base64 encode (for API key obfuscation - not secure, just visual)
export function obfuscateApiKey(key: string): string {
  try {
    return btoa(key)
  } catch {
    return key
  }
}

export function deobfuscateApiKey(encoded: string): string {
  try {
    return atob(encoded)
  } catch {
    return encoded
  }
}

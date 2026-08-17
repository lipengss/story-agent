// ============ Node Types ============
export type NodeType = 'theme' | 'articleType' | 'skill' | 'plot' | 'character' | 'scene' | 'text' | 'reference'

// ============ Article Types ============
export interface ArticleType {
  id: string
  name: string
  description: string
  icon: string
  systemPrompt: string
  features: string[]
  typicalLength: string
  targetReader: string
}

// ============ Skill ============
export interface SkillVariable {
  name: string
  label: string
  defaultValue: string
  required: boolean
}

export interface Skill {
  id: string
  name: string
  category: SkillCategory
  description: string
  promptFragment: string
  variables: SkillVariable[]
  exampleInput?: string
  exampleOutput?: string
  createdAt: number
  updatedAt: number
}

export type SkillCategory = 'style' | 'structure' | 'character' | 'world'

export const SkillCategoryLabels: Record<SkillCategory, string> = {
  style: '风格',
  structure: '结构',
  character: '角色',
  world: '世界',
}

// ============ Graph ============
export interface StoryNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: Record<string, any>
  style?: Record<string, any>
}

export interface StoryEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export interface Graph {
  nodes: StoryNode[]
  edges: StoryEdge[]
  viewport: { x: number; y: number; zoom: number }
}

// ============ Version ============
export interface Version {
  id: string
  label: string
  content: string
  timestamp: number
}

// ============ LLM Config ============
export type LLMProvider = 'openai' | 'anthropic' | 'deepseek' | 'custom'

export interface LLMConfig {
  id: string
  name: string
  provider: LLMProvider
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  topP: number
  isDefault: boolean
}

export const ProviderDefaults: Record<LLMProvider, { baseUrl: string; models: string[] }> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-5', 'claude-opus-4-8', 'claude-haiku-4-5'],
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-v4-pro', 'deepseek-v4-flash'],
  },
  custom: {
    baseUrl: '',
    models: [],
  },
}

// ============ App State ============
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  language: 'zh' | 'en'
  lastOpenProjectId: string | null
  autoSave: boolean
}

export interface ProjectMeta {
  id: string
  name: string
  articleTypeId: string
  group: string
  createdAt: number
  updatedAt: number
}

// ============ Chat ============
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

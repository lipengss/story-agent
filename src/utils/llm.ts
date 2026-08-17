import type { LLMConfig } from '@/types'

export interface LLMRequest {
  config: LLMConfig
  systemPrompt: string
  userPrompt: string
  signal?: AbortSignal
}

export interface LLMTestResult {
  success: boolean
  error?: string
  model?: string
}

export async function callLLM(req: LLMRequest): Promise<string> {
  const { config, systemPrompt, userPrompt, signal } = req

  const headers: Record<string, string> = {}

  if (config.provider === 'openai' || config.provider === 'deepseek' || config.provider === 'custom') {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  } else if (config.provider === 'anthropic') {
    headers['x-api-key'] = config.apiKey
    headers['anthropic-version'] = '2023-06-01'
  }

  const body = buildRequestBody(config, systemPrompt, userPrompt)
  const isAnthropic = config.provider === 'anthropic'
  const endpoint = isAnthropic ? `${config.baseUrl}/messages` : `${config.baseUrl}/chat/completions`

  // Route: Electron main process (production) > Vite proxy (dev) > direct fetch (browser)
  const isDev = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV
  const electron = (window as any).electronAPI
  let response: Response

  if (electron && !isDev) {
    // Electron production: route through main process (no CORS issues)
    const result = await electron.apiFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
    if (!result.ok) {
      let errMsg: string
      try { const errJson = JSON.parse(result.text); errMsg = errJson.error?.message || result.text }
      catch { errMsg = result.text }
      throw new Error(`[${result.status}] ${errMsg || result.error}`)
    }
    const data = JSON.parse(result.text)
    if (config.provider === 'anthropic') {
      return data.content?.[0]?.text ?? ''
    }
    return data.choices?.[0]?.message?.content ?? ''
  } else if (isDev) {
    // Dev mode: route through Vite proxy
    response = await fetch('/api/llm-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Target-Url': endpoint,
        'X-Forwarded-Headers': JSON.stringify(headers),
      },
      body: JSON.stringify(body),
      signal,
    })
  } else {
    headers['Content-Type'] = 'application/json'
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })
  }

  if (!response.ok) {
    const errText = await response.text()
    let errMsg: string
    try {
      const errJson = JSON.parse(errText)
      errMsg = errJson.error?.message || errText
    } catch {
      errMsg = errText
    }
    throw new Error(`[${response.status}] ${errMsg}`)
  }

  const data = await response.json()

  if (config.provider === 'anthropic') {
    return data.content?.[0]?.text ?? ''
  }
  return data.choices?.[0]?.message?.content ?? ''
}

function buildRequestBody(config: LLMConfig, systemPrompt: string, userPrompt: string) {
  if (config.provider === 'anthropic') {
    return {
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      top_p: config.topP,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }
  }
  return {
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    top_p: config.topP,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  }
}

export async function testLLMConnection(config: LLMConfig): Promise<LLMTestResult> {
  // Validate required fields
  if (!config.apiKey || !config.apiKey.trim()) {
    return { success: false, error: 'API Key 不能为空，请在右侧面板中输入' }
  }
  if (!config.baseUrl || !config.baseUrl.trim()) {
    return { success: false, error: 'Base URL 不能为空' }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    const response = await callLLM({
      config: { ...config, maxTokens: 10 },
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'Reply with just "OK".',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    const modelInfo = response.length > 0 ? 'connected' : 'empty-response'
    return { success: true, model: modelInfo }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      return { success: false, error: '连接超时，请检查网络或 API 地址' }
    }
    return { success: false, error: e.message || '未知错误' }
  }
}

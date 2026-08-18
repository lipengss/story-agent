import { callLLM } from './llm'
import { loadApiConfigs } from './storage'
import type { LLMConfig } from '@/types'

export interface ReferenceFetchResult {
  success: boolean
  title?: string
  content?: string
  compressed?: boolean
  note?: string
  error?: string
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

const SUMMARIZE_MAX_INPUT = 8000

/** 拉取网页原始 HTML：优先走 Electron 主进程（无 CORS），浏览器环境回退直接 fetch */
async function fetchHtml(url: string): Promise<string> {
  const electron = (window as any).electronAPI
  if (electron?.apiFetch) {
    const res = await electron.apiFetch(url, { method: 'GET', headers: BROWSER_HEADERS })
    if (!res.ok) throw new Error(`抓取失败 [${res.status}]${res.error ? ' ' + res.error : ''}`)
    return res.text
  }
  // 浏览器开发环境回退（可能受 CORS 限制）
  const res = await fetch(url, { headers: BROWSER_HEADERS })
  if (!res.ok) throw new Error(`抓取失败 [${res.status}]`)
  return await res.text()
}

/** 从 HTML 提取正文。兼容百度百科等常见资讯/百科站点的结构 */
function extractMainText(doc: Document): { title: string; content: string } {
  const title = (doc.querySelector('h1')?.textContent || doc.querySelector('title')?.textContent || '')
    .replace(/_百度百科$/, '').replace(/[_-]?百度百科$/, '').trim()

  const selectors = ['.main-content', '.lemma-content', '.J-lemma-content', '.content-wrapper', 'article', 'main', 'body']
  let container: Element | null = null
  for (const sel of selectors) {
    const el = doc.querySelector(sel)
    if (el && (el.textContent || '').replace(/\s+/g, '').length > 40) { container = el; break }
  }

  let content = ''
  if (container) {
    // 去掉脚本/样式/导航噪声，保留正文文字
    container.querySelectorAll('script,style,noscript,nav,aside,footer,header').forEach(el => el.remove())
    content = (container.textContent || '').replace(/\s+/g, ' ').trim()
  }

  // 兜底：正文提取不足时用页面描述
  if (!content || content.length < 20) {
    content = (doc.querySelector('meta[name="description"]')?.getAttribute('content') || '').trim()
  }

  return { title, content }
}

function getDefaultLLMConfig(): LLMConfig | undefined {
  const configs = loadApiConfigs()
  return configs.find(c => c.isDefault) ?? configs[0]
}

/** 用 AI 把长文压缩成要点。未配置 API Key 返回 null */
async function summarizeText(text: string, config: LLMConfig): Promise<string | null> {
  const input = text.length > SUMMARIZE_MAX_INPUT ? text.substring(0, SUMMARIZE_MAX_INPUT) : text
  const systemPrompt = '你是资料提炼助手，擅长把长文压缩成要点，保留关键信息。'
  const userPrompt = `请把下面的参考资料压缩成要点：\n1. 保留所有关键事实（人名、时间、地点、数字、作品、事件、关系等）\n2. 输出 300~500 字，用「·」分条\n3. 直接输出要点，不要任何说明\n\n参考资料：\n${input}`
  const result = await callLLM({
    config: { ...config, maxTokens: 1000, temperature: 0.2 },
    systemPrompt,
    userPrompt,
  })
  return result?.trim() || null
}

/** 抓取参考链接正文，并（在已配置 API Key 时）自动压缩为要点 */
export async function fetchAndCompressReference(url: string): Promise<ReferenceFetchResult> {
  const fetched = await fetchReferenceText(url)
  if (!fetched.success) return fetched

  const config = getDefaultLLMConfig()
  if (!config || !config.apiKey) {
    return { success: true, title: fetched.title, content: fetched.content, compressed: false, note: '未配置 API Key，已保留原文（可手动精简）' }
  }
  try {
    const summary = await summarizeText(fetched.content!, config)
    if (summary) {
      return { success: true, title: fetched.title, content: summary, compressed: true, note: '已抓取并压缩为要点' }
    }
  } catch { /* 压缩失败，回退原文 */ }
  return { success: true, title: fetched.title, content: fetched.content, compressed: false, note: '压缩失败，已保留原文' }
}

/** 抓取参考链接，返回可喂给 AI 的标题 + 正文文本（不压缩） */
export async function fetchReferenceText(url: string): Promise<ReferenceFetchResult> {
  if (!url || !/^https?:\/\//i.test(url)) {
    return { success: false, error: '请输入有效的 http/https 链接' }
  }
  try {
    const html = await fetchHtml(url)
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const { title, content } = extractMainText(doc)
    if (!content) {
      return { success: false, error: '未能从该页面提取到正文，可能是动态加载或反爬页面，请手动复制正文' }
    }
    return { success: true, title, content }
  } catch (e: any) {
    return { success: false, error: e?.message || '抓取失败' }
  }
}

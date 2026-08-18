export type HotTopicSource = 'weibo' | 'baidu' | 'weibo+baidu'

export interface HotTopic {
  title: string
  heat?: string
  source: HotTopicSource
  desc?: string
}

export interface HotTopicsResult {
  success: boolean
  topics: HotTopic[]
  note?: string
  error?: string
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json,text/plain,*/*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

const WEIBO_URL = 'https://weibo.com/ajax/side/hotSearch'
const BAIDU_URL = 'https://top.baidu.com/api/board?platform=wise&tab=realtime'
const MAX_TOPICS = 30

/** 抓取 JSON 接口：优先走 Electron 主进程（无 CORS），浏览器环境回退直接 fetch */
async function apiFetchJson(url: string, extraHeaders: Record<string, string> = {}): Promise<any> {
  const headers = { ...BROWSER_HEADERS, ...extraHeaders }
  const electron = (window as any).electronAPI
  if (electron?.apiFetch) {
    const res = await electron.apiFetch(url, { method: 'GET', headers })
    if (!res.ok) throw new Error(`抓取失败 [${res.status}]${res.error ? ' ' + res.error : ''}`)
    return JSON.parse(res.text)
  }
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`抓取失败 [${res.status}]`)
  return await res.json()
}

function formatHeat(n: string | number): string {
  const num = Number(n)
  if (!num || Number.isNaN(num)) return String(n)
  if (num >= 100000000) return (num / 100000000).toFixed(1) + '亿'
  if (num >= 10000) return Math.round(num / 10000) + '万'
  return String(num)
}

async function fetchWeibo(): Promise<HotTopic[]> {
  const data = await apiFetchJson(WEIBO_URL, { Referer: 'https://weibo.com/' })
  const list: any[] = data?.data?.realtime || []
  return list
    .map((it: any) => ({
      title: String(it.word || '').replace(/#/g, '').trim(),
      heat: it.num ? formatHeat(it.num) : undefined,
      source: 'weibo' as const,
    }))
    .filter((t: HotTopic) => !!t.title)
}

async function fetchBaidu(): Promise<HotTopic[]> {
  const data = await apiFetchJson(BAIDU_URL, { Referer: 'https://top.baidu.com/' })
  // 百度热搜结构为 data.cards[].content[]，其中每项可能是 { content: [...] } 或直接是条目
  const cards: any[] = data?.data?.cards || []
  const items: any[] = []
  for (const card of cards) {
    const arr = card?.content || []
    for (const x of arr) {
      if (Array.isArray(x)) items.push(...x)
      else if (x && Array.isArray(x.content)) items.push(...x.content)
    }
  }
  return items
    .map((it: any) => ({
      title: String(it.word || '').trim(),
      source: 'baidu' as const,
    }))
    .filter((t: HotTopic) => !!t.title)
}

function normalizeTitle(t: string): string {
  return t
    .replace(/\s+/g, '')
    .replace(/[#「」《》“”]/g, '')
    .replace(/[。.!！?？…~～]+$/g, '')
    .toLowerCase()
}

/** 合并微博 + 百度热搜，按标题去重、交错排序、封顶 MAX_TOPICS 条 */
export function mergeHotTopics(weibo: HotTopic[], baidu: HotTopic[]): HotTopic[] {
  const map = new Map<string, HotTopic>()
  const order: string[] = []
  const maxLen = Math.max(weibo.length, baidu.length)
  for (let i = 0; i < maxLen; i++) {
    for (const t of [weibo[i], baidu[i]]) {
      if (!t) continue
      const key = normalizeTitle(t.title)
      const existing = map.get(key)
      if (!existing) {
        map.set(key, { ...t })
        order.push(key)
      } else {
        existing.source = 'weibo+baidu'
        if (!existing.heat) existing.heat = t.heat
        if (!existing.desc) existing.desc = t.desc
      }
    }
  }
  return order.map((k) => map.get(k)!).slice(0, MAX_TOPICS)
}

const SOURCE_LABEL: Record<HotTopicSource, string> = {
  weibo: '微博热搜',
  baidu: '百度热搜',
  'weibo+baidu': '微博+百度',
}

/** 把热点列表格式化成可读文本，方便用户删改、也方便喂给 AI */
export function formatHotTopics(topics: HotTopic[]): string {
  return topics
    .map((t, i) => {
      const heat = t.heat ? `｜热度 ${t.heat}` : ''
      const desc = t.desc ? `——${t.desc}` : ''
      return `${i + 1}. 【${SOURCE_LABEL[t.source]}】${t.title}${heat}${desc}`
    })
    .join('\n')
}

/** 抓取本周热点（微博热搜 + 百度热搜合并去重）。单源失败不影响另一个 */
export async function fetchHotTopics(): Promise<HotTopicsResult> {
  const [weiboRes, baiduRes] = await Promise.allSettled([fetchWeibo(), fetchBaidu()])
  const weibo = weiboRes.status === 'fulfilled' ? weiboRes.value : []
  const baidu = baiduRes.status === 'fulfilled' ? baiduRes.value : []

  if (weibo.length === 0 && baidu.length === 0) {
    const reasons = [weiboRes, baiduRes]
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => (r.reason as any)?.message)
      .filter(Boolean)
    return { success: false, topics: [], error: reasons.length ? `热点抓取失败：${reasons.join('；')}` : '热点抓取失败：两个源都没有返回数据' }
  }

  const topics = mergeHotTopics(weibo, baidu)
  let note = `已抓取微博热搜 ${weibo.length} 条 + 百度热搜 ${baidu.length} 条，合并去重后 ${topics.length} 条`
  if (weibo.length === 0) note += '（微博热搜抓取失败，已改用百度热搜）'
  if (baidu.length === 0) note += '（百度热搜抓取失败，已改用微博热搜）'
  return { success: true, topics, note }
}

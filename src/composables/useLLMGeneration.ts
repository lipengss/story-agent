import { ref } from 'vue'
import { message, notification } from 'ant-design-vue'
import { useProjectStore } from '@/stores/project'
import { loadApiConfigs } from '@/utils/storage'
import { callLLM } from '@/utils/llm'
import type { StoryNode, LLMConfig } from '@/types'

export function useLLMGeneration() {
  const projectStore = useProjectStore()
  const running = ref(false)
  const abortController = ref<AbortController | null>(null)
  const queue = ref<string[]>([])

  function collectUpstream(targetId: string): StoryNode[] {
    const graph = projectStore.graph
    const visited = new Set<string>()
    const result: StoryNode[] = []

    function walk(nodeId: string) {
      if (visited.has(nodeId)) return
      visited.add(nodeId)
      const node = graph.nodes.find(n => n.id === nodeId)
      if (!node) return
      const incoming = graph.edges.filter(e => e.target === nodeId)
      for (const edge of incoming) walk(edge.source)
      if (nodeId !== targetId) result.push(node)
    }

    walk(targetId)
    return result
  }

  function buildPrompt(targetNode: StoryNode, upstream: StoryNode[]): { systemPrompt: string; userPrompt: string } {
    let systemPrompt = '你是一位写作助手。'
    const parts: string[] = []

    for (const node of upstream) {
      switch (node.type) {
        case 'theme':
          if (node.data.content) parts.push(`## 故事主题\n${node.data.content}`)
          break
        case 'articleType':
          if (node.data.systemPrompt) { systemPrompt = node.data.systemPrompt; parts.push(`## 文章类型\n${node.data.name}`) }
          break
        case 'skill':
          if (node.data.promptFragment) {
            let f = node.data.promptFragment
            if (node.data.variables) {
              for (const v of node.data.variables) f = f.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, 'g'), v.defaultValue || `[${v.label}]`)
            }
            parts.push(`## 写作风格\n${f}`)
          }
          break
        case 'character':
          if (node.data.description) parts.push(`## 人物：${node.data.name || '未命名'}\n${node.data.description}`)
          break
        case 'scene':
          if (node.data.description) parts.push(`## 场景：${node.data.name || '未命名'}\n${node.data.description}`)
          break
        case 'plot':
          if (node.data.summary) parts.push(`## 情节：${node.data.title || '未命名'}\n${node.data.summary}`)
          break
        case 'text':
          const prevContent = node.data.generated || node.data.content || ''
          if (prevContent) {
            const snippet = prevContent.substring(0, 150) + (prevContent.length > 150 ? '...' : '')
            parts.push(`## ${node.data.title} 概要\n${snippet}`)
          }
          break
        case 'reference':
          if (node.data.content) {
            const refTitle = node.data.title || '参考资料'
            const refUrl = node.data.sourceUrl ? `\n来源：${node.data.sourceUrl}` : ''
            parts.push(`## 参考资料：${refTitle}\n${node.data.content}${refUrl}`)
          }
          break
      }
    }

    const chapterTitle = targetNode.data.title || '章节'
    const chapterOutline = targetNode.data.content || ''

    parts.push(`## 本章：${chapterTitle}`)
    if (chapterOutline) parts.push(`用户对本章的设想：${chapterOutline}`)
    parts.push(`请创作本章的完整内容。写作要求：\n1. 本章就是${chapterTitle}，正文中如需提及章节号必须使用「${chapterTitle}」，不要出现其他章节编号\n2. 每段不超过3行，关键观点用 **加粗** 标注\n3. 自然融入 2-3 句可独立传播的金句\n4. 直接输出正文，不要加任何前置说明`)

    return { systemPrompt, userPrompt: parts.join('\n\n') }
  }

  async function generateNode(nodeId: string) {
    const configs = loadApiConfigs()
    const config: LLMConfig | undefined = configs.find(c => c.isDefault) ?? configs[0]
    if (!config || !config.apiKey) {
      notification.warning({
        message: '请先配置 API Key',
        description: '👆 点击前往右侧「AI 设置」',
        duration: 4,
        key: 'no-api-key-gen',
        onClick: () => {
          window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: { tab: 'ai-settings' } }))
          notification.close('no-api-key-gen')
        },
      })
      return
    }

    const targetNode = projectStore.graph.nodes.find(n => n.id === nodeId)
    if (!targetNode) return

    const chapterTitle = targetNode.data.title || '章节'
    const wordCount = targetNode.data.wordCount || 2000
    const upstream = collectUpstream(targetNode.id)
    const { systemPrompt, userPrompt } = buildPrompt(targetNode, upstream)
    const wordHint = `\n\n要求：总字数约${wordCount}字。`

    running.value = true
    abortController.value = new AbortController()
    projectStore.updateNode(targetNode.id, { _generating: true })
    window.dispatchEvent(new CustomEvent('generation-started'))

    try {
      const result = await callLLM({ config, systemPrompt, userPrompt: userPrompt + wordHint, signal: abortController.value.signal })
      projectStore.updateNode(targetNode.id, { generated: result })
      projectStore.content = result
      projectStore.createVersion()
      projectStore.saveProject()
      window.dispatchEvent(new CustomEvent('generation-complete'))
      message.success(`「${chapterTitle}」完成！${queue.value.length > 0 ? `队列剩余 ${queue.value.length} 章` : ''}`)
    } catch (e: any) {
      if (e.name === 'AbortError') { message.info('已停止'); queue.value = [] }
      else message.error(`失败：${e.message}`)
    } finally {
      projectStore.updateNode(targetNode.id, { _generating: false })
      running.value = false
      abortController.value = null
      if (queue.value.length > 0) setTimeout(() => processQueue(), 500)
    }
  }

  function queueGenerate(nodeId: string) {
    if (queue.value.includes(nodeId)) { message.info('该章节已在队列中'); return }
    queue.value.push(nodeId)
    if (!running.value) processQueue()
    else message.success(`已加入队列（第 ${queue.value.length} 位）`)
  }

  async function processQueue() {
    if (queue.value.length === 0) return
    const nodeId = queue.value.shift()!
    await generateNode(nodeId)
  }

  function clearQueue() { queue.value = [] }

  async function run() {
    const selected = projectStore.selectedNode
    const textNodes = projectStore.graph.nodes.filter(n => n.type === 'text')
    let targetId: string | null = null
    if (selected && (selected.type === 'text' || selected.type === 'plot')) targetId = selected.id
    else targetId = textNodes[textNodes.length - 1]?.id || null
    if (!targetId) { message.warning('请先创建章节节点'); return }
    await generateNode(targetId)
  }

  function stop() { abortController.value?.abort(); clearQueue() }

  return { running, queue, run, stop, queueGenerate, clearQueue }
}

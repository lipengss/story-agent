<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '@/stores/project'

const props = defineProps<{ targetId: string }>()
const emit = defineEmits(['confirm', 'cancel', 'generateAll'])
const projectStore = useProjectStore()

const targetNode = computed(() => projectStore.graph.nodes.find(n => n.id === props.targetId))
const upstreamNodes = computed(() => {
  const graph = projectStore.graph
  const visited = new Set<string>()
  const result: any[] = []

  function walk(nodeId: string) {
    if (visited.has(nodeId) || nodeId === props.targetId) return
    visited.add(nodeId)
    const node = graph.nodes.find(n => n.id === nodeId)
    if (!node) return
    const incoming = graph.edges.filter(e => e.target === nodeId)
    for (const edge of incoming) walk(edge.source)
    result.push(node)
  }
  walk(props.targetId)
  return result
})

function getSummary(node: any): { label: string; content: string; filled: boolean } {
  switch (node.type) {
    case 'theme': return { label: '故事主题', content: node.data.content?.substring(0, 80) || '', filled: !!node.data.content }
    case 'articleType': return { label: '文章类型', content: node.data.name || '', filled: true }
    case 'character': return { label: `人物：${node.data.name}`, content: node.data.description?.substring(0, 80) || '', filled: !!node.data.description }
    case 'scene': return { label: `场景：${node.data.name}`, content: node.data.description?.substring(0, 80) || '', filled: !!node.data.description }
    case 'plot': return { label: `情节：${node.data.title}`, content: node.data.summary?.substring(0, 80) || '', filled: !!node.data.summary }
    case 'skill': return { label: `风格：${node.data.name}`, content: node.data.promptFragment?.substring(0, 60) || '', filled: !!node.data.promptFragment }
    case 'text': return { label: `章节：${node.data.title}`, content: node.data.generated ? '✅ 已生成' : (node.data.content?.substring(0, 60) || '未填写'), filled: true }
    default: return { label: node.type, content: '', filled: false }
  }
}

function jumpToNode(nodeId: string) {
  projectStore.selectNode(nodeId)
}
</script>

<template>
  <div class="context-preview">
    <div class="cp-title">AI 生成上下文预览</div>
    <div class="cp-subtitle">以下内容将发送给 AI 用于生成「{{ targetNode?.data?.title || '章节' }}」</div>

    <div class="cp-list">
      <div v-for="node in upstreamNodes" :key="node.id" class="cp-item" :class="{ filled: getSummary(node).filled }" @click="jumpToNode(node.id)">
        <span class="cp-status">{{ getSummary(node).filled ? '✅' : '❌' }}</span>
        <span class="cp-label">{{ getSummary(node).label }}</span>
        <span class="cp-content">{{ getSummary(node).content || '（未填写，建议补充）' }}</span>
      </div>
    </div>

    <div class="cp-target" v-if="targetNode">
      <span class="cp-status">🎯</span>
      <span class="cp-label">目标章节</span>
      <span class="cp-content">{{ targetNode.data.title }} — {{ targetNode.data.content?.substring(0, 60) || '无要点' }}</span>
    </div>

    <div class="cp-actions">
      <a-button @click="emit('cancel')">取消</a-button>
      <a-button @click="emit('generateAll')" type="dashed">生成全部章节</a-button>
      <a-button type="primary" @click="emit('confirm')">确认生成</a-button>
    </div>
  </div>
</template>

<style scoped lang="less">
.context-preview {
  padding: 4px 0;
}

.cp-title { font-size: 16px; font-weight: 700; color: #1f2937; margin-bottom: 4px; }
.cp-subtitle { font-size: 13px; color: #6b7280; margin-bottom: 16px; }

.cp-list {
  display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;
  max-height: 320px; overflow-y: auto;
}

.cp-item, .cp-target {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  border-radius: 8px; border: 1px solid #e5e7eb; font-size: 13px;
  cursor: pointer; transition: all 0.15s;
  &:hover { background: #f9fafb; }
  &.filled { border-color: #d1fae5; background: #f0fdf4; }
}

.cp-target { border-color: #c7d2fe; background: #eef2ff; cursor: default; }

.cp-status { font-size: 13px; flex-shrink: 0; }
.cp-label { font-weight: 600; color: #374151; white-space: nowrap; flex-shrink: 0; }
.cp-content { color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }

.cp-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
</style>

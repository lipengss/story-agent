<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '@/stores/project'

const projectStore = useProjectStore()

const chapters = computed(() =>
  projectStore.graph.nodes.filter(n => n.type === 'text')
)

function selectChapter(nodeId: string) {
  const node = projectStore.graph.nodes.find(n => n.id === nodeId)
  if (node) {
    projectStore.selectNode(nodeId)
    projectStore.content = node.data.generated || node.data.content || ''
  }
}

function wordCount(text: string): number {
  return text?.length || 0
}
</script>

<template>
  <div class="chapter-outline" v-if="projectStore.projectMeta">
    <div class="section-label">章节目录（{{ chapters.length }}）</div>
    <div v-if="chapters.length === 0" class="empty-text">暂无章节</div>
    <div
      v-for="ch in chapters"
      :key="ch.id"
      class="ch-item"
      :class="{ active: projectStore.selectedNode?.id === ch.id }"
      @click="selectChapter(ch.id)"
    >
      <span class="ch-icon">{{ ch.data.generated ? '✅' : '📋' }}</span>
      <span class="ch-title">{{ ch.data.title || '未命名' }}</span>
      <span class="ch-count">{{ wordCount(ch.data.generated || ch.data.content) }} 字</span>
    </div>
  </div>
</template>

<style scoped lang="less">
.section-label {
  font-size: 11px; font-weight: 600; color: #6b7280;
  text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;
}

.ch-item {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px; border-radius: 6px; cursor: pointer;
  font-size: 12px; transition: background 0.15s;
  &:hover { background: #f3f4f6; }
  &.active { background: #eef2ff; color: #6366f1; font-weight: 500; }
}

.ch-icon { font-size: 12px; flex-shrink: 0; }
.ch-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ch-count { font-size: 10px; color: #9ca3af; flex-shrink: 0; }

.empty-text { font-size: 12px; color: #6b7280; padding: 4px; }
</style>

<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useProjectStore } from '@/stores/project'
import { useLLMGeneration } from '@/composables/useLLMGeneration'
import { message } from 'ant-design-vue'
import { getSavedLicense } from '@/utils/license'
import {
  SaveOutlined, ThunderboltOutlined, PauseCircleOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, QuestionCircleOutlined,
  DownloadOutlined, ClockCircleOutlined,
} from '@ant-design/icons-vue'

defineProps<{ leftCollapsed: boolean; rightCollapsed: boolean }>()
const emit = defineEmits(['toggleLeft', 'toggleRight'])

const projectStore = useProjectStore()
const { running, queue, run, stop, queueGenerate, clearQueue } = useLLMGeneration()

const licenseExpiry = computed(() => {
  const license = getSavedLicense()
  if (!license?.expiresAt) return null
  const d = new Date(license.expiresAt)
  const diff = d.getTime() - Date.now()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  const dateStr = d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  return { dateStr, days }
})

function getTargetNodeId(): string | null {
  const selected = projectStore.selectedNode
  const textNodes = projectStore.graph.nodes.filter(n => n.type === 'text')
  if (selected && (selected.type === 'text' || selected.type === 'plot')) return selected.id
  return textNodes[textNodes.length - 1]?.id || null
}

function handleGenerate() {
  const targetId = getTargetNodeId()
  if (!targetId) { message.warning('请先创建章节节点'); return }
  projectStore.selectNode(targetId)
  run()
}

function onGenerateAll() {
  const chapters = projectStore.graph.nodes.filter(n => n.type === 'text')
  for (const ch of chapters) {
    if (!ch.data.generated) queueGenerate(ch.id)
  }
  if (chapters.every(c => c.data.generated)) message.info('所有章节已生成完毕')
}

function handleSave() {
  projectStore.saveProject()
  message.success('项目已保存')
}

function onQueueGenerate(e: Event) {
  const nodeId = (e as CustomEvent).detail.nodeId
  if (nodeId) queueGenerate(nodeId)
}

onMounted(() => window.addEventListener('queue-generate', onQueueGenerate))
onUnmounted(() => window.removeEventListener('queue-generate', onQueueGenerate))

function reopenTour() {
  if ((window as any).__showTour) {
    (window as any).__showTour()
  }
}

function exportMarkdown() {
  const chapters = projectStore.graph.nodes.filter(n => n.type === 'text')
  let md = `# ${projectStore.projectMeta?.name || '未命名'}\n\n`

  // Theme
  const theme = projectStore.graph.nodes.find(n => n.type === 'theme')
  if (theme?.data.content) md += `> ${theme.data.content}\n\n---\n\n`

  // Characters
  const chars = projectStore.graph.nodes.filter(n => n.type === 'character')
  if (chars.length) {
    md += `## 人物设定\n`
    for (const c of chars) md += `- **${c.data.name}**：${c.data.description}\n`
    md += '\n---\n\n'
  }

  // Scenes
  const scenes = projectStore.graph.nodes.filter(n => n.type === 'scene')
  if (scenes.length) {
    md += `## 场景设定\n`
    for (const s of scenes) md += `- **${s.data.name}**：${s.data.description}\n`
    md += '\n---\n\n'
  }

  // Chapters
  if (chapters.length) {
    for (const ch of chapters) {
      md += `## ${ch.data.title || '章节'}\n\n`
      md += (ch.data.generated || ch.data.content || '（无内容）') + '\n\n'
    }
  } else {
    md += '（暂无章节内容）\n'
  }

  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${projectStore.projectMeta?.name || '文章'}.md`
  a.click()
  URL.revokeObjectURL(url)
  message.success('导出成功')
}
</script>

<template>
  <div class="app-header" id="app-header">
    <div class="header-left">
      <div class="app-logo">
        <span class="logo-text">StoryAgent</span>
      </div>
      <a-divider type="vertical" />
      <span class="project-name" v-if="projectStore.projectMeta">
        {{ projectStore.projectMeta.name }}
      </span>
      <span class="project-name" v-else>未打开文章</span>
    </div>

    <div class="header-center">
      <a-space :size="4">
        <a-tooltip title="保存 Ctrl+S">
          <a-button type="text" size="small" @click="handleSave">
            <template #icon><SaveOutlined /></template>
          </a-button>
        </a-tooltip>
        <a-tooltip title="导出 Markdown">
          <a-button type="text" size="small" @click="exportMarkdown">
            <template #icon><DownloadOutlined /></template>
          </a-button>
        </a-tooltip>
        <a-divider type="vertical" />
        <template v-if="!running">
          <a-button type="primary" id="header-generate-btn" @click="handleGenerate">
            ✨ 生成
          </a-button>
        </template>
        <template v-else>
          <a-button danger @click="stop">
            <template #icon><PauseCircleOutlined /></template>
            停止生成
          </a-button>
        </template>
      </a-space>
    </div>

    <div class="header-right">
      <a-tooltip v-if="licenseExpiry" :title="`激活有效期至 ${licenseExpiry.dateStr}`">
        <span class="license-badge" :class="{ 'license-expiring': licenseExpiry.days <= 7 }">
          <ClockCircleOutlined />
          <span v-if="licenseExpiry.days > 0">{{ licenseExpiry.days }}天</span>
          <span v-else>已过期</span>
        </span>
      </a-tooltip>
      <a-tooltip title="新手指引">
        <a-button type="text" size="small" @click="reopenTour">
          <template #icon><QuestionCircleOutlined /></template>
        </a-button>
      </a-tooltip>
    </div>
  </div>
</template>

<script lang="ts">
import { Divider as ADivider } from 'ant-design-vue'
export default {
  components: {
    SaveOutlined, ThunderboltOutlined, PauseCircleOutlined,
    MenuFoldOutlined, MenuUnfoldOutlined, QuestionCircleOutlined, DownloadOutlined,
    ClockCircleOutlined,
    ADivider,
  },
}
</script>

<style scoped lang="less">
.app-header {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
  -webkit-app-region: drag;

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 200px;
    > * { -webkit-app-region: no-drag; }
  }

  .logo-text {
    font-size: 15px;
    font-weight: 700;
    background: linear-gradient(135deg, #6366f1, #a855f7);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .project-name { font-size: 13px; color: #6b7280; }

  .header-center {
    display: flex;
    align-items: center;
    > * { -webkit-app-region: no-drag; }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    > * { -webkit-app-region: no-drag; }
  }

  .license-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #6b7280;
    background: #f3f4f6;
    padding: 2px 10px;
    border-radius: 10px;
    cursor: default;
    white-space: nowrap;

    &.license-expiring {
      color: #f59e0b;
      background: #fffbeb;
    }
  }
}
</style>

<script setup lang="ts">
import { ref, markRaw, computed, onMounted, onUnmounted } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'

import { useProjectStore } from '@/stores/project'
import { generateId } from '@/utils/storage'
import { Modal, message } from 'ant-design-vue'
import { marked } from 'marked'
import type { StoryNode, StoryEdge, NodeType } from '@/types'

import ThemeNode from './nodes/ThemeNode.vue'
import ArticleTypeNode from './nodes/ArticleTypeNode.vue'
import SkillNode from './nodes/SkillNode.vue'
import PlotNode from './nodes/PlotNode.vue'
import CharacterNode from './nodes/CharacterNode.vue'
import SceneNode from './nodes/SceneNode.vue'
import TextNode from './nodes/TextNode.vue'
import ReferenceNode from './nodes/ReferenceNode.vue'

const projectStore = useProjectStore()


// Preview modal
const previewVisible = ref(false)
const previewNode = ref<StoryNode | null>(null)
const previewContent = ref('')

const previewChapters = computed(() =>
  projectStore.graph.nodes.filter(n => n.type === 'text')
)

const previewIndex = computed(() =>
  previewChapters.value.findIndex(n => n.id === previewNode.value?.id)
)

const previewHtml = computed(() => {
  try { return marked(previewContent.value || '') }
  catch { return previewContent.value }
})

function onPreviewOpen(e: Event) {
  const detail = (e as CustomEvent).detail
  const node = projectStore.graph.nodes.find(n => n.id === detail.nodeId)
  if (node) {
    previewNode.value = node
    previewContent.value = node.data.generated || node.data.content || ''
    previewVisible.value = true
  }
}

function prevChapter() {
  const idx = previewIndex.value
  if (idx > 0) switchPreviewChapter(idx - 1)
}

function nextChapter() {
  const idx = previewIndex.value
  if (idx < previewChapters.value.length - 1) switchPreviewChapter(idx + 1)
}

function switchPreviewChapter(idx: number) {
  const ch = previewChapters.value[idx]
  if (!ch) return
  previewNode.value = ch
  previewContent.value = ch.data.generated || ch.data.content || ''
}

async function copyPreview() {
  try {
    await navigator.clipboard.writeText(previewContent.value)
    message.success('已复制到剪贴板')
  } catch {
    message.error('复制失败')
  }
}

function closePreview() {
  previewVisible.value = false
  previewNode.value = null
}

onMounted(() => {
  window.addEventListener('open-preview', onPreviewOpen)
})

onUnmounted(() => {
  window.removeEventListener('open-preview', onPreviewOpen)
})

const nodeTypes: any = {
  theme: markRaw(ThemeNode),
  articleType: markRaw(ArticleTypeNode),
  skill: markRaw(SkillNode),
  plot: markRaw(PlotNode),
  character: markRaw(CharacterNode),
  scene: markRaw(SceneNode),
  text: markRaw(TextNode),
  reference: markRaw(ReferenceNode),
}

const nodes = computed(() =>
  projectStore.graph.nodes.map(n => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
  }))
)

const edges = computed(() =>
  projectStore.graph.edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    markerEnd: 'arrowclosed',
    style: snapEdgeId.value === e.id
      ? { stroke: '#6366f1', strokeWidth: 3, strokeDasharray: '6 3' }
      : { stroke: '#c4b5fd', strokeWidth: 2 },
    class: snapEdgeId.value === e.id ? 'edge-snapping' : undefined,
  }))
)

function onNodeClick(event: any) {
  projectStore.selectNode(event.node.id)
  // Sync editor to show generated content (or outline if not generated yet)
  const node = projectStore.graph.nodes.find(n => n.id === event.node.id)
  if (node && node.type === 'text') {
    projectStore.content = node.data.generated || node.data.content || ''
  } else if (node && node.type === 'plot') {
    projectStore.content = node.data.summary || ''
  } else if (node && node.type === 'articleType' && node.data.articleTypeId) {
    if (projectStore.projectMeta) {
      projectStore.projectMeta.articleTypeId = node.data.articleTypeId
    }
  }
}

// Double-click to enter inline editing
function onNodeDoubleClick(event: any) {
  const node = projectStore.graph.nodes.find(n => n.id === event.node.id)
  if (node && (node.type === 'theme' || node.type === 'character' || node.type === 'scene' || node.type === 'plot' || node.type === 'text' || node.type === 'reference')) {
    // Set editing flag – node components react to this
    projectStore.updateNode(event.node.id, { _editing: true })
  }
}

// Edge snap hint during drag
const snapEdgeId = ref<string | null>(null)

function onNodeDrag(event: any) {
  const pos = event.node.position
  const cx = pos.x + 100, cy = pos.y + 40
  const threshold = 70
  let closest: string | null = null
  let closestDist = threshold

  for (const edge of projectStore.graph.edges) {
    if (edge.source === event.node.id || edge.target === event.node.id) continue
    const s = projectStore.graph.nodes.find(n => n.id === edge.source)
    const t = projectStore.graph.nodes.find(n => n.id === edge.target)
    if (!s || !t) continue
    const d = pointToSegmentDist(cx, cy, s.position.x + 100, s.position.y + 40, t.position.x + 100, t.position.y + 40)
    if (d < closestDist) {
      closestDist = d
      closest = edge.id
    }
  }
  snapEdgeId.value = closest
}

function onNodeDragStop(event: any) {
  projectStore.moveNode(event.node.id, event.node.position)
  checkEdgeSnap(event.node.id, event.node.position)
  snapEdgeId.value = null
  projectStore.saveProject()
}

// Auto-connect when node dropped near an edge
function checkEdgeSnap(nodeId: string, pos: { x: number; y: number }) {
  const nodeCenter = { x: pos.x + 100, y: pos.y + 40 } // approximate node center
  const snapThreshold = 60

  for (const edge of projectStore.graph.edges) {
    if (edge.source === nodeId || edge.target === nodeId) continue

    const sourceNode = projectStore.graph.nodes.find(n => n.id === edge.source)
    const targetNode = projectStore.graph.nodes.find(n => n.id === edge.target)
    if (!sourceNode || !targetNode) continue

    const sx = sourceNode.position.x + 100
    const sy = sourceNode.position.y + 40
    const tx = targetNode.position.x + 100
    const ty = targetNode.position.y + 40

    // Point-to-line-segment distance
    const dist = pointToSegmentDist(nodeCenter.x, nodeCenter.y, sx, sy, tx, ty)
    if (dist < snapThreshold) {
      // Remove old edge, create two new ones
      projectStore.removeEdge(edge.id)
      projectStore.addEdge({
        id: generateId(),
        source: edge.source,
        target: nodeId,
        sourceHandle: edge.sourceHandle,
      })
      projectStore.addEdge({
        id: generateId(),
        source: nodeId,
        target: edge.target,
        targetHandle: edge.targetHandle,
      })
      break // only snap to one edge
    }
  }
}

function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function onConnect(params: any) {
  const { source, target, sourceHandle, targetHandle } = params

  // Prevent self-connection
  if (source === target) return

  // Prevent duplicate connections
  const exists = projectStore.graph.edges.find(e => e.source === source && e.target === target)
  if (exists) return

  const edge: StoryEdge = {
    id: generateId(),
    source,
    target,
    sourceHandle: sourceHandle ?? undefined,
    targetHandle: targetHandle ?? undefined,
  }
  projectStore.addEdge(edge)
}

function onEdgeClick(event: any) {
  Modal.confirm({
    title: '删除连线？',
    content: '这将断开两个节点之间的连接。',
    okText: '删除',
    cancelText: '取消',
    okType: 'danger',
    centered: true,
    onOk: () => {
      projectStore.removeEdge(event.edge.id)
    },
  })
}

function onPaneClick() {
  projectStore.selectNode(null)
}

// Plot template based on article type
function getPlotTemplate(): string {
  const typeId = projectStore.projectMeta?.articleTypeId
  if (typeId === 'novel' || typeId === 'script' || typeId === 'children') {
    return '1.【开端/建置】\n\n2.【发展/对抗】\n\n3.【高潮/转折】\n\n4.【结局/收束】'
  }
  if (typeId === 'zhihu' || typeId === 'social' || typeId === 'xhs') {
    return '1.【痛点/冲突】是什么让读者产生共鸣？\n\n2.【论点1 + 案例】\n\n3.【论点2 + 案例】\n\n4.【论点3 + 案例】\n\n5.【总结升华】一句话让读者记住什么？'
  }
  if (typeId === 'academic' || typeId === 'review' || typeId === 'copywriting') {
    return '1.【核心观点】\n\n2.【论据1】\n\n3.【论据2】\n\n4.【论据3】\n\n5.【总结】'
  }
  return '1.【灵感触动】\n\n2.【情感/思考展开】\n\n3.【升华收尾】'
}

// Add node at position
function addNode(type: NodeType, position?: { x: number; y: number }) {
  const pos = position ?? { x: 250 + Math.random() * 200, y: 150 + Math.random() * 300 }

  const typeDefaults: Record<NodeType, Record<string, any>> = {
    theme: { title: '主题', content: '写下故事的核心想法...' },
    articleType: {
      articleTypeId: projectStore.projectMeta?.articleTypeId ?? 'novel',
      name: projectStore.currentArticleType.name,
      systemPrompt: projectStore.currentArticleType.systemPrompt,
    },
    skill: { skillId: '', name: '写作风格', promptFragment: '', variables: [] },
    plot: { title: '情节', summary: getPlotTemplate() },
    character: { name: '人物', description: '性别，姓名，年龄，职业。性格特点。外貌特征。背景经历。口头禅或习惯动作。' },
    scene: { name: '场景', description: '时间、地点、环境描写、氛围基调' },
    text: { title: `第${projectStore.graph.nodes.filter(n => n.type === 'text').length + 1}章`, content: '' },
    reference: { title: '参考资料', content: '', sourceUrl: '' },
  }

  const node: StoryNode = {
    id: generateId(),
    type,
    position: pos,
    data: typeDefaults[type],
  }

  projectStore.addNode(node)
}

// Context menu
const contextMenu = ref<{ show: boolean; x: number; y: number; nodeId: string | null }>({
  show: false, x: 0, y: 0, nodeId: null,
})

function showContextMenu(clientX: number, clientY: number, nodeId: string | null) {
  const menuW = 170, menuH = 320
  const x = Math.min(clientX, window.innerWidth - menuW - 10)
  const y = Math.min(clientY, window.innerHeight - menuH - 10)
  contextMenu.value = { show: true, x: Math.max(x, 10), y: Math.max(y, 10), nodeId }
}

function onNodeContextMenu(event: any) {
  event.event.preventDefault()
  showContextMenu(event.event.clientX, event.event.clientY, event.node.id)
}

function onPaneContextMenu(event: any) {
  event.preventDefault()
  showContextMenu(event.clientX, event.clientY, null)
}

function closeContextMenu() {
  contextMenu.value.show = false
}

function duplicateNode() {
  const nodeId = contextMenu.value.nodeId
  if (!nodeId) { closeContextMenu(); return }
  const original = projectStore.graph.nodes.find(n => n.id === nodeId)
  if (!original) { closeContextMenu(); return }
  const newNode: StoryNode = {
    id: generateId(),
    type: original.type,
    position: { x: original.position.x + 40, y: original.position.y + 40 },
    data: { ...original.data },
  }
  // Renumber if it's a chapter
  if (newNode.type === 'text') {
    newNode.data.title = `第${projectStore.graph.nodes.filter(n => n.type === 'text').length + 1}章`
  }
  projectStore.addNode(newNode)
  closeContextMenu()
}

function deleteNodeFromContext() {
  const nodeId = contextMenu.value.nodeId
  if (!nodeId) { closeContextMenu(); return }
  closeContextMenu()
  projectStore.removeNode(nodeId)
}

// Handle drop from skill library
function onDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  const skillData = event.dataTransfer?.getData('application/skill')
  if (skillData) {
    const skill = JSON.parse(skillData)
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const pos = {
      x: event.clientX - rect.left - 80,
      y: event.clientY - rect.top - 30,
    }
    const node: StoryNode = {
      id: generateId(),
      type: 'skill',
      position: pos,
      data: {
        skillId: skill.id,
        name: skill.name,
        promptFragment: skill.promptFragment,
        variables: skill.variables,
      },
    }
    projectStore.addNode(node)
    message.success(`已添加风格「${skill.name}」`)
  }
}

function onNodesChange(changes: any[]) {
  for (const change of changes) {
    if (change.type === 'remove') {
      projectStore.removeNode(change.id)
    }
  }
}

// Clear all nodes
function clearAllNodes() {
  Modal.confirm({
    title: '清空画布？',
    content: '所有节点和连线将被移除。',
    okText: '清空',
    cancelText: '取消',
    okType: 'danger',
    centered: true,
    onOk: () => {
      projectStore.pushSnapshot()
      projectStore.graph.nodes = []
      projectStore.graph.edges = []
      projectStore.versions = []
      projectStore.content = ''
      projectStore.selectNode(null)
      projectStore.saveProject()
    },
  })
}

// Expose addNode for toolbar
defineExpose({ addNode })
</script>

<template>
  <div class="canvas-wrapper" @dragover="onDragOver" @drop="onDrop" @click="closeContextMenu">
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :node-types="nodeTypes"
      :default-viewport="projectStore.graph.viewport"
      :fit-view-on-init="true"
      :max-zoom="2"
      :min-zoom="0.15"

      delete-key-code="Delete"
      multi-selection-key-code="Shift"
      @nodes-change="onNodesChange"
      @node-click="onNodeClick"
      @node-double-click="onNodeDoubleClick"
      @node-drag="onNodeDrag"
      @node-drag-stop="onNodeDragStop"
      @node-context-menu="onNodeContextMenu"
      @connect="onConnect"
      @edge-click="onEdgeClick"
      @pane-click="onPaneClick"
      @pane-context-menu="onPaneContextMenu"
    >
      <Background :gap="20" />
      <Controls position="bottom-right" />
    </VueFlow>

    <!-- Context Menu -->
    <div
      v-if="contextMenu.show"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <template v-if="contextMenu.nodeId">
        <div class="ctx-item" @click="duplicateNode">
          📋 复制节点
        </div>
        <div class="ctx-item" @click="deleteNodeFromContext">
          🗑️ 删除节点
        </div>
      </template>
      <template v-else>
        <div class="ctx-label">添加节点</div>
        <div class="ctx-item" @click="addNode('theme'); closeContextMenu()">
          💡 主题
        </div>
        <div class="ctx-item" @click="addNode('articleType'); closeContextMenu()">
          📋 类型
        </div>
        <div class="ctx-item" @click="addNode('plot'); closeContextMenu()">
          📖 情节
        </div>
        <div class="ctx-item" @click="addNode('character'); closeContextMenu()">
          👤 人物
        </div>
        <div class="ctx-item" @click="addNode('scene'); closeContextMenu()">
          🏞️ 场景
        </div>
        <div class="ctx-item" @click="addNode('text'); closeContextMenu()">
          📝 章节
        </div>
        <div class="ctx-item" @click="addNode('skill'); closeContextMenu()">
          ⚡ 写作风格
        </div>
        <div class="ctx-item" @click="addNode('reference'); closeContextMenu()">
          🔗 参考资料
        </div>
      </template>
    </div>

    <!-- Toolbar -->
    <div class="canvas-toolbar" role="toolbar" id="canvas-toolbar">
      <a-tooltip title="定义故事的核心思想或问题，AI 会围绕此主题展开创作" placement="right">
        <button class="toolbar-btn" @click="addNode('theme')">
          <span class="tb-emoji">💡</span><span class="tb-label">主题</span>
        </button>
      </a-tooltip>
      <a-tooltip title="选择文章体裁（小说/散文/知乎回答等），决定 AI 的写作身份和风格" placement="right">
        <button class="toolbar-btn" @click="addNode('articleType')">
          <span class="tb-emoji">📋</span><span class="tb-label">类型</span>
        </button>
      </a-tooltip>
      <a-tooltip title="梳理故事的关键情节节点，如开端、转折、高潮、结局" placement="right">
        <button class="toolbar-btn" @click="addNode('plot')">
          <span class="tb-emoji">📖</span><span class="tb-label">情节</span>
        </button>
      </a-tooltip>
      <a-tooltip title="设定人物的外貌、性格、背景故事，AI 会据此塑造角色言行" placement="right">
        <button class="toolbar-btn" @click="addNode('character')">
          <span class="tb-emoji">👤</span><span class="tb-label">人物</span>
        </button>
      </a-tooltip>
      <a-tooltip title="描写故事发生的环境，包括时间、地点、氛围等细节" placement="right">
        <button class="toolbar-btn" @click="addNode('scene')">
          <span class="tb-emoji">🏞️</span><span class="tb-label">场景</span>
        </button>
      </a-tooltip>
      <a-tooltip title="创建一个写作章节，连接上游节点后 AI 可生成完整章节内容" placement="right">
        <button class="toolbar-btn" @click="addNode('text')">
          <span class="tb-emoji">📝</span><span class="tb-label">章节</span>
        </button>
      </a-tooltip>
      <a-tooltip title="添加写作风格节点，叠加到 AI 的生成指令中，如古风、幽默、简洁等" placement="right">
        <button class="toolbar-btn" @click="addNode('skill')">
          <span class="tb-emoji">⚡</span><span class="tb-label">风格</span>
        </button>
      </a-tooltip>
      <a-tooltip title="添加参考资料节点，粘贴外部文本或链接作为 AI 生成的参考依据" placement="right">
        <button class="toolbar-btn" @click="addNode('reference')">
          <span class="tb-emoji">🔗</span><span class="tb-label">资料</span>
        </button>
      </a-tooltip>
      <div class="toolbar-divider"></div>
      <a-tooltip title="删除画布上所有节点和连线，此操作可撤销 (Ctrl+Z)" placement="right">
        <button class="toolbar-btn toolbar-btn--danger" @click="clearAllNodes">
          <span class="tb-emoji">🗑️</span><span class="tb-label">清空</span>
        </button>
      </a-tooltip>
    </div>

    <!-- Preview Modal -->
    <a-modal
      v-model:open="previewVisible"
      :title="previewNode?.data?.title || '预览'"
      width="800px"
      class="preview-modal"
      @cancel="closePreview"
    >
      <template #footer>
        <span class="preview-word-count" v-if="previewChapters.length > 0">
          {{ previewIndex + 1 }} / {{ previewChapters.length }} · {{ previewContent.length }} 字
        </span>
        <a-button @click="prevChapter" :disabled="previewIndex <= 0">上一章</a-button>
        <a-button @click="nextChapter" :disabled="previewIndex >= previewChapters.length - 1">下一章</a-button>
        <a-button @click="closePreview">关闭</a-button>
        <a-button type="primary" @click="copyPreview">
          <template #icon><CopyOutlined /></template>
          一键复制
        </a-button>
      </template>
      <div class="preview-body">
        <div class="preview-content" v-html="previewHtml"></div>
      </div>
    </a-modal>
  </div>
</template>

<script lang="ts">
import {
  BulbOutlined, ProfileOutlined, ThunderboltOutlined, ReadOutlined,
  TeamOutlined, PictureOutlined, FileTextOutlined,
  DeleteOutlined, CopyOutlined,
} from '@ant-design/icons-vue'

export default {
  components: {
    BulbOutlined, ProfileOutlined, ThunderboltOutlined, ReadOutlined,
    TeamOutlined, PictureOutlined, FileTextOutlined,
    DeleteOutlined, CopyOutlined,
  },
}
</script>

<style scoped lang="less">
.canvas-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.canvas-toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: #fff;
  padding: 6px;
  border-radius: 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  color: #374151;
  border: none;
  background: transparent;
  font-family: inherit;
  white-space: nowrap;

  .tb-emoji { font-size: 14px; line-height: 1; }
  .tb-label { font-size: 11px; font-weight: 500; }

  &:hover { background: #f3f4f6; }
}

.toolbar-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 4px 6px;
}

.toolbar-btn--danger {
  &:hover { background: #fef2f2; }
}

.context-menu {
  position: fixed;
  z-index: 1000;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  padding: 4px;
  min-width: 160px;
}

.ctx-label {
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
}

.ctx-item {
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #374151;

  &:hover {
    background: #f3f4f6;
  }
}

// Preview modal
.preview-word-count {
  font-size: 13px;
  color: #6b7280;
  margin-right: auto;
  margin-right: 10px;
}

.preview-modal {
  :deep(.ant-modal-body) { padding: 24px 32px; }
  :deep(.ant-modal-footer) { display: flex; align-items: center; }
}

.preview-body {
  max-height: 65vh;
  overflow-y: auto;
}

.preview-content {
  font-family: 'Noto Serif SC', 'PingFang SC', serif;
  font-size: 15px;
  line-height: 2;
  color: #1f2937;

  :deep(h1) { font-size: 22px; font-weight: 700; margin: 20px 0 12px; color: #111827; }
  :deep(h2) { font-size: 19px; font-weight: 700; margin: 18px 0 10px; color: #1f2937; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
  :deep(h3) { font-size: 16px; font-weight: 600; margin: 14px 0 8px; color: #374151; }
  :deep(p) { margin: 10px 0; text-indent: 2em; }
  :deep(ul, ol) { margin: 8px 0; padding-left: 2em; }
  :deep(li) { margin: 4px 0; }
  :deep(blockquote) { margin: 12px 0; padding: 8px 16px; border-left: 3px solid #6366f1; background: #f8f7ff; color: #4b5563; }
  :deep(code) { background: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-size: 13px; font-family: 'JetBrains Mono', monospace; }
  :deep(pre) { background: #f9fafb; padding: 14px 18px; border-radius: 8px; overflow-x: auto; margin: 12px 0; border: 1px solid #e5e7eb; }
  :deep(hr) { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
  :deep(em) { font-style: italic; }
  :deep(strong) { font-weight: 700; color: #111827; }
}
</style>

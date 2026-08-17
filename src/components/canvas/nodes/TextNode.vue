<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useProjectStore } from '@/stores/project'

const props = defineProps<{ id: string; data: { title: string; content: string; generated?: string; _editing?: boolean; _generating?: boolean } }>()
const projectStore = useProjectStore()

const editing = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const editValue = ref('')

watch(() => props.data._editing, async (val) => {
  if (val) {
    editing.value = true
    editValue.value = props.data.content || ''
    projectStore.updateNode(props.id, { _editing: false })
    await nextTick()
    textareaRef.value?.focus()
  }
})

async function enterEdit() {
  editing.value = true
  editValue.value = props.data.content || ''
  await nextTick()
  textareaRef.value?.focus()
}

function saveEdit() {
  const newContent = editValue.value || props.data.content
  // Save to content (outline), don't touch generated
  projectStore.updateNode(props.id, { content: newContent })
  projectStore.saveProject()
  editing.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    saveEdit()
  } else if (e.key === 'Escape') {
    editing.value = false
  }
}

// Preview
function openPreview() {
  projectStore.selectNode(props.id)
  // emit a custom event that CanvasArea can listen to
  window.dispatchEvent(new CustomEvent('open-preview', { detail: { nodeId: props.id } }))
}

function quickGenerate() {
  projectStore.selectNode(props.id)
  window.dispatchEvent(new CustomEvent('queue-generate', { detail: { nodeId: props.id } }))
}
</script>

<template>
  <div class="node-base text-node" :class="{ 'node-editing': editing, 'node-generating': data._generating }">
    <Handle type="target" :position="Position.Left" />
    <div class="node-header">
      <span class="node-icon">📝</span>
      <span class="node-title">{{ data.title }}</span>
      <a-button type="text" size="small" class="preview-btn" @click.stop="openPreview" title="预览">
        <template #icon><EyeOutlined /></template>
      </a-button>
      <a-button type="text" size="small" class="gen-btn" @click.stop="quickGenerate" title="生成本章">
        <template #icon>✨</template>
      </a-button>
    </div>
    <div class="node-body">
      <div class="node-content" v-if="!editing" @dblclick.stop="enterEdit()">
        <div class="chapter-outline" v-if="data.content">
          {{ data.content.substring(0, 60) }}{{ data.content.length > 60 ? '...' : '' }}
        </div>
        <div class="chapter-empty" v-if="!data.content">
          双击输入本章要点...
        </div>
        <div class="chapter-status" v-if="data.generated">✅ 已生成</div>
      </div>
      <textarea
        v-else
        ref="textareaRef"
        v-model="editValue"
        class="node-inline-input" @wheel.stop @mousedown.stop @pointerdown.stop
        rows="4"
        @keydown="onKeydown"
        @blur="saveEdit"
        autofocus
      />
      <div class="edit-hint" v-if="!editing">
        双击编辑 · 选中后运行生成
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { EyeOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
export default { components: { EyeOutlined, ThunderboltOutlined } }
</script>

<style scoped lang="less">
.text-node {
  border-color: #6b7280;
  .node-header { background: #f3f4f6; display: flex; align-items: center; }
  .node-title { color: #374151; flex: 1; }
  .preview-btn { font-size: 13px; color: #6366f1; flex-shrink: 0; }
  .gen-btn { font-size: 13px; color: #f59e0b; flex-shrink: 0; }
}

.chapter-outline {
  font-size: 12px;
  color: #374151;
  line-height: 1.4;
}

.chapter-empty {
  font-size: 12px;
  color: #c4c4c4;
  font-style: italic;
}

.chapter-status {
  font-size: 10px;
  color: #22c55e;
  margin-top: 2px;
}
.node-inline-input {
  width: 100%;
  border: 1.5px solid #6366f1;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  font-family: inherit;
  line-height: 1.5;
  resize: vertical;
  background: #fff;
  outline: none;
}
.edit-hint {
  font-size: 10px;
  color: #c4c4c4;
  margin-top: 2px;
}
.node-editing {
  box-shadow: 0 0 0 2px #6366f1, 0 4px 16px rgba(99, 102, 241, 0.25) !important;
  min-width: 260px;
  max-width: 380px;
}

.node-generating {
  animation: node-pulse 1.5s ease-in-out infinite;
  border-color: #6366f1 !important;
  .node-header { background: #eef2ff; }
}

@keyframes node-pulse {
  0%, 100% { box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15); }
  50% { box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3), 0 4px 20px rgba(99, 102, 241, 0.25); }
}
.preview-btn { font-size: 13px; color: #6366f1; flex-shrink: 0; }
</style>

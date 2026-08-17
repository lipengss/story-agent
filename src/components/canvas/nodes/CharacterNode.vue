<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useProjectStore } from '@/stores/project'

const props = defineProps<{ id: string; data: { name: string; description: string; _editing?: boolean } }>()
const projectStore = useProjectStore()

const editing = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const editValue = ref('')

watch(() => props.data._editing, async (val) => {
  if (val) {
    editing.value = true
    editValue.value = props.data.description || ''
    projectStore.updateNode(props.id, { _editing: false })
    await nextTick()
    textareaRef.value?.focus()
  }
})

async function enterEdit() {
  editing.value = true
  editValue.value = props.data.description || ''
  await nextTick()
  textareaRef.value?.focus()
}

function saveEdit() {
  projectStore.updateNode(props.id, { description: editValue.value || props.data.description })
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
</script>

<template>
  <div class="node-base node-compact character-node" :class="{ 'node-editing': editing }">
    <Handle type="source" :position="Position.Right" />
    <div class="node-header">
      <span class="node-icon">👤</span>
      <span class="node-title">{{ data.name }}</span>
    </div>
    <div class="node-body">
      <div class="node-desc" v-if="!editing" @dblclick.stop="enterEdit()">
        {{ data.description || '双击编辑...' }}
      </div>
              <textarea ref="textareaRef"
        v-else
        v-model="editValue"
        class="node-inline-input" @wheel.stop @mousedown.stop @pointerdown.stop
        rows="3"
        @keydown="onKeydown"
        @blur="saveEdit"
        autofocus
      />
      <div class="edit-hint" v-if="!editing">双击编辑</div>
    </div>
  </div>
</template>

<style scoped lang="less">
.character-node {
  border-color: #ec4899;
  .node-header { background: #fce7f3; }
  .node-title { color: #9d174d; }
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
  text-align: right;
  margin-top: 2px;
}
.node-editing {
  box-shadow: 0 0 0 2px #6366f1, 0 4px 16px rgba(99, 102, 241, 0.25) !important;
  min-width: 220px;
  max-width: 320px;
}
</style>

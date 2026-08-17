<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Modal } from 'ant-design-vue'
import type { ProjectMeta } from '@/types'
import { FolderOutlined, FolderOpenOutlined, FileTextOutlined, DeleteOutlined, CloseOutlined } from '@ant-design/icons-vue'

const props = defineProps<{
  projects: ProjectMeta[]
  selectedGroup: string | null
  activeId: string | null
}>()

const emit = defineEmits<{
  select: [project: ProjectMeta]
  deleteProject: [project: ProjectMeta]
  deleteGroup: [group: string]
  toggleGroup: [group: string]
  moveToGroup: [projectId: string, group: string]
  renameProject: [projectId: string, name: string]
  renameGroup: [oldName: string, newName: string]
}>()

const renamingKey = ref<string | null>(null)
const renameValue = ref('')

function startRename(key: string, currentName: string) {
  renamingKey.value = key
  renameValue.value = currentName
}

function finishRename() {
  if (!renamingKey.value || !renameValue.value.trim()) { renamingKey.value = null; return }
  const key = renamingKey.value
  renamingKey.value = null
  if (key.startsWith('group-')) {
    emit('renameGroup', key.replace('group-', ''), renameValue.value.trim())
  } else if (key.startsWith('project-')) {
    emit('renameProject', key.replace('project-', ''), renameValue.value.trim())
  }
}

function onRenameKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') { e.preventDefault(); finishRename() }
  if (e.key === 'Escape') { renamingKey.value = null }
}

// Build a fast lookup map from tree key to ProjectMeta
function getProjectByKey(key: string): ProjectMeta | undefined {
  if (!key.startsWith('project-')) return undefined
  const id = key.replace('project-', '')
  return props.projects.find(p => p.id === id)
}

interface TreeNode {
  key: string
  title: string
  icon?: any
  isLeaf?: boolean
  group?: string
  project?: ProjectMeta
  children?: TreeNode[]
  selectable?: boolean
}

// Expand/collapse state
const expandedKeys = ref<string[]>([])
const manuallyCollapsed = ref<Set<string>>(new Set())

// 初始化 + 数据变化：新分组默认展开，但尊重用户手动折叠的分组
watch(() => props.projects, (projects) => {
  const groupKeys = projects.map(p => `group-${p.group || '未分组'}`)
  const valid = new Set(groupKeys)
  // 清理已删除分组的失效 key
  expandedKeys.value = expandedKeys.value.filter(k => valid.has(k))
  for (const k of [...manuallyCollapsed.value]) {
    if (!valid.has(k)) manuallyCollapsed.value.delete(k)
  }
  // 新出现、且未被用户手动折叠的分组 → 默认展开
  for (const k of groupKeys) {
    if (!expandedKeys.value.includes(k) && !manuallyCollapsed.value.has(k)) {
      expandedKeys.value = [...expandedKeys.value, k]
    }
  }
}, { immediate: true })

function onTreeExpand(_keys: string[], info: any) {
  const key = info.node?.key as string | undefined
  if (!key) return
  if (info.expanded) manuallyCollapsed.value.delete(key)
  else manuallyCollapsed.value.add(key)
}

const treeData = computed<TreeNode[]>(() => {
  const map: Record<string, ProjectMeta[]> = {}
  for (const p of props.projects) {
    const g = p.group || '未分组'
    if (!map[g]) map[g] = []
    map[g].push(p)
  }

  return Object.entries(map).map(([group, items]) => ({
    key: `group-${group}`,
    title: group,
    group,
    selectable: true,
    children: items.map(p => ({
      key: `project-${p.id}`,
      title: p.name,
      isLeaf: true,
      project: p,
      selectable: true,
    })),
  }))
})

// ---- ARTICLE CLICK: call store DIRECTLY, same pattern as ChapterOutline ----
function handleClick(node: TreeNode) {
  if (node.isLeaf) {
    // Try node.project directly, fall back to key lookup (ant-design-vue may strip custom props)
    const p = node.project || getProjectByKey(node.key)
    if (p) {
      emit('select', p)
    }
  } else if (node.group) {
    emit('toggleGroup', node.group)
  }
}

function onSelect(_keys: string[], info: any) {
  // Used when tree fires @select natively (e.g. keyboard navigation)
  const key = info.node?.key
  if (key?.startsWith('project-')) {
    const p = getProjectByKey(key)
    if (p) {
      emit('select', p)
    }
  } else if (key?.startsWith('group-')) {
    emit('toggleGroup', key.replace('group-', ''))
  }
}

function confirmDeleteProject(node: TreeNode) {
  const p = node.project || getProjectByKey(node.key)
  if (!p) return
  Modal.confirm({
    title: `删除「${p.name}」？`,
    content: '删除后无法恢复',
    okText: '删除',
    cancelText: '取消',
    okType: 'danger',
    centered: true,
    onOk: () => emit('deleteProject', p),
  })
}

function confirmDeleteGroup(node: TreeNode) {
  const group = node.group
  if (!group) return
  Modal.confirm({
    title: `删除分组「${group}」？`,
    content: '组内文章将移至「未分组」',
    okText: '删除',
    cancelText: '取消',
    centered: true,
    onOk: () => emit('deleteGroup', group),
  })
}

function onDrop(info: any) {
  const dragKey: string = info.dragNode.key
  const dropKey: string = info.node.key

  // Target is a group (folder)
  let targetGroup: string
  if (dropKey.startsWith('group-')) {
    targetGroup = dropKey.replace('group-', '')
  } else {
    // Dropped on a project — move to its parent group
    const parentKey = info.node.parent?.key || ''
    targetGroup = parentKey.replace('group-', '')
  }

  if (dragKey.startsWith('project-')) {
    const projectId = dragKey.replace('project-', '')
    if (targetGroup) {
      emit('moveToGroup', projectId, targetGroup)
    }
  }
}
</script>

<template>
  <div class="article-tree">
    <a-tree
      :tree-data="treeData"
      v-model:expandedKeys="expandedKeys"
      :selected-keys="[...(selectedGroup ? [`group-${selectedGroup}`] : []), ...(activeId ? [`project-${activeId}`] : [])]"
      block-node
      draggable
      show-icon
      @select="onSelect"
      @drop="onDrop"
      @expand="onTreeExpand"
    >
      <template #title="node">
        <!-- Rename input -->
        <span v-if="renamingKey === node.key" class="tree-rename-row" @click.stop>
          <input
            v-model="renameValue"
            class="tree-rename-input"
            @keydown="onRenameKeydown"
            @blur="finishRename"
            autofocus
          />
        </span>
        <!-- Normal display -->
        <span v-else class="tree-node-title" :class="{ 'is-group': !node.isLeaf }"
          @click.stop="handleClick(node as TreeNode)"
          @dblclick.stop="startRename(node.key, node.title)">
          <FolderOutlined v-if="!node.isLeaf && selectedGroup !== node.group" class="tree-icon folder" />
          <FolderOpenOutlined v-else-if="!node.isLeaf" class="tree-icon folder-open" />
          <FileTextOutlined v-else class="tree-icon file" />
          <span class="tree-label">{{ node.title }}</span>
          <!-- Group actions -->
          <span v-if="!node.isLeaf && node.group" class="tree-actions" @click.stop>
            <CloseOutlined class="tree-action-btn" @click="confirmDeleteGroup(node as TreeNode)" />
          </span>
          <!-- Project actions -->
          <span v-if="node.isLeaf" class="tree-actions" @click.stop>
            <DeleteOutlined class="tree-action-btn" @click="confirmDeleteProject(node as TreeNode)" />
          </span>
        </span>
      </template>
    </a-tree>
  </div>
</template>

<style scoped lang="less">
.article-tree {
  :deep(.ant-tree) {
    background: transparent;
    .ant-tree-treenode {
      padding: 1px 0;
      width: 100%;
    }
    .ant-tree-node-content-wrapper {
      flex: 1;
      min-width: 0;
      border-radius: 4px;
    }
    .ant-tree-node-selected {
      background: #eef2ff !important;
    }
    .ant-tree-switcher {
      width: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9ca3af;
    }
    .ant-tree-draggable-icon {
      display: none;
    }
  }
}

.tree-node-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #374151;
  flex: 1;
  min-width: 0;

  &.is-group {
    font-weight: 600;
    font-size: 12px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
}

.tree-icon {
  font-size: 14px;
  flex-shrink: 0;

  &.folder { color: #9ca3af; }
  &.folder-open { color: #6366f1; }
  &.file { color: #9ca3af; }
}

.tree-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.tree-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;

  .tree-node-title:hover & {
    opacity: 1;
  }
}

.tree-action-btn {
  font-size: 11px;
  color: #9ca3af;
  padding: 2px;
  cursor: pointer;
  &:hover { color: #ef4444; }
}

.tree-rename-row {
  display: flex;
  align-items: center;
  flex: 1;
}

.tree-rename-input {
  width: 100%;
  border: 1.5px solid #6366f1;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
}
</style>

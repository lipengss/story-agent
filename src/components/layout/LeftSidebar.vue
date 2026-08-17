<script setup lang="ts">
import { ref } from 'vue'
import { useProjectList } from '@/composables/useProjectList'
import { useProjectStore } from '@/stores/project'
import { buildTemplate } from '@/utils/templates'
import ArticleTree from './ArticleTree.vue'
import ArticleTypeSelector from './ArticleTypeSelector.vue'
import NewProjectModal from '@/components/dialogs/NewProjectModal.vue'
import { PlusOutlined, MenuFoldOutlined } from '@ant-design/icons-vue'

defineProps<{ collapsed: boolean }>()
const emit = defineEmits(['toggle'])

const projectStore = useProjectStore()
const {
  list, selectedGroup, openProject, createProject,
  deleteProject, deleteGroup, renameProject, renameGroup,
  moveProject, toggleSelectGroup,
} = useProjectList()

const showNewModal = ref(false)

function onModalCreate(meta: { name: string; articleTypeId: string; group?: string; templateId?: string }) {
  const p = createProject(meta)
  showNewModal.value = false

  // Use loadProject to properly init store — clears versions/content/graph
  projectStore.loadProject(p)

  // Build from template
  const { nodes, edges } = buildTemplate(meta.templateId || 'novel', meta.articleTypeId)
  projectStore.graph.nodes = nodes
  projectStore.graph.edges = edges
  // Fill articleType node with systemPrompt from type definition
  projectStore.setArticleType(meta.articleTypeId)
  projectStore.saveProject()
}
</script>

<template>
  <div class="left-sidebar">
    <div class="sidebar-header">
      <span class="sidebar-title">文章</span>
      <a-button type="text" size="small" @click="emit('toggle')">
        <template #icon><MenuFoldOutlined /></template>
      </a-button>
    </div>

    <div class="section">
      <a-button type="dashed" block @click="showNewModal = true">
        <template #icon><PlusOutlined /></template>
        新建文章
      </a-button>
    </div>

    <!-- Article Tree -->
    <div class="section tree-section">
      <div class="section-label">文章列表（{{ list.length }}）</div>
      <ArticleTree
        v-if="list.length > 0"
        :projects="list"
        :selected-group="selectedGroup"
        :active-id="projectStore.projectMeta?.id ?? null"
        @select="openProject"
        @delete-project="deleteProject"
        @delete-group="deleteGroup"
        @rename-project="(id: string, name: string) => renameProject(id, name)"
        @rename-group="(old: string, name: string) => renameGroup(old, name)"
        @toggle-group="toggleSelectGroup"
        @move-to-group="moveProject"
      />
      <div v-else class="empty-text">暂无文章</div>
    </div>

    <!-- Article Types -->
    <div class="section">
      <ArticleTypeSelector />
    </div>

    <NewProjectModal v-model:open="showNewModal" @create="onModalCreate" />
  </div>
</template>

<script lang="ts">
export default { components: { PlusOutlined, MenuFoldOutlined } }
</script>

<style scoped lang="less">
.left-sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #e5e7eb;
}

.sidebar-title {
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  .demo-btn { margin-top: 6px; }
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.tree-section {
  flex: 1;
  overflow-y: auto;
}

.empty-text {
  font-size: 12px;
  color: #6b7280;
  padding: 8px;
  text-align: center;
}
</style>

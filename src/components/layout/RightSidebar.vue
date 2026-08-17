<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useProjectStore } from '@/stores/project'
import PropertyPanel from '@/components/panels/PropertyPanel.vue'
import SkillLibrary from '@/components/panels/SkillLibrary.vue'
import LLMConfig from '@/components/panels/LLMConfig.vue'
import ChapterOutline from './ChapterOutline.vue'

defineProps<{ collapsed: boolean }>()
const emit = defineEmits(['toggle'])

const projectStore = useProjectStore()
const activeTab = ref('skills')

// Badge hint: show indicator on 属性 tab when a node is selected
const hasNodeSelected = computed(() => !!projectStore.selectedNode)

// Auto-switch tab: node selected → 属性, pane clicked → 写作风格
watch(() => projectStore.selectedNode, (node) => {
  if (node) {
    activeTab.value = 'properties'
  } else {
    activeTab.value = 'skills'
  }
})

// Listen for external requests to switch tabs
function onNavigateToTab(e: Event) {
  const tab = (e as CustomEvent).detail?.tab
  if (tab) activeTab.value = tab
}
onMounted(() => window.addEventListener('navigate-to-tab', onNavigateToTab))
onUnmounted(() => window.removeEventListener('navigate-to-tab', onNavigateToTab))
</script>

<template>
  <div class="right-sidebar" id="right-sidebar">
    <div class="sidebar-header">
      <a-tabs v-model:activeKey="activeTab" size="small" class="sidebar-tabs">
        <a-tab-pane key="properties">
          <template #tab>
            <span class="tab-label">
              属性
              <span v-if="hasNodeSelected" class="tab-badge" />
            </span>
          </template>
        </a-tab-pane>
        <a-tab-pane key="skills" tab="写作风格" />
        <a-tab-pane key="ai-settings" tab="AI 设置" />
      </a-tabs>
      <a-button type="text" size="small" @click="emit('toggle')" class="collapse-btn">
        <template #icon><MenuFoldOutlined /></template>
      </a-button>
    </div>

    <div class="sidebar-content">
      <div v-if="activeTab === 'properties'">
        <div class="prop-section">
          <ChapterOutline />
        </div>
        <a-divider class="prop-divider" />
        <div class="prop-section">
          <PropertyPanel />
        </div>
      </div>
      <div v-if="activeTab === 'skills'">
        <SkillLibrary />
      </div>
      <div v-if="activeTab === 'ai-settings'">
        <LLMConfig :start-expanded="true" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { MenuFoldOutlined } from '@ant-design/icons-vue'
export default { components: { MenuFoldOutlined } }
</script>

<style scoped lang="less">
.right-sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
  padding-right: 4px;
}

.sidebar-tabs {
  flex: 1;
  :deep(.ant-tabs-nav) {
    margin-bottom: 0;
    &::before { border-bottom: none; }
  }
  :deep(.ant-tabs-tab) {
    padding: 8px 12px;
    font-size: 13px;
  }
}

.tab-label { position: relative; }
.tab-badge {
  position: absolute; top: -2px; right: -8px;
  width: 6px; height: 6px; border-radius: 50%; background: #6366f1;
}

.collapse-btn {
  flex-shrink: 0;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.prop-section {
  .prop-section-title {
    font-size: 11px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }
}

.prop-divider {
  margin: 12px 0;
  border-color: #e5e7eb;
}
</style>

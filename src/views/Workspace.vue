<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/project'
import { useAppStore } from '@/stores/app'
import { useResize } from '@/composables/useResize'
import { loadProjectList, saveProjectList } from '@/utils/storage'
import LeftSidebar from '@/components/layout/LeftSidebar.vue'
import RightSidebar from '@/components/layout/RightSidebar.vue'
import BottomPanel from '@/components/layout/BottomPanel.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import CanvasArea from '@/components/canvas/CanvasArea.vue'
import WelcomeTour from '@/components/onboarding/WelcomeTour.vue'
import { MenuUnfoldOutlined, UpOutlined, DownOutlined } from '@ant-design/icons-vue'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const appStore = useAppStore()

const leftCollapsed = ref(false)
const rightCollapsed = ref(false)
const bottomVisible = ref(localStorage.getItem('storyagent_bottomVisible') !== 'false')
const { bottomHeight, startVerticalResize } = useResize(320)

function onGenerationComplete() {
  bottomVisible.value = true
}

// Persist bottom panel preference
watch(bottomVisible, (v) => {
  localStorage.setItem('storyagent_bottomVisible', String(v))
})

onMounted(() => {
  window.addEventListener('generation-complete', onGenerationComplete)
  window.addEventListener('keydown', onKeydown)

  const projectId = route.params.projectId as string | undefined
  const projects = loadProjectList()

  // Open project by route param
  if (projectId) {
    const meta = projects.find(p => p.id === projectId)
    if (meta) { projectStore.loadProject(meta); return }
  }

  // Open last project
  const lastId = appStore.currentProjectId
  if (lastId) {
    const meta = projects.find(p => p.id === lastId)
    if (meta) { projectStore.loadProject(meta); router.replace(`/workspace/${lastId}`); return }
  }

  // Open first project
  if (projects.length > 0) {
    const meta = projects[0]
    projectStore.loadProject(meta)
    router.replace(`/workspace/${meta.id}`)
    return
  }

  // Create demo
  const { meta } = projectStore.createDemoProject()
  const all = loadProjectList()
  all.unshift(meta)
  saveProjectList(all)
  router.replace(`/workspace/${meta.id}`)
})

onUnmounted(() => {
  window.removeEventListener('generation-complete', onGenerationComplete)
  window.removeEventListener('keydown', onKeydown)
})

function onKeydown(e: KeyboardEvent) {
  const ctrl = e.ctrlKey || e.metaKey
  const target = e.target as HTMLElement
  const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

  // Ctrl+S: Save
  if (ctrl && e.key === 's') {
    e.preventDefault()
    projectStore.saveProject()
    return
  }

  // Ctrl+Z: Undo
  if (ctrl && !e.shiftKey && e.key === 'z') {
    e.preventDefault()
    projectStore.undo()
    return
  }

  // Ctrl+Shift+Z: Redo
  if (ctrl && e.shiftKey && e.key === 'Z') {
    e.preventDefault()
    projectStore.redo()
    return
  }

  // Delete: remove selected node (not when typing in input)
  if (e.key === 'Delete' && !isInput) {
    const selId = projectStore.selectedNodeId
    if (selId) {
      e.preventDefault()
      projectStore.removeNode(selId)
    }
    return
  }

  // Escape: deselect
  if (e.key === 'Escape' && !isInput) {
    projectStore.selectNode(null)
    return
  }

  // Ctrl+N: new article (handled by LeftSidebar)
}
</script>

<template>
  <div class="workspace" tabindex="0">
    <AppHeader
      :left-collapsed="leftCollapsed"
      :right-collapsed="rightCollapsed"
      @toggle-left="leftCollapsed = !leftCollapsed"
      @toggle-right="rightCollapsed = !rightCollapsed"
    />

    <div class="workspace-body">
      <div class="edge-toggle edge-toggle--left" :class="{ visible: leftCollapsed }" v-if="leftCollapsed">
        <a-tooltip title="展开侧栏" placement="right">
          <div class="edge-btn" @click="leftCollapsed = false"><MenuUnfoldOutlined /></div>
        </a-tooltip>
      </div>

      <div class="left-sidebar" :class="{ collapsed: leftCollapsed }">
        <LeftSidebar :collapsed="leftCollapsed" @toggle="leftCollapsed = !leftCollapsed" />
      </div>

      <div class="main-content">
        <div class="canvas-container" v-if="projectStore.projectMeta">
          <CanvasArea :key="projectStore.projectId ?? undefined" />
        </div>

        <!-- Empty state: no article -->
        <div class="workspace-empty" v-if="!projectStore.projectMeta">
          <div class="empty-icon">📝</div>
          <h2>还没有文章</h2>
          <p>点击左侧「新建文章」开始创作你的第一篇作品</p>
        </div>

        <div class="bottom-toggle" v-if="projectStore.projectMeta" @click="bottomVisible = !bottomVisible">
          <span class="bottom-toggle-btn">
            {{ bottomVisible ? '收起' : '展开' }}编辑区
            <UpOutlined v-if="bottomVisible" />
            <DownOutlined v-else />
          </span>
        </div>

        <div class="bottom-panel" v-if="projectStore.projectMeta && bottomVisible" :style="{ height: bottomHeight + 'px' }">
          <div class="resize-handle resize-handle--vertical" @mousedown="startVerticalResize"></div>
          <BottomPanel :key="projectStore.projectId ?? undefined" />
        </div>
      </div>

      <div class="right-sidebar" :class="{ collapsed: rightCollapsed }">
        <RightSidebar :collapsed="rightCollapsed" @toggle="rightCollapsed = !rightCollapsed" />
      </div>

      <div class="edge-toggle edge-toggle--right" :class="{ visible: rightCollapsed }" v-if="rightCollapsed">
        <a-tooltip title="展开侧栏" placement="left">
          <div class="edge-btn" @click="rightCollapsed = false"><MenuUnfoldOutlined /></div>
        </a-tooltip>
      </div>
    </div>

    <WelcomeTour />
  </div>
</template>

<style scoped lang="less">
.workspace {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  outline: none;
}

.workspace-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.left-sidebar {
  width: 240px;
  min-width: 240px;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  transition: width 0.2s, min-width 0.2s;
  overflow: hidden;
  flex-shrink: 0;
  &.collapsed { width: 0; min-width: 0; border-right: none; }
}

.edge-toggle {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 20;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
  &.visible { opacity: 1; pointer-events: all; }
  &--left { left: 0; }
  &--right { right: 0; }
}

.edge-btn {
  width: 24px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0 6px 6px 0;
  cursor: pointer;
  color: #6b7280;
  font-size: 14px;
  transition: all 0.15s;
  .edge-toggle--right & { border-radius: 6px 0 0 6px; }
  &:hover { background: #f3f4f6; color: #6366f1; }
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.canvas-container {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.bottom-toggle {
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: #f8f9fb;
  border-top: 1px solid #e5e7eb;
  cursor: pointer;
  flex-shrink: 0;
  font-size: 12px;
  color: #6b7280;
  user-select: none;
  &:hover { background: #eef2ff; color: #6366f1; }
}

.bottom-toggle-btn { font-size: 11px; transition: color 0.15s; }

.bottom-panel {
  position: relative;
  background: #fff;
  border-top: 1px solid #e5e7eb;
  min-height: 150px;
  .resize-handle { top: -4px; }
}

.workspace-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #6b7280;

  .empty-icon { font-size: 48px; }
  h2 { font-size: 18px; font-weight: 600; color: #374151; margin: 0; }
  p { font-size: 14px; margin: 0; }
}

.right-sidebar {
  width: 320px;
  min-width: 320px;
  background: #fff;
  border-left: 1px solid #e5e7eb;
  transition: width 0.2s, min-width 0.2s;
  overflow: hidden;
  flex-shrink: 0;
  &.collapsed { width: 0; min-width: 0; border-left: none; }
}
</style>

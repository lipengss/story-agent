<script setup lang="ts">
import { ref, onMounted, watch, nextTick, provide, reactive } from 'vue'
import zhCN from 'ant-design-vue/locale/zh_CN'

// 直接提供中文本地化，确保 Tour 按钮显示中文
// Tour 面板通过 Portal/Teleport 渲染，但 Vue 3 的 provide/inject
// 跨越 Teleport 边界，TourPanel 的 LocaleReceiver 能找到此处的 localeData
provide('localeData', reactive({
  antLocale: { ...zhCN, exist: true },
}))

const open = ref(false)
const current = ref(0)
const tourKey = ref(0)

// 全局触发入口（AppHeader "?" 按钮调用）
if (typeof window !== 'undefined') {
  ;(window as any).__showTour = () => {
    localStorage.removeItem('storyagent_tour_seen')
    current.value = 0
    // Force re-mount the tour component to avoid internal state issues
    tourKey.value++
    nextTick(() => { open.value = true })
  }
}

const steps = [
  {
    title: '👋 欢迎使用 StoryAgent',
    description: '一个可视化的 AI 写作工具，帮你从灵感到成文。我们准备了一篇示例文章，你可以先随便看看～',
    target: () => document.getElementById('app-header'),
    placement: 'bottom' as const,
    nextButtonProps: { children: '下一步' },
  },
  {
    title: '👆 添加节点构建故事',
    description: '使用左侧工具栏按钮在画布上添加节点：主题、人物、场景、情节、章节。也可以右键画布空白处添加。',
    target: () => document.getElementById('canvas-toolbar'),
    placement: 'right' as const,
    prevButtonProps: { children: '上一步' },
    nextButtonProps: { children: '下一步' },
  },
  {
    title: '✏️ 双击节点直接编辑',
    description: '双击画布上的任意节点即可在当前位置编辑内容。按 Enter 保存，Escape 取消。',
    target: () => document.querySelector('.vue-flow__pane') as HTMLElement | null,
    placement: 'bottom' as const,
    prevButtonProps: { children: '上一步' },
    nextButtonProps: { children: '下一步' },
  },
  {
    title: '✨ 点击「生成」按钮',
    description: '填好主题、人物、场景后，点击顶部的「✨ 生成」按钮，AI 会自动融合所有设定生成章节正文。',
    target: () => document.getElementById('header-generate-btn'),
    placement: 'bottom' as const,
    prevButtonProps: { children: '上一步' },
    nextButtonProps: { children: '下一步' },
  },
  {
    title: '💬 AI 助手打磨文章',
    description: '编辑器工具栏提供润色、扩写、缩写、续写、写开头结尾和逻辑检查。按 Ctrl+K 可以输入自由指令，点击「📰 标题设计」可生成章节标题。',
    target: () => document.getElementById('editor-ai-toolbar'),
    placement: 'top' as const,
    prevButtonProps: { children: '上一步' },
    nextButtonProps: { children: '下一步' },
  },
  {
    title: '⚡ 写作风格库 & AI 设置',
    description: '右侧面板可以拖拽风格模板到画布、配置 API Key。没有配置 API Key 之前 AI 功能无法使用哦～',
    target: () => document.getElementById('right-sidebar'),
    placement: 'left' as const,
    prevButtonProps: { children: '上一步' },
    nextButtonProps: { children: '结束导览' },
  },
]

// Debug: watch for tour open state
watch(open, (val) => {
  if (val) {
    console.log('[WelcomeTour] Tour opened, current step:', current.value)
    // Debug: check if all target elements exist
    nextTick(() => {
      const ids = ['app-header', 'canvas-toolbar', 'header-generate-btn', 'editor-ai-toolbar', 'right-sidebar']
      ids.forEach(id => {
        const el = document.getElementById(id)
        console.log(`[WelcomeTour] Target #${id}:`, el ? 'found' : 'MISSING')
      })
      // Check for tour DOM elements
      setTimeout(() => {
        const tourElements = document.querySelectorAll('.ant-tour, .ant-tour-content, .ant-tour-inner')
        console.log('[WelcomeTour] Tour DOM elements found:', tourElements.length)
        tourElements.forEach((el, i) => {
          const style = window.getComputedStyle(el)
          console.log(`[WelcomeTour]   [${i}] tag=${el.tagName} class="${el.className}" opacity=${style.opacity} display=${style.display} visibility=${style.visibility}`)
        })
        // Also check for the popup container
        const bodyChildren = document.body.children
        for (let i = 0; i < bodyChildren.length; i++) {
          const c = bodyChildren[i] as HTMLElement
          if (c.style.position === 'absolute' && c.style.top === '0px' && c.style.left === '0px') {
            console.log('[WelcomeTour] Popup container found:', c.children.length, 'children')
            for (let j = 0; j < c.children.length; j++) {
              console.log(`[WelcomeTour]   child[${j}]:`, c.children[j].className || c.children[j].tagName)
            }
          }
        }
      }, 500)
    })
  }
})

onMounted(() => {
  const seen = localStorage.getItem('storyagent_tour_seen')
  if (!seen) {
    // 首屏渲染后稍等让 DOM 就绪
    setTimeout(() => { open.value = true }, 800)
  }
})

function done() {
  open.value = false
  localStorage.setItem('storyagent_tour_seen', '1')
}
</script>

<template>
  <a-tour
    :key="tourKey"
    v-model:current="current"
    :open="open"
    :steps="steps"
    :z-index="1001"
    @finish="done"
    @close="done"
  />
</template>

<!-- Force tour popup panel visible — works around ant-design-vue's
     PopupInner opacity:0 state machine + vShow display:none that can get stuck in Electron -->
<style>
/* Override vShow display:none */
.ant-tour[style*="display"],
.ant-tour [style*="display"] {
  display: block !important;
}
/* Override opacity:0 from stuck state machine */
.ant-tour,
.ant-tour-content,
.ant-tour-inner {
  opacity: 1 !important;
  pointer-events: auto !important;
}
/* Also target the rc-trigger-popup wrapper (has opacity:0 inline) */
.rc-trigger-popup,
[class*="rc-trigger-popup"] {
  opacity: 1 !important;
  pointer-events: auto !important;
}
/* Target elements inside the tour that might be hidden */
[class*="ant-tour"] {
  visibility: visible !important;
}
</style>

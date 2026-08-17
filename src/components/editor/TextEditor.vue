<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useProjectStore } from '@/stores/project'
import { loadApiConfigs } from '@/utils/storage'
import { callLLM } from '@/utils/llm'
import { message, notification } from 'ant-design-vue'
import { marked } from 'marked'

const projectStore = useProjectStore()

const editMode = ref<'edit' | 'preview'>('edit')
const generating = ref(false)
const processingKey = ref<string | null>(null)

// Inline AI actions
const aiActions = [
  { key: 'polish', label: '✨ 润色', prompt: '请润色以下文字，使其更流畅优美，保持原意不变：' },
  { key: 'expand', label: '📝 扩写', prompt: '请扩写以下文字，增加细节和描写，使其更加丰富饱满：' },
  { key: 'shorten', label: '✂️ 缩写', prompt: '请缩写以下文字，保留核心内容，精简到一半长度：' },
  { key: 'continue', label: '💡 续写', prompt: '请从以下文字继续往下写，保持风格一致：' },
  { key: 'openStart', label: '🚀 写开头', prompt: '请为这篇文章写一个引人入胜的开头段落：' },
  { key: 'openEnd', label: '🏁 写结尾', prompt: '请为这篇文章写一个圆满的结尾段落：' },
  { key: 'checkLogic', label: '🔍 检查逻辑', prompt: '请检查以下内容的逻辑一致性，列出所有矛盾、漏洞或不合理之处。如果没问题就说"未发现逻辑问题"。用编号列出每个问题，格式："1.【问题类型】问题描述 → 建议修改"：' },
]

// Build article context from canvas nodes for inline AI awareness
function buildArticleContext(): string {
  const nodes = projectStore.graph.nodes
  const parts: string[] = []

  const theme = nodes.find(n => n.type === 'theme')
  if (theme?.data.content) parts.push(`【文章主题】${theme.data.content}`)

  const articleType = nodes.find(n => n.type === 'articleType')
  if (articleType?.data.name) {
    parts.push(`【文章类型】${articleType.data.name}`)
    if (articleType.data.systemPrompt) parts.push(`【写作要求】${articleType.data.systemPrompt}`)
  }

  const chars = nodes.filter(n => n.type === 'character')
  if (chars.length) {
    parts.push('【人物设定】')
    for (const c of chars) {
      if (c.data.name || c.data.description) parts.push(`${c.data.name || '未命名'}：${c.data.description || ''}`)
    }
  }

  const scenes = nodes.filter(n => n.type === 'scene')
  if (scenes.length) {
    parts.push('【场景设定】')
    for (const s of scenes) {
      if (s.data.name || s.data.description) parts.push(`${s.data.name || '未命名'}：${s.data.description || ''}`)
    }
  }

  const plots = nodes.filter(n => n.type === 'plot')
  if (plots.length) {
    parts.push('【情节要点】')
    for (const p of plots) {
      if (p.data.title || p.data.summary) parts.push(`${p.data.title || '未命名'}：${p.data.summary || ''}`)
    }
  }

  const skills = nodes.filter(n => n.type === 'skill')
  if (skills.length) {
    parts.push('【写作风格】')
    for (const sk of skills) {
      if (sk.data.name || sk.data.promptFragment) parts.push(`${sk.data.name || '未命名'}：${sk.data.promptFragment || ''}`)
    }
  }

  return parts.length ? `以下是整篇文章的创作设定，请严格遵循这些设定来处理用户的文本：\n\n${parts.join('\n\n')}` : ''
}

async function inlineAI(key: string, promptPrefix: string) {
  const textarea = document.querySelector('.editor-textarea') as HTMLTextAreaElement
  if (!textarea) return
  const selStart = textarea.selectionStart
  const selEnd = textarea.selectionEnd
  const selectedText = textarea.value.substring(selStart, selEnd) || textarea.value
  if (!selectedText.trim()) { message.warning('请先选择文本或输入内容'); return }

  const configs = loadApiConfigs()
  const config = configs.find(c => c.isDefault) ?? configs[0]
  if (!config?.apiKey) {
    notification.warning({
      message: '请先配置 API Key',
      description: '👆 点击前往右侧「AI 设置」',
      duration: 4,
      key: 'no-api-key',
      onClick: () => {
        window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: { tab: 'ai-settings' } }))
        notification.close('no-api-key')
      },
    })
    return
  }

  // 检查逻辑 uses review panel instead of inline replace
  if (key === 'checkLogic') {
    processingKey.value = key
    try {
      const context = buildArticleContext()
      const systemPrompt = context
        ? `你是写作质量审核员。${context}\n\n请只返回问题分析，不要加其他说明。`
        : '你是写作质量审核员，请返回问题分析。'
      const result = await callLLM({ config, systemPrompt, userPrompt: promptPrefix + '\n\n' + selectedText })
      reviewContent.value = result
      showReview.value = true
    } catch (e: any) {
      message.error(e.message)
    } finally {
      processingKey.value = null
    }
    return
  }

  processingKey.value = key
  try {
    const context = buildArticleContext()
    const systemPrompt = context
      ? `你是写作助手。${context}\n\n请只返回处理后的文本，不要加任何解释说明。`
      : '你是写作助手，只返回处理后的文本。'
    const result = await callLLM({ config, systemPrompt, userPrompt: promptPrefix + '\n\n' + selectedText })
    const current = textarea.value
    if (key === 'continue' || key === 'openEnd') {
      projectStore.content = current + '\n\n' + result
    } else if (key === 'openStart') {
      projectStore.content = result + '\n\n' + current
    } else if (selStart !== selEnd) {
      projectStore.content = current.substring(0, selStart) + result + current.substring(selEnd)
    } else {
      projectStore.content = result
    }
    projectStore.createVersion()
    message.success('完成')
  } catch (e: any) {
    message.error(e.message)
  } finally {
    processingKey.value = null
  }
}

// Title designer
const showTitleDesigner = ref(false)
const titleCandidates = ref<string[]>([])
const titleGenerating = ref(false)

async function openTitleDesigner() {
  const configs = loadApiConfigs()
  const config = configs.find(c => c.isDefault) ?? configs[0]
  if (!config?.apiKey) {
    notification.warning({
      message: '请先配置 API Key',
      description: '👆 点击前往右侧「AI 设置」',
      duration: 4,
      key: 'no-api-key-title',
      onClick: () => { window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: { tab: 'ai-settings' } })); notification.close('no-api-key-title') },
    })
    return
  }
  showTitleDesigner.value = true
  titleCandidates.value = []
  titleGenerating.value = true
  try {
    const context = buildArticleContext()

    // Get chapter content from editor
    const chapterContent = projectStore.content || ''
    // Get selected text from editor (if any)
    const textarea = document.querySelector('.editor-textarea') as HTMLTextAreaElement
    const selectedText = textarea
      ? textarea.value.substring(textarea.selectionStart, textarea.selectionEnd).trim()
      : ''

    const titleAngles = '1.悬念疑问式\n2.反常识式\n3.共鸣痛点式\n4.对比冲击式\n5.两难选择式\n6.温情治愈式'
    const formatHint = '每个15-25字，标题之间角度要明显不同，直接输出6行标题，每行格式："1. 标题内容"，不要加任何其他文字。'

    let prompt: string
    let systemPrompt = '你是专业的标题设计师，根据文章内容生成贴合内文的标题，只返回6行标题，不要加任何解释。'

    if (selectedText) {
      // Priority: selected text — generate titles focused on the selection
      const snippet = selectedText.length > 800 ? selectedText.substring(0, 800) + '...' : selectedText
      const contextHint = context ? `\n\n文章整体设定：${context.replace(/^以下是整篇文章的创作设定.*：\n\n/, '')}` : ''
      prompt = `以下是用户选中的文章段落：\n\n---\n${snippet}\n---${contextHint}\n\n请根据这段选中的内容的核心主题和风格，用以下6种角度各生成1个章节标题（共6个）：\n${titleAngles}\n\n${formatHint}`
    } else if (chapterContent.trim()) {
      // Chapter has content — combine context + chapter text
      const snippet = chapterContent.length > 1000 ? chapterContent.substring(0, 1000) + '...' : chapterContent
      prompt = `${context}\n\n以下是本章正文内容：\n\n---\n${snippet}\n---\n\n请根据本章的具体内容并结合以上创作设定，用以下6种角度各生成1个章节标题（共6个）：\n${titleAngles}\n\n${formatHint}`
    } else if (context) {
      // Fallback: no content yet, only settings
      prompt = `${context}\n\n请根据以上创作设定，用以下6种角度各生成1个文章标题（共6个）：\n${titleAngles}\n\n${formatHint}`
    } else {
      prompt = `请根据当前文章内容，用6种不同角度各生成1个标题，${formatHint}`
    }

    const result = await callLLM({ config, systemPrompt, userPrompt: prompt })
    titleCandidates.value = result.split('\n').filter((l: string) => l.trim()).slice(0, 6)
  } catch (e: any) {
    message.error(e.message)
  } finally {
    titleGenerating.value = false
  }
}

function selectTitle(title: string) {
  // Extract just the title without the number prefix
  const clean = title.replace(/^\d+[\.\、\s]+/, '').trim()
  projectStore.projectMeta!.name = clean
  projectStore.saveProject()
  showTitleDesigner.value = false
  message.success('标题已更新')
}

// Ctrl+K inline prompt
const showQuickPrompt = ref(false)
const quickPrompt = ref('')

function openQuickPrompt() {
  quickPrompt.value = ''
  showQuickPrompt.value = true
}

async function submitQuickPrompt() {
  const instruction = quickPrompt.value.trim()
  if (!instruction) return

  const textarea = document.querySelector('.editor-textarea') as HTMLTextAreaElement
  if (!textarea) return
  const selStart = textarea.selectionStart
  const selEnd = textarea.selectionEnd
  const selectedText = textarea.value.substring(selStart, selEnd)

  const configs = loadApiConfigs()
  const config = configs.find(c => c.isDefault) ?? configs[0]
  if (!config?.apiKey) {
    notification.warning({
      message: '请先配置 API Key',
      description: '👆 点击前往右侧「AI 设置」',
      duration: 4,
      key: 'no-api-key-quick',
      onClick: () => {
        window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: { tab: 'ai-settings' } }))
        notification.close('no-api-key-quick')
      },
    })
    return
  }

  showQuickPrompt.value = false
  processingKey.value = 'quick-prompt'

  try {
    const context = buildArticleContext()
    const systemPrompt = context
      ? `你是写作助手。${context}\n\n请只返回处理后的文本，不要加任何解释说明。`
      : '你是写作助手，只返回处理后的文本。'
    const userPrompt = selectedText
      ? `用户指令：${instruction}\n\n原文：${selectedText}`
      : `用户指令：${instruction}\n\n全文：${textarea.value}`
    const result = await callLLM({ config, systemPrompt, userPrompt })
    if (selStart !== selEnd) {
      projectStore.content = textarea.value.substring(0, selStart) + result + textarea.value.substring(selEnd)
    } else {
      projectStore.content = result
    }
    projectStore.createVersion()
    message.success('完成')
  } catch (e: any) {
    message.error(e.message)
  } finally {
    processingKey.value = null
  }
}

// Logic review panel
const showReview = ref(false)
const reviewContent = ref('')

function applyReviewSuggestion() {
  showReview.value = false
  reviewContent.value = ''
}

// Ctrl+K keyboard shortcut
function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    openQuickPrompt()
  }
}

function onGenStarted() { generating.value = true }
function onGenComplete() { generating.value = false }

onMounted(() => {
  window.addEventListener('generation-started', onGenStarted)
  window.addEventListener('generation-complete', onGenComplete)
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  window.removeEventListener('generation-started', onGenStarted)
  window.removeEventListener('generation-complete', onGenComplete)
  window.removeEventListener('keydown', onKeydown)
})

const saveStatus = ref<'saved' | 'saving' | 'unsaved'>('saved')
let saveTimer: ReturnType<typeof setTimeout> | null = null

// Current chapter being edited
const currentChapter = computed(() => {
  const sel = projectStore.selectedNode
  if (sel && sel.type === 'text') return sel.data.title || '章节'
  const first = projectStore.graph.nodes.find(n => n.type === 'text')
  return first?.data?.title || '正文'
})

// Debounced save whenever content changes
watch(() => projectStore.content, (val) => {
  // Capture load count to detect project switch
  const capturedLoadCount = projectStore.loadCount

  const selected = projectStore.selectedNode
  if (selected && selected.type === 'text') {
    projectStore.updateNode(selected.id, { generated: val })
  }
  saveStatus.value = 'unsaved'
  if (saveTimer) clearTimeout(saveTimer)
  saveStatus.value = 'saving'
  saveTimer = setTimeout(() => {
    if (projectStore.loadCount !== capturedLoadCount) return
    projectStore.saveProject() // save content only, no version
    saveStatus.value = 'saved'
  }, 2000)
})

const previewHtml = computed(() => {
  try {
    return marked(projectStore.content || '')
  } catch {
    return projectStore.content
  }
})

// Version management
const showVersions = ref(false)
function restoreVersion(versionId: string) {
  projectStore.restoreVersion(versionId)
  showVersions.value = false
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`
  return new Date(ts).toLocaleDateString('zh-CN')
}

function wordDiff(v: { content: string }, i: number, all: { content: string }[]): string {
  if (i === all.length - 1) return `${v.content.length} 字`
  const prev = all[i + 1]?.content || ''
  const delta = v.content.length - prev.length
  const sign = delta >= 0 ? '+' : ''
  return `${v.content.length} 字 (${sign}${delta})`
}
</script>

<template>
  <div class="text-editor">
    <div class="editor-toolbar" id="editor-ai-toolbar">
      <div class="toolbar-left">
        <span class="chapter-badge">📄 {{ currentChapter }}</span>
        <a-radio-group v-model:value="editMode" size="small" button-style="solid">
          <a-radio-button value="edit">编辑</a-radio-button>
          <a-radio-button value="preview">预览</a-radio-button>
        </a-radio-group>
        <span class="save-indicator" :class="saveStatus">
          <CheckCircleOutlined v-if="saveStatus === 'saved'" />
          <SyncOutlined v-else-if="saveStatus === 'saving'" spin />
          <EditOutlined v-else />
          {{ saveStatus === 'saved' ? '已保存' : saveStatus === 'saving' ? '保存中...' : '未保存' }}
        </span>
      </div>
      <a-dropdown v-model:open="showVersions" trigger="click">
        <a-button size="small">
          版本 ({{ projectStore.versions.length }}) <DownOutlined />
        </a-button>
        <template #overlay>
          <div class="version-dropdown">
            <div class="version-list">
              <div v-if="projectStore.versions.length === 0" class="empty-text">暂无版本</div>
              <div
                v-for="(v, idx) in [...projectStore.versions].reverse()"
                :key="v.id"
                class="version-item"
                :class="{ 'is-latest': idx === 0 }"
                @click="restoreVersion(v.id)"
              >
                <div class="version-top">
                  <span class="version-label">{{ v.label }}</span>
                  <span v-if="idx === 0" class="version-latest-tag">当前</span>
                </div>
                <div class="version-meta">
                  <span class="version-date">{{ relativeTime(v.timestamp) }}</span>
                  <span class="version-words">{{ wordDiff(v, projectStore.versions.length - 1 - idx, projectStore.versions) }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </a-dropdown>
    </div>

    <!-- Inline AI toolbar -->
    <div v-if="editMode === 'edit'" class="inline-ai-bar">
      <span class="inline-ai-label">AI 助手：</span>
      <a-button
        v-for="act in aiActions"
        :key="act.key"
        size="small" type="text"
        :loading="processingKey === act.key"
        @click="inlineAI(act.key, act.prompt)"
      >{{ act.label }}</a-button>
      <a-divider type="vertical" style="margin: 0 2px; border-color: #e5e7eb;" />
      <a-button size="small" type="text" @click="openTitleDesigner" :loading="titleGenerating">
        📰 标题设计
      </a-button>
      <a-button size="small" type="text" class="quick-prompt-btn" @click="openQuickPrompt">
        ⌨️ Ctrl+K 指令
      </a-button>
    </div>

    <!-- Generation loading bar -->
    <div v-if="generating" class="gen-loading-bar">
      <span class="gen-loading-dot"></span>
      AI 正在生成文章...
    </div>

    <!-- Logic review panel -->
    <div v-if="showReview" class="review-panel">
      <div class="review-header">
        <span>🔍 逻辑检查结果</span>
        <a-button type="text" size="small" @click="showReview = false">✕</a-button>
      </div>
      <div class="review-body" v-text="reviewContent"></div>
      <div class="review-footer">
        <a-button size="small" @click="showReview = false">关闭</a-button>
        <a-button size="small" type="primary" @click="applyReviewSuggestion">已阅，开始修改</a-button>
      </div>
    </div>

    <div class="editor-body">
      <a-textarea
        v-if="editMode === 'edit'"
        v-model:value="projectStore.content"
        :auto-size="false"
        class="editor-textarea"
        placeholder="在此编辑文本...支持 Markdown 格式"
      />
      <div v-else class="editor-preview" v-html="previewHtml"></div>
    </div>

    <!-- Title Designer Modal -->
    <a-modal
      :open="showTitleDesigner"
      title="📰 AI 标题设计"
      width="520px"
      :footer="null"
      @cancel="showTitleDesigner = false"
    >
      <div class="title-designer-body">
        <div class="td-hint" v-if="!titleGenerating && titleCandidates.length === 0">
          根据你的文章主题、人物、情节设定，AI 正在生成 6 个爆款标题...
        </div>
        <a-spin :spinning="titleGenerating" tip="AI 正在设计标题...">
          <div class="td-list" v-if="titleCandidates.length > 0">
            <div
              v-for="(t, i) in titleCandidates"
              :key="i"
              class="td-item"
              @click="selectTitle(t)"
            >
              <span class="td-num">{{ i + 1 }}</span>
              <span class="td-text">{{ t.replace(/^\d+[\.\、\s]+/, '') }}</span>
            </div>
          </div>
        </a-spin>
      </div>
    </a-modal>

    <!-- Ctrl+K Quick Prompt Modal -->
    <a-modal
      :open="showQuickPrompt"
      title="AI 指令"
      width="480px"
      :closable="true"
      :footer="null"
      @cancel="showQuickPrompt = false"
    >
      <div class="quick-prompt-body">
        <div class="qp-hint">输入自然语言指令，AI 会根据整篇文章的设定来执行</div>
        <a-textarea
          v-model:value="quickPrompt"
          :rows="3"
          placeholder="例如：把第三段改得更悬疑、用更简洁的语言重写、把对话改成内心独白..."
          @press-enter="(e: KeyboardEvent) => { if (!e.shiftKey) { e.preventDefault(); submitQuickPrompt(); } }"
        />
      </div>
      <div class="quick-prompt-footer">
        <a-button @click="showQuickPrompt = false">取消</a-button>
        <a-button type="primary" :loading="processingKey === 'quick-prompt'" @click="submitQuickPrompt">
          执行
        </a-button>
      </div>
    </a-modal>
  </div>
</template>

<script lang="ts">
import { DownOutlined, CheckCircleOutlined, SyncOutlined, EditOutlined } from '@ant-design/icons-vue'
export default { components: { DownOutlined, CheckCircleOutlined, SyncOutlined, EditOutlined } }
</script>

<style scoped lang="less">
.text-editor {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .chapter-badge {
    font-size: 12px;
    font-weight: 600;
    color: #6366f1;
    background: #eef2ff;
    padding: 2px 10px;
    border-radius: 10px;
    white-space: nowrap;
  }

  .save-indicator {
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    color: #6b7280;
    &.saved { color: #22c55e; }
    &.saving { color: #f59e0b; }
    &.unsaved { color: #ef4444; }
  }
}

.inline-ai-bar {
  display: flex; align-items: center; gap: 2px;
  padding: 4px 12px; border-bottom: 1px solid #e5e7eb;
  background: #fafbff; flex-shrink: 0; flex-wrap: wrap;
}
.inline-ai-label { font-size: 11px; color: #6b7280; margin-right: 4px; }
.quick-prompt-btn {
  color: #6366f1;
  font-weight: 500;
}

.gen-loading-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: linear-gradient(90deg, #eef2ff, #faf5ff, #eef2ff);
  background-size: 200% 100%;
  animation: shimmer 2s ease-in-out infinite;
  font-size: 12px;
  color: #6366f1;
  font-weight: 500;
  flex-shrink: 0;
}

.gen-loading-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6366f1;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.review-panel {
  margin: 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  max-height: 200px;
  display: flex;
  flex-direction: column;
}

.review-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #fefce8;
  border-bottom: 1px solid #fde68a;
  font-size: 13px;
  font-weight: 600;
  color: #92400e;
}

.review-body {
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.7;
  color: #374151;
  overflow-y: auto;
  white-space: pre-wrap;
  flex: 1;
}

.review-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 6px 12px;
  border-top: 1px solid #f3f4f6;
  background: #fafafa;
}

.editor-body {
  flex: 1;
  overflow: hidden;
}

.editor-textarea {
  width: 100%;
  height: 100%;
  border: none;
  resize: none;
  padding: 12px;
  font-size: 14px;
  line-height: 1.8;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  &:focus {
    outline: none;
    box-shadow: none;
  }
}

.editor-preview {
  padding: 12px 16px;
  height: 100%;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.8;
  color: #374151;

  :deep(h1), :deep(h2), :deep(h3) { margin: 12px 0 8px; }
  :deep(p) { margin: 6px 0; }
  :deep(code) { background: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
  :deep(pre) { background: #f3f4f6; padding: 12px; border-radius: 6px; overflow-x: auto; }
}

.version-dropdown {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 4px;
  min-width: 220px;
}

.version-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 6px;
  font-size: 13px;
  border-left: 3px solid transparent;

  &:hover { background: #f3f4f6; }
  &.is-latest { border-left-color: #6366f1; background: #fafbff; }
}

.version-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.version-label {
  font-weight: 600;
  color: #374151;
}

.version-latest-tag {
  font-size: 10px;
  background: #6366f1;
  color: #fff;
  padding: 0 6px;
  border-radius: 8px;
  line-height: 16px;
}

.version-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #9ca3af;
}

.version-date {
  color: #6b7280;
}

.version-words {
  color: #9ca3af;
}

.empty-text {
  padding: 12px;
  text-align: center;
  font-size: 13px;
  color: #6b7280;
}

.quick-prompt-body {
  .qp-hint {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 10px;
  }
}

.quick-prompt-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.title-designer-body {
  .td-hint { font-size: 13px; color: #6b7280; text-align: center; padding: 20px 0; }
}

.td-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.td-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  cursor: pointer;
  border: 1.5px solid #e5e7eb;
  transition: all 0.15s;

  &:hover { border-color: #6366f1; background: #faf9ff; }
}

.td-num {
  width: 24px; height: 24px;
  border-radius: 50%;
  background: #6366f1;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.td-text {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.4;
}
</style>

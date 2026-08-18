<script setup lang="ts">
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useProjectStore } from '@/stores/project'
import { fetchAndCompressReference } from '@/utils/reference'
import { fetchHotTopics, formatHotTopics } from '@/utils/hotTopics'

const projectStore = useProjectStore()
const node = computed(() => projectStore.selectedNode)
const nodeLabel = computed(() => {
  const map: Record<string, string> = { theme: '主题', articleType: '文章类型', skill: '写作风格', plot: '情节', character: '人物', scene: '场景', text: '章节', reference: '参考资料' }
  return map[node.value?.type || ''] || node.value?.type || ''
})

const fetchingRef = ref(false)
const fetchingHot = ref(false)

async function fetchReference() {
  if (!node.value || node.value.type !== 'reference') return
  const url = (node.value.data.sourceUrl || '').trim()
  if (!url) { message.warning('请先填写「来源链接」'); return }
  fetchingRef.value = true
  try {
    const res = await fetchAndCompressReference(url)
    if (!res.success) { message.error(res.error || '抓取失败'); return }
    projectStore.updateNode(node.value.id, {
      content: res.content,
      title: res.title || node.value.data.title,
    })
    projectStore.saveProject()
    message.success(res.note || (res.compressed ? '已压缩为要点' : '已抓取正文'))
  } finally {
    fetchingRef.value = false
  }
}

async function fetchHot() {
  if (!node.value || node.value.type !== 'reference') return
  fetchingHot.value = true
  try {
    const res = await fetchHotTopics()
    if (!res.success) { message.error(res.error || '抓取失败'); return }
    projectStore.updateNode(node.value.id, {
      title: '本周热点清单',
      content: formatHotTopics(res.topics),
    })
    projectStore.saveProject()
    message.success(res.note || `已抓取 ${res.topics.length} 条热点，可删除不需要的`)
  } finally {
    fetchingHot.value = false
  }
}
</script>

<template>
  <div class="property-panel">
    <Transition name="panel-fade" mode="out-in">
      <div v-if="node" :key="node.id" class="node-properties">
        <!-- Theme -->
        <template v-if="node.type === 'theme'">
          <div class="prop-item"><span class="prop-label">标题</span><a-input v-model:value="node.data.title" size="small" @change="projectStore.saveProject()" /></div>
          <div class="prop-item"><span class="prop-label">内容</span><a-textarea v-model:value="node.data.content" size="small" :rows="3" @change="projectStore.saveProject()" /></div>
        </template>

        <!-- ArticleType -->
        <template v-if="node.type === 'articleType'">
          <div class="prop-item"><span class="prop-label">类型</span>
            <a-select v-model:value="node.data.articleTypeId" size="small" style="width:100%" @change="projectStore.setArticleType(node.data.articleTypeId)">
              <a-select-option v-for="t in projectStore.articleTypes" :key="t.id" :value="t.id">{{ t.icon }} {{ t.name }}</a-select-option>
            </a-select>
          </div>
          <div class="prop-item"><span class="prop-label">系统指令</span><a-textarea v-model:value="node.data.systemPrompt" size="small" :rows="4" @change="projectStore.saveProject()" /></div>
        </template>

        <!-- Skill -->
        <template v-if="node.type === 'skill'">
          <div class="prop-item"><span class="prop-label">名称</span><span class="prop-value">{{ node.data.name }}</span></div>
          <div class="prop-item" v-if="node.data.variables?.length">
            <span class="prop-label">变量</span>
            <div v-for="v in node.data.variables" :key="v.name" class="var-row">
              <span class="var-name">{{ v.name }}</span>
              <a-input v-model:value="v.defaultValue" size="small" :placeholder="v.label" style="width:120px" @change="projectStore.saveProject()" />
            </div>
          </div>
        </template>

        <!-- Plot -->
        <template v-if="node.type === 'plot'">
          <div class="prop-item"><span class="prop-label">标题</span><a-input v-model:value="node.data.title" size="small" @change="projectStore.saveProject()" /></div>
          <div class="prop-item"><span class="prop-label">摘要</span><a-textarea v-model:value="node.data.summary" size="small" :rows="3" @change="projectStore.saveProject()" /></div>
        </template>

        <!-- Character -->
        <template v-if="node.type === 'character'">
          <div class="prop-item"><span class="prop-label">名称</span><a-input v-model:value="node.data.name" size="small" @change="projectStore.saveProject()" /></div>
          <div class="prop-item"><span class="prop-label">设定</span><a-textarea v-model:value="node.data.description" size="small" :rows="3" @change="projectStore.saveProject()" /></div>
        </template>

        <!-- Scene -->
        <template v-if="node.type === 'scene'">
          <div class="prop-item"><span class="prop-label">名称</span><a-input v-model:value="node.data.name" size="small" @change="projectStore.saveProject()" /></div>
          <div class="prop-item"><span class="prop-label">描述</span><a-textarea v-model:value="node.data.description" size="small" :rows="3" @change="projectStore.saveProject()" /></div>
        </template>

        <!-- Text / Chapter -->
        <template v-if="node.type === 'text'">
          <div class="prop-item"><span class="prop-label">章节标题</span><a-input v-model:value="node.data.title" size="small" @change="projectStore.saveProject()" /></div>
          <div class="prop-item">
            <span class="prop-label">目标字数：{{ node.data.wordCount || 2000 }} 字</span>
            <a-slider :value="node.data.wordCount || 2000" :min="200" :max="10000" :step="100"
              :marks="{ 200: '200', 2000: '2k', 5000: '5k', 10000: '1w' }"
              @change="(v: number) => { if (node) { projectStore.updateNode(node.id, { wordCount: v }); projectStore.saveProject() } }" />
          </div>
        </template>

        <!-- Reference -->
        <template v-if="node.type === 'reference'">
          <div class="prop-item"><span class="prop-label">标题</span><a-input v-model:value="node.data.title" size="small" @change="projectStore.saveProject()" /></div>
          <div class="prop-item"><span class="prop-label">内容</span><a-textarea v-model:value="node.data.content" size="small" :rows="4" placeholder="粘贴参考资料文本，或点下方「抓取」自动获取..." @change="projectStore.saveProject()" /></div>
          <div class="prop-item">
            <span class="prop-label">来源链接</span>
            <div class="ref-url-row">
              <a-input v-model:value="node.data.sourceUrl" size="small" placeholder="https://..." @change="projectStore.saveProject()" />
              <a-button size="small" type="primary" :loading="fetchingRef" @click="fetchReference">抓取</a-button>
            </div>
          </div>
          <div class="prop-item">
            <span class="prop-label">热点采集</span>
            <a-button size="small" :loading="fetchingHot" @click="fetchHot">抓本周热点（微博+百度）</a-button>
          </div>
        </template>
      </div>

      <div v-else :key="'empty'" class="no-selection">
        <div class="empty-text">点击画布上的节点<br/>查看和编辑属性<br/><span class="empty-hint">或切换到 AI 设置 / 写作风格</span></div>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="less">
.property-panel {
  .section-title { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 10px; }
}
.node-properties {
  .prop-item { margin-bottom: 10px; }
  .prop-label { display: block; font-size: 12px; color: #6b7280; margin-bottom: 4px; }
  .prop-value { font-size: 13px; color: #374151; }
}
.var-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.ref-url-row { display: flex; gap: 6px; .a-input { flex: 1; } }
.var-name { font-size: 12px; font-family: monospace; color: #6366f1; min-width: 60px; }
.no-selection { text-align: center; padding: 24px 0; .empty-text { font-size: 13px; color: #6b7280; line-height: 1.6; } .empty-hint { font-size: 11px; color: #9ca3af; } }
.panel-fade-enter-active, .panel-fade-leave-active { transition: opacity 0.15s ease; }
.panel-fade-enter-from, .panel-fade-leave-to { opacity: 0; }
</style>

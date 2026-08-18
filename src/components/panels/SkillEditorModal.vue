<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSkillStore } from '@/stores/skills'
import { loadApiConfigs } from '@/utils/storage'
import { callLLM } from '@/utils/llm'
import { message } from 'ant-design-vue'
import type { Skill, SkillCategory, SkillVariable } from '@/types'
import { SkillCategoryLabels } from '@/types'
import { ThunderboltOutlined } from '@ant-design/icons-vue'

const props = defineProps<{
  open: boolean
  skillId: string | null
}>()

const emit = defineEmits(['update:open'])
const skillStore = useSkillStore()

const name = ref('')
const category = ref<SkillCategory>('style')
const description = ref('')
const promptFragment = ref('')
const variables = ref<SkillVariable[]>([])
const exampleInput = ref('')
const exampleOutput = ref('')
const previewRendered = ref('')

const isEditing = computed(() => !!props.skillId)

watch(() => [props.open, props.skillId], () => {
  if (props.open) {
    if (props.skillId) {
      const skill = skillStore.skills.find(s => s.id === props.skillId)
      if (skill) {
        name.value = skill.name
        category.value = skill.category
        description.value = skill.description
        promptFragment.value = skill.promptFragment
        variables.value = [...skill.variables]
        exampleInput.value = skill.exampleInput ?? ''
        exampleOutput.value = skill.exampleOutput ?? ''
      }
    } else {
      resetForm()
    }
  }
})

function resetForm() {
  name.value = ''
  category.value = 'style'
  description.value = ''
  promptFragment.value = ''
  variables.value = []
  exampleInput.value = ''
  exampleOutput.value = ''
  previewRendered.value = ''
}

function parseVariables() {
  const regex = /\{\{(\w+)\}\}/g
  const seen = new Set<string>()
  const vars: SkillVariable[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(promptFragment.value)) !== null) {
    const name = match[1]
    if (!seen.has(name)) {
      seen.add(name)
      const existing = variables.value.find(v => v.name === name)
      vars.push(existing ?? { name, label: name, defaultValue: '', required: true })
    }
  }
  variables.value = vars
}

function preview() {
  let result = promptFragment.value
  for (const v of variables.value) {
    result = result.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, 'g'), v.defaultValue || `[${v.label}]`)
  }
  previewRendered.value = result
}

function save() {
  const data = {
    name: name.value,
    category: category.value,
    description: description.value,
    promptFragment: promptFragment.value,
    variables: variables.value,
    exampleInput: exampleInput.value,
    exampleOutput: exampleOutput.value,
  }

  if (isEditing.value && props.skillId) {
    skillStore.updateSkill(props.skillId, data)
  } else {
    skillStore.createSkill(data)
  }

  emit('update:open', false)
}

// AI generation
const aiDesc = ref('')
const aiGenerating = ref(false)

async function aiGenerate() {
  if (!aiDesc.value.trim()) return
  const configs = loadApiConfigs()
  const config = configs.find(c => c.isDefault) ?? configs[0]
  if (!config || !config.apiKey) {
    message.warning('请先在 AI 设置中配置 API Key')
    return
  }
  aiGenerating.value = true
  try {
    const prompt = `你是一个专业的写作风格设计师。根据用户的需求描述，设计一个完整的写作风格模板。

## 风格模板结构
一个写作风格包含：
- name：简短名称（如"海明威风格""知乎爆款体""玄幻世界观"）
- category：分类，从以下选一：style(风格) / structure(结构) / character(角色) / world(世界) / title(标题)
- description：一句话描述此风格的用途
- promptFragment：核心提示词片段。用 {{变量名}} 格式标记占位符。这是发送给 AI 的实际指令，需要包含：
  1. 【角色设定】AI 扮演什么角色、有什么能力
  2. 【工作流程】分步骤说明 AI 应该如何工作
  3. 【输出要求】格式、风格、字数等具体要求
- exampleInput：一个示例输入
- exampleOutput：对应的示例输出

返回纯 JSON（不要 \`\`\`json 包裹）：
{
  "name": "...",
  "category": "style",
  "description": "...",
  "promptFragment": "...",
  "exampleInput": "...",
  "exampleOutput": "..."
}

用户需求：${aiDesc.value}`

    const result = await callLLM({ config, systemPrompt: '你是专业的写作风格设计师，只返回合法 JSON，不要任何额外内容。', userPrompt: prompt })
    const json = JSON.parse(result.replace(/```json|```/g, '').trim())
    name.value = json.name || ''
    category.value = json.category || 'style'
    description.value = json.description || ''
    promptFragment.value = json.promptFragment || ''
    exampleInput.value = json.exampleInput || ''
    exampleOutput.value = json.exampleOutput || ''
    parseVariables()
    message.success('AI 已生成完整风格模板，可继续手动调整')
  } catch (e: any) {
    message.error(`生成失败：${e.message}`)
  } finally {
    aiGenerating.value = false
  }
}

function cancel() {
  emit('update:open', false)
}
</script>

<template>
  <a-modal
    :open="open"
    :title="isEditing ? '编辑写作风格' : '新建写作风格'"
    width="560px"
    @ok="save"
    @cancel="cancel"
    ok-text="保存到本地"
    cancel-text="取消"
  >
    <a-form layout="vertical" size="small">
      <a-row :gutter="12">
        <a-col :span="14">
          <a-form-item label="名称" required>
            <a-input v-model:value="name" placeholder="风格名称，如：海明威冰山体" />
          </a-form-item>
        </a-col>
        <a-col :span="10">
          <a-form-item label="分类" required>
            <a-select v-model:value="category">
              <a-select-option v-for="(label, key) in SkillCategoryLabels" :key="key" :value="key">
                {{ label }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="描述">
        <a-textarea v-model:value="description" :rows="2" placeholder="简要描述此写作风格的效果" />
      </a-form-item>

      <!-- AI Generate -->
      <a-form-item label="🤖 AI 智能生成（填写需求，自动创建完整风格设置）">
        <a-textarea
          v-model:value="aiDesc"
          :rows="2"
          placeholder="描述你想要的写作风格，如：需要知乎爆款回答风格，开头用反常识观点抓眼球，中间分3点论证并配案例，结尾金句总结..."
        />
        <a-button
          type="dashed"
          size="small"
          :loading="aiGenerating"
          style="margin-top: 6px"
          @click="aiGenerate"
        >
          <template #icon><ThunderboltOutlined /></template>
          AI 生成风格
        </a-button>
      </a-form-item>

      <a-form-item label="提示词片段" required>
        <a-textarea
          v-model:value="promptFragment"
          :rows="6"
          placeholder="输入提示词片段，使用 {{变量名}} 作为占位符"
          @change="parseVariables"
        />
      </a-form-item>

      <!-- Variables Table -->
      <a-form-item label="变量列表" v-if="variables.length > 0">
        <div class="variables-table">
          <div class="var-header">
            <span class="var-col">变量名</span>
            <span class="var-col">标签</span>
            <span class="var-col">默认值</span>
            <span class="var-col-sm">必填</span>
          </div>
          <div v-for="v in variables" :key="v.name" class="var-row">
            <code class="var-col">{{ v.name }}</code>
            <a-input v-model:value="v.label" size="small" class="var-col" />
            <a-input v-model:value="v.defaultValue" size="small" class="var-col" />
            <a-switch v-model:checked="v.required" size="small" class="var-col-sm" />
          </div>
        </div>
      </a-form-item>

      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item label="示例输入">
            <a-textarea v-model:value="exampleInput" :rows="3" placeholder="（可选）" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="示例输出">
            <a-textarea v-model:value="exampleOutput" :rows="3" placeholder="（可选）" />
          </a-form-item>
        </a-col>
      </a-row>

      <!-- Preview -->
      <a-form-item label="预览" v-if="previewRendered">
        <div class="preview-box">{{ previewRendered }}</div>
      </a-form-item>
      <a-button size="small" @click="preview" style="margin-bottom: 8px">预览渲染结果</a-button>
    </a-form>
  </a-modal>
</template>

<style scoped lang="less">
.variables-table {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
}
.var-header {
  display: flex;
  background: #f9fafb;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
}
.var-row {
  display: flex;
  padding: 4px 10px;
  align-items: center;
  border-top: 1px solid #e5e7eb;
  gap: 8px;
}
.var-col {
  flex: 1;
  font-size: 12px;
}
.var-col-sm {
  width: 40px;
  flex-shrink: 0;
}
.preview-box {
  padding: 12px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  color: #374151;
}
</style>

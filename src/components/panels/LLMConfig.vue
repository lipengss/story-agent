<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import type { LLMConfig, LLMProvider } from '@/types'
import { ProviderDefaults } from '@/types'
import { loadApiConfigs, saveApiConfigs, generateId, obfuscateApiKey, deobfuscateApiKey } from '@/utils/storage'
import { testLLMConnection } from '@/utils/llm'

const electron = (window as any).electronAPI
const isElectron = !!electron

const props = withDefaults(defineProps<{ startExpanded?: boolean }>(), { startExpanded: false })
const collapsed = ref(!props.startExpanded)

// Storage path (Electron only)
const storagePath = ref('')

async function loadStoragePath() {
  if (electron) {
    storagePath.value = await electron.getDataPath()
  }
}

async function changeStoragePath() {
  if (!electron) return
  const newPath = await electron.setDataPath()
  if (newPath) {
    storagePath.value = newPath
    message.success(`数据路径已更改为：${newPath}`)
  }
}

onMounted(() => { loadStoragePath() })

const configs = ref<LLMConfig[]>(loadApiConfigs())
const activeConfigId = ref<string>(configs.value.find(c => c.isDefault)?.id ?? '')

// Ensure we have at least one config
if (configs.value.length === 0) {
  const defaultConfig: LLMConfig = {
    id: generateId(),
    name: 'DeepSeek',
    provider: 'deepseek',
    baseUrl: ProviderDefaults.deepseek.baseUrl,
    apiKey: '',
    model: 'deepseek-v4-pro',
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1,
    isDefault: true,
  }
  configs.value = [defaultConfig]
  activeConfigId.value = defaultConfig.id
  saveApiConfigs(configs.value)
}

const currentConfig = computed(() =>
  configs.value.find(c => c.id === activeConfigId.value) ?? configs.value[0]
)

const editingConfig = ref<LLMConfig>({ ...currentConfig.value })
const showApiKey = ref(false)
const testing = ref(false)

watch(activeConfigId, (newId) => {
  const cfg = configs.value.find(c => c.id === newId)
  if (cfg) editingConfig.value = { ...cfg }
})

function onProviderChange(provider: LLMProvider) {
  editingConfig.value.provider = provider
  editingConfig.value.baseUrl = ProviderDefaults[provider].baseUrl
  editingConfig.value.model = ProviderDefaults[provider].models[0] ?? ''
}

async function testConnection() {
  testing.value = true
  const result = await testLLMConnection(editingConfig.value)
  if (result.success) {
    message.success('连接测试成功！')
  } else {
    message.error(`连接测试失败：${result.error || '未知错误'}`)
  }
  testing.value = false
}

function saveConfig() {
  const cfg = { ...editingConfig.value }
  const idx = configs.value.findIndex(c => c.id === cfg.id)
  if (idx !== -1) {
    configs.value[idx] = cfg
  }
  saveApiConfigs(configs.value)
  message.success('配置已保存')
}

function addConfig() {
  const newConfig: LLMConfig = {
    id: generateId(),
    name: `配置 ${configs.value.length + 1}`,
    provider: 'openai',
    baseUrl: ProviderDefaults.openai.baseUrl,
    apiKey: '',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1,
    isDefault: false,
  }
  configs.value.push(newConfig)
  activeConfigId.value = newConfig.id
  editingConfig.value = { ...newConfig }
  saveApiConfigs(configs.value)
}
</script>

<template>
  <div class="llm-config">
    <div class="config-header" @click="collapsed = !collapsed">
      <span class="collapse-arrow" :class="{ expanded: !collapsed }">
        <RightOutlined />
      </span>
      <span class="section-title">LLM 配置</span>
      <a-select
        v-model:value="activeConfigId"
        size="small"
        style="width: 130px"
        @click.stop
        @change="saveConfig()"
      >
        <a-select-option v-for="c in configs" :key="c.id" :value="c.id">
          {{ c.name }}
        </a-select-option>
      </a-select>
      <a-button type="text" size="small" @click.stop="addConfig">
        <template #icon><PlusOutlined /></template>
      </a-button>
    </div>

    <div class="config-form" v-if="editingConfig && !collapsed">
      <a-form layout="vertical" size="small">
        <a-form-item label="服务商">
          <a-select
            :value="editingConfig.provider"
            @change="onProviderChange"
          >
            <a-select-option value="deepseek">DeepSeek</a-select-option>
            <a-select-option value="openai">OpenAI</a-select-option>
            <a-select-option value="anthropic">Anthropic</a-select-option>
            <a-select-option value="custom">自定义</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="接口地址">
          <a-input v-model:value="editingConfig.baseUrl" placeholder="https://api.openai.com/v1" />
        </a-form-item>

        <a-form-item label="密钥">
          <a-input
            :type="showApiKey ? 'text' : 'password'"
            v-model:value="editingConfig.apiKey"
            placeholder="sk-..."
          >
            <template #suffix>
              <EyeOutlined v-if="!showApiKey" @click="showApiKey = true" style="cursor:pointer" />
              <EyeInvisibleOutlined v-else @click="showApiKey = false" style="cursor:pointer" />
            </template>
          </a-input>
        </a-form-item>

        <a-form-item label="模型">
          <a-auto-complete
            v-model:value="editingConfig.model"
            :options="ProviderDefaults[editingConfig.provider].models.map(m => ({ value: m }))"
            placeholder="选择或输入模型名"
            allow-clear
          />
        </a-form-item>

        <a-form-item>
          <template #label>
            <span>Temperature
              <a-tooltip title="控制输出的随机性和创造性。0 = 确定保守，2 = 多变创意。创意写作建议 0.7~1.2" placement="top">
                <QuestionCircleOutlined class="param-help-icon" />
              </a-tooltip>
            </span>
          </template>
          <a-slider
            v-model:value="editingConfig.temperature"
            :min="0" :max="2" :step="0.1"
            :marks="{ 0: '0', 1: '1', 2: '2' }"
          />
        </a-form-item>

        <a-form-item>
          <template #label>
            <span>Max Tokens
              <a-tooltip title="限制 AI 回复的最大长度。1 token ≈ 0.7 个汉字，4096 ≈ 2800 字" placement="top">
                <QuestionCircleOutlined class="param-help-icon" />
              </a-tooltip>
            </span>
          </template>
          <a-input-number
            v-model:value="editingConfig.maxTokens"
            :min="1" :max="128000"
            style="width: 100%"
          />
        </a-form-item>

        <a-form-item>
          <template #label>
            <span>Top P
              <a-tooltip title="核采样：控制词汇选择的多样性。越小越集中，越大越多变。通常与 Temperature 二选一调整即可" placement="top">
                <QuestionCircleOutlined class="param-help-icon" />
              </a-tooltip>
            </span>
          </template>
          <a-slider
            v-model:value="editingConfig.topP"
            :min="0" :max="1" :step="0.05"
            :marks="{ 0: '0', 0.5: '0.5', 1: '1' }"
          />
        </a-form-item>

        <div class="config-actions">
          <a-button type="primary" size="small" block @click="saveConfig">保存配置</a-button>
          <a-button size="small" block @click="testConnection" :loading="testing">测试连接</a-button>
        </div>
      </a-form>

      <!-- Storage path config (Electron only) -->
      <div v-if="isElectron" class="storage-path-section">
        <a-divider style="margin: 10px 0;" />
        <div class="storage-path-label">📁 数据存储位置</div>
        <div class="storage-path-value">{{ storagePath || '加载中...' }}</div>
        <a-button size="small" block @click="changeStoragePath" style="margin-top: 6px;">
          更改存储路径
        </a-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { PlusOutlined, EyeOutlined, EyeInvisibleOutlined, RightOutlined, QuestionCircleOutlined } from '@ant-design/icons-vue'
export default { components: { PlusOutlined, EyeOutlined, EyeInvisibleOutlined, RightOutlined, QuestionCircleOutlined } }
</script>

<style scoped lang="less">
.llm-config {
  .config-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 0;
    cursor: pointer;
    user-select: none;
    padding: 2px 0;

    &:hover {
      .section-title { color: #6366f1; }
    }
  }
  .collapse-arrow {
    font-size: 10px;
    color: #9ca3af;
    transition: transform 0.2s;
    flex-shrink: 0;
    &.expanded {
      transform: rotate(90deg);
    }
  }
  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    flex-shrink: 0;
    transition: color 0.15s;
  }
  .config-form {
    margin-top: 10px;
    :deep(.ant-form-item) {
      margin-bottom: 10px;
    }
    :deep(.ant-form-item-label) {
      padding-bottom: 2px;
      label { font-size: 12px; color: #6b7280; }
    }
  }
  .param-help-icon {
    color: #9ca3af;
    font-size: 11px;
    margin-left: 3px;
    cursor: help;
    transition: color 0.15s;
    &:hover { color: #6366f1; }
  }
  .config-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  .storage-path-section {
    padding: 0 2px;
  }

  .storage-path-label {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 4px;
  }

  .storage-path-value {
    font-size: 11px;
    color: #9ca3af;
    word-break: break-all;
    background: #f9fafb;
    padding: 6px 8px;
    border-radius: 4px;
    border: 1px solid #e5e7eb;
    margin-top: 4px;
  }
}
</style>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useProjectStore } from '@/stores/project'
import { message } from 'ant-design-vue'
import { UserOutlined, RobotOutlined, MessageOutlined } from '@ant-design/icons-vue'
import type { ChatMessage } from '@/types'
import { generateId } from '@/utils/storage'
import { loadApiConfigs } from '@/utils/storage'
import { callLLM } from '@/utils/llm'

const projectStore = useProjectStore()

const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const sending = ref(false)
const chatContainer = ref<HTMLElement | null>(null)

const quickActions = [
  { label: '续写', prompt: '请继续写下去，保持同样的风格和语气。' },
  { label: '写开头', prompt: '请为这个故事写一个引人入胜的开头。' },
  { label: '写结尾', prompt: '请为这个故事写一个圆满的结尾。' },
  { label: '检查逻辑', prompt: '请检查故事中的逻辑一致性，找出可能的矛盾或漏洞。' },
]

function getActiveConfig() {
  const configs = loadApiConfigs()
  if (configs.length === 0) return null
  return configs.find(c => c.isDefault) ?? configs[0]
}

function buildSystemPrompt(): string {
  const articleType = projectStore.currentArticleType
  return articleType.systemPrompt || '你是一位专业的写作助手，帮助用户创作优质内容。'
}

async function sendMessage(text?: string) {
  const msg = text || inputText.value.trim()
  if (!msg) return

  const config = getActiveConfig()
  if (!config || !config.apiKey) {
    // Friendly prompt in chat instead of error popup
    messages.value.push({
      id: generateId(),
      role: 'user',
      content: msg,
      timestamp: Date.now(),
    })
    messages.value.push({
      id: generateId(),
      role: 'assistant',
      content: `👋 **还没配置 AI 哦～**

要让 AI 帮你写作，需要先设置 API Key：

1. 点击右侧的 **「AI 设置」** 标签
2. 选择服务商，填入你的 **API Key**
3. 选择模型，点击 **保存配置**

💡 推荐使用 **DeepSeek**（国内可访问，性价比高）`,
      timestamp: Date.now(),
    })
    inputText.value = ''
    scrollToBottom()
    return
  }

  const context = projectStore.content
  const fullUserPrompt = context
    ? `当前文本内容：\n---\n${context}\n---\n\n用户指令：${msg}`
    : msg

  messages.value.push({
    id: generateId(),
    role: 'user',
    content: msg,
    timestamp: Date.now(),
  })

  inputText.value = ''
  sending.value = true
  scrollToBottom()

  try {
    const reply = await callLLM({
      config,
      systemPrompt: buildSystemPrompt(),
      userPrompt: fullUserPrompt,
    })

    messages.value.push({
      id: generateId(),
      role: 'assistant',
      content: reply || '（AI 返回了空内容，请重试）',
      timestamp: Date.now(),
    })
  } catch (e: any) {
    const errMsg = e.message || '未知错误'
    messages.value.push({
      id: generateId(),
      role: 'assistant',
      content: `😥 **AI 调用出错了**

> ${errMsg}

**可能的原因：**
- 🔑 API Key 填错了 → 去右侧「AI 设置」检查
- 🌐 网络不通 → 检查是否能访问 API 地址
- 📦 模型名不对 → 确认模型名称拼写正确

💡 如果用 DeepSeek，默认 Key 应该可以直接使用～`,
      timestamp: Date.now(),
    })
  } finally {
    sending.value = false
    scrollToBottom()
  }
}

function applyToText(content: string) {
  projectStore.content = content
  message.success('已应用到文本')
}

function quickAction(prompt: string) {
  sendMessage(prompt)
}

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}
</script>

<template>
  <div class="chat-panel">
    <!-- Quick Actions -->
    <div class="quick-actions">
      <a-button
        v-for="action in quickActions"
        :key="action.label"
        size="small"
        :disabled="sending"
        @click="quickAction(action.prompt)"
      >
        {{ action.label }}
      </a-button>
    </div>

    <!-- Messages -->
    <div class="chat-messages" ref="chatContainer">
      <div v-if="messages.length === 0" class="chat-empty">
        <div class="empty-icon"><MessageOutlined /></div>
        <div class="empty-text">对生成结果不满意？<br/>在这里让 AI 帮你改写、续写、检查逻辑</div>
        <div class="empty-hint">💡 提示：先用顶部「生成文章」产出初稿，再用对话精细打磨</div>
      </div>

      <div
        v-for="msg in messages"
        :key="msg.id"
        class="chat-message"
        :class="msg.role"
      >
        <div class="msg-avatar">
          <UserOutlined v-if="msg.role === 'user'" />
          <RobotOutlined v-else />
        </div>
        <div class="msg-body">
          <div class="msg-content" v-text="msg.content"></div>
          <div class="msg-actions" v-if="msg.role === 'assistant' && !msg.content.startsWith('❌')">
            <a-button type="link" size="small" @click="applyToText(msg.content)">
              应用到文本
            </a-button>
          </div>
        </div>
      </div>

      <!-- Loading indicator -->
      <div v-if="sending" class="chat-message assistant">
        <div class="msg-avatar"><RobotOutlined /></div>
        <div class="msg-body">
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Input -->
    <div class="chat-input">
      <a-textarea
        v-model:value="inputText"
        :rows="2"
        :disabled="sending"
        placeholder="输入指令与 AI 协作...（Enter 发送，Shift+Enter 换行）"
        @press-enter="(e: KeyboardEvent) => { if (!e.shiftKey) { e.preventDefault(); sendMessage(); } }"
      />
      <a-button
        type="primary"
        size="small"
        :loading="sending"
        class="chat-send-btn"
        @click="sendMessage()"
      >
        发送
      </a-button>
    </div>
  </div>
</template>

<style scoped lang="less">
.chat-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #e5e7eb;
}

.quick-actions {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid #e5e7eb;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-empty {
  text-align: center;
  padding: 32px 0;
  .empty-icon { font-size: 32px; margin-bottom: 8px; }
  .empty-text { font-size: 13px; color: #6b7280; line-height: 1.6; }
  .empty-hint { font-size: 11px; color: #9ca3af; margin-top: 10px; }
}

.chat-message {
  display: flex;
  gap: 8px;

  &.user { flex-direction: row-reverse; }

  .msg-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }

  .msg-body {
    max-width: 80%;
  }

  .msg-content {
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
  }

  &.user .msg-content {
    background: #6366f1;
    color: #fff;
    border-bottom-right-radius: 4px;
  }

  &.assistant .msg-content {
    background: #f3f4f6;
    color: #374151;
    border-bottom-left-radius: 4px;
  }

  .msg-actions {
    margin-top: 4px;
  }
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 12px;

  span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #9ca3af;
    animation: typing 1.4s infinite ease-in-out;

    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}

.chat-input {
  padding: 10px 12px;
  border-top: 1px solid #e5e7eb;
  flex-shrink: 0;

  .chat-send-btn { margin-top: 8px; }
}
</style>

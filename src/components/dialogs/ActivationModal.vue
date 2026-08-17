<script setup lang="ts">
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import { verifyLicense, saveLicense, formatCode, isValidCodeFormat, getDeviceId } from '@/utils/license'
import type { LicenseState } from '@/utils/license'

const emit = defineEmits<{ activated: [state: LicenseState] }>()

const rawCode = ref('')
const loading = ref(false)
const error = ref('')

const displayCode = computed(() => formatCode(rawCode.value))

const reasonMessages: Record<string, string> = {
  invalid: '激活码无效，请检查是否正确输入',
  already_activated: '此激活码已在其他设备上使用',
  revoked: '此激活码已被撤销',
  expired: '此激活码已过期',
}

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  // Track cursor position
  const cursor = target.selectionStart ?? 0
  const oldLen = target.value.length

  // Strip non-alphanumeric and uppercase
  const cleaned = target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  // Limit to 16 chars
  const limited = cleaned.slice(0, 16)
  // Insert hyphens
  const parts: string[] = []
  for (let i = 0; i < limited.length; i += 4) {
    parts.push(limited.slice(i, i + 4))
  }
  rawCode.value = parts.join('-')

  // Restore cursor (account for added hyphens)
  const newLen = rawCode.value.length
  const hyphenCount = rawCode.value.slice(0, cursor).split('-').length - 1
  const oldHyphenCount = target.value.slice(0, cursor).split('-').length - 1
  const adjustment = hyphenCount - oldHyphenCount

  // Use nextTick to let v-model update first
  requestAnimationFrame(() => {
    const input = document.getElementById('activation-input') as HTMLInputElement
    if (input) {
      const pos = cursor + adjustment + (newLen - oldLen)
      input.setSelectionRange(pos, pos)
    }
  })
}

function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  const pasted = e.clipboardData?.getData('text') ?? ''
  rawCode.value = formatCode(pasted)
  error.value = ''
}

async function handleActivate() {
  error.value = ''

  if (!isValidCodeFormat(rawCode.value)) {
    error.value = '请输入完整的激活码（格式：STORY-XXXX-XXXX-XXXX-XXXX）'
    return
  }

  loading.value = true
  try {
    const result = await verifyLicense(rawCode.value)

    if (result.valid) {
      const state: LicenseState = {
        activated: true,
        code: rawCode.value,
        deviceId: getDeviceId(),
        expiresAt: result.expiresAt,
      }
      saveLicense(state)
      message.success('激活成功！')
      emit('activated', state)
    } else {
      error.value = reasonMessages[result.reason ?? 'invalid'] ?? '验证失败，请稍后重试'
    }
  } catch (e: any) {
    error.value = e.message || '网络错误，请检查网络连接后重试'
  } finally {
    loading.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && isValidCodeFormat(rawCode.value)) {
    handleActivate()
  }
}
</script>

<template>
  <div class="activation-overlay">
    <div class="activation-card">
      <!-- Logo / Header -->
      <div class="activation-header">
        <div class="activation-logo">✍️</div>
        <h1 class="activation-title">StoryAgent</h1>
        <p class="activation-subtitle">AI 智能写作工具</p>
      </div>

      <!-- Input area -->
      <div class="activation-body">
        <p class="activation-label">请输入激活码以继续使用</p>

        <input
          id="activation-input"
          class="activation-input"
          :value="rawCode"
          type="text"
          placeholder="STORY-XXXX-XXXX-XXXX-XXXX"
          maxlength="29"
          autocomplete="off"
          spellcheck="false"
          @input="onInput"
          @paste="onPaste"
          @keydown="handleKeydown"
        />

        <p v-if="error" class="activation-error">{{ error }}</p>
        <p v-else class="activation-hint">输入时自动格式化，支持粘贴</p>

        <button
          class="activation-btn"
          :disabled="!isValidCodeFormat(rawCode) || loading"
          @click="handleActivate"
        >
          <span v-if="loading" class="btn-loading">
            <span class="spinner"></span>
            验证中...
          </span>
          <span v-else>激活</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.activation-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 40%, #16213e 100%);
}

.activation-card {
  width: 460px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 40px 36px 32px;
  backdrop-filter: blur(12px);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.4);
}

.activation-header {
  text-align: center;
  margin-bottom: 28px;
}

.activation-logo {
  font-size: 48px;
  margin-bottom: 8px;
}

.activation-title {
  font-size: 28px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 4px;
  letter-spacing: -0.5px;
}

.activation-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

.activation-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activation-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
  margin: 0;
  text-align: center;
}

.activation-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 17px;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  letter-spacing: 2px;
  text-align: center;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.activation-input::placeholder {
  color: rgba(255, 255, 255, 0.2);
  letter-spacing: 2px;
  font-size: 16px;
}

.activation-input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.activation-error {
  font-size: 13px;
  color: #f87171;
  margin: 0;
  text-align: center;
}

.activation-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
  margin: 0;
  text-align: center;
}

.activation-btn {
  width: 100%;
  padding: 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.15s;
  margin-top: 4px;
}

.activation-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.activation-btn:active:not(:disabled) {
  transform: translateY(0);
}

.activation-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-loading {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

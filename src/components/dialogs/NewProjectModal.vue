<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useProjectStore } from '@/stores/project'
import { ARTICLE_TYPE_ICONS } from '@/utils/constants'

const props = withDefaults(defineProps<{
  open: boolean
  closable?: boolean
  maskClosable?: boolean
}>(), {
  closable: true,
  maskClosable: true,
})

const emit = defineEmits(['update:open', 'create'])

const projectStore = useProjectStore()

const articleTypeId = ref('novel')
const projectName = ref('未命名文章')
const groupName = ref('')

const presetGroups = ['工作', '个人创作', '学习', '随笔']

const selectedType = computed(() =>
  projectStore.articleTypes.find(t => t.id === articleTypeId.value)
)

watch(() => props.open, (val) => {
  if (val) {
    articleTypeId.value = 'novel'
    projectName.value = '未命名文章'
    groupName.value = ''
  }
})

function handleCreate() {
  if (!projectName.value.trim()) return
  emit('create', {
    name: projectName.value.trim(),
    articleTypeId: articleTypeId.value,
    group: groupName.value.trim(),
    templateId: articleTypeId.value, // template matches article type
  })
  emit('update:open', false)
}
</script>

<template>
  <a-modal
    :open="open"
    title="新建文章"
    width="520px"
    :closable="closable"
    :mask-closable="maskClosable"
    @ok="handleCreate"
    @cancel="emit('update:open', false)"
    ok-text="创建"
    cancel-text="取消"
  >
    <a-form layout="vertical" size="small">
      <!-- Title + Group inline -->
      <div class="form-row">
        <a-form-item label="文章标题" required style="flex:1; margin-bottom: 0;">
          <a-input v-model:value="projectName" placeholder="输入文章标题" :maxlength="50" />
        </a-form-item>
        <a-form-item label="分组（可选）" style="width: 160px; flex-shrink: 0; margin-bottom: 0;">
          <a-auto-complete
            v-model:value="groupName"
            :options="presetGroups.map(g => ({ value: g }))"
            placeholder="如：工作"
            allow-clear
          />
        </a-form-item>
      </div>

      <!-- Article types -->
      <a-form-item label="文章类型" style="margin-top: 14px; margin-bottom: 0;">
        <div class="type-grid">
          <div
            v-for="type in projectStore.articleTypes"
            :key="type.id"
            class="type-card"
            :class="{ active: articleTypeId === type.id }"
            @click="articleTypeId = type.id"
          >
            <span class="type-icon">{{ ARTICLE_TYPE_ICONS[type.id] ?? '📄' }}</span>
            <div class="type-name">{{ type.name }}</div>
            <div class="type-desc">{{ type.description }}</div>
          </div>
        </div>
      </a-form-item>

      <!-- Selected type hint -->
      <div v-if="selectedType" class="type-hint">
        <div class="type-hint-title">
          {{ ARTICLE_TYPE_ICONS[selectedType.id] }} AI 扮演「{{ selectedType.name }}」角色
        </div>
        <div class="type-hint-meta">
          <span>📏 {{ selectedType.typicalLength }}</span>
          <span>👥 {{ selectedType.targetReader }}</span>
          <span v-if="selectedType.features?.length">🏷️ {{ selectedType.features.slice(0, 3).join(' · ') }}</span>
        </div>
      </div>
    </a-form>
  </a-modal>
</template>

<style scoped lang="less">
.form-row {
  display: flex;
  gap: 16px;
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
  padding-right: 4px;
}

.type-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 10px 4px 8px;
  border-radius: 10px;
  cursor: pointer;
  border: 1.5px solid #e5e7eb;
  transition: all 0.15s;
  text-align: center;

  &:hover { border-color: #c7d2fe; background: #faf9ff; }
  &.active { border-color: #6366f1; background: #eef2ff; }
}

.type-icon {
  font-size: 22px;
  line-height: 1;
}

.type-name {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.type-desc {
  font-size: 10px;
  color: #9ca3af;
  line-height: 1.3;
}

.type-hint {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #f0f5ff;
  border: 1px solid #dbeafe;
}

.type-hint-title {
  font-size: 13px;
  font-weight: 600;
  color: #4338ca;
  margin-bottom: 4px;
}

.type-hint-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 11px;
  color: #6366f1;
  span { white-space: nowrap; }
}
</style>

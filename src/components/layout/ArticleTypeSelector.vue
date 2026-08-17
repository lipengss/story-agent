<script setup lang="ts">
import { useProjectStore } from '@/stores/project'
import { ARTICLE_TYPE_ICONS } from '@/utils/constants'
import { message } from 'ant-design-vue'
import { QuestionCircleOutlined } from '@ant-design/icons-vue'

const projectStore = useProjectStore()

function selectType(typeId: string) {
  projectStore.setArticleType(typeId)
  const type = projectStore.articleTypes.find(t => t.id === typeId)
  if (type) {
    message.success(`已切换为「${type.name}」模式`)
  }
}
</script>

<template>
  <div class="article-type-selector">
    <div class="section-label">
      文章类型
      <a-tooltip title="文章类型决定了 AI 的写作身份和风格。选中一种类型后，AI 会以对应的角色（小说家/诗人/博主等）来写作。你可以把它理解为给 AI 设定的「人设」" placement="top">
        <QuestionCircleOutlined class="help-icon" />
      </a-tooltip>
    </div>
    <div class="section-hint">选择一种类型 → AI 自动切换到对应的写作风格</div>
    <div class="type-grid">
      <a-tooltip
        v-for="type in projectStore.articleTypes"
        :key="type.id"
        placement="right"
        color="#fff"
        overlay-class-name="type-tooltip-overlay"
      >
        <template #title>
          <div class="tt-content">
            <div class="tt-title">{{ ARTICLE_TYPE_ICONS[type.id] }} {{ type.name }}</div>
            <div class="tt-desc">{{ type.description }}</div>
            <a-divider style="margin:6px 0" />
            <div class="tt-row"><b>特征：</b>{{ (type as any).features?.join('、') }}</div>
            <div class="tt-row"><b>长度：</b>{{ (type as any).typicalLength }}</div>
            <div class="tt-row"><b>读者：</b>{{ (type as any).targetReader }}</div>
          </div>
        </template>
        <div
          class="type-card"
          :class="{ active: projectStore.projectMeta?.articleTypeId === type.id }"
          @click="selectType(type.id)"
        >
          <span class="type-icon">{{ ARTICLE_TYPE_ICONS[type.id] ?? '📄' }}</span>
          <span class="type-name">{{ type.name }}</span>
        </div>
      </a-tooltip>
    </div>
  </div>
</template>

<style scoped lang="less">
.section-label {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.help-icon {
  font-size: 11px;
  color: #9ca3af;
  cursor: help;
  &:hover { color: #6366f1; }
}

.section-hint {
  font-size: 10px;
  color: #9ca3af;
  margin-bottom: 8px;
}

.type-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.type-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px;
  border-radius: 8px;
  cursor: pointer;
  border: 1.5px solid #e5e7eb;
  transition: all 0.2s;
  background: #fafafa;

  &:hover { border-color: #c7d2fe; background: #f5f3ff; }
  &.active { border-color: #6366f1; background: #eef2ff; }
}

.type-icon { font-size: 22px; }
.type-name { font-size: 11px; color: #6b7280; font-weight: 500; }
</style>

<style lang="less">
.type-tooltip-overlay {
  max-width: 280px;
  .tt-content { padding: 4px; }
  .tt-title { font-size: 14px; font-weight: 600; color: #1f2937; }
  .tt-desc { font-size: 12px; color: #6b7280; }
  .tt-row { font-size: 12px; color: #374151; margin: 2px 0; }
}
</style>

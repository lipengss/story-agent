<script setup lang="ts">
import { ref } from 'vue'
import { useSkillStore } from '@/stores/skills'
import type { SkillCategory } from '@/types'
import { SkillCategoryLabels } from '@/types'
import SkillEditorModal from './SkillEditorModal.vue'

const skillStore = useSkillStore()
const showEditor = ref(false)
const editingSkillId = ref<string | null>(null)

const categories: Array<{ key: SkillCategory | 'all'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'style', label: '风格' },
  { key: 'structure', label: '结构' },
  { key: 'character', label: '角色' },
  { key: 'world', label: '世界' },
  { key: 'title', label: '标题' },
]

function onDragStart(event: DragEvent, skill: any) {
  event.dataTransfer?.setData('application/skill', JSON.stringify(skill))
  event.dataTransfer!.effectAllowed = 'move'
}

function editSkill(skillId: string) {
  editingSkillId.value = skillId
  showEditor.value = true
}

function createSkill() {
  editingSkillId.value = null
  showEditor.value = true
}

function deleteSkill(skillId: string) {
  skillStore.deleteSkill(skillId)
}
</script>

<template>
  <div class="skill-library">
    <div class="skill-header">
      <a-button type="primary" size="small" @click="createSkill">
        <template #icon><PlusOutlined /></template>
        新建风格
      </a-button>
    </div>

    <!-- Search -->
    <a-input
      v-model:value="skillStore.searchQuery"
      placeholder="搜索风格..."
      size="small"
      allow-clear
      style="margin-bottom: 10px"
    >
      <template #prefix><SearchOutlined /></template>
    </a-input>

    <!-- Category Filter -->
    <div class="category-filters">
      <div
        v-for="cat in categories"
        :key="cat.key"
        class="cat-tag"
        :class="{ active: skillStore.categoryFilter === cat.key }"
        @click="skillStore.setCategoryFilter(cat.key)"
      >
        {{ cat.label }}
      </div>
    </div>

    <!-- Skill Cards -->
    <div class="skill-list">
      <div
        v-for="skill in skillStore.filteredSkills"
        :key="skill.id"
        class="skill-card"
        draggable="true"
        @dragstart="(e: DragEvent) => onDragStart(e, skill)"
      >
        <div class="skill-card-header">
          <span class="skill-name">{{ skill.name }}</span>
          <a-dropdown trigger="click">
            <a-button type="text" size="small"><MoreOutlined /></a-button>
            <template #overlay>
              <a-menu>
                <a-menu-item @click="editSkill(skill.id)"><EditOutlined /> 编辑</a-menu-item>
                <a-menu-item danger @click="deleteSkill(skill.id)"><DeleteOutlined /> 删除</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
        <div class="skill-desc">{{ skill.description }}</div>
        <div class="skill-meta">
          <a-tag size="small" :color="skill.category === 'style' ? 'green' : skill.category === 'structure' ? 'blue' : skill.category === 'character' ? 'pink' : 'purple'">
            {{ SkillCategoryLabels[skill.category] }}
          </a-tag>
        </div>
      </div>

      <div v-if="skillStore.filteredSkills.length === 0" class="empty-text">
        暂无匹配的风格
      </div>
    </div>

    <SkillEditorModal
      v-model:open="showEditor"
      :skill-id="editingSkillId"
    />
  </div>
</template>

<script lang="ts">
import { PlusOutlined, SearchOutlined, MoreOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons-vue'
export default { components: { PlusOutlined, SearchOutlined, MoreOutlined, EditOutlined, DeleteOutlined } }
</script>

<style scoped lang="less">
.skill-library {
  .skill-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
  }
}

.category-filters {
  display: flex;
  gap: 4px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.cat-tag {
  padding: 2px 10px;
  font-size: 12px;
  border-radius: 12px;
  cursor: pointer;
  border: 1px solid #e5e7eb;
  color: #6b7280;
  transition: all 0.15s;

  &:hover { border-color: #c7d2fe; color: #6366f1; }
  &.active {
    background: #6366f1;
    color: #fff;
    border-color: #6366f1;
  }
}

.skill-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-card {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  cursor: grab;
  transition: all 0.15s;

  &:hover {
    border-color: #c7d2fe;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
  }

  &:active { cursor: grabbing; }
}

.skill-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.skill-name {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.skill-desc {
  font-size: 12px;
  color: #6b7280;
  margin: 4px 0;
  line-height: 1.4;
}

.empty-text {
  text-align: center;
  font-size: 13px;
  color: #6b7280;
  padding: 16px 0;
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useProjectStore } from '@/stores/project'
import { useSkillStore } from '@/stores/skills'

const props = defineProps<{ id: string; data: { skillId: string; name: string; category?: string; promptFragment: string; variables: any[] } }>()
const projectStore = useProjectStore()
const skillStore = useSkillStore()

const skills = computed(() => skillStore.skills)

const currentSkill = computed(() => skills.value.find(s => s.id === props.data.skillId))

function onSkillSelect(skillId: string) {
  const skill = skills.value.find(s => s.id === skillId)
  if (skill) {
    projectStore.updateNode(props.id, {
      skillId: skill.id,
      name: skill.name,
      category: skill.category,
      promptFragment: skill.promptFragment,
      variables: skill.variables ? [...skill.variables] : [],
    })
    projectStore.saveProject()
  }
}
</script>

<template>
  <div class="node-base node-compact skill-node">
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Right" />
    <div class="node-header">
      <span class="node-icon">⚡</span>
      <span class="node-title">{{ data.name || '选择技能' }}</span>
    </div>
    <div class="node-body">
      <a-select
        :value="data.skillId || undefined"
        placeholder="选择技能..."
        size="small"
        style="width: 100%"
        @change="onSkillSelect"
        @click.stop
      >
        <a-select-option v-for="s in skills" :key="s.id" :value="s.id">
          {{ s.name }}
        </a-select-option>
      </a-select>
      <div class="skill-vars" v-if="data.variables?.length">
        {{ data.variables.length }} 个变量
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.skill-node {
  border-color: #22c55e;
  .node-header { background: #dcfce7; }
  .node-title { color: #166534; }
}

.skill-vars {
  font-size: 11px;
  color: #6b7280;
  margin-top: 4px;
}
</style>

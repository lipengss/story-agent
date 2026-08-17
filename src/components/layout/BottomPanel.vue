<script setup lang="ts">
import { useProjectStore } from '@/stores/project'
import TextEditor from '@/components/editor/TextEditor.vue'

const projectStore = useProjectStore()
</script>

<template>
  <div class="bottom-panel">
    <div class="bp-content">
      <TextEditor :key="projectStore.projectMeta?.id" />
    </div>
  </div>
</template>

<style scoped lang="less">
.bottom-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.bp-content {
  flex: 1;
  overflow: hidden;
  display: flex;
}
</style>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{ data: { articleTypeId: string; name: string; systemPrompt: string } }>()
</script>

<template>
  <div class="node-base article-type-node">
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Right" />
    <div class="node-header">
      <span class="node-icon">📋</span>
      <span class="node-title">{{ data.name }}</span>
    </div>
    <div class="node-body">
      <div class="node-prompt">{{ data.systemPrompt?.substring(0, 60) }}...</div>
    </div>
  </div>
</template>

<style scoped lang="less">
.article-type-node {
  border-color: #3b82f6;
  .node-header { background: #dbeafe; }
  .node-title { color: #1e40af; }
}
</style>

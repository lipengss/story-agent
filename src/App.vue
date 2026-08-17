<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { ConfigProvider } from 'ant-design-vue'
import zhCN from 'ant-design-vue/locale/zh_CN'
import { isLicenseValid, getSavedLicense } from '@/utils/license'
import type { LicenseState } from '@/utils/license'
import ActivationModal from '@/components/dialogs/ActivationModal.vue'

const appStore = useAppStore()
const activated = ref(false)
const checking = ref(true)

onMounted(() => {
  // In dev mode without Electron, skip license check
  const isDev = import.meta.env.DEV
  const isElectron = !!(window as any).electronAPI

  if (isDev && !isElectron) {
    // Browser dev mode: skip activation
    activated.value = true
  } else if (isLicenseValid()) {
    activated.value = true
  }
  checking.value = false
})

function onActivated(_state: LicenseState) {
  activated.value = true
}
</script>

<template>
  <ConfigProvider :locale="zhCN">
    <!-- Activation gate -->
    <template v-if="!checking">
      <ActivationModal v-if="!activated" @activated="onActivated" />
      <router-view v-else />
    </template>
  </ConfigProvider>
</template>

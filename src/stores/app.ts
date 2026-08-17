import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { UserPreferences } from '@/types'
import { loadPreferences, savePreferences } from '@/utils/storage'

export const useAppStore = defineStore('app', () => {
  const preferences = ref<UserPreferences>(loadPreferences())
  const currentProjectId = ref<string | null>(preferences.value.lastOpenProjectId)

  const theme = ref<UserPreferences['theme']>(preferences.value.theme)
  const language = ref<UserPreferences['language']>(preferences.value.language)
  const autoSave = ref<boolean>(preferences.value.autoSave)

  function setTheme(t: UserPreferences['theme']) {
    theme.value = t
    save()
  }

  function setLanguage(l: UserPreferences['language']) {
    language.value = l
    save()
  }

  function setAutoSave(v: boolean) {
    autoSave.value = v
    save()
  }

  function setCurrentProjectId(id: string | null) {
    currentProjectId.value = id
    preferences.value.lastOpenProjectId = id
    save()
  }

  function save() {
    const prefs: UserPreferences = {
      theme: theme.value,
      language: language.value,
      autoSave: autoSave.value,
      lastOpenProjectId: currentProjectId.value,
    }
    preferences.value = prefs
    savePreferences(prefs)
  }

  return {
    preferences,
    theme,
    language,
    autoSave,
    currentProjectId,
    setTheme,
    setLanguage,
    setAutoSave,
    setCurrentProjectId,
  }
})

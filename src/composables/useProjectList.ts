import { ref, computed } from 'vue'
import { message, Modal } from 'ant-design-vue'
import type { ProjectMeta } from '@/types'
import { loadProjectList, saveProjectList, generateId, deleteProjectData } from '@/utils/storage'
import { useProjectStore } from '@/stores/project'

export function useProjectList() {
  const projectStore = useProjectStore()

  const list = ref<ProjectMeta[]>(loadProjectList())
  const selectedGroup = ref<string | null>(null)

  // Flatten groups into tree
  const grouped = computed(() => {
    const map: Record<string, ProjectMeta[]> = {}
    for (const p of list.value) {
      const g = p.group || '未分组'
      if (!map[g]) map[g] = []
      map[g].push(p)
    }
    return map
  })

  function refresh() {
    list.value = loadProjectList()
  }

  function openProject(project: ProjectMeta) {
    projectStore.loadProject(project)
  }

  function createProject(meta: { name: string; articleTypeId: string; group?: string }) {
    const group = meta.group || (selectedGroup.value && selectedGroup.value !== '未分组' ? selectedGroup.value : '')
    const p: ProjectMeta = {
      id: generateId(),
      name: meta.name,
      articleTypeId: meta.articleTypeId,
      group,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const all = loadProjectList()
    all.unshift(p)
    saveProjectList(all)
    refresh()
    return p
  }

  function deleteProject(project: ProjectMeta) {
    const before = loadProjectList()
    const all = before.filter(x => x.id !== project.id)
    saveProjectList(all)
    deleteProjectData(project.id)
    if (projectStore.projectMeta?.id === project.id) {
      if (all.length > 0) {
        openProject(all[0])
      } else {
        projectStore.projectMeta = null
        projectStore.content = ''
      }
    }
    list.value.splice(0, list.value.length, ...all)
    message.success('已删除')
  }

  function deleteGroup(group: string) {
    const all = loadProjectList()
    for (const p of all) {
      if (p.group === group) p.group = ''
    }
    saveProjectList(all)
    if (selectedGroup.value === group) selectedGroup.value = null
    list.value.splice(0, list.value.length, ...all)
    message.success(`分组「${group}」已删除`)
  }

  function renameProject(projectId: string, newName: string) {
    const all = loadProjectList()
    const p = all.find(x => x.id === projectId)
    if (!p || !newName.trim()) return
    p.name = newName.trim()
    p.updatedAt = Date.now()
    saveProjectList(all)
    refresh()
  }

  function renameGroup(oldName: string, newName: string) {
    if (!newName.trim() || oldName === newName.trim() || oldName === '未分组') return
    const all = loadProjectList()
    const target = oldName === '' ? '' : oldName
    for (const p of all) {
      if (p.group === target) p.group = newName.trim()
    }
    saveProjectList(all)
    if (selectedGroup.value === oldName) selectedGroup.value = newName.trim()
    refresh()
  }

  function moveProject(projectId: string, newGroup: string) {
    const all = loadProjectList()
    const p = all.find(x => x.id === projectId)
    if (!p) return
    const target = newGroup === '未分组' ? '' : newGroup
    if (p.group === target) return
    p.group = target
    saveProjectList(all)
    refresh()
    message.success(`已移至「${newGroup}」`)
  }

  function toggleSelectGroup(group: string) {
    selectedGroup.value = selectedGroup.value === group ? null : group
  }

  function loadDemo() {
    const { meta } = projectStore.createDemoProject()
    const all = loadProjectList()
    if (!all.find(x => x.id === meta.id)) all.unshift(meta)
    saveProjectList(all)
    refresh()
    openProject(meta)
  }

  const isActive = (id: string) => projectStore.projectMeta?.id === id

  return {
    list,
    grouped,
    selectedGroup,
    refresh,
    openProject,
    createProject,
    deleteProject,
    deleteGroup,
    renameProject,
    renameGroup,
    moveProject,
    toggleSelectGroup,
    loadDemo,
    isActive,
  }
}

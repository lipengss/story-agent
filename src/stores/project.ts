import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Graph, StoryNode, StoryEdge, Version, ProjectMeta, ArticleType } from '@/types'
import { generateId, loadGraph, saveGraph, loadVersions, saveVersions, loadCurrentContent, saveCurrentContent } from '@/utils/storage'
import { DEFAULT_ARTICLE_TYPES } from './articleTypes'

export const useProjectStore = defineStore('project', () => {
  // Project meta
  const projectMeta = ref<ProjectMeta | null>(null)
  const projectId = computed(() => projectMeta.value?.id ?? null)

  // Graph
  const graph = ref<Graph>({ nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } })

  // Text content
  const content = ref('')
  const currentVersion = ref(0)
  const versions = ref<Version[]>([])

  // Selected node
  const selectedNodeId = ref<string | null>(null)
  const selectedNode = computed(() => {
    if (!selectedNodeId.value) return null
    return graph.value.nodes.find(n => n.id === selectedNodeId.value) ?? null
  })

  // Undo/Redo stacks
  const MAX_UNDO = 50
  const undoStack = ref<{ nodes: StoryNode[]; edges: StoryEdge[] }[]>([])
  const redoStack = ref<{ nodes: StoryNode[]; edges: StoryEdge[] }[]>([])

  function pushSnapshot() {
    const snapshot = {
      nodes: JSON.parse(JSON.stringify(graph.value.nodes)),
      edges: JSON.parse(JSON.stringify(graph.value.edges)),
    }
    undoStack.value.push(snapshot)
    if (undoStack.value.length > MAX_UNDO) undoStack.value.shift()
    redoStack.value = []
  }

  function undo() {
    const snap = undoStack.value.pop()
    if (!snap) return
    redoStack.value.push({
      nodes: JSON.parse(JSON.stringify(graph.value.nodes)),
      edges: JSON.parse(JSON.stringify(graph.value.edges)),
    })
    graph.value.nodes = snap.nodes
    graph.value.edges = snap.edges
    if (selectedNodeId.value && !graph.value.nodes.find(n => n.id === selectedNodeId.value)) {
      selectedNodeId.value = null
    }
    saveProject()
  }

  function redo() {
    const snap = redoStack.value.pop()
    if (!snap) return
    undoStack.value.push({
      nodes: JSON.parse(JSON.stringify(graph.value.nodes)),
      edges: JSON.parse(JSON.stringify(graph.value.edges)),
    })
    graph.value.nodes = snap.nodes
    graph.value.edges = snap.edges
    if (selectedNodeId.value && !graph.value.nodes.find(n => n.id === selectedNodeId.value)) {
      selectedNodeId.value = null
    }
    saveProject()
  }

  // Article types — imported from separate definition file
  const articleTypes = ref<ArticleType[]>(DEFAULT_ARTICLE_TYPES)

  const currentArticleType = computed(() => {
    if (!projectMeta.value) return articleTypes.value[0]
    return articleTypes.value.find(t => t.id === projectMeta.value!.articleTypeId) ?? articleTypes.value[0]
  })

  // Load project
  const loadCount = ref(0)
  function loadProject(meta: ProjectMeta) {
    loadCount.value++
    projectMeta.value = meta
    graph.value = loadGraph(meta.id)
    const newVersions = loadVersions(meta.id)
    const saved = loadCurrentContent(meta.id)
    // If no saved content, sync from first text node
    if (!saved) {
      const firstText = graph.value.nodes.find(n => n.type === 'text')
      content.value = firstText?.data?.generated || firstText?.data?.content || ''
    } else {
      content.value = saved
    }
    // Direct assignment for reliable reactivity
    versions.value = newVersions
    if (versions.value.length > 0) {
      currentVersion.value = versions.value.length
    } else {
      currentVersion.value = 0
    }
    selectedNodeId.value = null
  }

  // Save
  function saveProject() {
    if (!projectId.value) return
    saveGraph(projectId.value, graph.value)
    saveVersions(projectId.value, versions.value)
    saveCurrentContent(projectId.value, content.value)
    if (projectMeta.value) {
      projectMeta.value.updatedAt = Date.now()
    }
  }

  // Node operations
  function addNode(node: StoryNode) {
    pushSnapshot()
    graph.value.nodes.push(node)
    saveProject()
  }

  function removeNode(nodeId: string) {
    pushSnapshot()
    graph.value.nodes = graph.value.nodes.filter(n => n.id !== nodeId)
    graph.value.edges = graph.value.edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    if (selectedNodeId.value === nodeId) selectedNodeId.value = null
    // Renumber remaining chapters
    renumberChapters()
    saveProject()
  }

  function renumberChapters() {
    const chapters = graph.value.nodes.filter(n => n.type === 'text')
    chapters.forEach((n, i) => {
      const num = i + 1
      if (n.data.title && /第\d+章/.test(n.data.title)) {
        n.data.title = n.data.title.replace(/第\d+章/, `第${num}章`)
      }
    })
  }

  function updateNode(nodeId: string, data: Record<string, any>) {
    const node = graph.value.nodes.find(n => n.id === nodeId)
    if (node) {
      pushSnapshot()
      node.data = { ...node.data, ...data }
      saveProject()
    }
  }

  function moveNode(nodeId: string, position: { x: number; y: number }) {
    const node = graph.value.nodes.find(n => n.id === nodeId)
    if (node) {
      pushSnapshot()
      node.position = position
    }
  }

  function selectNode(nodeId: string | null) {
    selectedNodeId.value = nodeId
  }

  // Edge operations
  function addEdge(edge: StoryEdge) {
    if (!graph.value.edges.find(e => e.source === edge.source && e.target === edge.target)) {
      pushSnapshot()
      graph.value.edges.push(edge)
      saveProject()
    }
  }

  function removeEdge(edgeId: string) {
    pushSnapshot()
    graph.value.edges = graph.value.edges.filter(e => e.id !== edgeId)
    saveProject()
  }

  // Version operations
  function createVersion() {
    const v: Version = {
      id: generateId(),
      label: `v${versions.value.length + 1}`,
      content: content.value,
      timestamp: Date.now(),
    }
    versions.value.push(v)
    currentVersion.value = versions.value.length
    saveProject()
  }

  function restoreVersion(versionId: string) {
    const v = versions.value.find(v => v.id === versionId)
    if (v) {
      content.value = v.content
      saveCurrentContent(projectId.value!, content.value)
    }
  }

  // Article type
  function setArticleType(typeId: string) {
    if (!projectMeta.value) return
    projectMeta.value.articleTypeId = typeId
    const typeNode = graph.value.nodes.find(n => n.type === 'articleType')
    const articleType = articleTypes.value.find(t => t.id === typeId)
    if (typeNode && articleType) {
      typeNode.data = { ...typeNode.data, name: articleType.name, systemPrompt: articleType.systemPrompt, articleTypeId: typeId }
    }
    saveProject()
  }

  // Viewport
  function setViewport(viewport: { x: number; y: number; zoom: number }) {
    graph.value.viewport = viewport
  }

  // Demo project
  function createDemoProject(): { meta: ProjectMeta; graph: Graph; content: string } {
    const pid = generateId()
    const meta: ProjectMeta = {
      id: pid,
      name: '示例项目 - 雨巷邂逅',
      articleTypeId: 'novel',
      group: '个人创作',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const n1 = generateId() // Theme
    const n2 = generateId() // ArticleType
    const n3 = generateId() // Plot
    const n4 = generateId() // Text

    const demoGraph: Graph = {
      nodes: [
        { id: n1, type: 'theme', position: { x: 60, y: 100 }, data: { title: '故事主题', content: '两个陌生人在江南雨巷中偶然相遇，从相识、误会到最终走到一起的爱情故事。' } },
        { id: n2, type: 'articleType', position: { x: 300, y: 100 }, data: { articleTypeId: 'novel', name: '小说', systemPrompt: '你是一位专业的小说家，擅长创作引人入胜的故事情节。注重人物塑造、情节推进和环境描写。' } },
        { id: n3, type: 'plot', position: { x: 540, y: 100 }, data: { title: '情节概要', summary: '深秋雨天，花店店主苏念遇见躲雨的年轻人顾尘。一杯热茶，一次对视，两个陌生人的故事在雨巷中悄然开始。' } },
        { id: n4, type: 'text', position: { x: 780, y: 100 }, data: { title: '第一章', content: '' } },
      ],
      edges: [
        { id: generateId(), source: n1, target: n2 },
        { id: generateId(), source: n2, target: n3 },
        { id: generateId(), source: n3, target: n4 },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    }

    const demoContent = `# 第一章：雨巷相遇

深秋的雨，下得不急不缓，像是谁在天上慢慢地筛着一层细细的纱。

苏念蹲在"花间"门口，把新到的绣球花一盆一盆摆好。雨水顺着屋檐滴下来，打在青石板上，溅起细碎的水花。。空气里混着桂花和湿润泥土的气息，还有花店里飘出来的淡淡茉莉香。

她喜欢雨天。雨声让人觉得安静，像是世界慢了下来。

门上的风铃忽然响了——叮铃一声。

一个年轻人推门进来，身上穿着一件深灰色的风衣，肩膀被雨水打湿了一片。他怀里抱着一个牛皮纸袋，纸袋的底部已经被雨浸得发软。他站在门口，有些不好意思地看着满地的花盆，和蹲在花丛里的苏念。

"抱歉，"他说，"雨太大了，能不能……让我躲一会儿？"

苏念抬起头，对上了他的眼睛。

那是一双很干净的眼睛，像是雨后初晴的天空。他的头发有点乱，额前几缕湿漉漉地垂下来，看起来有些狼狈，却又让人觉得亲近。

"当然可以。"苏念笑了笑，站起身，拍了拍手上的泥，"进来坐吧，我给你倒杯热茶。"

年轻人松了口气，小心翼翼地绕过地上的花盆，走到柜台边的高脚凳上坐下。他把纸袋放在膝盖上，环顾四周，目光在满屋子的花上停留了几秒。

"你的花店真好看，"他说，"我路过这条巷子好多次了，从来没注意到这里有家花店。"

"开了快两年了，"苏念把一杯冒着热气的茉莉花茶推到他面前，"可能你不常往巷子深处走。"

他接过茶杯，双手捧着，暖意从掌心传上来。他看着杯子里浮沉的茉莉花瓣，忽然笑了一下。

"我叫顾尘，"他抬头说，"就住在巷子口的公寓楼。"

"苏念，"她说，"思念的念。"

窗外的雨还在下，一盆绣球花的叶子上挂着一颗晶莹的水珠，摇摇欲坠。`

    loadProject(meta)
    graph.value = demoGraph
    content.value = demoContent
    saveProject()

    return { meta, graph: demoGraph, content: demoContent }
  }

  return {
    projectMeta,
    projectId,
    graph,
    content,
    currentVersion,
    versions,
    selectedNodeId,
    selectedNode,
    articleTypes,
    currentArticleType,
    loadProject,
    saveProject,
    addNode,
    removeNode,
    updateNode,
    moveNode,
    selectNode,
    addEdge,
    removeEdge,
    createVersion,
    restoreVersion,
    setArticleType,
    setViewport,
    createDemoProject,
    undoStack,
    redoStack,
    pushSnapshot,
    undo,
    redo,
    loadCount,
  }
})

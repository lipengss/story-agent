import { generateId } from './storage'

export interface ProjectTemplate {
  id: string
  name: string
  icon: string
  desc: string
  nodes: Array<{ type: string; position: { x: number; y: number }; data: Record<string, any> }>
  edges: Array<{ source: number; target: number }>
}

export const TEMPLATES: ProjectTemplate[] = [
  {
    id: 'novel',
    name: '小说创作',
    icon: '📖',
    desc: '主题→类型→人物/场景→情节→章节，适合中短篇故事',
    nodes: [
      { type: 'theme', position: { x: 60, y: 60 }, data: { title: '故事主题', content: '两个陌生人在江南雨巷中偶然相遇，从相识、误会到最终走到一起的爱情故事。' } },
      { type: 'articleType', position: { x: 310, y: 60 }, data: { articleTypeId: 'novel', name: '小说', systemPrompt: '' } },
      { type: 'character', position: { x: 60, y: 230 }, data: { name: '主角', description: '女，26岁，花店店主。性格温柔细腻，喜欢雨天，相信命中注定的相遇。' } },
      { type: 'scene', position: { x: 310, y: 230 }, data: { name: '场景', description: '时间：深秋午后，细雨蒙蒙。地点：江南古镇的青石板小巷。一家叫"花间"的小花店。氛围：安静、温柔，带着淡淡的诗意。' } },
      { type: 'plot', position: { x: 560, y: 140 }, data: { title: '情节', summary: '1.【开端/建置】雨巷中的偶然相遇\n\n2.【发展/对抗】彼此的误会与试探\n\n3.【高潮/转折】说出真心话的那个雨天\n\n4.【结局/收束】在最初遇见的巷口重逢' } },
      { type: 'text', position: { x: 810, y: 140 }, data: { title: '第1章', content: '' } },
    ],
    edges: [
      { source: 0, target: 1 }, { source: 1, target: 4 },
      { source: 2, target: 4 }, { source: 3, target: 4 },
      { source: 4, target: 5 },
    ],
  },
  {
    id: 'zhihu',
    name: '知乎回答',
    icon: '🤔',
    desc: '问题→观点→论据→正文，适合深度内容创作',
    nodes: [
      { type: 'theme', position: { x: 60, y: 100 }, data: { title: '核心问题', content: '为什么程序员普遍喜欢用Mac？' } },
      { type: 'articleType', position: { x: 300, y: 100 }, data: { articleTypeId: 'zhihu', name: '知乎回答', systemPrompt: '' } },
      { type: 'plot', position: { x: 540, y: 60 }, data: { title: '论点1', summary: '1.【痛点】程序员在Windows下开发的各种痛苦\n\n2.【论点+案例】Unix终端体验 vs Windows\n\n3.【对比数据】主流开发工具的跨平台表现' } },
      { type: 'plot', position: { x: 540, y: 200 }, data: { title: '论点2', summary: '1.【痛点】系统崩溃和更新带来的时间成本\n\n2.【论点+案例】硬件稳定性和使用寿命对比\n\n3.【总结】Mac的投资回报率计算' } },
      { type: 'text', position: { x: 780, y: 130 }, data: { title: '第1章', content: '' } },
    ],
    edges: [
      { source: 0, target: 1 }, { source: 1, target: 2 },
      { source: 1, target: 3 }, { source: 2, target: 4 }, { source: 3, target: 4 },
    ],
  },
  {
    id: 'xhs',
    name: '小红书笔记',
    icon: '📕',
    desc: '产品→卖点→正文，适合种草分享',
    nodes: [
      { type: 'theme', position: { x: 60, y: 100 }, data: { title: '推荐好物', content: '最近发现的超好用降噪耳机' } },
      { type: 'articleType', position: { x: 300, y: 100 }, data: { articleTypeId: 'xhs', name: '小红书笔记', systemPrompt: '' } },
      { type: 'plot', position: { x: 540, y: 100 }, data: { title: '核心卖点', summary: '降噪效果惊艳/续航一周/佩戴舒适' } },
      { type: 'text', position: { x: 780, y: 100 }, data: { title: '第1章', content: '' } },
    ],
    edges: [
      { source: 0, target: 1 }, { source: 1, target: 2 }, { source: 2, target: 3 },
    ],
  },
  {
    id: 'blank',
    name: '空白画布',
    icon: '📄',
    desc: '从核心结构开始：主题→类型→章节，快速上手',
    nodes: [
      { type: 'theme', position: { x: 60, y: 100 }, data: { title: '故事主题', content: '' } },
      { type: 'articleType', position: { x: 310, y: 100 }, data: { articleTypeId: 'novel', name: '小说', systemPrompt: '' } },
      { type: 'text', position: { x: 560, y: 100 }, data: { title: '第1章', content: '' } },
    ],
    edges: [
      { source: 0, target: 1 },
      { source: 1, target: 2 },
    ],
  },
]

/** Build template nodes/edges into graph data */
export function buildTemplate(templateId: string, articleTypeId: string) {
  // Fall back to blank for unknown types so they get a clean theme→type→chapter layout
  const tmpl = TEMPLATES.find(t => t.id === templateId) || TEMPLATES.find(t => t.id === 'blank') || TEMPLATES[0]
  const idMap: string[] = tmpl.nodes.map(() => generateId())

  const nodes = tmpl.nodes.map((n, i) => {
    const data = { ...n.data }
    if (n.type === 'articleType') {
      data.articleTypeId = articleTypeId
    }
    return { id: idMap[i], type: n.type as any, position: n.position, data }
  })

  const edges = tmpl.edges.map(e => ({
    id: generateId(),
    source: idMap[e.source],
    target: idMap[e.target],
  }))

  return { nodes, edges }
}

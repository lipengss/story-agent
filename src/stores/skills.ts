import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Skill, SkillCategory } from '@/types'
import { loadSkills, saveSkills, generateId } from '@/utils/storage'

export const useSkillStore = defineStore('skills', () => {
  const skills = ref<Skill[]>(loadSkills())

  const categoryFilter = ref<SkillCategory | 'all'>('all')
  const searchQuery = ref('')

  const defaultSkills: Skill[] = [
    // ===== 风格类 style =====
    {
      id: 'ds-style-hemingway',
      name: '海明威冰山体',
      category: 'style',
      description: '句子简短有力，用最少的话说最多的意思',
      promptFragment: `请采用海明威"冰山理论"风格写作：
- 句子简短，平均每句不超过20字，用句号而非逗号分隔
- 只写表面可见的对话和动作，情感和意义藏在文字之下（八分之一在水面，八分之七在水下）
- 多用对话推进情节，对话要利落有力，不拖泥带水
- 避免形容词和副词，用名词和动词说话
- "一个男人可以被打倒，但不能被击败"——人物可以失败但不能放弃
主题：{{context}}`,
      variables: [{ name: 'context', label: '写作主题/背景', defaultValue: '', required: true }],
      createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'ds-style-warm',
      name: '温情细腻风格',
      category: 'style',
      description: '温柔细腻，注重情感和细节，让人心头一暖',
      promptFragment: `请用温柔细腻的笔触写作：
- 从日常小事中提炼情感——一杯热茶、一个眼神、一句不经意的关心
- 多用感官描写：温度（掌心传来的暖意）、声音（雨打在窗上的节奏）、气味（厨房飘来的饭菜香）
- 人物内心活动要细腻但不矫情，真实的犹豫和柔软的期待
- 节奏舒缓，给读者留足品味的时间
- 结局要温暖但不圆满——生活本来如此
主题：{{context}}`,
      variables: [{ name: 'context', label: '写作主题/背景', defaultValue: '', required: true }],
      createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'ds-style-zhihu-hit',
      name: '知乎爆款体',
      category: 'style',
      description: '高赞回答风格——反常识开头+干货+金句收尾',
      promptFragment: `请用知乎高赞回答的写作风格：
1. 开头用反常识观点/个人经历/惊人数字抓住注意力（3行以内）
2. 正文分3-5个论点，每个 = 一句话结论 + 案例/数据 + 实操建议
3. 每段不超过3行（适配手机阅读），关键观点用**加粗**标注
4. 多用对比制造冲击（"99%的人以为……实际上……"）
5. 结尾用一句金句升华 + 引导互动
6. 至少融入2句适合截图转发的句子
主题：{{context}}`,
      variables: [{ name: 'context', label: '写作主题', defaultValue: '', required: true }],
      createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'ds-style-classical',
      name: '古风文雅',
      category: 'style',
      description: '半文半白的古典中文风格，适合历史/仙侠/国风内容',
      promptFragment: `请用古典中文风格写作，兼具文言韵味和现代可读性：
- 用词讲究，适当使用成语和典故但不堆砌
- 句式参差，长短交错，读来有韵律感
- 环境描写要有意境——落花、残月、孤舟、远山
- 对话可略带文白，不同身份的人说话方式要不同
- 含蓄表达情感——不说"我很伤心"而写"独倚栏杆，望断天涯"
主题：{{context}}`,
      variables: [{ name: 'context', label: '写作主题/背景', defaultValue: '', required: true }],
      createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'ds-style-irony',
      name: '幽默反讽风',
      category: 'style',
      description: '用幽默和反讽解构严肃话题，让人笑着思考',
      promptFragment: `请用幽默反讽风格写作：
- 用一本正经的语气说不正经的话（反差萌）
- 善用"你以为……结果……"的转折句式制造笑点
- 自嘲是最好的幽默——先拿自己开刀
- 在搞笑中偷偷塞入洞察——读者笑完之后发现"好像真的是这样"
- 不要刻意搞笑，最幽默的话往往是最真实的话
- 每段至少埋一个让人会心一笑的点
主题：{{context}}`,
      variables: [{ name: 'context', label: '写作主题', defaultValue: '', required: true }],
      createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'ds-style-suspense',
      name: '悬疑紧张风',
      category: 'style',
      description: '制造紧张感和悬念，让读者停不下来',
      promptFragment: `请用悬疑风格写作，制造持续的紧张感：
- 开头抛出一个反常的细节——"一切正常，除了那个不应该出现在那里的人"
- 每段结尾留一个未解问题，勾着读者往下看
- 信息释放要有节奏——每次只给一块拼图，永远让读者差一块
- 用短句和碎片化描写制造紧迫感，长句用于缓口气
- 环境描写服务于紧张感——灯光闪烁、脚步回声、时钟滴答
主题：{{context}}`,
      variables: [{ name: 'context', label: '写作主题/背景', defaultValue: '', required: true }],
      createdAt: Date.now(), updatedAt: Date.now(),
    },
    // ===== 结构类 structure =====
    {
      id: 'ds-struct-three-act',
      name: '三幕戏结构',
      category: 'structure',
      description: '建置→对抗→解决，最经典的故事骨架',
      promptFragment: `请严格按照三幕结构组织内容：
【第一幕 - 建置（25%篇幅）】
- 介绍主要人物、核心冲突的种子、故事世界的基本规则
- 用"激励事件"打破日常——一个让主角无法回到从前的事件
【第二幕 - 对抗（50%篇幅）】
- 冲突升级，主角主动/被动应对
- 中间点：局势逆转，主角从被动变为主动（或反过来）
- "最黑暗的时刻"：主角跌入谷底，似乎一切希望都破灭了
【第三幕 - 解决（25%篇幅）】
- 高潮：与核心冲突的最终对决，释放所有累积的张力
- 结局：展示冲突解决后的新常态，主角的成长
主题：{{theme}}`,
      variables: [{ name: 'theme', label: '故事主题', defaultValue: '', required: true }],
      createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'ds-struct-zhihu-layer',
      name: '知乎三层框架',
      category: 'structure',
      description: '痛点共鸣→干货输出→金句升华（20/60/20比例）',
      promptFragment: `请严格按三层框架组织内容：
【第一层：痛点共鸣（20%篇幅）】
- 从具体场景或故事切入，让读者觉得"说的就是我"
- 指出普遍存在但被忽视的问题，建立信任感
【第二层：干货输出（60%篇幅）】
- 分3-5个论点深入展开
- 每个论点结构：小标题 → 一句话结论 → 案例/数据支撑 → 实操建议
- 论点之间要有逻辑递进，层层深入
【第三层：总结升华（20%篇幅）】
- 提炼核心洞见（一句话让读者记住）
- 给出可执行的行动建议
- 金句收尾，打动人心
主题：{{topic}}`,
      variables: [{ name: 'topic', label: '文章主题', defaultValue: '', required: true }],
      createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'ds-struct-scqa',
      name: 'SCQA 论证结构',
      category: 'structure',
      description: '情境→冲突→问题→答案，最清晰的逻辑论证框架',
      promptFragment: `请按 SCQA 框架组织内容：
【S - Situation 情境】
- 描述一个读者熟悉的场景或公认的事实（建立共同语境）
【C - Complication 冲突】
- 指出这个场景中的问题/矛盾/变化——"但是……"
- 让读者感到原来的认知受到了挑战
【Q - Question 问题】
- 明确提出核心问题——"那么怎么办？"
- 这个问题应该是读者此刻心中正在问的
【A - Answer 答案】
- 给出你的核心答案或解决方案
- 展开论证：为什么是这个答案？有什么支撑？
- 最后回到开篇的情境，形成闭环
主题：{{topic}}`,
      variables: [{ name: 'topic', label: '论证主题', defaultValue: '', required: true }],
      createdAt: Date.now(), updatedAt: Date.now(),
    },
    // ===== 角色类 character =====
    {
      id: 'ds-char-hero-journey',
      name: '英雄之旅角色集',
      category: 'character',
      description: '坎贝尔经典原型：英雄、导师、盟友、对手、阴影',
      promptFragment: `请为故事设计以下角色原型，注意每个角色要有内在动机而非脸谱化：
1. 【英雄】——不是最强的，但最愿意改变。TA的弱点和欲望是什么？读者为什么关心TA？
2. 【导师】——给英雄关键指引，但不替英雄解决问题。一个好的导师有自己的遗憾。
3. 【盟友】——陪伴英雄，提供不同视角。盟友和英雄的关系应该是互补而非服从。
4. 【对手/阴影】——不是纯粹的"坏人"，TA有自己的正义。让读者理解（甚至同情）对手的立场。
5. 【信使/催化剂】——触发改变的事件或人物，不一定贯穿全场但必须有存在感。
故事背景：{{background}}`,
      variables: [{ name: 'background', label: '故事背景', defaultValue: '', required: true }],
      createdAt: Date.now(), updatedAt: Date.now(),
    },
    // ===== 世界观类 world =====
    {
      id: 'ds-world-urban-fantasy',
      name: '都市奇幻世界观',
      category: 'world',
      description: '现代都市之下隐藏着另一个世界的规则',
      promptFragment: `请构建双层世界观：
【表层世界】
- 看似正常的现代都市，人们过着朝九晚五的普通生活
- 但总有一些"说不通"的细节——午夜消失的路灯、总在街角出现的流浪猫
【里层世界】
- 隐藏在表象之下的规则体系——可以是魔法、超能力、修仙、灵异
- 规则要明确：谁能进入里世界？力量的来源和限制是什么？违背规则的代价？
- 两个世界的交集：什么情况下表里世界会碰撞？
【关键张力】
- 主角在两个世界之间挣扎——归属感、身份认同、选择
- 最好有一个"不可逆的选择"时刻——选择了里世界就无法回到表世界
基础设定：{{setting}}`,
      variables: [{ name: 'setting', label: '基础设定', defaultValue: '', required: true }],
      createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'ds-world-jianghu',
      name: '江湖武林世界观',
      category: 'world',
      description: '中国传统江湖世界观，门派、武功、恩怨情仇',
      promptFragment: `请构建一个中国武侠江湖世界观：
【势力格局】
- 正派（名门正派，以维护武林秩序自居）vs 邪派（行事不羁，亦正亦邪）
- 中间势力：不问世事的隐世高手、唯利是图的情报贩子、亦官亦侠的朝廷势力
- 门派之间表面和气，暗流涌动——谁和谁有世仇？谁和谁有联姻？
【武功体系】
- 武功不是随便谁都能练的——需要天赋、机缘、师承
- 每门武功有其哲学根基（道家/佛家/兵家），不仅是一套招式
- 武功的代价：每门顶级武功都有其副作用或限制
【江湖规矩】
- 不成文的规则比成文的规矩更重要——"人在江湖，身不由己"
- 名望比实力更重要，但名望也是一把双刃剑
基础设定：{{setting}}`,
      variables: [{ name: 'setting', label: '基础设定', defaultValue: '古代江湖', required: true }],
      createdAt: Date.now(), updatedAt: Date.now(),
    },
  ]

  // Initialize with defaults if empty
  if (skills.value.length === 0) {
    skills.value = [...defaultSkills]
    saveSkills(skills.value)
  }

  const filteredSkills = computed(() => {
    let result = skills.value
    if (categoryFilter.value !== 'all') {
      result = result.filter(s => s.category === categoryFilter.value)
    }
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
    }
    return result
  })

  function createSkill(skill: Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>): Skill {
    const newSkill: Skill = {
      ...skill,
      id: generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    skills.value.push(newSkill)
    saveSkills(skills.value)
    return newSkill
  }

  function updateSkill(skillId: string, updates: Partial<Skill>) {
    const idx = skills.value.findIndex(s => s.id === skillId)
    if (idx !== -1) {
      skills.value[idx] = { ...skills.value[idx], ...updates, updatedAt: Date.now() }
      saveSkills(skills.value)
    }
  }

  function deleteSkill(skillId: string) {
    skills.value = skills.value.filter(s => s.id !== skillId)
    saveSkills(skills.value)
  }

  function setCategoryFilter(cat: SkillCategory | 'all') {
    categoryFilter.value = cat
  }

  function setSearchQuery(q: string) {
    searchQuery.value = q
  }

  return {
    skills,
    filteredSkills,
    categoryFilter,
    searchQuery,
    defaultSkills,
    createSkill,
    updateSkill,
    deleteSkill,
    setCategoryFilter,
    setSearchQuery,
  }
})

import { describe, it, expect } from 'vitest'
import { createEmptyDoc, type DeskDoc, type PlanItem, type Task } from '@/types'
import {
  addPlanItem,
  isDoneToday,
  itemsBySection,
  itemsForDate,
  movePlanItem,
  nextSortIndex,
  removePlanItem,
  reorderSection,
  rolloverCandidates,
  rolloverItems,
  togglePlanItem,
  displayTitle,
  isSourceMissing,
  sourceTitle,
} from '@/features/plan/planLogic'
import { applyWriteBack } from '@/features/plan/joinToday'

const TODAY = '2026-11-13'
const YESTERDAY = '2026-11-12'

function baseDoc(): DeskDoc {
  return createEmptyDoc()
}

function addTask(doc: DeskDoc, id = 't1'): Task {
  const task: Task = {
    id,
    projectId: 'p1',
    title: '任务',
    status: 'todo',
    priority: 0,
    estimateMin: null,
    dueDate: null,
    createdAt: '2026-11-01T00:00:00.000Z',
  }
  doc.tasks.push(task)
  return task
}

function addItem(doc: DeskDoc, partial: Partial<PlanItem> = {}): PlanItem {
  const { item } = addPlanItem(doc, {
    date: TODAY,
    section: 'am',
    title: partial.title || '条目',
    ...partial,
  })
  if (!item) throw new Error('未创建条目')
  return item
}

describe('新建与排序', () => {
  it('同一段内依次追加，sortIndex 递增', () => {
    const doc = baseDoc()
    const a = addItem(doc, { title: '一' })
    const b = addItem(doc, { title: '二' })

    expect(a.sortIndex).toBe(0)
    expect(b.sortIndex).toBe(1)
    expect(itemsForDate(doc, TODAY).map((i) => i.title)).toEqual(['一', '二'])
  })

  it('空标题不会被加入', () => {
    const doc = baseDoc()
    const { item } = addPlanItem(doc, { date: TODAY, section: 'am', title: '   ' })
    expect(item).toBeNull()
    expect(doc.plans).toHaveLength(0)
  })

  it('同一来源在同一天只加一次', () => {
    const doc = baseDoc()
    addTask(doc)
    const first = addPlanItem(doc, { date: TODAY, section: 'am', title: '改接口', sourceType: 'task', sourceId: 't1' })
    const second = addPlanItem(doc, { date: TODAY, section: 'pm', title: '改接口', sourceType: 'task', sourceId: 't1' })

    expect(first.duplicated).toBe(false)
    expect(second.duplicated).toBe(true)
    expect(doc.plans).toHaveLength(1)
  })

  it('不同日期允许同一个来源各一条', () => {
    const doc = baseDoc()
    addTask(doc)
    addPlanItem(doc, { date: TODAY, section: 'am', title: '改接口', sourceType: 'task', sourceId: 't1' })
    const next = addPlanItem(doc, { date: YESTERDAY, section: 'am', title: '改接口', sourceType: 'task', sourceId: 't1' })
    expect(next.duplicated).toBe(false)
    expect(doc.plans).toHaveLength(2)
  })

  it('按上午下午晚上分组排序', () => {
    const doc = baseDoc()
    addItem(doc, { section: 'eve', title: '晚' })
    addItem(doc, { section: 'am', title: '早' })
    addItem(doc, { section: 'pm', title: '中' })

    expect(itemsForDate(doc, TODAY).map((i) => i.title)).toEqual(['早', '中', '晚'])
    expect(itemsBySection(doc, TODAY, 'pm')).toHaveLength(1)
  })
})

describe('勾选与回写', () => {
  it('勾选会写入完成时间，取消会清空', () => {
    const doc = baseDoc()
    const item = addItem(doc)

    togglePlanItem(doc, item.id)
    expect(doc.plans[0].done).toBe(true)
    expect(doc.plans[0].doneAt).toBeTruthy()

    togglePlanItem(doc, item.id)
    expect(doc.plans[0].done).toBe(false)
    expect(doc.plans[0].doneAt).toBeNull()
  })

  it('任务来源：勾选把任务改为完成，取消改回待做', () => {
    const doc = baseDoc()
    addTask(doc)
    const item = addItem(doc, { sourceType: 'task', sourceId: 't1' })

    togglePlanItem(doc, item.id, true)
    expect(doc.tasks[0].status).toBe('done')

    togglePlanItem(doc, item.id, false)
    expect(doc.tasks[0].status).toBe('todo')
  })

  it('Bug 来源：勾选标记为已解', () => {
    const doc = baseDoc()
    doc.bugs.push({
      id: 'b1',
      projectId: 'p1',
      title: '崩溃',
      severity: 'major',
      status: 'open',
      note: '',
      createdAt: '',
    })
    const item = addItem(doc, { sourceType: 'bug', sourceId: 'b1' })

    togglePlanItem(doc, item.id, true)
    expect(doc.bugs[0].status).toBe('fixed')
  })

  it('跟进来源：勾选标记完成', () => {
    const doc = baseDoc()
    doc.followups.push({
      id: 'f1',
      clientId: 'c1',
      title: '回邮件',
      dueDate: TODAY,
      status: 'open',
      fromSessionId: null,
      createdAt: '',
    })
    const item = addItem(doc, { sourceType: 'followup', sourceId: 'f1' })

    togglePlanItem(doc, item.id, true)
    expect(doc.followups[0].status).toBe('done')
  })

  it('训练来源：勾选把整次训练标记为完成', () => {
    const doc = baseDoc()
    doc.workouts.push({
      id: 'w1',
      date: TODAY,
      focus: '胸',
      items: [],
      completed: false,
      durationMin: 0,
    })
    const item = addItem(doc, { sourceType: 'workout', sourceId: 'w1' })

    togglePlanItem(doc, item.id, true)
    expect(doc.workouts[0].completed).toBe(true)
  })

  it('自媒体内容是提醒型，勾选不改变内容阶段', () => {
    const doc = baseDoc()
    doc.media.push({
      id: 'm1',
      title: '第 3 期',
      platforms: ['视频号'],
      stage: 'ready',
      publishAt: null,
      publishedAt: null,
      body: '',
      stats: { views: 0, likes: 0, follows: 0, recordedAt: null },
      createdAt: '',
      updatedAt: '',
    })
    const item = addItem(doc, { sourceType: 'content', sourceId: 'm1' })

    togglePlanItem(doc, item.id, true)
    expect(doc.media[0].stage).toBe('ready')
    expect(item.done).toBe(true)
  })

  it('源实体不存在时不报错', () => {
    const doc = baseDoc()
    expect(() => applyWriteBack(doc, { sourceType: 'task', sourceId: '不存在' }, true)).not.toThrow()
  })
})

describe('移动与重排', () => {
  it('移到其他日期会追加到目标日该段末尾', () => {
    const doc = baseDoc()
    const item = addItem(doc, { title: '搬走' })
    addPlanItem(doc, { date: '2026-11-14', section: 'am', title: '已在明天' })

    movePlanItem(doc, item.id, '2026-11-14')

    const tomorrow = itemsForDate(doc, '2026-11-14')
    expect(tomorrow.map((i) => i.title)).toEqual(['已在明天', '搬走'])
    expect(tomorrow[1].sortIndex).toBe(1)
  })

  it('重排会按给定顺序写回 sortIndex，并可跨段移动', () => {
    const doc = baseDoc()
    const a = addItem(doc, { title: 'A' })
    const b = addItem(doc, { title: 'B' })

    reorderSection(doc, TODAY, 'pm', [b.id, a.id])

    expect(itemsBySection(doc, TODAY, 'pm').map((i) => i.title)).toEqual(['B', 'A'])
    expect(itemsBySection(doc, TODAY, 'am')).toHaveLength(0)
  })

  it('删除后不再出现在列表里', () => {
    const doc = baseDoc()
    const a = addItem(doc, { title: '要删' })
    addItem(doc, { title: '留下' })

    removePlanItem(doc, a.id)

    expect(itemsForDate(doc, TODAY).map((i) => i.title)).toEqual(['留下'])
  })

  it('nextSortIndex 取当前最大值加一', () => {
    const doc = baseDoc()
    addItem(doc)
    addItem(doc)
    expect(nextSortIndex(doc, TODAY, 'am')).toBe(2)
  })
})

describe('顺延', () => {
  it('只挑今天之前且未完成的条目', () => {
    const doc = baseDoc()
    const oldDone = addPlanItem(doc, { date: YESTERDAY, section: 'am', title: '昨天做完' }).item!
    addPlanItem(doc, { date: YESTERDAY, section: 'pm', title: '昨天没做' })
    addPlanItem(doc, { date: TODAY, section: 'am', title: '今天没做' })
    togglePlanItem(doc, oldDone.id, true)

    const candidates = rolloverCandidates(doc, TODAY)
    expect(candidates.map((c) => c.title)).toEqual(['昨天没做'])
  })

  it('全部移到今天后落到对应时段', () => {
    const doc = baseDoc()
    addPlanItem(doc, { date: YESTERDAY, section: 'am', title: 'A' })
    addPlanItem(doc, { date: YESTERDAY, section: 'pm', title: 'B' })

    const moved = rolloverItems(doc, rolloverCandidates(doc, TODAY).map((c) => c.id), TODAY)

    expect(moved).toBe(2)
    expect(itemsBySection(doc, TODAY, 'am').map((i) => i.title)).toEqual(['A'])
    expect(itemsBySection(doc, TODAY, 'pm').map((i) => i.title)).toEqual(['B'])
    expect(rolloverCandidates(doc, TODAY)).toHaveLength(0)
  })

  it('只移入选中的那几条', () => {
    const doc = baseDoc()
    const a = addPlanItem(doc, { date: YESTERDAY, section: 'am', title: '选中' }).item!
    addPlanItem(doc, { date: YESTERDAY, section: 'am', title: '不选' })

    rolloverItems(doc, [a.id], TODAY)

    expect(itemsForDate(doc, TODAY).map((i) => i.title)).toEqual(['选中'])
    expect(itemsForDate(doc, YESTERDAY).map((i) => i.title)).toEqual(['不选'])
  })

  it('统计完成数与预估总时长', () => {
    const doc = baseDoc()
    const a = addPlanItem(doc, { date: TODAY, section: 'am', title: 'A', estimateMin: 30 }).item!
    addPlanItem(doc, { date: TODAY, section: 'pm', title: 'B', estimateMin: 60 })
    togglePlanItem(doc, a.id, true)

    const stats = isDoneToday(doc, TODAY)
    expect(stats).toEqual({ done: 1, total: 2, estimate: 90 })
  })
})

describe('来源引用（PRD 规则一）', () => {
  function planOfSource(sourceType: PlanItem['sourceType'], sourceId: string | null, title: string): PlanItem {
    return {
      id: 'pl-src',
      date: TODAY,
      section: 'am',
      title,
      module: 'dev',
      priority: 0,
      estimateMin: null,
      done: false,
      doneAt: null,
      sourceType,
      sourceId,
      sortIndex: 0,
    }
  }

  it('显示名以源实体当前标题为准', () => {
    const doc = baseDoc()
    const task = addTask(doc, 't1')
    doc.tasks[0].title = '原来的名字'
    const plan = planOfSource('task', task.id, '快照名字')
    doc.plans.push(plan)

    expect(sourceTitle(doc, plan)).toBe('原来的名字')
    expect(displayTitle(doc, plan)).toBe('原来的名字')

    doc.tasks[0].title = '改名之后'
    expect(displayTitle(doc, plan)).toBe('改名之后')
  })

  it('源被删除后标记来源已删除，名字回落到快照', () => {
    const doc = baseDoc()
    const plan = planOfSource('task', 'missing', '旧任务')
    doc.plans.push(plan)

    expect(isSourceMissing(doc, plan)).toBe(true)
    expect(displayTitle(doc, plan)).toBe('旧任务')

    addTask(doc, 'missing').title = '又回来了'
    expect(isSourceMissing(doc, plan)).toBe(false)
    expect(displayTitle(doc, plan)).toBe('又回来了')
  })

  it('自由条目和五种来源都能取到标题', () => {
    const doc = baseDoc()
    doc.followups.push({
      id: 'f1',
      clientId: 'c1',
      title: '回访',
      dueDate: null,
      status: 'open',
      fromSessionId: null,
      createdAt: '',
    })
    doc.media.push({
      id: 'm1',
      title: '选题',
      platforms: [],
      stage: 'idea',
      publishAt: null,
      publishedAt: null,
      body: '',
      stats: { views: 0, likes: 0, follows: 0, recordedAt: null },
      createdAt: '',
      updatedAt: '',
    })
    doc.bugs.push({
      id: 'b1',
      projectId: 'p1',
      title: '崩了',
      severity: 'major',
      status: 'open',
      note: '',
      createdAt: '',
    })
    doc.workouts.push({ id: 'w1', date: TODAY, focus: '胸', items: [], completed: false, durationMin: 0 })

    expect(sourceTitle(doc, planOfSource('followup', 'f1', ''))).toBe('回访')
    expect(sourceTitle(doc, planOfSource('content', 'm1', ''))).toBe('选题')
    expect(sourceTitle(doc, planOfSource('bug', 'b1', ''))).toBe('崩了')
    expect(sourceTitle(doc, planOfSource('workout', 'w1', ''))).toBe('胸')

    const free = planOfSource(null, null, '自己写的')
    expect(sourceTitle(doc, free)).toBeNull()
    expect(isSourceMissing(doc, free)).toBe(false)
    expect(displayTitle(doc, free)).toBe('自己写的')
  })
})

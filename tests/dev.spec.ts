import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import Dev from '@/views/Dev.vue'
import { db, resetDbForTests } from '@/store/db'
import { createEmptyDoc, type DeskDoc } from '@/types'
import {
  addBug,
  addTask,
  addTimeLog,
  bugsOf,
  createProject,
  elapsedMs,
  formatMinutes,
  nextTaskStatus,
  pauseTimer,
  projectSummary,
  removeProject,
  removeTask,
  resumeTimer,
  setBugStatus,
  setTaskStatus,
  sortedProjects,
  startTimer,
  stopTimer,
  tasksOf,
  upsertDevLog,
} from '@/features/dev/devLogic'
import { displayTitle, isSourceMissing } from '@/features/plan/planLogic'

let wrapper: VueWrapper | null = null

function seedDoc(): DeskDoc {
  const doc = createEmptyDoc()
  const project = createProject(doc, '工作台')!
  addTask(doc, project.id, '改完登录接口')
  addBug(doc, project.id, '登录偶发 500', 'blocker')
  return doc
}

beforeEach(() => {
  resetDbForTests()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, savedAt: new Date().toISOString() }) })),
  )
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllGlobals()
})

describe('项目与任务', () => {
  it('新建项目后进入进行中，按状态排序', () => {
    const doc = createEmptyDoc()
    const a = createProject(doc, 'B 项目')!
    const b = createProject(doc, 'A 项目')!
    a.status = 'paused'

    expect(doc.projects).toHaveLength(2)
    expect(sortedProjects(doc).map((p) => p.name)).toEqual(['A 项目', 'B 项目'])
  })

  it('空项目名不会创建', () => {
    const doc = createEmptyDoc()
    expect(createProject(doc, '  ')).toBeNull()
    expect(doc.projects).toHaveLength(0)
  })

  it('任务三态循环：待做 → 进行中 → 完成 → 待做', () => {
    expect(nextTaskStatus('todo')).toBe('doing')
    expect(nextTaskStatus('doing')).toBe('done')
    expect(nextTaskStatus('done')).toBe('todo')
  })

  it('进行中的任务排在待做之前', () => {
    const doc = createEmptyDoc()
    const p = createProject(doc, 'P')!
    const t1 = addTask(doc, p.id, '一')!
    addTask(doc, p.id, '二')
    setTaskStatus(doc, t1.id, 'doing')

    expect(tasksOf(doc, p.id).map((t) => t.title)).toEqual(['一', '二'])
  })

  it('删除任务后今日计划条目保留，标记为来源已删除', () => {
    const doc = seedDoc()
    const task = doc.tasks[0]
    doc.plans.push({
      id: 'pl1',
      date: '2026-11-13',
      section: 'am',
      title: task.title,
      module: 'dev',
      priority: 0,
      estimateMin: null,
      done: false,
      doneAt: null,
      sourceType: 'task',
      sourceId: task.id,
      sortIndex: 0,
    })

    removeTask(doc, task.id)

    expect(doc.tasks).toHaveLength(0)
    expect(doc.plans).toHaveLength(1)
    expect(isSourceMissing(doc, doc.plans[0])).toBe(true)
    expect(displayTitle(doc, doc.plans[0])).toBe(task.title)
  })

  it('项目汇总给累计工时、未完成任务与未解 Bug', () => {
    const doc = seedDoc()
    const id = doc.projects[0].id
    addTimeLog(doc, id, 45)

    expect(projectSummary(doc, id)).toEqual({ minutes: 45, openTasks: 1, openBugs: 1 })
  })

  it('删除项目会连带清掉其下任务、Bug、工时与日志', () => {
    const doc = seedDoc()
    const id = doc.projects[0].id
    addTimeLog(doc, id, 30)
    upsertDevLog(doc, '2026-11-13', id, '写了登录重试')

    removeProject(doc, id)

    expect(doc.projects).toHaveLength(0)
    expect(doc.tasks).toHaveLength(0)
    expect(doc.bugs).toHaveLength(0)
    expect(doc.timeLogs).toHaveLength(0)
    expect(doc.devLogs).toHaveLength(0)
  })
})

describe('Bug', () => {
  it('未解 Bug 排在前面，同状态按严重程度排', () => {
    const doc = createEmptyDoc()
    const p = createProject(doc, 'P')!
    addBug(doc, p.id, '轻微', 'minor')
    addBug(doc, p.id, '致命', 'blocker')
    const fixed = addBug(doc, p.id, '已修', 'major')!
    setBugStatus(doc, fixed.id, 'fixed')

    expect(bugsOf(doc, p.id).map((b) => b.title)).toEqual(['致命', '轻微', '已修'])
  })

  it('标记已解后未解数量下降', () => {
    const doc = seedDoc()
    const id = doc.projects[0].id
    expect(projectSummary(doc, id).openBugs).toBe(1)

    setBugStatus(doc, doc.bugs[0].id, 'fixed')
    expect(projectSummary(doc, id).openBugs).toBe(0)
  })
})

describe('工时计时', () => {
  it('开始、暂停、继续、结束的累计时间正确', () => {
    const doc = createEmptyDoc()
    const p = createProject(doc, 'P')!

    startTimer(doc, p.id, null, 1000)
    expect(elapsedMs(doc.runtime.timer, 61000)).toBe(60000)

    pauseTimer(doc, 61000)
    expect(elapsedMs(doc.runtime.timer, 999999)).toBe(60000)

    resumeTimer(doc, 100000)
    expect(elapsedMs(doc.runtime.timer, 130000)).toBe(90000)

    const log = stopTimer(doc, 130000, '写接口')
    expect(log?.minutes).toBe(2)
    expect(doc.runtime.timer).toBeNull()
    expect(doc.timeLogs).toHaveLength(1)
    expect(doc.timeLogs[0].note).toBe('写接口')
  })

  it('结束计时至少记 1 分钟', () => {
    const doc = createEmptyDoc()
    const p = createProject(doc, 'P')!
    startTimer(doc, p.id, null, 1000)
    const log = stopTimer(doc, 2000)
    expect(log?.minutes).toBe(1)
  })

  it('没有计时时不产生记录', () => {
    const doc = createEmptyDoc()
    expect(stopTimer(doc)).toBeNull()
    expect(doc.timeLogs).toHaveLength(0)
  })

  it('手动补录会按分钟反向推算开始时间', () => {
    const doc = createEmptyDoc()
    const p = createProject(doc, 'P')!
    const end = new Date('2026-11-13T18:00:00.000Z')
    const log = addTimeLog(doc, p.id, 90, '补录', end)

    expect(log?.minutes).toBe(90)
    expect(log?.startedAt).toBe('2026-11-13T16:30:00.000Z')
  })

  it('工时展示格式', () => {
    expect(formatMinutes(0)).toBe('0m')
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(60)).toBe('1h')
    expect(formatMinutes(135)).toBe('2h 15m')
  })
})

describe('开发日志', () => {
  it('同一天同一项目追加到同一条', () => {
    const doc = createEmptyDoc()
    const p = createProject(doc, 'P')!
    upsertDevLog(doc, '2026-11-13', p.id, '第一段')
    upsertDevLog(doc, '2026-11-13', p.id, '第二段')

    expect(doc.devLogs).toHaveLength(1)
    expect(doc.devLogs[0].content).toBe('第一段\n第二段')
  })

  it('空内容不记录', () => {
    const doc = createEmptyDoc()
    expect(upsertDevLog(doc, '2026-11-13', null, '   ')).toBeNull()
  })
})

describe('开发工作页面', () => {
  async function mountDev(doc: DeskDoc) {
    db.doc = doc
    db.ready = true
    wrapper = mount(Dev)
    await flushPromises()
    return wrapper
  }

  it('渲染项目、任务与 Bug', async () => {
    const doc = seedDoc()
    const w = await mountDev(doc)
    expect(w.text()).toContain('工作台')
    expect(w.text()).toContain('改完登录接口')
    expect(w.find('[data-testid="dev-task-add"]').exists()).toBe(true)
  })

  it('点加入今天会写入今日计划，并带上来源', async () => {
    const doc = seedDoc()
    const w = await mountDev(doc)

    const joinBtn = w.findAll('button').find((b) => b.text() === '加入今天')!
    await joinBtn.trigger('click')
    await flushPromises()

    expect(db.doc.plans).toHaveLength(1)
    expect(db.doc.plans[0].sourceType).toBe('task')
    expect(db.doc.plans[0].module).toBe('dev')
  })

  it('重复加入同一条不会产生第二条', async () => {
    const doc = seedDoc()
    const w = await mountDev(doc)

    const joinBtn = w.findAll('button').find((b) => b.text() === '加入今天')!
    await joinBtn.trigger('click')
    await joinBtn.trigger('click')
    await flushPromises()

    expect(db.doc.plans).toHaveLength(1)
  })

  it('切换任务状态按钮会推进状态', async () => {
    const doc = seedDoc()
    const w = await mountDev(doc)
    const taskId = doc.tasks[0].id

    await w.find(`[data-testid="dev-task-toggle-${taskId}"]`).trigger('click')
    await flushPromises()
    expect(db.doc.tasks[0].status).toBe('doing')

    await w.find(`[data-testid="dev-task-toggle-${taskId}"]`).trigger('click')
    await flushPromises()
    expect(db.doc.tasks[0].status).toBe('done')
  })

  it('计时器可开始并结束，落一条工时', async () => {
    const doc = seedDoc()
    const w = await mountDev(doc)
    await w.find('[data-testid="seg-time"]').trigger('click')

    await w.find('[data-testid="dev-timer-toggle"]').trigger('click')
    await flushPromises()
    expect(db.doc.runtime.timer).not.toBeNull()

    await w.find('[data-testid="dev-timer-stop"]').trigger('click')
    await flushPromises()
    expect(db.doc.runtime.timer).toBeNull()
    expect(db.doc.timeLogs).toHaveLength(1)
    expect(db.doc.timeLogs[0].minutes).toBeGreaterThanOrEqual(1)
  })
})

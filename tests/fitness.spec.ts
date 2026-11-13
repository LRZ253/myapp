import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import Fitness from '@/views/Fitness.vue'
import { db, resetDbForTests } from '@/store/db'
import { createEmptyDoc, type DeskDoc } from '@/types'
import { addDays, todayKey, weekStartKey, weekdayIndex } from '@/lib/date'
import {
  addBodyMetric,
  addExercise,
  ensureWeekPlan,
  ensureWorkout,
  planOf,
  setDayPlan,
  setWorkoutCompleted,
  sparklinePoints,
  toggleDayExercise,
  toggleSet,
  updateSet,
  weekWorkoutStats,
  weightTrend,
} from '@/features/fitness/fitnessLogic'

const TODAY = todayKey()
const TODAY_WEEKDAY = weekdayIndex(TODAY)

let wrapper: VueWrapper | null = null

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

describe('周计划', () => {
  it('初始化补齐七天', () => {
    const doc = createEmptyDoc()
    ensureWeekPlan(doc)
    expect(doc.weekPlans).toHaveLength(7)
    expect(doc.weekPlans.map((w) => w.weekday).sort()).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('可以把某天改成训练日并挂动作', () => {
    const doc = createEmptyDoc()
    ensureWeekPlan(doc)
    const exercise = addExercise(doc, '卧推', '胸')!

    setDayPlan(doc, 3, { type: 'train', focus: '胸 + 三头' })
    toggleDayExercise(doc, 3, exercise.id)

    expect(planOf(doc, 3)?.focus).toBe('胸 + 三头')
    expect(planOf(doc, 3)?.exerciseIds).toContain(exercise.id)

    toggleDayExercise(doc, 3, exercise.id)
    expect(planOf(doc, 3)?.exerciseIds).toHaveLength(0)
  })

  it('空动作名不会入动作库', () => {
    const doc = createEmptyDoc()
    expect(addExercise(doc, '  ')).toBeNull()
  })
})

describe('今日训练', () => {
  function trainToday(doc: DeskDoc) {
    ensureWeekPlan(doc)
    const exercise = addExercise(doc, '卧推', '胸')!
    setDayPlan(doc, TODAY_WEEKDAY, { type: 'train', focus: '胸' })
    toggleDayExercise(doc, TODAY_WEEKDAY, exercise.id)
    return exercise
  }

  it('按周计划生成训练，默认三组', () => {
    const doc = createEmptyDoc()
    trainToday(doc)
    const workout = ensureWorkout(doc, TODAY)!

    expect(workout.items).toHaveLength(1)
    expect(workout.items[0].name).toBe('卧推')
    expect(workout.items[0].sets).toHaveLength(3)
    expect(workout.items[0].doneSets).toBe(0)
  })

  it('休息日不生成训练', () => {
    const doc = createEmptyDoc()
    ensureWeekPlan(doc)
    setDayPlan(doc, TODAY_WEEKDAY, { type: 'rest' })
    expect(ensureWorkout(doc, TODAY)).toBeNull()
  })

  it('同一天重复调用只生成一次', () => {
    const doc = createEmptyDoc()
    trainToday(doc)
    ensureWorkout(doc, TODAY)
    ensureWorkout(doc, TODAY)
    expect(doc.workouts).toHaveLength(1)
  })

  it('逐组打勾与取消', () => {
    const doc = createEmptyDoc()
    trainToday(doc)
    const workout = ensureWorkout(doc, TODAY)!

    toggleSet(doc, workout.id, 0, 0)
    expect(doc.workouts[0].items[0].doneSets).toBe(1)
    toggleSet(doc, workout.id, 0, 1)
    expect(doc.workouts[0].items[0].doneSets).toBe(2)

    toggleSet(doc, workout.id, 0, 1)
    expect(doc.workouts[0].items[0].doneSets).toBe(1)
  })

  it('可以改次数与重量', () => {
    const doc = createEmptyDoc()
    trainToday(doc)
    const workout = ensureWorkout(doc, TODAY)!

    updateSet(doc, workout.id, 0, 0, { reps: 12, weight: 40 })
    expect(doc.workouts[0].items[0].sets[0]).toEqual({ reps: 12, weight: 40 })
  })

  it('完成整次训练才计入本周次数', () => {
    const doc = createEmptyDoc()
    trainToday(doc)
    const workout = ensureWorkout(doc, TODAY)!

    expect(weekWorkoutStats(doc, TODAY).done).toBe(0)
    setWorkoutCompleted(doc, workout.id, true)
    expect(weekWorkoutStats(doc, TODAY).done).toBe(1)
    setWorkoutCompleted(doc, workout.id, false)
    expect(weekWorkoutStats(doc, TODAY).done).toBe(0)
  })

  it('只统计本周已完成的训练', () => {
    const doc = createEmptyDoc()
    ensureWeekPlan(doc)
    const start = weekStartKey(TODAY, 1)
    doc.workouts.push(
      { id: 'w1', date: TODAY, focus: '胸', items: [], completed: true, durationMin: 40 },
      { id: 'w2', date: addDays(start, -1), focus: '背', items: [], completed: true, durationMin: 40 },
      { id: 'w3', date: TODAY, focus: '腿', items: [], completed: false, durationMin: 0 },
    )
    expect(weekWorkoutStats(doc, TODAY).done).toBe(1)
  })
})

describe('身体数据', () => {
  it('同一天再记会覆盖', () => {
    const doc = createEmptyDoc()
    addBodyMetric(doc, '2026-11-13', 70)
    addBodyMetric(doc, '2026-11-13', 69.5)
    expect(doc.bodyMetrics).toHaveLength(1)
    expect(doc.bodyMetrics[0].weight).toBe(69.5)
  })

  it('非法体重不入库', () => {
    const doc = createEmptyDoc()
    expect(addBodyMetric(doc, '2026-11-13', 0)).toBeNull()
  })

  it('趋势按日期升序，最多 30 条', () => {
    const doc = createEmptyDoc()
    for (let i = 0; i < 35; i++) {
      addBodyMetric(doc, addDays('2026-01-01', i), 70 + i * 0.1)
    }
    const trend = weightTrend(doc, 30)
    expect(trend).toHaveLength(30)
    const dates = trend.map((t) => t.date)
    expect([...dates].sort()).toEqual(dates)
  })

  it('折线点少于两个时为空', () => {
    expect(sparklinePoints([70], 100, 40)).toBe('')
    expect(sparklinePoints([70, 71], 100, 40)).toContain(',')
  })
})

describe('健身页面', () => {
  async function mountFitness(doc: DeskDoc) {
    db.doc = doc
    db.ready = true
    wrapper = mount(Fitness, { attachTo: document.body })
    await flushPromises()
    return wrapper
  }

  it('月历渲染整月，今天格子带标记', async () => {
    const w = await mountFitness(createEmptyDoc())
    expect(w.find('[data-testid="month-grid"]').exists()).toBe(true)
    expect(w.findAll('.mc-cell').length).toBe(42)
    expect(w.find(`[data-testid="fitness-cell-${TODAY}"]`).exists()).toBe(true)
  })

  it('格子里显示部位、动作数与组数', async () => {
    const doc = createEmptyDoc()
    ensureWeekPlan(doc)
    const bench = addExercise(doc, '卧推', '胸')!
    const fly = addExercise(doc, '飞鸟', '胸')!
    setDayPlan(doc, TODAY_WEEKDAY, { type: 'train', focus: '胸 + 三头' })
    toggleDayExercise(doc, TODAY_WEEKDAY, bench.id)
    toggleDayExercise(doc, TODAY_WEEKDAY, fly.id)
    ensureWorkout(doc, TODAY)

    const w = await mountFitness(doc)
    const cell = w.find(`[data-testid="fitness-cell-${TODAY}"]`)
    expect(cell.text()).toContain('胸 + 三头')
    expect(cell.text()).toContain('2 动作')
    expect(cell.text()).toContain('6 组')
  })

  it('实际练的部位与周模板不同时，会说明差异', async () => {
    const doc = createEmptyDoc()
    ensureWeekPlan(doc)
    const exercise = addExercise(doc, '深蹲', '腿')!
    setDayPlan(doc, TODAY_WEEKDAY, { type: 'train', focus: '腿' })
    toggleDayExercise(doc, TODAY_WEEKDAY, exercise.id)
    const workout = ensureWorkout(doc, TODAY)!
    workout.focus = '胸 + 三头'

    const w = await mountFitness(doc)
    // 日历格子按实际记录显示
    expect(w.find(`[data-testid="fitness-cell-${TODAY}"]`).text()).toContain('胸 + 三头')
    // 详情区提示模板与实际记录的差别，避免"格子里写胸、详情里写腿"
    const diff = w.find('[data-testid="fitness-focus-diff"]')
    expect(diff.exists()).toBe(true)
    expect(diff.text()).toContain('胸 + 三头')
    expect(diff.text()).toContain('模板')

    // 模板改到与实际一致后提示消失
    setDayPlan(db.doc, TODAY_WEEKDAY, { focus: '胸 + 三头' })
    await flushPromises()
    expect(w.find('[data-testid="fitness-focus-diff"]').exists()).toBe(false)
  })

  it('点日历里的其他日期，详情区会切过去', async () => {
    const w = await mountFitness(createEmptyDoc())
    const target = addDays(TODAY, 1)
    await w.find(`[data-testid="fitness-cell-${target}"]`).trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="fitness-cell-' + target + '"]').classes()).toContain('selected')
  })

  it('今天安排训练但未开始时，可以点开始生成训练', async () => {
    const doc = createEmptyDoc()
    ensureWeekPlan(doc)
    const exercise = addExercise(doc, '深蹲', '腿')!
    setDayPlan(doc, TODAY_WEEKDAY, { type: 'train', focus: '腿' })
    toggleDayExercise(doc, TODAY_WEEKDAY, exercise.id)

    const w = await mountFitness(doc)
    const startBtn = w.find('[data-testid="fitness-start"]')
    expect(startBtn.exists()).toBe(true)

    await startBtn.trigger('click')
    await flushPromises()

    expect(db.doc.workouts).toHaveLength(1)
    expect(db.doc.workouts[0].items[0].name).toBe('深蹲')
  })

  it('点组数会记录完成组，完成训练后本周次数加一', async () => {
    const doc = createEmptyDoc()
    ensureWeekPlan(doc)
    const exercise = addExercise(doc, '卧推', '胸')!
    setDayPlan(doc, TODAY_WEEKDAY, { type: 'train', focus: '胸' })
    toggleDayExercise(doc, TODAY_WEEKDAY, exercise.id)
    ensureWorkout(doc, TODAY)

    const w = await mountFitness(doc)
    await w.find('[data-testid="fitness-set-0-0"]').trigger('click')
    await flushPromises()
    expect(db.doc.workouts[0].items[0].doneSets).toBe(1)

    await w.find('[data-testid="fitness-complete"]').trigger('click')
    await flushPromises()
    expect(db.doc.workouts[0].completed).toBe(true)
    expect(w.text()).toContain('本周 1 / 1 次')
  })
})

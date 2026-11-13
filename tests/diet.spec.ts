import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import Diet from '@/views/Diet.vue'
import { db, resetDbForTests } from '@/store/db'
import { ui } from '@/store/ui'
import { createEmptyDoc, type DeskDoc } from '@/types'
import { todayKey } from '@/lib/date'
import {
  addDish,
  addWater,
  dayCalories,
  logPlannedMeals,
  mealText,
  planOf,
  removeDish,
  setMealPlan,
  toggleMealDish,
  waterCups,
  weekMealStats,
} from '@/features/diet/dietLogic'

const TODAY = todayKey()

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

describe('菜品与周计划', () => {
  it('加菜后可以挂到某一餐', () => {
    const doc = createEmptyDoc()
    const dish = addDish(doc, '燕麦粥', 'breakfast', 300)!

    toggleMealDish(doc, TODAY, 'breakfast', dish.id)

    expect(planOf(doc, TODAY, 'breakfast')?.dishIds).toEqual([dish.id])
    expect(mealText(doc, TODAY, 'breakfast')).toBe('燕麦粥')
  })

  it('再点一次从这一餐移掉', () => {
    const doc = createEmptyDoc()
    const dish = addDish(doc, '燕麦粥')!
    toggleMealDish(doc, TODAY, 'breakfast', dish.id)
    toggleMealDish(doc, TODAY, 'breakfast', dish.id)
    expect(planOf(doc, TODAY, 'breakfast')?.dishIds).toEqual([])
  })

  it('同一餐重复设置只保留一条计划', () => {
    const doc = createEmptyDoc()
    const a = addDish(doc, 'A')!
    const b = addDish(doc, 'B')!
    setMealPlan(doc, TODAY, 'lunch', [a.id])
    setMealPlan(doc, TODAY, 'lunch', [b.id])

    expect(doc.mealPlans).toHaveLength(1)
    expect(planOf(doc, TODAY, 'lunch')?.dishIds).toEqual([b.id])
  })

  it('删菜会从计划与打卡里一并移除', () => {
    const doc = createEmptyDoc()
    const dish = addDish(doc, '鸡胸沙拉', 'lunch', 500)!
    setMealPlan(doc, TODAY, 'lunch', [dish.id])
    logPlannedMeals(doc, TODAY)

    removeDish(doc, dish.id)

    expect(doc.dishes).toHaveLength(0)
    expect(doc.mealPlans[0].dishIds).toEqual([])
    expect(doc.mealLogs[0].dishIds).toEqual([])
  })

  it('空菜名不入库', () => {
    const doc = createEmptyDoc()
    expect(addDish(doc, '   ')).toBeNull()
  })
})

describe('打卡与喝水', () => {
  it('照计划打卡会为有菜的餐次建记录', () => {
    const doc = createEmptyDoc()
    const dish = addDish(doc, '番茄牛腩', 'dinner', 600)!
    setMealPlan(doc, TODAY, 'dinner', [dish.id])

    const count = logPlannedMeals(doc, TODAY, 'home')

    expect(count).toBe(1)
    expect(doc.mealLogs).toHaveLength(1)
    expect(doc.mealLogs[0].source).toBe('home')
  })

  it('重复打卡不会产生重复记录', () => {
    const doc = createEmptyDoc()
    const dish = addDish(doc, 'A')!
    setMealPlan(doc, TODAY, 'lunch', [dish.id])
    logPlannedMeals(doc, TODAY)
    logPlannedMeals(doc, TODAY)
    expect(doc.mealLogs).toHaveLength(1)
  })

  it('外卖标记会覆盖原有来源', () => {
    const doc = createEmptyDoc()
    const dish = addDish(doc, 'A')!
    setMealPlan(doc, TODAY, 'lunch', [dish.id])
    logPlannedMeals(doc, TODAY, 'home')
    logPlannedMeals(doc, TODAY, 'takeout')
    expect(doc.mealLogs[0].source).toBe('takeout')
  })

  it('喝水在 0 到 8 之间截断', () => {
    const doc = createEmptyDoc()
    expect(addWater(doc, TODAY, 3)).toBe(3)
    expect(addWater(doc, TODAY, 10)).toBe(8)
    expect(addWater(doc, TODAY, -20)).toBe(0)
    expect(waterCups(doc, TODAY)).toBe(0)
  })

  it('本周统计分开算在家与外卖', () => {
    const doc = createEmptyDoc()
    const dish = addDish(doc, 'A')!
    setMealPlan(doc, TODAY, 'lunch', [dish.id])
    setMealPlan(doc, TODAY, 'dinner', [dish.id])
    logPlannedMeals(doc, TODAY, 'home')
    doc.mealLogs[1].source = 'takeout'

    const stats = weekMealStats(doc, TODAY)
    expect(stats.home).toBe(1)
    expect(stats.takeout).toBe(1)
  })

  it('当天热量按计划里菜品的千卡求和', () => {
    const doc = createEmptyDoc()
    const a = addDish(doc, 'A', 'breakfast', 300)!
    const b = addDish(doc, 'B', 'lunch', 500)!
    setMealPlan(doc, TODAY, 'breakfast', [a.id])
    setMealPlan(doc, TODAY, 'lunch', [b.id])
    expect(dayCalories(doc, TODAY)).toBe(800)
  })
})

describe('饮食页面', () => {
  async function mountDiet(doc: DeskDoc) {
    db.doc = doc
    db.ready = true
    wrapper = mount(Diet, { attachTo: document.body })
    await flushPromises()
    return wrapper
  }

  it('月历渲染整月，今天在格子里', async () => {
    const w = await mountDiet(createEmptyDoc())
    expect(w.find('[data-testid="month-grid"]').exists()).toBe(true)
    expect(w.findAll('.mc-cell')).toHaveLength(42)
    expect(w.find(`[data-testid="diet-cell-${TODAY}"]`).exists()).toBe(true)
  })

  it('点某天格子打开当天饮食抽屉', async () => {
    const w = await mountDiet(createEmptyDoc())
    await w.find(`[data-testid="diet-cell-${TODAY}"]`).trigger('click')
    await flushPromises()

    expect(ui.drawer?.title).toContain('饮食')
    expect((ui.drawer?.props as { date?: string })?.date).toBe(TODAY)
  })

  it('格子会显示当天排的菜', async () => {
    const doc = createEmptyDoc()
    const dish = addDish(doc, '鸡胸沙拉', 'lunch', 500)!
    setMealPlan(doc, TODAY, 'lunch', [dish.id])

    const w = await mountDiet(doc)
    const cell = w.find(`[data-testid="diet-cell-${TODAY}"]`)
    expect(cell.text()).toContain('鸡胸沙拉')
    expect(cell.text()).toContain('500')
  })

  it('空格子用 is-empty 标记，不会套上全局空状态盒子的样式', async () => {
    const w = await mountDiet(createEmptyDoc())
    const cell = w.find(`[data-testid="diet-cell-${TODAY}"]`)
    // .empty 是全局空状态组件（大虚线框）的类名，格子里的空提示必须用 .is-empty
    expect(cell.findAll('.empty')).toHaveLength(0)
    expect(cell.find('.is-empty').exists()).toBe(true)
  })

  it('点水滴会累加喝水杯数', async () => {
    const doc = createEmptyDoc()
    const w = await mountDiet(doc)

    await w.find('[data-testid="diet-cup-3"]').trigger('click')
    await flushPromises()

    expect(waterCups(db.doc, TODAY)).toBe(3)
    expect(w.text()).toContain('喝水 3 / 8')
  })

  it('照这个吃会生成打卡记录', async () => {
    const doc = createEmptyDoc()
    const dish = addDish(doc, '鸡胸沙拉', 'lunch', 500)!
    setMealPlan(doc, TODAY, 'lunch', [dish.id])

    const w = await mountDiet(doc)
    await w.find('[data-testid="diet-eat-planned"]').trigger('click')
    await flushPromises()

    expect(db.doc.mealLogs).toHaveLength(1)
    expect(w.text()).toContain('1 餐已打卡')
  })
})

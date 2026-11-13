import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import Today from '@/views/Today.vue'
import { createTestRouter } from '@/router'
import { db, resetDbForTests } from '@/store/db'
import { createEmptyDoc, type DeskDoc } from '@/types'
import { todayKey, addDays } from '@/lib/date'
import { addPlanItem } from '@/features/plan/planLogic'

const TODAY = todayKey()
const YESTERDAY = addDays(TODAY, -1)

let wrapper: VueWrapper | null = null

async function mountToday(doc: DeskDoc) {
  db.doc = doc
  db.ready = true
  const router = createTestRouter()
  await router.push('/today')
  await router.isReady()
  wrapper = mount(Today, { global: { plugins: [router] } })
  await flushPromises()
  return { router, wrapper }
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

describe('今日计划页面', () => {
  it('渲染三个时段分组', async () => {
    const w = (await mountToday(createEmptyDoc())).wrapper
    expect(w.find('[data-testid="plan-section-am"]').exists()).toBe(true)
    expect(w.find('[data-testid="plan-section-pm"]').exists()).toBe(true)
    expect(w.find('[data-testid="plan-section-eve"]').exists()).toBe(true)
  })

  it('底部输入回车即新增，并落在对应时段', async () => {
    const doc = createEmptyDoc()
    const { wrapper: w } = await mountToday(doc)

    const input = w.find('[data-testid="plan-add-pm"]')
    await input.setValue('和客户对一下进度')
    await w.findAll('form')[1].trigger('submit')
    await flushPromises()

    expect(db.doc.plans).toHaveLength(1)
    expect(db.doc.plans[0].section).toBe('pm')
    expect(db.doc.plans[0].title).toBe('和客户对一下进度')
    expect(w.text()).toContain('和客户对一下进度')
  })

  it('勾选后条目状态与数据库同步', async () => {
    const doc = createEmptyDoc()
    const { item } = addPlanItem(doc, { date: TODAY, section: 'am', title: '写第 3 期开头' })
    const w = (await mountToday(doc)).wrapper

    await w.find(`[data-testid="plan-check-${item!.id}"]`).trigger('click')
    await flushPromises()

    expect(db.doc.plans[0].done).toBe(true)
    expect(w.find(`[data-testid="plan-item-${item!.id}"]`).attributes('data-done')).toBe('true')
  })

  it('点标题可就地改名', async () => {
    const doc = createEmptyDoc()
    const { item } = addPlanItem(doc, { date: TODAY, section: 'am', title: '旧标题' })
    const w = (await mountToday(doc)).wrapper

    await w.find(`[data-testid="plan-title-${item!.id}"]`).trigger('click')
    const editor = w.find(`[data-testid="plan-edit-${item!.id}"]`)
    expect(editor.exists()).toBe(true)

    await editor.setValue('新标题')
    await editor.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(db.doc.plans[0].title).toBe('新标题')
  })

  it('有昨天未完成时出现顺延条，全部移到今天后消失', async () => {
    const doc = createEmptyDoc()
    addPlanItem(doc, { date: YESTERDAY, section: 'am', title: '昨天没做完' })
    const w = (await mountToday(doc)).wrapper

    expect(w.find('[data-testid="rollover-bar"]').exists()).toBe(true)

    await w.find('[data-testid="rollover-all"]').trigger('click')
    await flushPromises()

    expect(db.doc.plans[0].date).toBe(TODAY)
    expect(w.find('[data-testid="rollover-bar"]').exists()).toBe(false)
  })

  it('忽略顺延不会改动数据', async () => {
    const doc = createEmptyDoc()
    addPlanItem(doc, { date: YESTERDAY, section: 'am', title: '昨天没做完' })
    const w = (await mountToday(doc)).wrapper

    await w.find('[data-testid="rollover-ignore"]').trigger('click')
    await flushPromises()

    expect(db.doc.plans[0].date).toBe(YESTERDAY)
    expect(w.find('[data-testid="rollover-bar"]').exists()).toBe(false)
  })

  it('切到前一天后顺延条不再出现', async () => {
    const doc = createEmptyDoc()
    addPlanItem(doc, { date: YESTERDAY, section: 'am', title: '昨天的事' })
    const w = (await mountToday(doc)).wrapper

    await w.find('[data-testid="date-prev"]').trigger('click')
    await flushPromises()

    expect(w.find('[data-testid="date-today"]').exists()).toBe(true)
    expect(w.find('[data-testid="rollover-bar"]').exists()).toBe(false)
    expect(w.text()).toContain('昨天的事')
  })
})

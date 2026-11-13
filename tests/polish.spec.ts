import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from '@/App.vue'
import Fitness from '@/views/Fitness.vue'
import Diet from '@/views/Diet.vue'
import { createTestRouter } from '@/router'
import { db, resetDbForTests } from '@/store/db'
import { ui } from '@/store/ui'
import PlanList from '@/features/plan/PlanList.vue'
import { createEmptyDoc, type DeskDoc, type PlanItem } from '@/types'
import { todayKey } from '@/lib/date'

let wrapper: VueWrapper | null = null
let fetchMock: ReturnType<typeof vi.fn>

function jsonOk(body: unknown, status = 200) {
  return { ok: status < 300, status, json: async () => body } as unknown as Response
}

beforeEach(() => {
  resetDbForTests()
  ui.drawer = null
  ui.paletteOpen = false
  ui.toastVisible = false
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init || (init.method || 'GET') === 'GET') {
      return jsonOk({ ok: true, doc: createEmptyDoc(), savedAt: null })
    }
    return jsonOk({ ok: true, savedAt: new Date().toISOString() })
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllGlobals()
})

async function mountApp(doc: DeskDoc = createEmptyDoc(), path = '/') {
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (!init || (init.method || 'GET') === 'GET') {
      return jsonOk({ ok: true, doc, savedAt: doc.exportedAt })
    }
    return jsonOk({ ok: true, savedAt: new Date().toISOString() })
  })

  const router = createTestRouter()
  await router.push(path)
  await router.isReady()
  wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return router
}

function openPalette() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
}

async function typeQuery(text: string) {
  const input = document.querySelector('[data-testid="palette-input"]') as HTMLInputElement
  input.value = text
  input.dispatchEvent(new Event('input'))
  await nextTick()
  return input
}

describe('保存状态提示', () => {
  it('没有保存过时不显示文字', async () => {
    await mountApp()
    expect(document.querySelector('[data-testid="save-status"]')?.textContent).toBe('')
  })

  it('保存后显示时间，保存中显示进行中', async () => {
    await mountApp()
    db.saving = true
    await nextTick()
    expect(document.querySelector('[data-testid="save-status"]')?.textContent).toContain('保存中')

    db.saving = false
    db.savedAt = new Date(2026, 10, 13, 9, 5).toISOString()
    await nextTick()
    expect(document.querySelector('[data-testid="save-status"]')?.textContent).toBe('已保存 09:05')
  })
})

describe('导航角标（AC-07）', () => {
  it('今日未完成、待跟进、待发布三处数量正确', async () => {
    const today = todayKey()
    const doc = createEmptyDoc()
    for (let i = 0; i < 5; i++) {
      doc.plans.push({
        id: `p${i}`,
        date: today,
        section: 'am',
        title: `事 ${i}`,
        module: 'plan',
        priority: 0,
        estimateMin: null,
        done: false,
        doneAt: null,
        sourceType: null,
        sourceId: null,
        sortIndex: i,
      })
    }
    for (let i = 0; i < 3; i++) {
      doc.followups.push({
        id: `f${i}`,
        clientId: 'c1',
        title: `跟进 ${i}`,
        dueDate: today,
        status: 'open',
        fromSessionId: null,
        createdAt: '',
      })
    }
    for (let i = 0; i < 2; i++) {
      doc.media.push({
        id: `m${i}`,
        title: `内容 ${i}`,
        platforms: [],
        stage: 'ready',
        publishAt: null,
        publishedAt: null,
        body: '',
        stats: { views: 0, likes: 0, follows: 0, recordedAt: null },
        createdAt: '',
        updatedAt: '',
      })
    }

    await mountApp(doc)

    expect(document.querySelector('[data-testid="nav-today"] .badge')?.textContent).toBe('5')
    expect(document.querySelector('[data-testid="nav-consult"] .badge')?.textContent).toBe('3')
    expect(document.querySelector('[data-testid="nav-media"] .badge')?.textContent).toBe('2')
  })
})

describe('快速备忘快捷键（AC-09）', () => {
  it('⌘J 打开抽屉，保存后首页能读到', async () => {
    await mountApp()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true }))
    await nextTick()

    const textarea = document.querySelector('[data-testid="memo-textarea"]') as HTMLTextAreaElement
    expect(textarea).toBeTruthy()
    textarea.value = '下班前发周报'
    textarea.dispatchEvent(new Event('input'))
    await nextTick()

    ;(document.querySelector('[data-testid="memo-save"]') as HTMLElement).click()
    await flushPromises()

    expect(db.doc.memos).toHaveLength(1)
    expect(db.doc.memos[0].content).toBe('下班前发周报')
  })
})

describe('命令面板搜索与新建', () => {
  it('搜得到任务条目，回车跳到对应模块', async () => {
    const doc = createEmptyDoc()
    doc.tasks.push({
      id: 't1',
      projectId: 'p1',
      title: '写季度复盘报告',
      status: 'doing',
      priority: 1,
      estimateMin: null,
      dueDate: null,
      createdAt: new Date().toISOString(),
    })

    const router = await mountApp(doc)
    openPalette()
    await nextTick()

    const input = await typeQuery('季度')
    const items = document.querySelectorAll('[data-testid^="palette-item-"]')
    expect(items).toHaveLength(1)
    expect(items[0].textContent).toContain('写季度复盘报告')
    expect(items[0].textContent).toContain('任务')

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushPromises()
    await nextTick()

    expect(router.currentRoute.value.path).toBe('/dev')
  })

  it('搜得到客户与内容', async () => {
    const doc = createEmptyDoc()
    doc.clients.push({ id: 'c1', name: '和光科技', contact: '', status: 'active', note: '' })
    doc.media.push({
      id: 'm1',
      title: '小团队的工具链',
      platforms: [],
      stage: 'idea',
      publishAt: null,
      publishedAt: null,
      body: '',
      stats: { views: 0, likes: 0, follows: 0, recordedAt: null },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    await mountApp(doc)
    openPalette()
    await nextTick()

    await typeQuery('和光')
    expect(document.querySelectorAll('[data-testid^="palette-item-"]')).toHaveLength(1)

    await typeQuery('工具链')
    const items = document.querySelectorAll('[data-testid^="palette-item-"]')
    expect(items).toHaveLength(1)
    expect(items[0].textContent).toContain('内容')
  })

  it('新建入口打开快速备忘抽屉', async () => {
    await mountApp()
    openPalette()
    await nextTick()

    const input = await typeQuery('快速备忘')
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushPromises()
    await nextTick()

    expect(ui.drawer?.title).toBe('快速备忘')
    expect(document.querySelector('[data-testid="memo-textarea"]')).toBeTruthy()
  })

  it('方向键可以在结果间移动', async () => {
    await mountApp()
    openPalette()
    await nextTick()

    const input = document.querySelector('[data-testid="palette-input"]') as HTMLInputElement
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    await nextTick()

    expect(document.querySelector('[data-active="true"]')?.getAttribute('data-testid')).toBe('palette-item-1')
  })
})

describe('来源删除的显示', () => {
  it('源实体被删后条目保留，显示「来源已删除」与快照标题', async () => {
    const doc = createEmptyDoc()
    const item: PlanItem = {
      id: 'pl1',
      date: '2026-11-13',
      section: 'am',
      title: '被删掉的任务',
      module: 'dev',
      priority: 0,
      estimateMin: null,
      done: false,
      doneAt: null,
      sourceType: 'task',
      sourceId: 'gone',
      sortIndex: 0,
    }
    doc.plans.push(item)
    db.doc = doc
    db.ready = true

    wrapper = mount(PlanList, { props: { date: '2026-11-13' }, attachTo: document.body })
    await flushPromises()

    expect(wrapper.find('[data-testid="plan-missing"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="plan-title-pl1"]').text()).toBe('被删掉的任务')
  })

  it('源任务还在时显示源里的标题，不显示已删除标记', async () => {
    const doc = createEmptyDoc()
    doc.tasks.push({
      id: 't1',
      projectId: 'p1',
      title: '源里的标题',
      status: 'todo',
      priority: 1,
      estimateMin: null,
      dueDate: null,
      createdAt: new Date().toISOString(),
    })
    doc.plans.push({
      id: 'pl2',
      date: '2026-11-13',
      section: 'am',
      title: '过时的快照',
      module: 'dev',
      priority: 0,
      estimateMin: null,
      done: false,
      doneAt: null,
      sourceType: 'task',
      sourceId: 't1',
      sortIndex: 0,
    })
    db.doc = doc
    db.ready = true

    wrapper = mount(PlanList, { props: { date: '2026-11-13' }, attachTo: document.body })
    await flushPromises()

    expect(wrapper.find('[data-testid="plan-title-pl2"]').text()).toBe('源里的标题')
    expect(wrapper.find('[data-testid="plan-missing"]').exists()).toBe(false)
  })
})

describe('空状态与示例数据', () => {
  it('动作库为空时可以一键填入常用动作', async () => {
    db.doc = createEmptyDoc()
    db.ready = true
    wrapper = mount(Fitness, { attachTo: document.body })
    await flushPromises()

    const empty = wrapper.find('[data-testid="empty-state"]')
    expect(empty.exists()).toBe(true)
    expect(empty.text()).toContain('动作库还是空的')

    await empty.find('button').trigger('click')
    await flushPromises()

    expect(db.doc.exercises).toHaveLength(3)
    expect(db.doc.exercises.map((e) => e.name)).toContain('深蹲')
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })

  it('菜品库为空时可以一键填入家常菜', async () => {
    db.doc = createEmptyDoc()
    db.ready = true
    wrapper = mount(Diet, { attachTo: document.body })
    await flushPromises()

    const empty = wrapper.find('[data-testid="empty-state"]')
    expect(empty.exists()).toBe(true)
    expect(empty.text()).toContain('菜品库还是空的')

    await empty.find('button').trigger('click')
    await flushPromises()

    expect(db.doc.dishes).toHaveLength(3)
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })
})

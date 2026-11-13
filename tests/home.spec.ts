import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import App from '@/App.vue'
import { createTestRouter } from '@/router'
import { db, resetDbForTests } from '@/store/db'
import { ui } from '@/store/ui'
import { createEmptyDoc, type DeskDoc } from '@/types'
import { todayKey } from '@/lib/date'
import { addPlanItem } from '@/features/plan/planLogic'

const TODAY = todayKey()

let wrapper: VueWrapper | null = null

function ok(body: unknown, status = 200) {
  return { ok: status < 300, status, json: async () => body } as unknown as Response
}

async function mountApp(doc: DeskDoc, path = '/') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init || (init.method || 'GET') === 'GET') return ok({ ok: true, doc, savedAt: null })
      return ok({ ok: true, savedAt: new Date().toISOString() })
    }),
  )
  const router = createTestRouter()
  await router.push(path)
  await router.isReady()
  wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return { router, wrapper }
}

beforeEach(() => {
  resetDbForTests()
  ui.drawer = null
  ui.paletteOpen = false
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllGlobals()
})

describe('首页', () => {
  it('显示今日计划条目与备忘', async () => {
    const doc = createEmptyDoc()
    addPlanItem(doc, { date: TODAY, section: 'am', title: '改完登录接口' })
    doc.memos.push({ id: 'm1', content: '封面配色参考那篇', createdAt: new Date().toISOString(), archived: false })

    await mountApp(doc)

    const text = document.body.textContent || ''
    expect(text).toContain('改完登录接口')
    expect(text).toContain('封面配色参考那篇')
    expect(text).toContain('今日计划')
  })

  it('输入备忘回车后写入数据并出现在列表', async () => {
    await mountApp(createEmptyDoc())

    const input = document.querySelector('[data-testid="memo-input"]') as HTMLInputElement
    input.value = '问下老张半马'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushPromises()

    expect(db.doc.memos).toHaveLength(1)
    expect(db.doc.memos[0].content).toBe('问下老张半马')
    expect(document.body.textContent).toContain('问下老张半马')
  })

  it('摘要卡显示各模块数字，点击可跳转', async () => {
    const doc = createEmptyDoc()
    doc.projects.push({ id: 'p1', name: '工作台', status: 'active', repoUrl: '', note: '', createdAt: '' })
    doc.bugs.push({ id: 'b1', projectId: 'p1', title: '崩溃', severity: 'major', status: 'open', note: '', createdAt: '' })
    doc.media.push({
      id: 'm1',
      title: '第 3 期',
      platforms: [],
      stage: 'ready',
      publishAt: null,
      publishedAt: null,
      body: '',
      stats: { views: 0, likes: 0, follows: 0, recordedAt: null },
      createdAt: '',
      updatedAt: '',
    })

    const { router } = await mountApp(doc)

    const devCard = document.querySelector('[data-testid="summary-dev"]') as HTMLElement
    expect(devCard.textContent).toContain('1 个项目在跑')
    expect(devCard.textContent).toContain('1 个 bug 未解')

    const mediaCard = document.querySelector('[data-testid="summary-media"]') as HTMLElement
    expect(mediaCard.textContent).toContain('1 篇待发布')

    mediaCard.click()
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/media')
  })

  it('咨询摘要卡跳到跟进页签', async () => {
    const { router } = await mountApp(createEmptyDoc())
    const card = document.querySelector('[data-testid="summary-consult"]') as HTMLElement
    card.click()
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/consult')
    expect(router.currentRoute.value.query.tab).toBe('followups')
  })
})

describe('快速备忘快捷键', () => {
  it('⌘J 在任意页面打开备忘抽屉', async () => {
    await mountApp(createEmptyDoc(), '/dev')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true }))
    await flushPromises()

    expect(ui.drawer?.title).toBe('快速备忘')
    expect(document.querySelector('[data-testid="memo-textarea"]')).toBeTruthy()
  })

  it('在抽屉里保存后写入备忘并关闭抽屉', async () => {
    await mountApp(createEmptyDoc(), '/dev')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true }))
    await flushPromises()

    const area = document.querySelector('[data-testid="memo-textarea"]') as HTMLTextAreaElement
    area.value = '抽屉里写的备忘'
    area.dispatchEvent(new Event('input'))
    await flushPromises()
    ;(document.querySelector('[data-testid="memo-save"]') as HTMLElement).click()
    await flushPromises()

    expect(db.doc.memos[0].content).toBe('抽屉里写的备忘')
    expect(ui.drawer).toBeNull()
  })
})

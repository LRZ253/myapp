import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import App from '@/App.vue'
import { createTestRouter } from '@/router'
import { db, resetDbForTests } from '@/store/db'
import { ui, openDrawer } from '@/store/ui'
import { createEmptyDoc } from '@/types'

const Dummy = defineComponent({
  render: () => h('div', { 'data-testid': 'drawer-content' }, '抽屉内容'),
})

let wrapper: VueWrapper | null = null
let fetchMock: ReturnType<typeof vi.fn>

function jsonOk(body: unknown, status = 200) {
  return { ok: status < 300, status, json: async () => body } as unknown as Response
}

async function mountApp() {
  const router = createTestRouter()
  await router.push('/')
  await router.isReady()
  wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return { router }
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

describe('导航结构', () => {
  it('侧边栏渲染九个入口', async () => {
    await mountApp()
    const items = document.querySelectorAll('[data-testid^="nav-"]')
    expect(items).toHaveLength(9)
    expect(document.body.textContent).toContain('数据与设置')
  })

  it('点击导航会切换路由并渲染对应页面', async () => {
    const { router } = await mountApp()
    const link = document.querySelector('[data-testid="nav-media"]') as HTMLElement
    link.click()
    await flushPromises()
    await nextTick()

    expect(router.currentRoute.value.path).toBe('/media')
    expect(document.querySelector('[data-testid="page-media"]')).toBeTruthy()
  })

  it('当前页导航项带 active 标记，切页后跟随移动', async () => {
    const { router } = await mountApp()
    expect(document.querySelector('[data-testid="nav-home"]')?.className).toContain('active')

    await router.push('/consult')
    await flushPromises()
    await nextTick()

    expect(document.querySelector('[data-testid="nav-consult"]')?.className).toContain('active')
    expect(document.querySelector('[data-testid="nav-home"]')?.className).not.toContain('active')
  })
})

describe('主题', () => {
  it('切换深色后写到设置并更新根元素属性', async () => {
    await mountApp()
    const btn = document.querySelector('[data-testid="theme-toggle"]') as HTMLElement
    btn.click()
    await flushPromises()

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(db.doc.settings.theme).toBe('dark')
    expect(btn.textContent).toContain('浅色')
  })

  it('载入时按设置应用主题', async () => {
    const doc = createEmptyDoc()
    doc.settings.theme = 'dark'
    fetchMock.mockResolvedValueOnce(jsonOk({ ok: true, doc, savedAt: null }))

    await mountApp()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})

describe('抽屉', () => {
  it('打开后按 Esc 关闭', async () => {
    await mountApp()
    openDrawer({ title: '测试抽屉', component: Dummy })
    await nextTick()

    expect(document.querySelector('[data-testid="drawer-content"]')).toBeTruthy()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(ui.drawer).toBeNull()
    expect(document.querySelector('[data-testid="drawer-content"]')).toBeNull()
  })

  it('点击抽屉外部遮罩关闭', async () => {
    await mountApp()
    openDrawer({ title: '测试抽屉', component: Dummy })
    await nextTick()

    const mask = document.querySelector('[data-testid="drawer-mask"]') as HTMLElement
    mask.dispatchEvent(new Event('click'))
    await nextTick()

    expect(ui.drawer).toBeNull()
  })

  it('抽屉打开时外壳让出宽度', async () => {
    await mountApp()
    openDrawer({ title: '测试抽屉', component: Dummy })
    await nextTick()

    expect(document.querySelector('.shell')?.className).toContain('drawer-open')
  })
})

describe('命令面板', () => {
  it('⌘K 打开，输入过滤后回车跳转', async () => {
    const { router } = await mountApp()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    await nextTick()
    expect(document.querySelector('[data-testid="palette"]')).toBeTruthy()

    const input = document.querySelector('[data-testid="palette-input"]') as HTMLInputElement
    input.value = '健身'
    input.dispatchEvent(new Event('input'))
    await nextTick()

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushPromises()
    await nextTick()

    expect(router.currentRoute.value.path).toBe('/fitness')
    expect(document.querySelector('[data-testid="palette"]')).toBeNull()
  })

  it('没有匹配项时显示提示', async () => {
    await mountApp()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    await nextTick()

    const input = document.querySelector('[data-testid="palette-input"]') as HTMLInputElement
    input.value = 'zzzz'
    input.dispatchEvent(new Event('input'))
    await nextTick()

    expect(document.body.textContent).toContain('没有匹配项')
  })
})

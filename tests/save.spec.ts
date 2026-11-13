import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from '@/App.vue'
import { createTestRouter } from '@/router'
import { db, patch, resetDbForTests, SAVE_DEBOUNCE_MS } from '@/store/db'
import { createEmptyDoc } from '@/types'

let wrapper: VueWrapper | null = null
let fetchMock: ReturnType<typeof vi.fn>
let failSave = false

function jsonOk(body: unknown, status = 200) {
  return { ok: status < 300, status, json: async () => body } as unknown as Response
}

beforeEach(() => {
  resetDbForTests()
  failSave = false
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init || (init.method || 'GET') === 'GET') {
      return jsonOk({ ok: true, doc: createEmptyDoc(), savedAt: null })
    }
    if (failSave) return jsonOk({ ok: false, message: '磁盘满了' }, 500)
    return jsonOk({ ok: true, savedAt: new Date(2026, 10, 13, 16, 30).toISOString() })
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllGlobals()
})

async function mountApp() {
  const router = createTestRouter()
  await router.push('/')
  await router.isReady()
  wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

function putCalls() {
  return fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
}

describe('手动保存', () => {
  it('顶栏有常驻的保存按钮', async () => {
    const w = await mountApp()
    const btn = w.find('[data-testid="save-now"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('保存')
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('改动后标记为未保存，点保存立即落盘', async () => {
    const w = await mountApp()
    expect(db.dirty).toBe(false)

    patch((doc) => {
      doc.memos.push({
        id: 'm1',
        content: '记一条',
        createdAt: new Date().toISOString(),
        archived: false,
      })
    })
    await nextTick()

    expect(db.dirty).toBe(true)
    expect(w.find('[data-testid="save-status"]').text()).toBe('未保存改动')

    const before = putCalls().length
    await w.find('[data-testid="save-now"]').trigger('click')
    await flushPromises()

    expect(putCalls().length).toBe(before + 1)
    expect(db.dirty).toBe(false)
    expect(db.saving).toBe(false)
    expect(db.savedAt).toBeTruthy()
    expect(w.find('[data-testid="save-status"]').text()).toContain('已保存')
  })

  it('点保存会取消等待中的防抖，不会连发两次请求', async () => {
    const w = await mountApp()
    const before = putCalls().length

    patch((doc) => {
      doc.memos.push({ id: 'm2', content: '再记一条', createdAt: '', archived: false })
    })
    // 还在防抖窗口内就点保存
    await w.find('[data-testid="save-now"]').trigger('click')
    await flushPromises()

    expect(putCalls().length).toBe(before + 1)

    // 等过防抖时间，不应再补发一次
    await new Promise((r) => setTimeout(r, SAVE_DEBOUNCE_MS + 120))
    expect(putCalls().length).toBe(before + 1)
  })

  it('⌘S / Ctrl+S 也能触发保存', async () => {
    await mountApp()
    const before = putCalls().length

    patch((doc) => {
      doc.memos.push({ id: 'm3', content: '快捷键', createdAt: '', archived: false })
    })

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true }))
    await flushPromises()

    expect(putCalls().length).toBe(before + 1)
    expect(db.dirty).toBe(false)
  })

  it('保存失败时状态显示保存失败，dirty 保留', async () => {
    const w = await mountApp()
    failSave = true

    patch((doc) => {
      doc.memos.push({ id: 'm4', content: '会失败', createdAt: '', archived: false })
    })
    await w.find('[data-testid="save-now"]').trigger('click')
    await flushPromises()

    expect(db.error?.code).toBe('SAVE')
    expect(w.find('[data-testid="save-status"]').text()).toBe('保存失败')
    expect(db.dirty).toBe(true)
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import Settings from '@/views/Settings.vue'
import App from '@/App.vue'
import { createTestRouter } from '@/router'
import { db, resetDbForTests } from '@/store/db'
import { ui } from '@/store/ui'
import { EXPORT_URL } from '@/lib/api'
import { createEmptyDoc, type DeskDoc, type Memo } from '@/types'
import {
  COUNT_LABELS,
  countRows,
  docSizeBytes,
  formatBytes,
  formatPlatforms,
  parseImport,
  parsePlatforms,
  totalEntries,
  updateSettings,
} from '@/features/settings/settingsLogic'

function memo(id: string, content: string): Memo {
  return { id, content, createdAt: new Date().toISOString(), archived: false }
}

function jsonOk(body: unknown, status = 200) {
  return { ok: status < 300, status, json: async () => body } as unknown as Response
}

let wrapper: VueWrapper | null = null
let fetchMock: ReturnType<typeof vi.fn>
let backups: { file: string; size: number; mtime: string }[]
let backupDoc: DeskDoc
let lastImport: DeskDoc | null
let resetCalled: boolean

beforeEach(() => {
  resetDbForTests()
  ui.toastVisible = false
  backups = []
  backupDoc = createEmptyDoc()
  lastImport = null
  resetCalled = false

  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method || 'GET').toUpperCase()
    if (url === '/api/backups' && method === 'GET') return jsonOk({ ok: true, items: backups })
    if (url === '/api/backups/restore' && method === 'POST') {
      return jsonOk({ ok: true, doc: backupDoc, savedAt: new Date().toISOString() })
    }
    if (url === '/api/import' && method === 'POST') {
      lastImport = JSON.parse(String(init?.body)).doc as DeskDoc
      return jsonOk({ ok: true, counts: {}, savedAt: new Date().toISOString() })
    }
    if (url === '/api/reset' && method === 'POST') {
      resetCalled = true
      return jsonOk({ ok: true, doc: createEmptyDoc(), savedAt: new Date().toISOString() })
    }
    if (url === '/api/data' && method === 'PUT') {
      return jsonOk({ ok: true, savedAt: new Date().toISOString() })
    }
    return jsonOk({ ok: true })
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllGlobals()
})

function setDoc(doc: DeskDoc) {
  db.doc = doc
  db.ready = true
  db.savedAt = new Date().toISOString()
}

async function mountSettings(doc: DeskDoc) {
  setDoc(doc)
  wrapper = mount(Settings, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

function calledTimes(url: string, method = 'POST') {
  return fetchMock.mock.calls.filter(
    ([u, init]) => u === url && ((init as RequestInit | undefined)?.method || 'GET').toUpperCase() === method,
  ).length
}

describe('数据统计', () => {
  it('总览覆盖全部模块，条目数取自数据文件', () => {
    const doc = createEmptyDoc()
    doc.memos.push(memo('m1', '买菜'), memo('m2', '取快递'))
    doc.games.push({ id: 'g1', title: '只狼', platform: '', status: 'playing', rating: 0, progress: 20, note: '' })

    const rows = countRows(doc)
    expect(rows).toHaveLength(Object.keys(COUNT_LABELS).length)
    expect(rows.map((r) => r.label)).toContain('快速备忘')

    const byKey = new Map(rows.map((r) => [r.key, r.count]))
    expect(byKey.get('memos')).toBe(2)
    expect(byKey.get('games')).toBe(1)
    expect(byKey.get('tasks')).toBe(0)
    expect(totalEntries(doc)).toBe(3)
  })

  it('文件大小按两空格缩进的 JSON 估算', () => {
    const doc = createEmptyDoc()
    const base = docSizeBytes(doc)
    expect(base).toBeGreaterThan(0)

    doc.memos.push(memo('m1', '一条比较长的备忘内容，用来观察字节数变化'))
    expect(docSizeBytes(doc)).toBeGreaterThan(base)
  })

  it('字节展示分档', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(1024 * 1024 * 3)).toBe('3.0 MB')
  })
})

describe('导入校验', () => {
  it('空文件不通过', () => {
    const result = parseImport('   ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('空')
  })

  it('不是 JSON 不通过', () => {
    const result = parseImport('{ 这不是 json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('JSON')
  })

  it('缺 schemaVersion 不通过', () => {
    const result = parseImport(JSON.stringify({ settings: {}, runtime: {} }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('schemaVersion')
  })

  it('版本高于本程序不支持', () => {
    const doc = createEmptyDoc()
    const result = parseImport(JSON.stringify({ ...doc, schemaVersion: 99 }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('版本')
  })

  it('合法文件给出覆盖条数与只含非空的清单', () => {
    const doc = createEmptyDoc()
    doc.memos.push(memo('m1', 'a'), memo('m2', 'b'))
    doc.tasks.push({
      id: 't1',
      projectId: 'p1',
      title: '写文档',
      status: 'todo',
      priority: 1,
      estimateMin: null,
      dueDate: null,
      createdAt: new Date().toISOString(),
    })

    const result = parseImport(JSON.stringify(doc))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.preview.total).toBe(3)
    expect(result.preview.rows.map((r) => r.key).sort()).toEqual(['memos', 'tasks'])
  })
})

describe('偏好设置工具', () => {
  it('平台列表支持顿号、逗号、空格分隔', () => {
    expect(parsePlatforms('视频号、B站, 小红书  公众号')).toEqual(['视频号', 'B站', '小红书', '公众号'])
    expect(parsePlatforms(' , 、 ')).toEqual([])
    expect(formatPlatforms(['B站', '小红书'])).toBe('B站、小红书')
  })

  it('改设置只覆盖传入的字段', () => {
    const doc = createEmptyDoc()
    doc.settings.theme = 'dark'
    updateSettings(doc, { userName: '老王', weekStart: 7 })
    expect(doc.settings.theme).toBe('dark')
    expect(doc.settings.userName).toBe('老王')
    expect(doc.settings.weekStart).toBe(7)
  })
})

describe('设置页面', () => {
  it('总览显示每个模块的条目数', async () => {
    const doc = createEmptyDoc()
    doc.memos.push(memo('m1', 'a'), memo('m2', 'b'))
    const w = await mountSettings(doc)

    expect(w.find('[data-testid="data-overview"]').exists()).toBe(true)
    expect(w.find('[data-testid="count-memos"]').text()).toBe('2')
    expect(w.find('[data-testid="count-tasks"]').text()).toBe('0')
    expect(w.text()).toContain('共 2 条')
  })

  it('导出入口指向本地导出接口', async () => {
    const w = await mountSettings(createEmptyDoc())
    const link = w.find('[data-testid="data-export"]')
    expect(link.attributes('href')).toBe(EXPORT_URL)
    expect(EXPORT_URL).toBe('/api/export')
  })

  it('导入合法文件先预览再确认，确认后替换数据', async () => {
    const current = createEmptyDoc()
    current.memos.push(memo('old', '旧数据'))
    const w = await mountSettings(current)

    const incoming = createEmptyDoc()
    incoming.memos.push(memo('n1', '新数据一'), memo('n2', '新数据二'))

    const file = new File([JSON.stringify(incoming)], 'desk.json', { type: 'application/json' })
    const input = w.find('[data-testid="data-import-file"]')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()

    expect(w.find('[data-testid="import-preview"]').exists()).toBe(true)
    expect(w.find('[data-testid="import-total"]').text()).toBe('2')
    expect(calledTimes('/api/import')).toBe(0)

    await w.find('[data-testid="import-confirm"]').trigger('click')
    await flushPromises()

    expect(calledTimes('/api/import')).toBe(1)
    expect(lastImport?.memos).toHaveLength(2)
    expect(db.doc.memos.map((m) => m.content)).toEqual(['新数据一', '新数据二'])
    expect(w.find('[data-testid="import-preview"]').exists()).toBe(false)
  })

  it('导入非法文件只提示错误，不动数据', async () => {
    const current = createEmptyDoc()
    current.memos.push(memo('old', '旧数据'))
    const w = await mountSettings(current)

    const file = new File(['{"hello":1}'], 'bad.json', { type: 'application/json' })
    const input = w.find('[data-testid="data-import-file"]')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()

    expect(w.find('[data-testid="import-error"]').exists()).toBe(true)
    expect(w.find('[data-testid="import-preview"]').exists()).toBe(false)
    expect(db.doc.memos[0].content).toBe('旧数据')
  })

  it('备份列表可刷新，恢复要点两次确认', async () => {
    backups = [{ file: 'app-20261112.json', size: 4096, mtime: new Date().toISOString() }]
    const restored = createEmptyDoc()
    restored.memos.push(memo('r1', '来自备份'))
    backupDoc = restored

    const w = await mountSettings(createEmptyDoc())
    await flushPromises()

    const rows = w.findAll('[data-testid="backup-item"]')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('2026-11-12')

    const button = w.find('[data-testid="backup-restore-app-20261112.json"]')
    await button.trigger('click')
    expect(calledTimes('/api/backups/restore')).toBe(0)
    expect(button.text()).toContain('确认恢复')

    await button.trigger('click')
    await flushPromises()

    expect(calledTimes('/api/backups/restore')).toBe(1)
    expect(db.doc.memos.map((m) => m.content)).toEqual(['来自备份'])
  })

  it('没有备份时给出说明', async () => {
    const w = await mountSettings(createEmptyDoc())
    expect(w.find('[data-testid="backup-empty"]').exists()).toBe(true)
  })

  it('改称呼、周起始日、平台、时薪都会写进设置', async () => {
    const w = await mountSettings(createEmptyDoc())

    const name = w.find('[data-testid="prefs-name"]')
    ;(name.element as HTMLInputElement).value = '老王'
    await name.trigger('change')

    await w.find('[data-testid="prefs-week-start"]').setValue('7')

    const platforms = w.find('[data-testid="prefs-platforms"]')
    await platforms.setValue('视频号、B站、小红书')
    await platforms.trigger('change')

    const rate = w.find('[data-testid="prefs-rate"]')
    ;(rate.element as HTMLInputElement).value = '300'
    await rate.trigger('change')
    await flushPromises()

    expect(db.doc.settings.userName).toBe('老王')
    expect(db.doc.settings.weekStart).toBe(7)
    expect(db.doc.settings.platforms).toEqual(['视频号', 'B站', '小红书'])
    expect(db.doc.settings.defaultHourlyRate).toBe(300)
  })

  it('点分段控件切深色', async () => {
    const w = await mountSettings(createEmptyDoc())
    await w.find('[data-testid="seg-dark"]').trigger('click')
    await flushPromises()

    expect(db.doc.settings.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('清空必须输入确认词，确认后清空数据', async () => {
    const doc = createEmptyDoc()
    doc.memos.push(memo('m1', '留着看看'))
    const w = await mountSettings(doc)

    const button = w.find('[data-testid="reset-button"]')
    expect(button.attributes('disabled')).toBeDefined()

    await w.find('[data-testid="reset-confirm-input"]').setValue('清空')
    expect(w.find('[data-testid="reset-button"]').attributes('disabled')).toBeUndefined()

    await w.find('[data-testid="reset-button"]').trigger('click')
    await flushPromises()

    expect(resetCalled).toBe(true)
    expect(db.doc.memos).toHaveLength(0)
  })
})

describe('损坏态页面', () => {
  it('显示错误说明与备份，并可从备份恢复', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = (init?.method || 'GET').toUpperCase()
      if (url === '/api/data' && method === 'GET') {
        return jsonOk(
          {
            ok: false,
            code: 'CORRUPT',
            message: 'Unexpected token } in JSON',
            backups: [{ file: 'app-20261111.json', size: 2048, mtime: new Date().toISOString() }],
          },
          409,
        )
      }
      if (url === '/api/backups/restore') return jsonOk({ ok: true, doc: createEmptyDoc(), savedAt: null })
      return jsonOk({ ok: true })
    })

    const router = createTestRouter()
    await router.push('/settings')
    await router.isReady()
    wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    await nextTick()

    expect(document.querySelector('[data-testid="corrupt-screen"]')).toBeTruthy()
    expect(document.body.textContent).toContain('数据文件无法解析')
    expect(document.body.textContent).toContain('app-20261111.json')

    const restore = document.querySelector('[data-testid="corrupt-restore-app-20261111.json"]') as HTMLElement
    expect(restore).toBeTruthy()
    restore.click()
    await flushPromises()

    expect(calledTimes('/api/backups/restore')).toBe(1)
  })
})

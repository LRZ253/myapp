import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db, loadDoc, patch, flush, resetDbForTests } from '@/store/db'
import { createEmptyDoc } from '@/types'

function ok(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
}

const sampleDoc = () => {
  const doc = createEmptyDoc()
  doc.plans.push({
    id: 'p1',
    date: '2026-11-13',
    section: 'am',
    title: '写测试',
    module: 'plan',
    priority: 0,
    estimateMin: null,
    done: false,
    doneAt: null,
    sourceType: null,
    sourceId: null,
    sortIndex: 0,
  })
  return doc
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  resetDbForTests()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('载入数据', () => {
  it('成功载入后 ready 为真且数据到位', async () => {
    fetchMock.mockResolvedValue(ok({ ok: true, doc: sampleDoc(), savedAt: '2026-11-13T00:00:00.000Z' }))

    const result = await loadDoc()

    expect(result).toBe(true)
    expect(db.ready).toBe(true)
    expect(db.doc.plans).toHaveLength(1)
    expect(db.savedAt).toBe('2026-11-13T00:00:00.000Z')
    expect(db.error).toBeNull()
  })

  it('文件损坏时记录 CORRUPT 错误并保留备份列表', async () => {
    fetchMock.mockResolvedValue(
      ok({ ok: false, code: 'CORRUPT', message: '无法解析', backups: [{ file: 'app-20261113.json', size: 10, mtime: '' }] }, 409),
    )

    const result = await loadDoc()

    expect(result).toBe(false)
    expect(db.ready).toBe(false)
    expect(db.error?.code).toBe('CORRUPT')
    expect(db.error?.backups).toHaveLength(1)
  })

  it('连不上服务时记录 NETWORK 错误', async () => {
    fetchMock.mockRejectedValue(new Error('Failed to fetch'))

    const result = await loadDoc()

    expect(result).toBe(false)
    expect(db.error?.code).toBe('NETWORK')
  })
})

describe('保存数据', () => {
  it('patch 后 flush 会把整份数据 PUT 到服务端', async () => {
    fetchMock.mockResolvedValueOnce(ok({ ok: true, doc: sampleDoc(), savedAt: null }))
    await loadDoc()

    fetchMock.mockResolvedValueOnce(ok({ ok: true, savedAt: '2026-11-13T01:02:03.000Z' }))
    patch((doc) => {
      doc.memos.push({ id: 'm1', content: '随手记', createdAt: '2026-11-13T01:00:00.000Z', archived: false })
    })
    await flush()

    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
    expect(url).toBe('/api/data')
    expect(init.method).toBe('PUT')
    const payload = JSON.parse(String(init.body))
    expect(payload.doc.memos).toHaveLength(1)
    expect(db.savedAt).toBe('2026-11-13T01:02:03.000Z')
    expect(db.saving).toBe(false)
  })

  it('连续多次 patch 只触发一次保存（300ms 防抖）', async () => {
    fetchMock.mockResolvedValueOnce(ok({ ok: true, doc: createEmptyDoc(), savedAt: null }))
    await loadDoc()
    fetchMock.mockClear()

    fetchMock.mockResolvedValue(ok({ ok: true, savedAt: new Date().toISOString() }))
    vi.useFakeTimers()

    patch((doc) => doc.memos.push({ id: 'a', content: 'A', createdAt: '', archived: false }))
    patch((doc) => doc.memos.push({ id: 'b', content: 'B', createdAt: '', archived: false }))
    patch((doc) => doc.memos.push({ id: 'c', content: 'C', createdAt: '', archived: false }))

    expect(fetchMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(320)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(payload.doc.memos).toHaveLength(3)
  })

  it('保存失败时留下错误且不卡住 saving 状态', async () => {
    fetchMock.mockResolvedValueOnce(ok({ ok: true, doc: createEmptyDoc(), savedAt: null }))
    await loadDoc()

    fetchMock.mockResolvedValueOnce(ok({ ok: false, message: '磁盘写入失败' }, 500))
    patch((doc) => doc.memos.push({ id: 'x', content: 'X', createdAt: '', archived: false }))
    await flush()

    expect(db.error?.code).toBe('SAVE')
    expect(db.error?.message).toContain('磁盘写入失败')
    expect(db.saving).toBe(false)
  })

  it('未就绪时 flush 不发请求', async () => {
    await flush()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

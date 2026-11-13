// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Server } from 'node:http'
import { createAppServer } from '../server/index.mjs'
import { createStore } from '../server/store.mjs'
import { createApiHandler } from '../server/api.mjs'
import { createEmptyDoc } from '../shared/schema.mjs'

let dir = ''
let dataDir = ''
let dataFile = ''
let server: Server
let base = ''
let exported = ''

function postJson(body: unknown) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  } satisfies RequestInit
}

async function api(pathname: string, init?: RequestInit) {
  const res = await fetch(`${base}${pathname}`, init)
  const body = await res.json().catch(() => null)
  return { res, body }
}

function putDoc(doc: unknown) {
  return api('/api/data', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ doc }),
  })
}

function docWithMemo(content: string) {
  const doc = createEmptyDoc()
  doc.memos.push({ id: 'memo_1', content, createdAt: new Date().toISOString(), archived: false })
  return doc
}

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'desk-e2e-'))
  mkdirSync(path.join(dir, 'dist'), { recursive: true })
  writeFileSync(path.join(dir, 'dist', 'index.html'), '<!doctype html><title>工作台</title>')
  dataDir = path.join(dir, 'data')
  dataFile = path.join(dataDir, 'app-data.json')

  const store = createStore(dataDir)
  server = createAppServer({ root: dir, handleApi: createApiHandler(store) }) as Server
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const addr = server.address()
  if (!addr || typeof addr === 'string') throw new Error('未取得端口')
  base = `http://127.0.0.1:${addr.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  rmSync(dir, { recursive: true, force: true })
})

describe('数据往返（AC-34）', () => {
  it('首次打开自动建立数据文件', async () => {
    const { res, body } = await api('/api/data')
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.doc.memos).toEqual([])
    expect(existsSync(dataFile)).toBe(true)
  })

  it('保存后写入磁盘，再读能拿到', async () => {
    const { res, body } = await putDoc(docWithMemo('第一条真实数据'))
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)

    const again = await api('/api/data')
    expect(again.body.doc.memos[0].content).toBe('第一条真实数据')

    const onDisk = JSON.parse(readFileSync(dataFile, 'utf8'))
    expect(onDisk.memos[0].content).toBe('第一条真实数据')
  })

  it('第二次写入前会生成当日备份', async () => {
    await putDoc(docWithMemo('第二条'))
    const { body } = await api('/api/backups')
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items.length).toBeGreaterThanOrEqual(1)
    expect(body.items[0].file).toMatch(/^app-\d{8}\.json$/)
    expect(body.items[0].size).toBeGreaterThan(0)
  })

  it('导出拿到完整 JSON 并带下载文件名', async () => {
    const res = await fetch(`${base}/api/export`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(res.headers.get('content-disposition')).toContain('attachment')

    exported = await res.text()
    const doc = JSON.parse(exported)
    expect(doc.schemaVersion).toBe(1)
    expect(doc.memos[0].content).toBe('第二条')
  })

  it('非法文件导入被拒绝，原数据不动', async () => {
    const { res } = await api('/api/import', postJson({ doc: { schemaVersion: 1 } }))
    expect(res.status).toBe(400)

    const now = await api('/api/data')
    expect(now.body.doc.memos[0].content).toBe('第二条')
  })

  it('清空需要确认词', async () => {
    const bad = await api('/api/reset', postJson({ confirm: '删掉' }))
    expect(bad.res.status).toBe(400)
    expect((await api('/api/data')).body.doc.memos).toHaveLength(1)

    const ok = await api('/api/reset', postJson({ confirm: '清空' }))
    expect(ok.res.status).toBe(200)
    expect(ok.body.doc.memos).toHaveLength(0)

    // 清空前自动留了一份
    const archives = readdirSync(dataDir).filter((f) => f.startsWith('app-data.pre-reset-'))
    expect(archives.length).toBe(1)
  })

  it('导出 → 清空 → 导入能完整还原', async () => {
    const { res, body } = await api('/api/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: exported,
    })
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)

    const now = await api('/api/data')
    expect(now.body.doc.memos[0].content).toBe('第二条')
  })

  it('重启后数据仍在', async () => {
    const fresh = createStore(dataDir)
    const loaded = fresh.load()
    expect(loaded.ok).toBe(true)
    expect(loaded.doc.memos[0].content).toBe('第二条')
  })

  it('可以从当日备份恢复', async () => {
    const list = await api('/api/backups')
    const file = list.body.items[0].file

    const { res, body } = await api('/api/backups/restore', postJson({ file }))
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)

    const now = await api('/api/data')
    expect(now.body.doc.memos).toHaveLength(0)
  })
})

describe('损坏保护（AC-38）', () => {
  it('文件被改坏后拒绝读取，进入只读保护', async () => {
    writeFileSync(dataFile, '{ 这不是合法 JSON', 'utf8')

    const { res, body } = await api('/api/data')
    expect(res.status).toBe(409)
    expect(body.code).toBe('CORRUPT')
    expect(Array.isArray(body.backups)).toBe(true)
  })

  it('只读状态下拒绝写入，不会覆盖原文件', async () => {
    const broken = readFileSync(dataFile, 'utf8')

    const { res, body } = await putDoc(docWithMemo('不该写进去'))
    expect(res.status).toBe(409)
    expect(body.ok).toBe(false)
    expect(readFileSync(dataFile, 'utf8')).toBe(broken)
  })

  it('以空白数据重建后恢复可用，坏文件被存档', async () => {
    const { res, body } = await api('/api/rebuild', postJson({ confirm: true }))
    expect(res.status).toBe(200)
    expect(body.doc.memos).toHaveLength(0)

    const archived = readdirSync(dataDir).filter((f) => f.startsWith('app-data.corrupt-'))
    expect(archived.length).toBe(1)

    const after = await api('/api/data')
    expect(after.res.status).toBe(200)
    expect(after.body.doc.memos).toHaveLength(0)
  })
})

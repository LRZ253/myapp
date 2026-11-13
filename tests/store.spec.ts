// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createStore, dayKey, pruneBackups, listBackups } from '../server/store.mjs'
import { createEmptyDoc } from '../shared/schema.mjs'

let dir = ''
let store: ReturnType<typeof createStore>

function planItem(title: string) {
  return {
    id: `p_${title}`,
    date: '2026-11-13',
    section: 'am',
    title,
    module: 'plan',
    priority: 0,
    estimateMin: null,
    done: false,
    doneAt: null,
    sourceType: null,
    sourceId: null,
    sortIndex: 0,
  }
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'desk-p1-'))
  store = createStore(dir)
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('数据文件与原子写入', () => {
  it('首次读取自动创建数据文件，版本号为 1', () => {
    const result = store.load()
    expect(result.ok).toBe(true)
    expect(existsSync(path.join(dir, 'app-data.json'))).toBe(true)
    expect(result.doc.schemaVersion).toBe(1)
  })

  it('写入后重新读取内容一致', () => {
    store.load()
    const doc = createEmptyDoc()
    doc.plans.push(planItem('写测试'))
    store.write(doc)

    const reopened = createStore(dir).load()
    expect(reopened.ok).toBe(true)
    expect(reopened.doc.plans).toHaveLength(1)
    expect(reopened.doc.plans[0].title).toBe('写测试')
  })

  it('写入完成后不残留临时文件', () => {
    store.load()
    const doc = createEmptyDoc()
    store.write(doc)
    expect(existsSync(path.join(dir, 'app-data.json.tmp'))).toBe(false)
  })

  it('写入前保留上一版 .bak', () => {
    store.load()
    const first = createEmptyDoc()
    first.plans.push(planItem('第一版'))
    store.write(first)

    const second = createEmptyDoc()
    second.plans.push(planItem('第二版'))
    store.write(second)

    const bak = JSON.parse(readFileSync(path.join(dir, 'app-data.json.bak'), 'utf8'))
    expect(bak.plans[0].title).toBe('第一版')
  })

  it('拒绝结构非法的文档，不写坏现有文件', () => {
    store.load()
    const good = createEmptyDoc()
    good.plans.push(planItem('保留我'))
    store.write(good)

    const bad = { schemaVersion: 1, settings: {}, runtime: {} } as Record<string, unknown>
    expect(() => store.write(bad)).toThrow(/数据结构不合法/)
    const after = JSON.parse(readFileSync(path.join(dir, 'app-data.json'), 'utf8'))
    expect(after.plans).toHaveLength(1)
  })
})

describe('每日备份', () => {
  it('当天首次写入会生成当日备份', () => {
    store.load()
    const doc = createEmptyDoc()
    store.write(doc)

    const dirBackups = path.join(dir, 'backups')
    const expected = `app-${dayKey()}.json`
    expect(readdirSync(dirBackups)).toContain(expected)
  })

  it('同一天多次写入只保留一份当日备份', () => {
    store.load()
    for (let i = 0; i < 4; i++) {
      const doc = createEmptyDoc()
      doc.plans.push(planItem(`第${i}次`))
      store.write(doc)
    }
    const files = readdirSync(path.join(dir, 'backups')).filter((f) => f === `app-${dayKey()}.json`)
    expect(files).toHaveLength(1)
  })

  it('备份超过 14 份时清理最旧的，只保留最近 14 份', () => {
    const backupDir = path.join(dir, 'backups')
    mkdirSync(backupDir, { recursive: true })
    for (let i = 1; i <= 18; i++) {
      const name = `app-202601${String(i).padStart(2, '0')}.json`
      writeFileSync(path.join(backupDir, name), '{}')
    }
    const removed = pruneBackups(backupDir, 14)
    expect(removed).toHaveLength(4)
    const left = listBackups(backupDir)
    expect(left).toHaveLength(14)
    expect(left.map((i) => i.file)).not.toContain('app-20260101.json')
  })
})

describe('损坏保护', () => {
  it('文件损坏时进入只读保护态，并拒绝写入', () => {
    writeFileSync(path.join(dir, 'app-data.json'), '{ 这不是 JSON')

    const result = store.load()
    expect(result.ok).toBe(false)
    expect(result.code).toBe('CORRUPT')
    expect(store.readOnly).toBe(true)

    expect(() => store.write(createEmptyDoc())).toThrow(/只读保护/)
  })

  it('损坏时原文件内容保持不变', () => {
    const broken = '{ 这不是 JSON'
    writeFileSync(path.join(dir, 'app-data.json'), broken)
    store.load()
    try {
      store.write(createEmptyDoc())
    } catch {
      /* 预期抛错 */
    }
    expect(readFileSync(path.join(dir, 'app-data.json'), 'utf8')).toBe(broken)
  })

  it('可以从损坏状态以空白重建，并归档原文件', () => {
    writeFileSync(path.join(dir, 'app-data.json'), 'broken')
    store.load()
    const doc = store.rebuild()
    expect(doc.plans).toHaveLength(0)
    expect(store.readOnly).toBe(false)
    const archived = readdirSync(dir).filter((f) => f.startsWith('app-data.corrupt-'))
    expect(archived).toHaveLength(1)
  })
})

describe('恢复、导入与清空', () => {
  it('当日备份记录的是当天开始时的状态', () => {
    store.load()
    const doc = createEmptyDoc()
    doc.plans.push(planItem('今天写的'))
    store.write(doc)

    const backup = JSON.parse(readFileSync(path.join(dir, 'backups', `app-${dayKey()}.json`), 'utf8'))
    expect(backup.plans).toHaveLength(0)
  })

  it('可以从备份文件恢复内容到主文件', () => {
    store.load()
    const snapshot = createEmptyDoc()
    snapshot.plans.push(planItem('备份内容'))
    writeFileSync(path.join(dir, 'backups', 'app-20260101.json'), JSON.stringify(snapshot))

    const restored = store.restore('app-20260101.json')
    expect(restored.plans[0].title).toBe('备份内容')

    const onDisk = JSON.parse(readFileSync(path.join(dir, 'app-data.json'), 'utf8'))
    expect(onDisk.plans[0].title).toBe('备份内容')
  })

  it('拒绝非法备份文件名', () => {
    expect(() => store.restore('../app-data.json')).toThrow(/不合法/)
  })

  it('导入非法文档时报错且不覆盖现有数据', () => {
    store.load()
    const good = createEmptyDoc()
    good.plans.push(planItem('原有数据'))
    store.write(good)

    expect(() => store.importDoc({ schemaVersion: 1 })).toThrow(/校验失败/)
    const onDisk = JSON.parse(readFileSync(path.join(dir, 'app-data.json'), 'utf8'))
    expect(onDisk.plans[0].title).toBe('原有数据')
  })

  it('导入合法文档时归档旧数据并返回条目统计', () => {
    store.load()
    store.write(createEmptyDoc())

    const incoming = createEmptyDoc()
    incoming.plans.push(planItem('导入项'))
    incoming.memos.push({ id: 'm1', content: '备忘', createdAt: new Date().toISOString(), archived: false })
    const { counts } = store.importDoc(incoming)

    expect(counts.plans).toBe(1)
    expect(counts.memos).toBe(1)
    expect(readdirSync(dir).some((f) => f.startsWith('app-data.pre-import-'))).toBe(true)
  })

  it('清空会保留设置并清掉所有条目', () => {
    store.load()
    const doc = createEmptyDoc()
    doc.settings.theme = 'dark'
    doc.plans.push(planItem('会被清掉'))
    store.write(doc)

    const after = store.reset()
    expect(after.plans).toHaveLength(0)
    expect(after.settings.theme).toBe('dark')
  })
})

import { reactive } from 'vue'
import { createEmptyDoc, type BackupItem, type DeskDoc } from '@/types'

export interface DbError {
  code: 'CORRUPT' | 'SAVE' | 'NETWORK' | string
  message: string
  backups: BackupItem[]
}

export const SAVE_DEBOUNCE_MS = 300

export const db = reactive({
  doc: createEmptyDoc() as DeskDoc,
  ready: false,
  saving: false,
  savedAt: null as string | null,
  /** 有改动还没落盘 */
  dirty: false,
  error: null as DbError | null,
})

let debounceTimer: ReturnType<typeof setTimeout> | null = null
/** 每次 patch 自增；保存完成时若没有新改动才把 dirty 清掉 */
let rev = 0

export function setDoc(next: DeskDoc): void {
  db.doc = next
}

export async function loadDoc(): Promise<boolean> {
  try {
    const res = await fetch('/api/data')
    const body = await res.json().catch(() => null)
    if (res.status === 409 && body?.code === 'CORRUPT') {
      db.error = {
        code: 'CORRUPT',
        message: body.message || '数据文件无法解析',
        backups: Array.isArray(body.backups) ? body.backups : [],
      }
      db.ready = false
      return false
    }
    if (!res.ok || !body?.ok) throw new Error(body?.message || '读取数据失败')
    db.doc = body.doc as DeskDoc
    db.savedAt = body.savedAt || null
    db.error = null
    db.ready = true
    db.dirty = false
    return true
  } catch (err) {
    db.error = {
      code: 'NETWORK',
      message: err instanceof Error ? err.message : '无法连接本地服务',
      backups: [],
    }
    db.ready = false
    return false
  }
}

/** 所有写入的唯一入口：改数据 + 防抖保存 */
export function patch(fn: (doc: DeskDoc) => void): void {
  fn(db.doc)
  rev += 1
  db.dirty = true
  scheduleSave()
}

export function scheduleSave(ms = SAVE_DEBOUNCE_MS): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void flush()
  }, ms)
}

export async function flush(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (!db.ready) return
  const at = rev
  db.saving = true
  try {
    const res = await fetch('/api/data', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doc: db.doc }),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok || !body?.ok) throw new Error(body?.message || '保存失败')
    db.savedAt = body.savedAt || new Date().toISOString()
    db.error = null
    // 保存期间又有新的改动，就继续保持 dirty，等下一轮
    if (rev === at) db.dirty = false
  } catch (err) {
    db.error = {
      code: 'SAVE',
      message: err instanceof Error ? err.message : '保存失败',
      backups: [],
    }
  } finally {
    db.saving = false
  }
}

/** 手动保存：取消等待中的防抖，立刻落盘，返回是否成功 */
export async function saveNow(): Promise<boolean> {
  await flush()
  return !!db.ready && !db.error && !db.dirty
}

export function resetDbForTests(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = null
  rev = 0
  db.doc = createEmptyDoc()
  db.ready = false
  db.saving = false
  db.savedAt = null
  db.dirty = false
  db.error = null
}

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
  error: null as DbError | null,
})

let debounceTimer: ReturnType<typeof setTimeout> | null = null

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

export function resetDbForTests(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = null
  db.doc = createEmptyDoc()
  db.ready = false
  db.saving = false
  db.savedAt = null
  db.error = null
}

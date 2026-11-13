import type { BackupItem, DeskDoc } from '@/types'

export const EXPORT_URL = '/api/export'

export class ApiError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

interface Envelope {
  ok: boolean
  message?: string
  code?: string
}

async function call<T extends Envelope>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new ApiError('连不上本地服务，确认窗口没有关掉')
  }
  const body = (await res.json().catch(() => null)) as T | null
  if (!res.ok || !body || !body.ok) {
    throw new ApiError(body?.message || `请求失败（${res.status}）`, body?.code)
  }
  return body
}

function postJson(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export async function listBackups(): Promise<BackupItem[]> {
  const body = await call<Envelope & { items?: BackupItem[] }>('/api/backups')
  return Array.isArray(body.items) ? body.items : []
}

export async function restoreBackup(file: string): Promise<DeskDoc> {
  const body = await call<Envelope & { doc: DeskDoc }>('/api/backups/restore', postJson({ file }))
  return body.doc
}

export async function importDoc(doc: DeskDoc): Promise<Record<string, number>> {
  const body = await call<Envelope & { counts?: Record<string, number> }>('/api/import', postJson({ doc }))
  return body.counts || {}
}

export async function resetDoc(): Promise<DeskDoc> {
  const body = await call<Envelope & { doc: DeskDoc }>('/api/reset', postJson({ confirm: '清空' }))
  return body.doc
}

export async function rebuildDoc(): Promise<DeskDoc> {
  const body = await call<Envelope & { doc: DeskDoc }>('/api/rebuild', postJson({ confirm: true }))
  return body.doc
}

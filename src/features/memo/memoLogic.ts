import type { DeskDoc, Memo } from '@/types'
import { addPlanItem } from '@/features/plan/planLogic'

export function addMemo(doc: DeskDoc, content: string): Memo | null {
  const text = content.trim()
  if (!text) return null
  const memo: Memo = {
    id: `memo_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    content: text,
    createdAt: new Date().toISOString(),
    archived: false,
  }
  doc.memos.unshift(memo)
  return memo
}

export function recentMemos(doc: DeskDoc, limit = 3): Memo[] {
  return doc.memos
    .filter((m) => !m.archived)
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
}

export function findMemo(doc: DeskDoc, id: string): Memo | undefined {
  return doc.memos.find((m) => m.id === id)
}

export function updateMemo(doc: DeskDoc, id: string, content: string): void {
  const memo = findMemo(doc, id)
  if (!memo) return
  const text = content.trim()
  if (text) memo.content = text
}

export function removeMemo(doc: DeskDoc, id: string): void {
  const index = doc.memos.findIndex((m) => m.id === id)
  if (index >= 0) doc.memos.splice(index, 1)
}

/** 备忘转成今天的任务，原备忘移除 */
export function memoToPlan(doc: DeskDoc, id: string, date: string) {
  const memo = findMemo(doc, id)
  if (!memo) return null
  const result = addPlanItem(doc, { date, section: 'am', title: memo.content })
  removeMemo(doc, id)
  return result.item
}

import type { DeskDoc, ModuleKey, PlanItem, Priority, Section, SourceType } from '@/types'
import { applyWriteBack } from './joinToday'

export const SECTIONS: { key: Section; label: string }[] = [
  { key: 'am', label: '上午' },
  { key: 'pm', label: '下午' },
  { key: 'eve', label: '晚上' },
]

const SECTION_ORDER: Record<Section, number> = { am: 0, pm: 1, eve: 2 }

export function sectionLabel(section: Section): string {
  return SECTIONS.find((s) => s.key === section)?.label || ''
}

/** 按当前时间给出默认时段 */
export function defaultSection(now = new Date()): Section {
  const hour = now.getHours()
  if (hour < 12) return 'am'
  if (hour < 18) return 'pm'
  return 'eve'
}

export function itemsForDate(doc: DeskDoc, date: string): PlanItem[] {
  return doc.plans
    .filter((p) => p.date === date)
    .sort((a, b) => {
      const sec = SECTION_ORDER[a.section] - SECTION_ORDER[b.section]
      if (sec !== 0) return sec
      if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex
      return a.id.localeCompare(b.id)
    })
}

export function itemsBySection(doc: DeskDoc, date: string, section: Section): PlanItem[] {
  return itemsForDate(doc, date).filter((p) => p.section === section)
}

export function nextSortIndex(doc: DeskDoc, date: string, section: Section): number {
  const items = itemsBySection(doc, date, section)
  return items.reduce((max, i) => Math.max(max, i.sortIndex), -1) + 1
}

export function isDoneToday(doc: DeskDoc, date: string): { done: number; total: number; estimate: number } {
  const items = itemsForDate(doc, date)
  return {
    done: items.filter((i) => i.done).length,
    total: items.length,
    estimate: items.reduce((sum, i) => sum + (i.estimateMin || 0), 0),
  }
}

export interface AddPlanInput {
  date: string
  section: Section
  title: string
  module?: ModuleKey
  priority?: Priority
  estimateMin?: number | null
  sourceType?: SourceType | null
  sourceId?: string | null
}

/**
 * 新建今日计划条目。同一来源在同一天只允许一条。
 */
export function addPlanItem(doc: DeskDoc, input: AddPlanInput): { item: PlanItem | null; duplicated: boolean } {
  const title = input.title.trim()
  if (!title) return { item: null, duplicated: false }

  const sourceType = input.sourceType ?? null
  const sourceId = input.sourceId ?? null

  if (sourceType && sourceId) {
    const existing = doc.plans.find((p) => p.date === input.date && p.sourceType === sourceType && p.sourceId === sourceId)
    if (existing) return { item: existing, duplicated: true }
  }

  let sortIndex = nextSortIndex(doc, input.date, input.section)
  if (sourceType === 'workout') {
    const workout = doc.workouts.find((w) => w.id === sourceId)
    if (workout && workout.completed) sortIndex = 0
  }

  const item: PlanItem = {
    id: `plan_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    date: input.date,
    section: input.section,
    title,
    module: input.module || 'plan',
    priority: input.priority ?? 0,
    estimateMin: input.estimateMin ?? null,
    done: false,
    doneAt: null,
    sourceType,
    sourceId,
    sortIndex,
  }
  doc.plans.push(item)
  return { item, duplicated: false }
}

export function findPlanItem(doc: DeskDoc, id: string): PlanItem | undefined {
  return doc.plans.find((p) => p.id === id)
}

/** 勾选/取消勾选，回写型条目同步源实体 */
export function togglePlanItem(doc: DeskDoc, id: string, done?: boolean): void {
  const item = findPlanItem(doc, id)
  if (!item) return
  const next = done ?? !item.done
  item.done = next
  item.doneAt = next ? new Date().toISOString() : null
  applyWriteBack(doc, item, next)
}

export function renamePlanItem(doc: DeskDoc, id: string, title: string): void {
  const item = findPlanItem(doc, id)
  if (!item) return
  const next = title.trim()
  if (next) item.title = next
}

export function setPlanSection(doc: DeskDoc, id: string, section: Section): void {
  const item = findPlanItem(doc, id)
  if (!item || item.section === section) return
  item.section = section
  item.sortIndex = nextSortIndex(doc, item.date, section)
}

export function setPlanPriority(doc: DeskDoc, id: string, priority: Priority): void {
  const item = findPlanItem(doc, id)
  if (item) item.priority = priority
}

export function cyclePriority(item: PlanItem): Priority {
  return ((item.priority + 1) % 3) as Priority
}

/** 按给定顺序重排某段，并全部落到目标段 */
export function reorderSection(doc: DeskDoc, date: string, section: Section, orderedIds: string[]): void {
  orderedIds.forEach((id, index) => {
    const item = findPlanItem(doc, id)
    if (!item) return
    item.section = section
    item.date = date
    item.sortIndex = index
  })
}

export function movePlanItem(doc: DeskDoc, id: string, date: string): void {
  const item = findPlanItem(doc, id)
  if (!item || item.date === date) return
  item.date = date
  item.sortIndex = nextSortIndex(doc, date, item.section)
}

export function removePlanItem(doc: DeskDoc, id: string): void {
  const index = doc.plans.findIndex((p) => p.id === id)
  if (index >= 0) doc.plans.splice(index, 1)
}

/** 今天之前所有没做完的条目 */
export function rolloverCandidates(doc: DeskDoc, today: string): PlanItem[] {
  return doc.plans
    .filter((p) => !p.done && p.date < today)
    .sort((a, b) => (a.date === b.date ? a.sortIndex - b.sortIndex : a.date < b.date ? -1 : 1))
}

export function rolloverItems(doc: DeskDoc, ids: string[], today: string): number {
  let moved = 0
  for (const id of ids) {
    const item = findPlanItem(doc, id)
    if (!item || item.done) continue
    item.date = today
    item.sortIndex = nextSortIndex(doc, today, item.section)
    moved += 1
  }
  return moved
}

/**
 * 读源实体的当前标题。自由条目返回 null，源被删除也返回 null。
 * PRD 规则一：渲染时以源实体为准，item.title 只作快照兜底。
 */
export function sourceTitle(doc: DeskDoc, item: Pick<PlanItem, 'sourceType' | 'sourceId'>): string | null {
  if (!item.sourceType || !item.sourceId) return null
  switch (item.sourceType) {
    case 'task':
      return doc.tasks.find((t) => t.id === item.sourceId)?.title ?? null
    case 'bug':
      return doc.bugs.find((b) => b.id === item.sourceId)?.title ?? null
    case 'followup':
      return doc.followups.find((f) => f.id === item.sourceId)?.title ?? null
    case 'content':
      return doc.media.find((m) => m.id === item.sourceId)?.title ?? null
    case 'workout': {
      const workout = doc.workouts.find((w) => w.id === item.sourceId)
      return workout ? workout.focus || '训练' : null
    }
    default:
      return null
  }
}

/** 带来源的条目，源实体已经被删掉了 */
export function isSourceMissing(doc: DeskDoc, item: Pick<PlanItem, 'sourceType' | 'sourceId'>): boolean {
  if (!item.sourceType || !item.sourceId) return false
  return sourceTitle(doc, item) === null
}

/** 条目显示名：有来源读源标题，源没了就用快照标题 */
export function displayTitle(doc: DeskDoc, item: PlanItem): string {
  return sourceTitle(doc, item) ?? item.title
}

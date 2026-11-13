import type { DeskDoc, PlanItem } from '@/types'

/** 回写型来源：勾选后要改源实体状态 */
export const WRITE_BACK_TYPES = ['task', 'bug', 'followup', 'workout'] as const

export function isWriteBack(item: Pick<PlanItem, 'sourceType'>): boolean {
  return !!item.sourceType && (WRITE_BACK_TYPES as readonly string[]).includes(item.sourceType)
}

/**
 * 把今日计划的完成状态写回源实体。
 * content 与自由条目是提醒型，不改变源数据。
 */
export function applyWriteBack(doc: DeskDoc, item: Pick<PlanItem, 'sourceType' | 'sourceId'>, done: boolean): void {
  if (!item.sourceType || !item.sourceId) return
  const id = item.sourceId

  switch (item.sourceType) {
    case 'task': {
      const task = doc.tasks.find((t) => t.id === id)
      if (task) task.status = done ? 'done' : 'todo'
      break
    }
    case 'bug': {
      const bug = doc.bugs.find((b) => b.id === id)
      if (bug) bug.status = done ? 'fixed' : 'open'
      break
    }
    case 'followup': {
      const followup = doc.followups.find((f) => f.id === id)
      if (followup) followup.status = done ? 'done' : 'open'
      break
    }
    case 'workout': {
      const workout = doc.workouts.find((w) => w.id === id)
      if (workout) workout.completed = done
      break
    }
    default:
      break
  }
}

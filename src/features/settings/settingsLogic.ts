import { countEntries, validateDoc } from '../../../shared/schema.mjs'
import type { DeskDoc, Settings } from '@/types'

/** 总览表里的条目名与顺序，和 PRD 5.9 的列举一致 */
export const COUNT_LABELS: Record<string, string> = {
  plans: '今日计划',
  memos: '快速备忘',
  media: '自媒体内容',
  projects: '项目',
  tasks: '任务',
  bugs: 'Bug',
  timeLogs: '工时记录',
  devLogs: '开发日志',
  clients: '客户',
  engagements: '咨询项目',
  sessions: '会谈记录',
  followups: '跟进事项',
  weekPlans: '周训练计划',
  exercises: '动作库',
  workouts: '训练记录',
  bodyMetrics: '身体数据',
  dishes: '菜品',
  mealPlans: '排餐',
  mealLogs: '饮食记录',
  waterLogs: '喝水记录',
  games: '游戏',
  shows: '追剧',
  leisureLogs: '娱乐时长',
  miniScores: '小游戏分数',
}

export interface CountRow {
  key: string
  label: string
  count: number
}

export function countRows(doc: DeskDoc): CountRow[] {
  const counts = countEntries(doc) as Record<string, number>
  return Object.keys(COUNT_LABELS).map((key) => ({
    key,
    label: COUNT_LABELS[key],
    count: counts[key] || 0,
  }))
}

export function totalEntries(doc: DeskDoc): number {
  return countRows(doc).reduce((sum, row) => sum + row.count, 0)
}

/** 数据文件按磁盘上的格式（两空格缩进）估算字节数 */
export function docSizeBytes(doc: DeskDoc): number {
  try {
    return new TextEncoder().encode(JSON.stringify(doc, null, 2)).length
  } catch {
    return 0
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export interface ImportPreview {
  doc: DeskDoc
  total: number
  rows: CountRow[]
}

export type ParseResult = { ok: true; preview: ImportPreview } | { ok: false; error: string }

/** 解析导入文件文本：先看 JSON 能不能读，再用同一份 schema 校验结构 */
export function parseImport(text: string): ParseResult {
  if (!text || !text.trim()) return { ok: false, error: '文件是空的' }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: '不是合法的 JSON 文件' }
  }

  const doc = parsed as DeskDoc
  const errors = validateDoc(doc) as string[]
  if (errors.length) return { ok: false, error: errors.join('；') }

  const rows = countRows(doc).filter((row) => row.count > 0)
  return {
    ok: true,
    preview: {
      doc,
      total: countRows(doc).reduce((sum, row) => sum + row.count, 0),
      rows,
    },
  }
}

export function updateSettings(doc: DeskDoc, next: Partial<Settings>): void {
  doc.settings = { ...doc.settings, ...next }
}

export function parsePlatforms(text: string): string[] {
  return text
    .split(/[,，、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function formatPlatforms(list: string[]): string {
  return (list || []).join('、')
}

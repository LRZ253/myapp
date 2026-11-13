export const MODULE_LABELS: Record<string, string> = {
  dev: '开发',
  consult: '咨询',
  media: '自媒体',
  fitness: '健身',
  diet: '饮食',
  play: '娱乐',
  plan: '',
}

export const PRIORITY_LABELS = ['普通', '重要', '紧急'] as const

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: '待做',
  doing: '进行中',
  done: '完成',
}

export const SEVERITY_LABELS: Record<string, string> = {
  blocker: '致命',
  major: '严重',
  normal: '一般',
  minor: '轻微',
}

export const STAGE_LABELS: Record<string, string> = {
  idea: '选题',
  draft: '写稿',
  ready: '待发布',
  published: '已发布',
}

export const ENGAGEMENT_STAGE_LABELS: Record<string, string> = {
  lead: '接洽',
  active: '进行中',
  closing: '收尾',
  closed: '已结项',
}

export const MEAL_LABELS: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}

export const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export function moduleLabel(key: string): string {
  return MODULE_LABELS[key] || ''
}

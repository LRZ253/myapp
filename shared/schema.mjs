export const SCHEMA_VERSION = 1

export const COLLECTIONS = [
  'plans',
  'memos',
  'media',
  'projects',
  'tasks',
  'bugs',
  'timeLogs',
  'devLogs',
  'clients',
  'engagements',
  'sessions',
  'followups',
  'weekPlans',
  'exercises',
  'workouts',
  'bodyMetrics',
  'dishes',
  'mealPlans',
  'mealLogs',
  'waterLogs',
  'games',
  'shows',
  'leisureLogs',
  'miniScores',
]

export function defaultSettings() {
  return {
    theme: 'light',
    weekStart: 1,
    platforms: ['视频号', 'B站', '小红书', '公众号'],
    defaultHourlyRate: 0,
    userName: '',
  }
}

/**
 * 空白数据文档。
 * @returns {Record<string, any>}
 */
export function createEmptyDoc() {
  const doc = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: null,
    settings: defaultSettings(),
    runtime: { timer: null },
  }
  for (const key of COLLECTIONS) doc[key] = []
  return doc
}

export function validateDoc(doc) {
  const errors = []
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return ['数据必须是一个对象']
  if (typeof doc.schemaVersion !== 'number') errors.push('缺少 schemaVersion')
  if (doc.schemaVersion > SCHEMA_VERSION) errors.push('数据版本高于本程序支持的版本')
  if (!doc.settings || typeof doc.settings !== 'object') errors.push('缺少 settings')
  if (!doc.runtime || typeof doc.runtime !== 'object') errors.push('缺少 runtime')
  for (const key of COLLECTIONS) {
    if (!Array.isArray(doc[key])) errors.push(`${key} 必须是数组`)
  }
  return errors
}

/**
 * @param {any} doc
 * @returns {Record<string, number>}
 */
export function countEntries(doc) {
  const counts = {}
  for (const key of COLLECTIONS) counts[key] = Array.isArray(doc?.[key]) ? doc[key].length : 0
  return counts
}

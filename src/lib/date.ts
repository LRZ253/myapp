export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 本地时区的 YYYY-MM-DD */
export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function todayKey(): string {
  return toKey(new Date())
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

/** 1 = 周一 … 7 = 周日 */
export function weekdayIndex(key: string): number {
  const day = parseKey(key).getDay()
  return day === 0 ? 7 : day
}

export function isWeekend(key: string): boolean {
  return weekdayIndex(key) >= 6
}

/** 返回该日期所在周的起始日（按设置里的周起始日） */
export function weekStartKey(key: string, weekStart: 1 | 7 = 1): string {
  const idx = weekdayIndex(key)
  const offset = weekStart === 1 ? idx - 1 : idx % 7
  return addDays(key, -offset)
}

export function weekKeys(startKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startKey, i))
}

const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export function weekdayName(key: string): string {
  return WEEKDAY_NAMES[weekdayIndex(key) - 1]
}

export function formatDate(key: string): string {
  const d = parseKey(key)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function formatMonth(key: string): string {
  const d = parseKey(key)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

export function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1)
  const start = new Date(first)
  const offset = (first.getDay() + 6) % 7
  start.setDate(first.getDate() - offset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return toKey(d)
  })
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day === 1) return '昨天'
  if (day < 7) return `${day} 天前`
  return toKey(new Date(then)).slice(5).replace('-', '/')
}

export function hhmm(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function combineDateTime(dateKey: string, time: string): string {
  const [h, m] = time.split(':').map(Number)
  const d = parseKey(dateKey)
  d.setHours(h || 0, m || 0, 0, 0)
  return d.toISOString()
}

export function splitDateTime(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: '', time: '' }
  return { date: toKey(d), time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}` }
}

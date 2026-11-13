import type { DeskDoc, MediaContent, MediaStatPoint } from '@/types'
import { toKey } from '@/lib/date'

export interface SeriesPoint extends MediaStatPoint {
  /** 当天有记录的内容条数 */
  contents: number
}

export interface PlatformRow {
  platform: string
  count: number
  views: number
  likes: number
  engagement: number
}

export interface ContentRow {
  id: string
  title: string
  views: number
  likes: number
  engagement: number
  date: string | null
  platforms: string[]
}

/** 已发布内容，按发布时间倒序 */
export function publishedContents(doc: DeskDoc): MediaContent[] {
  return doc.media
    .filter((m) => m.stage === 'published')
    .slice()
    .sort((a, b) => {
      const da = a.publishedAt || a.publishAt || a.updatedAt
      const db = b.publishedAt || b.publishAt || b.updatedAt
      return da < db ? 1 : -1
    })
}

/** 把每条内容的历史快照按日期汇总成一条时间线 */
export function dailySeries(doc: DeskDoc): SeriesPoint[] {
  const map = new Map<string, SeriesPoint>()
  for (const content of doc.media) {
    const history = content.stats.history
    if (!history || !history.length) {
      // 老数据只有一次快照：用 recordedAt 那天补一个点
      const at = content.stats.recordedAt
      if (!at || !content.stats.views) continue
      const date = at.slice(0, 10)
      const point = map.get(date) || { date, views: 0, likes: 0, follows: 0, contents: 0 }
      point.views += content.stats.views
      point.likes += content.stats.likes
      point.follows += content.stats.follows
      point.contents += 1
      map.set(date, point)
      continue
    }
    for (const item of history) {
      const point = map.get(item.date) || { date: item.date, views: 0, likes: 0, follows: 0, contents: 0 }
      point.views += item.views
      point.likes += item.likes
      point.follows += item.follows
      point.contents += 1
      map.set(item.date, point)
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.date < b.date ? -1 : 1))
}

export function totals(doc: DeskDoc): { views: number; likes: number; follows: number; engagement: number; count: number } {
  const rows = publishedContents(doc)
  const views = rows.reduce((sum, m) => sum + m.stats.views, 0)
  const likes = rows.reduce((sum, m) => sum + m.stats.likes, 0)
  const follows = rows.reduce((sum, m) => sum + m.stats.follows, 0)
  return {
    views,
    likes,
    follows,
    engagement: views ? likes / views : 0,
    count: rows.length,
  }
}

/** 平台维度：一条内容挂多个平台时，各平台各记一次，便于横向比较 */
export function platformRows(doc: DeskDoc): PlatformRow[] {
  const map = new Map<string, PlatformRow>()
  for (const content of publishedContents(doc)) {
    const platforms = content.platforms.length ? content.platforms : ['未标注']
    for (const platform of platforms) {
      const row = map.get(platform) || { platform, count: 0, views: 0, likes: 0, engagement: 0 }
      row.count += 1
      row.views += content.stats.views
      row.likes += content.stats.likes
      map.set(platform, row)
    }
  }
  const rows = Array.from(map.values())
  for (const row of rows) row.engagement = row.views ? row.likes / row.views : 0
  return rows.sort((a, b) => b.views - a.views)
}

export function contentRows(doc: DeskDoc): ContentRow[] {
  return publishedContents(doc).map((m) => ({
    id: m.id,
    title: m.title,
    views: m.stats.views,
    likes: m.stats.likes,
    engagement: m.stats.views ? m.stats.likes / m.stats.views : 0,
    date: (m.publishedAt || m.publishAt || '').slice(0, 10) || null,
    platforms: m.platforms,
  }))
}

/** 图表内边距：左右上下可以不同，右侧留给 Y 轴标签、底部留给 X 轴日期 */
export interface ChartPad {
  top: number
  right: number
  bottom: number
  left: number
}

function normPad(pad: number | Partial<ChartPad>): ChartPad {
  if (typeof pad === 'number') return { top: pad, right: pad, bottom: pad, left: pad }
  return { top: pad.top ?? 6, right: pad.right ?? 6, bottom: pad.bottom ?? 6, left: pad.left ?? 6 }
}

/** 折线路径：把数值映射到 SVG 坐标 */
export function linePath(values: number[], width: number, height: number, pad: number | Partial<ChartPad> = 6): string {
  if (!values.length) return ''
  const p = normPad(pad)
  const innerW = Math.max(width - p.left - p.right, 1)
  const innerH = Math.max(height - p.top - p.bottom, 1)
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const step = values.length > 1 ? innerW / (values.length - 1) : 0
  return values
    .map((value, i) => {
      const x = p.left + step * i
      const y = height - p.bottom - ((value - min) / span) * innerH
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function areaPath(values: number[], width: number, height: number, pad: number | Partial<ChartPad> = 6): string {
  const line = linePath(values, width, height, pad)
  if (!line) return ''
  const p = normPad(pad)
  return `${line} L${(width - p.right).toFixed(1)},${height - p.bottom} L${p.left},${height - p.bottom} Z`
}

export function pointCoords(
  values: number[],
  width: number,
  height: number,
  pad: number | Partial<ChartPad> = 6,
): { x: number; y: number }[] {
  if (!values.length) return []
  const p = normPad(pad)
  const innerW = Math.max(width - p.left - p.right, 1)
  const innerH = Math.max(height - p.top - p.bottom, 1)
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const step = values.length > 1 ? innerW / (values.length - 1) : 0
  return values.map((value, i) => ({
    x: p.left + step * i,
    y: height - p.bottom - ((value - min) / span) * innerH,
  }))
}

export function formatRate(value: number): string {
  if (!value) return '0%'
  return `${(value * 100).toFixed(1)}%`
}

/** 统计窗口内最近一次记录距今天数，用于提示数据新鲜度 */
export function daysSince(date: string | null, today = toKey(new Date())): number | null {
  if (!date) return null
  const a = new Date(`${date}T00:00:00`)
  const b = new Date(`${today}T00:00:00`)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

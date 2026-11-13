import type { DeskDoc, MediaContent, MediaStage, MediaStats } from '@/types'
import { toKey } from '@/lib/date'

export const MEDIA_STAGES: { key: MediaStage; label: string }[] = [
  { key: 'idea', label: '选题' },
  { key: 'draft', label: '写稿' },
  { key: 'ready', label: '待发布' },
  { key: 'published', label: '已发布' },
]

function nowIso() {
  return new Date().toISOString()
}

export function createContent(doc: DeskDoc, input: { title: string; platforms?: string[]; stage?: MediaStage }): MediaContent | null {
  const title = input.title.trim()
  if (!title) return null
  const content: MediaContent = {
    id: `media_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    title,
    platforms: input.platforms || [],
    stage: input.stage || 'idea',
    publishAt: null,
    publishedAt: null,
    body: '',
    stats: { views: 0, likes: 0, follows: 0, recordedAt: null },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  doc.media.push(content)
  return content
}

export function findContent(doc: DeskDoc, id: string): MediaContent | undefined {
  return doc.media.find((m) => m.id === id)
}

export function updateContent(doc: DeskDoc, id: string, patchData: Partial<MediaContent>): void {
  const content = findContent(doc, id)
  if (!content) return
  Object.assign(content, patchData)
  content.updatedAt = nowIso()
}

/** 改阶段；首次进入已发布时补 publishedAt */
export function setStage(doc: DeskDoc, id: string, stage: MediaStage): void {
  const content = findContent(doc, id)
  if (!content || content.stage === stage) return
  content.stage = stage
  if (stage === 'published' && !content.publishedAt) content.publishedAt = nowIso()
  if (stage !== 'published') content.publishedAt = null
  content.updatedAt = nowIso()
}

export function setStats(doc: DeskDoc, id: string, stats: Partial<Omit<MediaStats, 'recordedAt'>>): void {
  const content = findContent(doc, id)
  if (!content) return
  content.stats = {
    views: stats.views ?? content.stats.views,
    likes: stats.likes ?? content.stats.likes,
    follows: stats.follows ?? content.stats.follows,
    recordedAt: nowIso(),
  }
  content.updatedAt = nowIso()
}

export function removeContent(doc: DeskDoc, id: string): void {
  doc.media = doc.media.filter((m) => m.id !== id)
}

export function contentsByStage(doc: DeskDoc, stage: MediaStage): MediaContent[] {
  return doc.media
    .filter((m) => m.stage === stage)
    .slice()
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

/** 按 publishAt 把内容铺到日历上 */
export function calendarMap(doc: DeskDoc): Record<string, MediaContent[]> {
  const map: Record<string, MediaContent[]> = {}
  for (const content of doc.media) {
    if (!content.publishAt) continue
    const key = toKey(new Date(content.publishAt))
    if (!map[key]) map[key] = []
    map[key].push(content)
  }
  return map
}

export interface PlatformStat {
  platform: string
  count: number
  avgViews: number
  avgLikes: number
}

export function platformStats(doc: DeskDoc): PlatformStat[] {
  const buckets: Record<string, { count: number; views: number; likes: number }> = {}
  for (const content of doc.media) {
    if (content.stage !== 'published' || !content.stats.recordedAt) continue
    for (const platform of content.platforms) {
      if (!buckets[platform]) buckets[platform] = { count: 0, views: 0, likes: 0 }
      buckets[platform].count += 1
      buckets[platform].views += content.stats.views
      buckets[platform].likes += content.stats.likes
    }
  }
  return Object.entries(buckets)
    .map(([platform, b]) => ({
      platform,
      count: b.count,
      avgViews: Math.round(b.views / b.count),
      avgLikes: Math.round(b.likes / b.count),
    }))
    .sort((a, b) => b.avgViews - a.avgViews)
}

export function filterContents(
  doc: DeskDoc,
  filter: { platform?: string; stage?: MediaStage | ''; query?: string; since?: string },
): MediaContent[] {
  const query = (filter.query || '').trim()
  return doc.media
    .filter((m) => (filter.stage ? m.stage === filter.stage : true))
    .filter((m) => (filter.platform ? m.platforms.includes(filter.platform) : true))
    .filter((m) => (query ? m.title.includes(query) || m.body.includes(query) : true))
    .filter((m) => (filter.since ? (m.publishAt || '') >= filter.since : true))
    .slice()
    .sort((a, b) => (a.publishedAt || a.updatedAt) < (b.publishedAt || b.updatedAt) ? 1 : -1)
}

export function formatCount(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000) / 10}万`
  return String(n)
}

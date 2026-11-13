import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import Media from '@/views/Media.vue'
import MediaAnalytics from '@/features/media/MediaAnalytics.vue'
import { db, resetDbForTests } from '@/store/db'
import { createEmptyDoc, type DeskDoc } from '@/types'
import { createContent, setStage, setStats } from '@/features/media/mediaLogic'
import {
  linePath,
  dailySeries,
  formatRate,
  platformRows,
  pointCoords,
  publishedContents,
  totals,
} from '@/features/media/mediaAnalytics'

let wrapper: VueWrapper | null = null

function publishedDoc(): DeskDoc {
  const doc = createEmptyDoc()
  const a = createContent(doc, { title: '为什么不用 Notion', platforms: ['B站', '视频号'] })!
  const b = createContent(doc, { title: '低成本工作台', platforms: ['B站'] })!
  setStage(doc, a.id, 'published')
  setStage(doc, b.id, 'published')
  setStats(doc, a.id, { views: 12000, likes: 900, follows: 120 })
  setStats(doc, b.id, { views: 4000, likes: 200, follows: 30 })
  return doc
}

beforeEach(() => {
  resetDbForTests()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, savedAt: new Date().toISOString() }) })),
  )
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('数据快照', () => {
  it('每次记录写入一个历史点', () => {
    const doc = createEmptyDoc()
    const content = createContent(doc, { title: '测试' })!
    setStats(doc, content.id, { views: 100, likes: 10 })

    expect(doc.media[0].stats.history).toHaveLength(1)
    expect(doc.media[0].stats.history?.[0].views).toBe(100)
    expect(doc.media[0].stats.views).toBe(100)
  })

  it('同一天再记录会覆盖当天的点，不堆重复', () => {
    const doc = createEmptyDoc()
    const content = createContent(doc, { title: '测试' })!
    setStats(doc, content.id, { views: 100 })
    setStats(doc, content.id, { views: 260, likes: 30 })

    const history = doc.media[0].stats.history!
    expect(history).toHaveLength(1)
    expect(history[0].views).toBe(260)
    expect(history[0].likes).toBe(30)
  })

  it('跨日期记录会追加成趋势', () => {
    vi.useFakeTimers()
    const doc = createEmptyDoc()
    const content = createContent(doc, { title: '测试' })!

    vi.setSystemTime(new Date(2026, 10, 1, 10, 0, 0))
    setStats(doc, content.id, { views: 100 })
    vi.setSystemTime(new Date(2026, 10, 3, 10, 0, 0))
    setStats(doc, content.id, { views: 500 })

    const history = doc.media[0].stats.history!
    expect(history.map((p) => p.date)).toEqual(['2026-11-01', '2026-11-03'])
    expect(history[1].views).toBe(500)
  })

  it('老数据没有 history 时，用 recordedAt 补一个点', () => {
    const doc = createEmptyDoc()
    const content = createContent(doc, { title: '老内容' })!
    doc.media[0].stats = { views: 800, likes: 40, follows: 5, recordedAt: '2026-10-20T09:00:00.000Z' }

    const series = dailySeries(doc)
    expect(series).toHaveLength(1)
    expect(series[0].date).toBe('2026-10-20')
    expect(series[0].views).toBe(800)
  })
})

describe('统计计算', () => {
  it('只统计已发布内容', () => {
    const doc = publishedDoc()
    createContent(doc, { title: '还在写' })

    const total = totals(doc)
    expect(total.count).toBe(2)
    expect(total.views).toBe(16000)
    expect(total.likes).toBe(1100)
  })

  it('按日期汇总多条内容', () => {
    const doc = publishedDoc()
    const series = dailySeries(doc)
    // 两条都在今天记录，合并成一个点
    expect(series).toHaveLength(1)
    expect(series[0].views).toBe(16000)
    expect(series[0].contents).toBe(2)
  })

  it('平台维度按播放排序，多平台内容各记一次', () => {
    const doc = publishedDoc()
    const rows = platformRows(doc)

    expect(rows[0].platform).toBe('B站')
    expect(rows[0].count).toBe(2)
    expect(rows[0].views).toBe(16000)
    expect(rows.find((r) => r.platform === '视频号')?.views).toBe(12000)
  })

  it('没标平台的内容归到未标注', () => {
    const doc = createEmptyDoc()
    const content = createContent(doc, { title: '没平台' })!
    setStage(doc, content.id, 'published')
    setStats(doc, content.id, { views: 10 })

    expect(platformRows(doc)[0].platform).toBe('未标注')
  })

  it('赞播比与格式化', () => {
    const doc = publishedDoc()
    expect(formatRate(totals(doc).engagement)).toBe('6.9%')
    expect(formatRate(0)).toBe('0%')
  })

  it('已发布内容按时间倒序', () => {
    const doc = publishedDoc()
    const rows = publishedContents(doc)
    expect(rows).toHaveLength(2)
    expect(rows[0].publishedAt! >= rows[1].publishedAt!).toBe(true)
  })

  it('折线路径把数值映射到画布，空数组返回空串', () => {
    const path = linePath([0, 50, 100], 200, 100, 0)
    expect(path.startsWith('M')).toBe(true)
    expect(path.split('L')).toHaveLength(3)
    expect(linePath([], 200, 100)).toBe('')
  })

  it('留白可以不对称：曲线止于绘图区右边界，不会压到 Y 轴标签', () => {
    const pad = { top: 14, right: 54, bottom: 26, left: 8 }
    const pts = pointCoords([0, 50, 100], 720, 240, pad)
    expect(pts[0].x).toBe(8)
    expect(pts[pts.length - 1].x).toBe(666)
    expect(Math.min(...pts.map((p) => p.y))).toBe(14)
    expect(Math.max(...pts.map((p) => p.y))).toBe(214)
  })
})

describe('图表界面', () => {
  it('有数据时画出折线和统计卡', async () => {
    const doc = publishedDoc()
    db.doc = doc
    db.ready = true

    wrapper = mount(MediaAnalytics, { attachTo: document.body })
    await flushPromises()

    expect(wrapper.findAll('svg.trend').length).toBe(1)
    expect(wrapper.find('path.line.views').exists()).toBe(true)
    expect(wrapper.text()).toContain('总播放')
    expect(wrapper.text()).toContain('1.6万')
  })

  it('没有数据点时给出引导文案', async () => {
    db.doc = createEmptyDoc()
    db.ready = true

    wrapper = mount(MediaAnalytics, { attachTo: document.body })
    await flushPromises()

    expect(wrapper.find('svg.trend').exists()).toBe(false)
    expect(wrapper.text()).toContain('还没有数据点')
  })

  it('一条内容都没有时，数据视图仍显示自己的空状态', async () => {
    db.doc = createEmptyDoc()
    db.ready = true

    wrapper = mount(Media, { attachTo: document.body })
    await flushPromises()

    await wrapper.find('[data-testid="seg-analytics"]').trigger('click')
    await flushPromises()

    // 不要退回"先写选题"的全局空状态，数据视角要有自己的引导
    expect(wrapper.find('[data-testid="media-analytics"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('还没有数据点')
    expect(wrapper.text()).not.toContain('填入示例选题')
  })

  it('自媒体页面能切到数据视图', async () => {
    db.doc = publishedDoc()
    db.ready = true

    wrapper = mount(Media, { attachTo: document.body })
    await flushPromises()

    await wrapper.find('[data-testid="seg-analytics"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="media-analytics"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('播放趋势')
  })
})

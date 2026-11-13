import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import Media from '@/views/Media.vue'
import { db, resetDbForTests } from '@/store/db'
import { ui } from '@/store/ui'
import { createEmptyDoc, type DeskDoc } from '@/types'
import {
  calendarMap,
  contentsByStage,
  createContent,
  filterContents,
  platformStats,
  removeContent,
  setStage,
  setStats,
} from '@/features/media/mediaLogic'
import { isSourceMissing, togglePlanItem } from '@/features/plan/planLogic'
import ContentDrawer from '@/features/media/ContentDrawer.vue'
import { todayKey } from '@/lib/date'

let wrapper: VueWrapper | null = null

function seed(): DeskDoc {
  const doc = createEmptyDoc()
  const a = createContent(doc, { title: '第 3 期', platforms: ['视频号', 'B站'] })!
  const b = createContent(doc, { title: '我的一周工作流', platforms: ['视频号'] })!
  return Object.assign(doc, { _a: a.id, _b: b.id })
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
  vi.unstubAllGlobals()
})

describe('内容流转', () => {
  it('新建默认落在选题，平台为空', () => {
    const doc = createEmptyDoc()
    const content = createContent(doc, { title: '新选题' })!
    expect(content.stage).toBe('idea')
    expect(content.platforms).toEqual([])
    expect(doc.media).toHaveLength(1)
  })

  it('空标题不创建', () => {
    const doc = createEmptyDoc()
    expect(createContent(doc, { title: '  ' })).toBeNull()
  })

  it('改为已发布时自动补发布时间，改回去会清空', () => {
    const doc = createEmptyDoc()
    const content = createContent(doc, { title: 'A' })!

    setStage(doc, content.id, 'published')
    expect(doc.media[0].stage).toBe('published')
    expect(doc.media[0].publishedAt).toBeTruthy()

    setStage(doc, content.id, 'draft')
    expect(doc.media[0].publishedAt).toBeNull()
  })

  it('重复设置同阶段不覆盖发布时间', () => {
    const doc = createEmptyDoc()
    const content = createContent(doc, { title: 'A' })!
    setStage(doc, content.id, 'published')
    const first = doc.media[0].publishedAt
    setStage(doc, content.id, 'published')
    expect(doc.media[0].publishedAt).toBe(first)
  })

  it('回填数据会记录回填时间', () => {
    const doc = createEmptyDoc()
    const content = createContent(doc, { title: 'A' })!
    setStats(doc, content.id, { views: 12000, likes: 486, follows: 37 })

    expect(doc.media[0].stats.views).toBe(12000)
    expect(doc.media[0].stats.recordedAt).toBeTruthy()
  })

  it('删除内容后今日计划里的提醒项保留，标记为来源已删除', () => {
    const doc = createEmptyDoc()
    const content = createContent(doc, { title: 'A' })!
    doc.plans.push({
      id: 'pl1',
      date: '2026-11-13',
      section: 'am',
      title: 'A',
      module: 'media',
      priority: 0,
      estimateMin: null,
      done: false,
      doneAt: null,
      sourceType: 'content',
      sourceId: content.id,
      sortIndex: 0,
    })

    removeContent(doc, content.id)
    expect(doc.media).toHaveLength(0)
    expect(doc.plans).toHaveLength(1)
    expect(isSourceMissing(doc, doc.plans[0])).toBe(true)
  })
})

describe('视图与统计', () => {
  it('按阶段分列，最近更新的排在前面', () => {
    const doc = seed() as DeskDoc & { _a: string }
    setStage(doc, doc._a, 'draft')
    const list = contentsByStage(doc, 'draft')
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('第 3 期')
  })

  it('日历按计划发布时间归到对应日期', () => {
    const doc = createEmptyDoc()
    const content = createContent(doc, { title: 'A' })!
    doc.media[0].publishAt = new Date(2026, 10, 14, 19, 0).toISOString()

    const map = calendarMap(doc)
    expect(Object.keys(map)).toContain('2026-11-14')
    expect(map['2026-11-14'][0].id).toBe(content.id)
  })

  it('复盘按平台算平均播放与点赞', () => {
    const doc = createEmptyDoc()
    const a = createContent(doc, { title: 'A', platforms: ['视频号'] })!
    const b = createContent(doc, { title: 'B', platforms: ['视频号', 'B站'] })!
    setStage(doc, a.id, 'published')
    setStage(doc, b.id, 'published')
    setStats(doc, a.id, { views: 1000, likes: 100, follows: 5 })
    setStats(doc, b.id, { views: 3000, likes: 300, follows: 15 })

    const stats = platformStats(doc)
    const video = stats.find((s) => s.platform === '视频号')!
    expect(video.count).toBe(2)
    expect(video.avgViews).toBe(2000)
    expect(video.avgLikes).toBe(200)

    const bili = stats.find((s) => s.platform === 'B站')!
    expect(bili.count).toBe(1)
    expect(bili.avgViews).toBe(3000)
  })

  it('未回填数据的已发布内容不进入统计', () => {
    const doc = createEmptyDoc()
    const a = createContent(doc, { title: 'A', platforms: ['视频号'] })!
    setStage(doc, a.id, 'published')
    expect(platformStats(doc)).toHaveLength(0)
  })

  it('列表筛选支持平台、阶段与关键词', () => {
    const doc = seed() as DeskDoc & { _b: string }
    setStage(doc, doc._b, 'published')

    expect(filterContents(doc, { platform: 'B站' })).toHaveLength(1)
    expect(filterContents(doc, { stage: 'published' })).toHaveLength(1)
    expect(filterContents(doc, { query: '一周' })).toHaveLength(1)
  })
})

describe('自媒体页面', () => {
  async function mountMedia(doc: DeskDoc) {
    db.doc = doc
    db.ready = true
    wrapper = mount(Media, { attachTo: document.body })
    await flushPromises()
    return wrapper
  }

  it('看板渲染四列', async () => {
    const w = await mountMedia(seed())
    expect(w.find('[data-testid="media-column-idea"]').exists()).toBe(true)
    expect(w.find('[data-testid="media-column-ready"]').exists()).toBe(true)
    expect(w.findAll('.column')).toHaveLength(4)
  })

  it('拖拽卡片到待发布列会改变阶段', async () => {
    const doc = seed() as DeskDoc & { _a: string }
    const w = await mountMedia(doc)

    const card = w.find(`[data-testid="media-card-${doc._a}"]`)
    await card.trigger('dragstart')
    await w.find('[data-testid="media-column-ready"]').trigger('drop')
    await flushPromises()

    expect(db.doc.media.find((m) => m.id === doc._a)?.stage).toBe('ready')
  })

  it('点卡片打开详情抽屉', async () => {
    const doc = seed() as DeskDoc & { _a: string }
    const w = await mountMedia(doc)

    await w.find(`[data-testid="media-card-${doc._a}"]`).trigger('click')
    await flushPromises()

    expect(ui.drawer?.title).toBe('内容详情')
    expect((ui.drawer?.props as { contentId?: string })?.contentId).toBe(doc._a)
  })

  it('新建选题进入选题列', async () => {
    const doc = createEmptyDoc()
    const w = await mountMedia(doc)

    const input = w.find('[data-testid="media-new"]')
    await input.setValue('一个人做小工具的三年')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(db.doc.media).toHaveLength(1)
    expect(db.doc.media[0].stage).toBe('idea')
    expect(w.find('[data-testid="media-column-idea"]').text()).toContain('一个人做小工具的三年')
  })

  it('切到日历视图能看到按日期排布的内容', async () => {
    const doc = createEmptyDoc()
    const content = createContent(doc, { title: '今天该发这条' })!
    doc.media[0].publishAt = new Date().toISOString()
    const w = await mountMedia(doc)

    await w.find('[data-testid="seg-calendar"]').trigger('click')
    await flushPromises()

    expect(w.find('[data-testid="media-calendar"]').exists()).toBe(true)
    expect(w.text()).toContain('今天该发这条')
    expect(content.id).toBeTruthy()
  })
})

describe('内容加入今天（AC-33）', () => {
  it('只建提醒条目，重复点不新增，勾掉不改阶段', async () => {
    const doc = createEmptyDoc()
    const content = createContent(doc, { title: '短视频脚本' })!
    setStage(doc, content.id, 'ready')
    db.doc = doc
    db.ready = true

    wrapper = mount(ContentDrawer, { props: { contentId: content.id }, attachTo: document.body })
    await flushPromises()

    await wrapper.find('[data-testid="content-join-today"]').trigger('click')
    await flushPromises()

    expect(db.doc.plans).toHaveLength(1)
    expect(db.doc.plans[0].sourceType).toBe('content')
    expect(db.doc.plans[0].module).toBe('media')
    expect(db.doc.plans[0].date).toBe(todayKey())

    await wrapper.find('[data-testid="content-join-today"]').trigger('click')
    await flushPromises()
    expect(db.doc.plans).toHaveLength(1)

    togglePlanItem(db.doc, db.doc.plans[0].id)
    expect(db.doc.plans[0].done).toBe(true)
    expect(db.doc.media[0].stage).toBe('ready')
  })
})

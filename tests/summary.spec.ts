import { describe, it, expect } from 'vitest'
import { createEmptyDoc, type DeskDoc } from '@/types'
import { buildSummary, publishText } from '@/features/home/summary'
import { addDays, todayKey, weekStartKey, weekdayIndex } from '@/lib/date'

const TODAY = '2026-11-13'

function doc(): DeskDoc {
  return createEmptyDoc()
}

describe('首页摘要聚合', () => {
  it('自媒体统计待发布数量与最近的发布时间', () => {
    const d = doc()
    d.media.push(
      { id: 'm1', title: 'A', platforms: [], stage: 'ready', publishAt: '2026-11-14T19:00:00.000Z', publishedAt: null, body: '', stats: { views: 0, likes: 0, follows: 0, recordedAt: null }, createdAt: '', updatedAt: '' },
      { id: 'm2', title: 'B', platforms: [], stage: 'ready', publishAt: '2026-11-13T10:00:00.000Z', publishedAt: null, body: '', stats: { views: 0, likes: 0, follows: 0, recordedAt: null }, createdAt: '', updatedAt: '' },
      { id: 'm3', title: 'C', platforms: [], stage: 'published', publishAt: null, publishedAt: '', body: '', stats: { views: 0, likes: 0, follows: 0, recordedAt: null }, createdAt: '', updatedAt: '' },
    )
    const s = buildSummary(d, TODAY)
    expect(s.media.ready).toBe(2)
    expect(s.media.nextPublish).toBe('2026-11-13T10:00:00.000Z')
  })

  it('开发统计进行中项目与未解 Bug', () => {
    const d = doc()
    d.projects.push(
      { id: 'p1', name: 'A', status: 'active', repoUrl: '', note: '', createdAt: '' },
      { id: 'p2', name: 'B', status: 'active', repoUrl: '', note: '', createdAt: '' },
      { id: 'p3', name: 'C', status: 'done', repoUrl: '', note: '', createdAt: '' },
    )
    d.bugs.push(
      { id: 'b1', projectId: 'p1', title: 'x', severity: 'major', status: 'open', note: '', createdAt: '' },
      { id: 'b2', projectId: 'p1', title: 'y', severity: 'minor', status: 'open', note: '', createdAt: '' },
      { id: 'b3', projectId: 'p2', title: 'z', severity: 'minor', status: 'fixed', note: '', createdAt: '' },
    )
    const s = buildSummary(d, TODAY)
    expect(s.dev).toEqual({ activeProjects: 2, openBugs: 2 })
  })

  it('咨询给出下一次会谈与逾期跟进数', () => {
    const d = doc()
    d.sessions.push(
      { id: 's1', clientId: 'c1', engagementId: null, date: '2026-11-10', durationMin: 60, topic: '', conclusion: '', nextFollowUpDate: null },
      { id: 's2', clientId: 'c1', engagementId: null, date: '2026-11-15', durationMin: 60, topic: '', conclusion: '', nextFollowUpDate: null },
    )
    d.followups.push(
      { id: 'f1', clientId: 'c1', title: 'a', dueDate: '2026-11-12', status: 'open', fromSessionId: null, createdAt: '' },
      { id: 'f2', clientId: 'c1', title: 'b', dueDate: '2026-11-20', status: 'open', fromSessionId: null, createdAt: '' },
      { id: 'f3', clientId: 'c1', title: 'c', dueDate: '2026-11-11', status: 'done', fromSessionId: null, createdAt: '' },
    )
    const s = buildSummary(d, TODAY)
    expect(s.consult.nextSession).toBe('2026-11-15')
    expect(s.consult.pending).toBe(2)
    expect(s.consult.overdue).toBe(1)
  })

  it('健身给出今天练什么与本周完成次数', () => {
    const d = doc()
    const weekday = weekdayIndex(TODAY)
    const start = weekStartKey(TODAY, 1)
    d.weekPlans.push(
      { id: 'w1', weekday, type: 'train', focus: '胸 + 三头', exerciseIds: [] },
      { id: 'w2', weekday: (weekday % 7) + 1, type: 'train', focus: '背', exerciseIds: [] },
      { id: 'w3', weekday: ((weekday + 1) % 7) + 1, type: 'rest', focus: '', exerciseIds: [] },
    )
    d.workouts.push(
      { id: 'k1', date: start, focus: '胸', items: [], completed: true, durationMin: 50 },
      { id: 'k2', date: addDays(start, 1), focus: '背', items: [], completed: true, durationMin: 50 },
      { id: 'k3', date: addDays(start, 2), focus: '腿', items: [], completed: false, durationMin: 0 },
      { id: 'k4', date: addDays(start, -1), focus: '腿', items: [], completed: true, durationMin: 50 },
    )
    const s = buildSummary(d, TODAY)
    expect(s.fitness.today).toBe('胸 + 三头')
    expect(s.fitness.weekDone).toBe(2)
    expect(s.fitness.weekTotal).toBe(2)
  })

  it('休息日显示休息', () => {
    const d = doc()
    d.weekPlans.push({ id: 'w1', weekday: weekdayIndex(TODAY), type: 'rest', focus: '', exerciseIds: [] })
    expect(buildSummary(d, TODAY).fitness.today).toBe('今天休息')
  })

  it('饮食拼出今天三餐与喝水杯数', () => {
    const d = doc()
    d.dishes.push(
      { id: 'd1', name: '燕麦粥', mealType: 'breakfast', calories: 300, note: '' },
      { id: 'd2', name: '鸡胸沙拉', mealType: 'lunch', calories: 500, note: '' },
    )
    d.mealPlans.push(
      { id: 'mp1', date: TODAY, mealType: 'breakfast', dishIds: ['d1'] },
      { id: 'mp2', date: TODAY, mealType: 'lunch', dishIds: ['d2'] },
      { id: 'mp3', date: TODAY, mealType: 'dinner', dishIds: [] },
    )
    d.waterLogs.push({ id: 'wl1', date: TODAY, cups: 3 })
    const s = buildSummary(d, TODAY)
    expect(s.diet.meals).toBe('早餐 燕麦粥 · 午餐 鸡胸沙拉')
    expect(s.diet.water).toBe(3)
  })

  it('娱乐按本周累计分钟折算小时，并给出在玩项', () => {
    const d = doc()
    const start = weekStartKey(TODAY, 1)
    d.leisureLogs.push(
      { id: 'l1', date: TODAY, kind: 'game', minutes: 90, note: '' },
      { id: 'l2', date: start, kind: 'show', minutes: 30, note: '' },
      { id: 'l3', date: addDays(start, -2), kind: 'game', minutes: 120, note: '' },
    )
    d.games.push({ id: 'g1', title: '空洞骑士', platform: 'PC', status: 'playing', rating: 5, progress: 60, note: '' })
    const s = buildSummary(d, TODAY)
    expect(s.play.weekHours).toBe(2)
    expect(s.play.current).toBe('空洞骑士 60%')
  })
})

describe('发布时间文案', () => {
  it('没有定时给兜底文案', () => {
    expect(publishText(null)).toBe('还没定时')
  })

  it('今天与明天用相对说法', () => {
    const now = new Date()
    const todayAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0)
    expect(publishText(todayAt.toISOString())).toContain('今天')

    const tomorrowAt = new Date(todayAt.getTime() + 86400000)
    expect(publishText(tomorrowAt.toISOString())).toContain('明天')
  })

  it('更远的日期用月日', () => {
    const d = new Date()
    const later = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 10, 9, 30)
    expect(publishText(later.toISOString())).toContain('月')
  })
})

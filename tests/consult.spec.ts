import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import Consult from '@/views/Consult.vue'
import { createTestRouter } from '@/router'
import { db, resetDbForTests } from '@/store/db'
import { createEmptyDoc, type DeskDoc } from '@/types'
import { addDays, todayKey, toKey } from '@/lib/date'
import {
  addClient,
  addEngagement,
  addSession,
  clientSummary,
  generateFollowUp,
  isOverdue,
  monthlyBilling,
  removeClient,
  sortedFollowUps,
  toggleFollowUp,
} from '@/features/consult/consultLogic'

const TODAY = todayKey()
let wrapper: VueWrapper | null = null

function seed(): DeskDoc {
  const doc = createEmptyDoc()
  const client = addClient(doc, '客户 A', '微信')!
  addEngagement(doc, { clientId: client.id, name: '流程梳理', amount: 12000 })
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
  vi.unstubAllGlobals()
})

describe('客户与项目', () => {
  it('新增客户', () => {
    const doc = createEmptyDoc()
    const client = addClient(doc, '张三', '电话 123')!
    expect(doc.clients).toHaveLength(1)
    expect(client.contact).toBe('电话 123')
  })

  it('空客户名不创建', () => {
    const doc = createEmptyDoc()
    expect(addClient(doc, '  ')).toBeNull()
  })

  it('没有客户时项目不会创建', () => {
    const doc = createEmptyDoc()
    expect(addEngagement(doc, { clientId: '', name: '项目' })).toBeNull()
  })

  it('删除客户会清掉项目、会谈与跟进', () => {
    const doc = seed()
    const clientId = doc.clients[0].id
    const session = addSession(doc, { clientId, topic: '第一次', conclusion: '出清单' })!
    generateFollowUp(doc, session.id)

    removeClient(doc, clientId)

    expect(doc.clients).toHaveLength(0)
    expect(doc.engagements).toHaveLength(0)
    expect(doc.sessions).toHaveLength(0)
    expect(doc.followups).toHaveLength(0)
  })

  it('客户汇总给出进行中项目与会谈时长', () => {
    const doc = seed()
    const clientId = doc.clients[0].id
    addSession(doc, { clientId, durationMin: 90 })
    addSession(doc, { clientId, durationMin: 30 })

    const summary = clientSummary(doc, clientId)
    expect(summary.engagements).toBe(1)
    expect(summary.sessions).toBe(2)
    expect(summary.minutes).toBe(120)
  })
})

describe('会谈转跟进', () => {
  it('用结论做跟进标题，用下次跟进日做截止日', () => {
    const doc = seed()
    const clientId = doc.clients[0].id
    const session = addSession(doc, {
      clientId,
      topic: '第二次',
      conclusion: '先出一版流程清单\n下周三前给',
      nextFollowUpDate: '2026-11-20',
    })!

    const followup = generateFollowUp(doc, session.id)!

    expect(followup.title).toBe('先出一版流程清单')
    expect(followup.dueDate).toBe('2026-11-20')
    expect(followup.fromSessionId).toBe(session.id)
    expect(doc.followups).toHaveLength(1)
  })

  it('没有填下次跟进日时默认三天后', () => {
    const doc = seed()
    const clientId = doc.clients[0].id
    const session = addSession(doc, { clientId, conclusion: '跟进一下' })!
    const followup = generateFollowUp(doc, session.id)!
    expect(followup.dueDate).toBe(addDays(TODAY, 3))
  })

  it('跟进勾完成与取消', () => {
    const doc = seed()
    const session = addSession(doc, { clientId: doc.clients[0].id, conclusion: 'A' })!
    const followup = generateFollowUp(doc, session.id)!

    toggleFollowUp(doc, followup.id)
    expect(doc.followups[0].status).toBe('done')

    toggleFollowUp(doc, followup.id)
    expect(doc.followups[0].status).toBe('open')
  })
})

describe('跟进排序与逾期', () => {
  it('逾期规则：未完成且截止日早于今天', () => {
    const doc = seed()
    const clientId = doc.clients[0].id
    const session = addSession(doc, { clientId, conclusion: 'A' })!
    const followup = generateFollowUp(doc, session.id)!
    followup.dueDate = addDays(TODAY, -1)

    expect(isOverdue(followup, TODAY)).toBe(true)
    followup.status = 'done'
    expect(isOverdue(followup, TODAY)).toBe(false)
    followup.dueDate = null
    followup.status = 'open'
    expect(isOverdue(followup, TODAY)).toBe(false)
  })

  it('逾期排最前，然后是其他未完成，最后是已完成', () => {
    const doc = seed()
    const clientId = doc.clients[0].id
    const make = (title: string, due: string | null) => {
      const session = addSession(doc, { clientId, conclusion: title })!
      const followup = generateFollowUp(doc, session.id)!
      followup.dueDate = due
      return followup
    }
    const later = make('后面做', addDays(TODAY, 5))
    const overdue = make('已经过期', addDays(TODAY, -2))
    const done = make('做完了', TODAY)
    toggleFollowUp(doc, done.id)

    const sorted = sortedFollowUps(doc, TODAY)
    expect(sorted.map((f) => f.title)).toEqual(['已经过期', '后面做', '做完了'])
    expect(sorted[0].id).toBe(overdue.id)
    expect(sorted[1].id).toBe(later.id)
  })
})

describe('金额汇总', () => {
  it('按月汇总应收与已收，按项目列出', () => {
    const doc = seed()
    const engagement = doc.engagements[0]
    engagement.startDate = `${TODAY.slice(0, 7)}-01`
    engagement.received = 6000

    const billing = monthlyBilling(doc, TODAY.slice(0, 7))
    expect(billing.amount).toBe(12000)
    expect(billing.received).toBe(6000)
    expect(billing.rows[0].clientName).toBe('客户 A')
  })

  it('不在该月的项目不计入', () => {
    const doc = seed()
    doc.engagements[0].startDate = '2020-01-01'
    doc.engagements[0].endDate = '2020-02-01'
    const billing = monthlyBilling(doc, '2026-11')
    expect(billing.rows).toHaveLength(0)
  })
})

describe('咨询页面', () => {
  async function mountConsult(doc: DeskDoc, path = '/consult') {
    db.doc = doc
    db.ready = true
    const router = createTestRouter()
    await router.push(path)
    wrapper = mount(Consult, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    return wrapper
  }

  it('从首页带 tab 参数进来会直接打开跟进页签', async () => {
    const w = await mountConsult(seed(), '/consult?tab=followups')
    expect(w.find('[data-testid="consult-followups"]').exists()).toBe(true)
  })

  it('默认显示客户页签，可以直接新增客户', async () => {
    const w = await mountConsult(createEmptyDoc())
    expect(w.find('[data-testid="consult-clients"]').exists()).toBe(true)

    const input = w.find('[data-testid="client-name"]')
    await input.setValue('客户 B')
    await w.find('[data-testid="client-add"]').trigger('click')
    await flushPromises()

    expect(db.doc.clients).toHaveLength(1)
    expect(db.doc.clients[0].name).toBe('客户 B')
  })

  it('会谈记录可以一键生成跟进', async () => {
    const doc = seed()
    const clientId = doc.clients[0].id
    addSession(doc, { clientId, date: TODAY, topic: '第一次', conclusion: '给清单', nextFollowUpDate: toKey(new Date()) })
    const w = await mountConsult(doc, '/consult?tab=sessions')

    const sessionId = db.doc.sessions[0].id
    await w.find(`[data-testid="sess-followup-${sessionId}"]`).trigger('click')
    await flushPromises()

    expect(db.doc.followups).toHaveLength(1)
    expect(db.doc.followups[0].title).toBe('给清单')
  })

  it('客户可以删除：两次点击确认，连带清掉项目、会谈与跟进', async () => {
    const doc = seed()
    const client = doc.clients[0]
    const session = addSession(doc, { clientId: client.id, topic: '初次沟通', conclusion: '出方案' })!
    generateFollowUp(doc, session.id)
    expect(doc.engagements.length).toBe(1)
    expect(doc.followups.length).toBe(1)

    const w = await mountConsult(doc)
    const row = w.find(`[data-testid="client-${client.id}"]`)
    const del = row.find('[data-testid="inline-delete"]')

    expect(del.exists()).toBe(true)
    expect(del.attributes('data-pending')).toBe('false')

    // 第一次点击只进入待确认，不删数据
    await del.trigger('click')
    expect(del.attributes('data-pending')).toBe('true')
    expect(db.doc.clients).toHaveLength(1)

    // 第二次点击才真正删除
    await del.trigger('click')
    await flushPromises()
    expect(db.doc.clients).toHaveLength(0)
    expect(db.doc.engagements).toHaveLength(0)
    expect(db.doc.sessions).toHaveLength(0)
    expect(db.doc.followups).toHaveLength(0)
  })

  it('逾期跟进有醒目标记', async () => {
    const doc = seed()
    const clientId = doc.clients[0].id
    const session = addSession(doc, { clientId, conclusion: '过期的事' })!
    const followup = generateFollowUp(doc, session.id)!
    followup.dueDate = addDays(TODAY, -1)

    const w = await mountConsult(doc, '/consult?tab=followups')
    const row = w.find(`[data-testid="followup-${followup.id}"]`)
    expect(row.classes()).toContain('overdue')
  })
})

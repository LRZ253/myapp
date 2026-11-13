import type { Client, DeskDoc, Engagement, EngagementStage, FollowUp, Session } from '@/types'
import { addDays, todayKey } from '@/lib/date'

export function addClient(doc: DeskDoc, name: string, contact = ''): Client | null {
  const text = name.trim()
  if (!text) return null
  const client: Client = {
    id: `client_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: text,
    contact,
    status: 'active',
    note: '',
  }
  doc.clients.push(client)
  return client
}

export function updateClient(doc: DeskDoc, id: string, patchData: Partial<Client>): void {
  const client = doc.clients.find((c) => c.id === id)
  if (client) Object.assign(client, patchData)
}

export function removeClient(doc: DeskDoc, id: string): void {
  doc.clients = doc.clients.filter((c) => c.id !== id)
  doc.engagements = doc.engagements.filter((e) => e.clientId !== id)
  doc.sessions = doc.sessions.filter((s) => s.clientId !== id)
  doc.followups = doc.followups.filter((f) => f.clientId !== id)
}

export function addEngagement(doc: DeskDoc, input: { clientId: string; name: string; amount?: number; stage?: EngagementStage }): Engagement | null {
  const name = input.name.trim()
  if (!input.clientId || !name) return null
  const engagement: Engagement = {
    id: `eng_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    clientId: input.clientId,
    name,
    stage: input.stage || 'lead',
    amount: input.amount || 0,
    received: 0,
    startDate: null,
    endDate: null,
    note: '',
  }
  doc.engagements.push(engagement)
  return engagement
}

export function updateEngagement(doc: DeskDoc, id: string, patchData: Partial<Engagement>): void {
  const engagement = doc.engagements.find((e) => e.id === id)
  if (engagement) Object.assign(engagement, patchData)
}

export function addSession(
  doc: DeskDoc,
  input: {
    clientId: string
    engagementId?: string | null
    date?: string
    durationMin?: number
    topic?: string
    conclusion?: string
    nextFollowUpDate?: string | null
  },
): Session | null {
  if (!input.clientId) return null
  const session: Session = {
    id: `sess_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    clientId: input.clientId,
    engagementId: input.engagementId || null,
    date: input.date || todayKey(),
    durationMin: input.durationMin || 60,
    topic: input.topic || '',
    conclusion: input.conclusion || '',
    nextFollowUpDate: input.nextFollowUpDate || null,
  }
  doc.sessions.push(session)
  return session
}

export function sessionsOf(doc: DeskDoc, clientId?: string): Session[] {
  return doc.sessions
    .filter((s) => (clientId ? s.clientId === clientId : true))
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

/** 从会谈记录一键生成跟进 */
export function generateFollowUp(doc: DeskDoc, sessionId: string): FollowUp | null {
  const session = doc.sessions.find((s) => s.id === sessionId)
  if (!session) return null
  const title = (session.conclusion || session.topic || '会后跟进').split('\n')[0].trim().slice(0, 60)
  const followup: FollowUp = {
    id: `fu_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    clientId: session.clientId,
    title,
    dueDate: session.nextFollowUpDate || addDays(todayKey(), 3),
    status: 'open',
    fromSessionId: session.id,
    createdAt: new Date().toISOString(),
  }
  doc.followups.push(followup)
  return followup
}

export function toggleFollowUp(doc: DeskDoc, id: string, done?: boolean): void {
  const followup = doc.followups.find((f) => f.id === id)
  if (!followup) return
  followup.status = (done ?? followup.status !== 'done') ? 'done' : 'open'
}

export function removeFollowUp(doc: DeskDoc, id: string): void {
  doc.followups = doc.followups.filter((f) => f.id !== id)
}

export function isOverdue(followup: FollowUp, today = todayKey()): boolean {
  return followup.status === 'open' && !!followup.dueDate && followup.dueDate < today
}

/** 未完成的排前面，其中逾期的排最前，再按截止日 */
export function sortedFollowUps(doc: DeskDoc, today = todayKey()): FollowUp[] {
  return doc.followups.slice().sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1
    const ao = isOverdue(a, today)
    const bo = isOverdue(b, today)
    if (ao !== bo) return ao ? -1 : 1
    if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : 1
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return 0
  })
}

export function clientSummary(doc: DeskDoc, clientId: string) {
  const sessions = sessionsOf(doc, clientId)
  return {
    engagements: doc.engagements.filter((e) => e.clientId === clientId && e.stage !== 'closed').length,
    sessions: sessions.length,
    minutes: sessions.reduce((sum, s) => sum + s.durationMin, 0),
    openFollowUps: doc.followups.filter((f) => f.clientId === clientId && f.status === 'open').length,
  }
}

export interface BillingRow {
  engagementId: string
  clientName: string
  name: string
  amount: number
  received: number
}

export function monthlyBilling(doc: DeskDoc, month: string): { amount: number; received: number; rows: BillingRow[] } {
  const start = `${month}-01`
  const end = `${month}-31`
  const rows: BillingRow[] = []
  for (const engagement of doc.engagements) {
    const from = engagement.startDate || start
    const to = engagement.endDate || end
    if (from > end || to < start) continue
    rows.push({
      engagementId: engagement.id,
      clientName: doc.clients.find((c) => c.id === engagement.clientId)?.name || '未知客户',
      name: engagement.name,
      amount: engagement.amount,
      received: engagement.received,
    })
  }
  return {
    amount: rows.reduce((sum, r) => sum + r.amount, 0),
    received: rows.reduce((sum, r) => sum + r.received, 0),
    rows,
  }
}

export function formatMoney(value: number): string {
  return `¥${Math.round(value).toLocaleString('zh-CN')}`
}

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import Segmented from '@/components/Segmented.vue'
import EmptyState from '@/components/EmptyState.vue'
import InlineDelete from '@/components/InlineDelete.vue'
import { db, patch } from '@/store/db'
import { toast } from '@/store/ui'
import { todayKey, toKey } from '@/lib/date'
import { ENGAGEMENT_STAGE_LABELS } from '@/lib/labels'
import type { EngagementStage } from '@/types'
import { addPlanItem, defaultSection } from '@/features/plan/planLogic'
import {
  addClient,
  addEngagement,
  addSession,
  clientSummary,
  formatMoney,
  generateFollowUp,
  isOverdue,
  monthlyBilling,
  removeClient,
  removeFollowUp,
  sortedFollowUps,
  toggleFollowUp,
  updateClient,
  updateEngagement,
} from '@/features/consult/consultLogic'

const route = useRoute()
const initialTab = typeof route.query.tab === 'string' ? route.query.tab : 'clients'
const tab = ref(['clients', 'engagements', 'sessions', 'followups'].includes(initialTab) ? initialTab : 'clients')

const today = todayKey()
const month = ref(today.slice(0, 7))

const newClientName = ref('')
const newClientContact = ref('')
const newProjectName = ref('')
const newProjectClient = ref('')
const newProjectAmount = ref<number | null>(null)

const sessionForm = ref({
  clientId: '',
  date: today,
  durationMin: 60,
  topic: '',
  conclusion: '',
  nextFollowUpDate: '',
})

const tabItems = [
  { value: 'clients', label: '客户' },
  { value: 'engagements', label: '项目' },
  { value: 'sessions', label: '会谈' },
  { value: 'followups', label: '跟进' },
]

const followups = computed(() => sortedFollowUps(db.doc, today))
const sessions = computed(() =>
  db.doc.sessions.slice().sort((a, b) => (a.date < b.date ? 1 : -1)),
)
const billing = computed(() => monthlyBilling(db.doc, month.value))

const subtitle = computed(() => {
  const open = db.doc.followups.filter((f) => f.status === 'open').length
  const overdue = db.doc.followups.filter((f) => isOverdue(f, today)).length
  return `${db.doc.clients.length} 位客户 · ${open} 件待跟进${overdue ? ` · ${overdue} 件逾期` : ''}`
})

function clientName(id: string) {
  return db.doc.clients.find((c) => c.id === id)?.name || '未知客户'
}

function addNewClient() {
  const name = newClientName.value
  if (!name.trim()) return
  patch((doc) => addClient(doc, name, newClientContact.value))
  newClientName.value = ''
  newClientContact.value = ''
  toast('已添加客户')
}

function addNewProject() {
  if (!newProjectClient.value || !newProjectName.value.trim()) return
  patch((doc) =>
    addEngagement(doc, {
      clientId: newProjectClient.value,
      name: newProjectName.value,
      amount: Number(newProjectAmount.value) || 0,
    }),
  )
  newProjectName.value = ''
  newProjectAmount.value = null
  toast('已添加项目')
}

function saveSession() {
  const form = sessionForm.value
  if (!form.clientId) return
  patch((doc) =>
    addSession(doc, {
      clientId: form.clientId,
      date: form.date,
      durationMin: Number(form.durationMin) || 60,
      topic: form.topic,
      conclusion: form.conclusion,
      nextFollowUpDate: form.nextFollowUpDate || null,
    }),
  )
  sessionForm.value = { clientId: form.clientId, date: today, durationMin: 60, topic: '', conclusion: '', nextFollowUpDate: '' }
  toast('已记录会谈')
}

function createFollowUp(sessionId: string) {
  let ok = false
  patch((doc) => {
    ok = !!generateFollowUp(doc, sessionId)
  })
  toast(ok ? '已生成跟进' : '生成失败')
}

function joinFollowUp(followupId: string, title: string) {
  let duplicated = false
  patch((doc) => {
    const result = addPlanItem(doc, {
      date: today,
      section: defaultSection(),
      title,
      module: 'consult',
      sourceType: 'followup',
      sourceId: followupId,
    })
    duplicated = result.duplicated
  })
  toast(duplicated ? '已在今天' : '已加入今天')
}

function seed() {
  patch((doc) => {
    const client = addClient(doc, '示例客户 A', '微信：abc')
    if (!client) return
    addEngagement(doc, { clientId: client.id, name: '流程梳理咨询', amount: 12000, stage: 'active' })
    addSession(doc, {
      clientId: client.id,
      date: today,
      durationMin: 60,
      topic: '第一次沟通',
      conclusion: '先出一版流程清单',
      nextFollowUpDate: toKey(new Date(Date.now() + 3 * 86400000)),
    })
  })
}
</script>

<template>
  <section data-testid="page-consult">
    <PageHeader title="咨询工作" :subtitle="subtitle">
      <Segmented v-model="tab" :items="tabItems" />
    </PageHeader>

    <div v-if="tab === 'clients'" class="tab-body" data-testid="consult-clients">
        <div class="card add-card">
          <input v-model="newClientName" placeholder="客户名，回车添加" data-testid="client-name" @keydown.enter="addNewClient" />
          <input v-model="newClientContact" placeholder="联系方式（可选）" class="contact" />
          <button class="btn primary" data-testid="client-add" @click="addNewClient">添加</button>
        </div>

        <EmptyState
          v-if="!db.doc.clients.length"
          title="还没有客户"
          desc="加第一位客户，咨询项目、会谈和跟进都挂在客户下面。"
          action-label="填入示例"
          @action="seed"
        />

        <div v-for="client in db.doc.clients" :key="client.id" class="card line-card" :data-testid="`client-${client.id}`">
          <div class="line-main">
            <span class="name">{{ client.name }}</span>
            <span class="hint">{{ client.contact || '—' }}</span>
          </div>
          <span class="hint">进行中 {{ clientSummary(db.doc, client.id).engagements }} 个 · 待跟进 {{ clientSummary(db.doc, client.id).openFollowUps }}</span>
          <select
            :value="client.status"
            class="mini-select"
            @change="patch((doc) => updateClient(doc, client.id, { status: ($event.target as HTMLSelectElement).value as 'active' | 'paused' | 'ended' }))"
          >
            <option value="active">合作中</option>
            <option value="paused">暂停</option>
            <option value="ended">已结束</option>
          </select>
          <InlineDelete label="删除" @confirm="patch((doc) => removeClient(doc, client.id))" />
        </div>
      </div>

      <div v-else-if="tab === 'engagements'" class="tab-body" data-testid="consult-engagements">
        <div class="card add-card">
          <select v-model="newProjectClient" class="mini-select" data-testid="eng-client">
            <option value="">选客户</option>
            <option v-for="client in db.doc.clients" :key="client.id" :value="client.id">{{ client.name }}</option>
          </select>
          <input v-model="newProjectName" placeholder="项目名" data-testid="eng-name" />
          <input v-model.number="newProjectAmount" type="number" min="0" placeholder="金额" class="amount" />
          <button class="btn primary" data-testid="eng-add" @click="addNewProject">添加</button>
        </div>

        <div v-for="eng in db.doc.engagements" :key="eng.id" class="card line-card" :data-testid="`eng-${eng.id}`">
          <div class="line-main">
            <span class="name">{{ eng.name }}</span>
            <span class="hint">{{ clientName(eng.clientId) }}</span>
          </div>
          <select
            :value="eng.stage"
            class="mini-select"
            @change="patch((doc) => updateEngagement(doc, eng.id, { stage: ($event.target as HTMLSelectElement).value as EngagementStage }))"
          >
            <option v-for="(label, key) in ENGAGEMENT_STAGE_LABELS" :key="key" :value="key">{{ label }}</option>
          </select>
          <span class="hint">{{ formatMoney(eng.amount) }} / 已收 {{ formatMoney(eng.received) }}</span>
        </div>

        <div class="card month-block">
          <div class="row">
            <input v-model="month" type="month" class="mini-select" />
            <span class="hint">应收 {{ formatMoney(billing.amount) }} · 已收 {{ formatMoney(billing.received) }}</span>
          </div>
          <div v-for="row in billing.rows" :key="row.engagementId" class="billing-row">
            <span>{{ row.clientName }}</span>
            <span class="hint">{{ row.name }}</span>
            <span class="hint">{{ formatMoney(row.received) }} / {{ formatMoney(row.amount) }}</span>
          </div>
        </div>
      </div>

      <div v-else-if="tab === 'sessions'" class="tab-body" data-testid="consult-sessions">
        <div class="card add-card form-grid">
          <select v-model="sessionForm.clientId" class="mini-select" data-testid="sess-client">
            <option value="">选客户</option>
            <option v-for="client in db.doc.clients" :key="client.id" :value="client.id">{{ client.name }}</option>
          </select>
          <input v-model="sessionForm.date" type="date" class="mini-select" data-testid="sess-date" />
          <input v-model.number="sessionForm.durationMin" type="number" min="1" class="amount" placeholder="分钟" />
          <input v-model="sessionForm.topic" placeholder="议题" data-testid="sess-topic" />
          <input v-model="sessionForm.conclusion" placeholder="结论（会生成跟进标题）" data-testid="sess-conclusion" />
          <input v-model="sessionForm.nextFollowUpDate" type="date" class="mini-select" data-testid="sess-next" />
          <button class="btn primary" data-testid="sess-add" @click="saveSession">记录会谈</button>
        </div>

        <div v-for="session in sessions" :key="session.id" class="card line-card" :data-testid="`sess-${session.id}`">
          <span class="hint">{{ session.date }}</span>
          <div class="line-main">
            <span class="name">{{ session.topic || '未填议题' }}</span>
            <span class="hint">{{ clientName(session.clientId) }} · {{ session.durationMin }} 分钟</span>
          </div>
          <span class="hint conclusion">{{ session.conclusion || '—' }}</span>
          <button class="btn mini" :data-testid="`sess-followup-${session.id}`" @click="createFollowUp(session.id)">生成跟进</button>
        </div>
      </div>

      <div v-else class="tab-body" data-testid="consult-followups">
        <div
          v-for="followup in followups"
          :key="followup.id"
          class="card line-card"
          :class="{ overdue: isOverdue(followup, today) }"
          :data-testid="`followup-${followup.id}`"
        >
          <button
            class="check"
            :aria-checked="followup.status === 'done'"
            :data-testid="`followup-toggle-${followup.id}`"
            @click="patch((doc) => toggleFollowUp(doc, followup.id))"
          />
          <div class="line-main">
            <span class="name" :class="{ done: followup.status === 'done' }">{{ followup.title }}</span>
            <span class="hint">{{ clientName(followup.clientId) }}</span>
          </div>
          <span class="hint" :class="{ danger: isOverdue(followup, today) }">{{ followup.dueDate || '无截止' }}</span>
          <button class="btn mini" @click="joinFollowUp(followup.id, followup.title)">加入今天</button>
          <InlineDelete label="删除" @confirm="patch((doc) => removeFollowUp(doc, followup.id))" />
        </div>
        <p v-if="!followups.length" class="hint">还没有跟进事项。会谈记录里点「生成跟进」就能拉一条。</p>
      </div>
  </section>
</template>

<style scoped>
.tab-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.add-card {
  display: flex;
  gap: 6px;
  padding: 8px;
  margin-bottom: 4px;
}

.form-grid {
  display: grid;
  grid-template-columns: 140px 140px 90px minmax(0, 1fr) minmax(0, 1.2fr) 140px 90px;
  align-items: center;
}

.line-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  font-size: 12px;
}

.line-card.overdue {
  border-color: var(--danger);
  background: var(--danger-soft);
}

.line-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.name {
  font-size: 12.5px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name.done {
  color: var(--text-3);
  text-decoration: line-through;
}

.conclusion {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-select {
  font-size: 11px;
  border: 0.5px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--bg);
  padding: 2px 4px;
  width: auto;
}

.amount {
  width: 90px;
  font-size: 11px;
}

.contact {
  max-width: 200px;
}

.mini {
  font-size: 11px;
  padding: 1px 7px;
}

.check {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 0.5px solid var(--border-strong);
  background: transparent;
  padding: 0;
}

.check[aria-checked='true'] {
  background: var(--text-2);
  border-color: var(--text-2);
}

.danger {
  color: var(--danger);
}

.month-block {
  margin-top: 8px;
  padding: 10px;
}

.billing-row {
  display: flex;
  gap: 10px;
  font-size: 12px;
  padding: 3px 0;
  border-top: 0.5px solid var(--border);
}
</style>

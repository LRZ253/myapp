<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import PlanList from '@/features/plan/PlanList.vue'
import { db, patch } from '@/store/db'
import { addDays, formatDate, todayKey, weekdayName } from '@/lib/date'
import { addPlanItem, isDoneToday, rolloverCandidates, rolloverItems } from '@/features/plan/planLogic'

const route = useRoute()
const router = useRouter()
const today = todayKey()

const dismissed = ref(false)
const expanded = ref(false)
const picked = ref<string[]>([])

const date = computed(() => (typeof route.query.date === 'string' && route.query.date ? route.query.date : today))
const stats = computed(() => isDoneToday(db.doc, date.value))
const candidates = computed(() => rolloverCandidates(db.doc, today))
const showRollover = computed(() => date.value === today && candidates.value.length > 0 && !dismissed.value)

const subtitle = computed(() => {
  if (!stats.value.total) return '把要做的事排进来'
  return `完成 ${stats.value.done} / ${stats.value.total}`
})

const dateLabel = computed(() => `${formatDate(date.value)} ${weekdayName(date.value)}`)

function go(target: string) {
  if (target === today) router.push({ path: '/today' })
  else router.push({ path: '/today', query: { date: target } })
}

function togglePicked(id: string) {
  const index = picked.value.indexOf(id)
  if (index >= 0) picked.value.splice(index, 1)
  else picked.value.push(id)
}

function moveAll() {
  patch((doc) => rolloverItems(doc, candidates.value.map((c) => c.id), today))
  dismissed.value = true
}

function movePicked() {
  const ids = picked.value.length ? picked.value : candidates.value.map((c) => c.id)
  patch((doc) => rolloverItems(doc, ids, today))
  picked.value = []
  expanded.value = false
  dismissed.value = true
}

function seed() {
  patch((doc) => {
    addPlanItem(doc, { date: date.value, section: 'am', title: '看一遍今天的安排', module: 'plan', estimateMin: 10 })
    addPlanItem(doc, { date: date.value, section: 'pm', title: '推进手上正在进行的事', module: 'plan', estimateMin: 60 })
    addPlanItem(doc, { date: date.value, section: 'eve', title: '记一笔今天的收获', module: 'plan', estimateMin: 10 })
  })
}
</script>

<template>
  <section data-testid="page-today">
    <PageHeader title="今日计划" :subtitle="subtitle">
      <div class="date-nav">
        <button class="icon-btn" aria-label="前一天" data-testid="date-prev" @click="go(addDays(date, -1))">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 6-6 6 6 6" /></svg>
        </button>
        <span class="date-text">{{ dateLabel }}</span>
        <button class="icon-btn" aria-label="后一天" data-testid="date-next" @click="go(addDays(date, 1))">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.5 6 6 6-6 6" /></svg>
        </button>
      </div>
      <button v-if="date !== today" class="btn sm" data-testid="date-today" @click="go(today)">回到今天</button>
    </PageHeader>

    <div v-if="showRollover" class="rollover" data-testid="rollover-bar">
      <div class="row">
        <span class="rollover-icon">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4.5l3 1.8" /><circle cx="12" cy="12" r="8.4" /></svg>
        </span>
        <span class="rollover-text">昨天还有 <b>{{ candidates.length }}</b> 件没做完</span>
        <div class="spacer" />
        <button class="btn mini" data-testid="rollover-expand" @click="expanded = !expanded">
          {{ expanded ? '收起' : '逐条选择' }}
        </button>
        <button class="btn primary mini" data-testid="rollover-all" @click="moveAll">全部移到今天</button>
        <button class="btn ghost mini" data-testid="rollover-ignore" @click="dismissed = true">忽略</button>
      </div>

      <div v-if="expanded" class="rollover-list">
        <label v-for="item in candidates" :key="item.id" class="rollover-item">
          <input
            type="checkbox"
            :value="item.id"
            :checked="picked.includes(item.id)"
            :data-testid="`rollover-pick-${item.id}`"
            @change="togglePicked(item.id)"
          />
          <span class="ellipsis">{{ item.title }}</span>
          <span class="hint">{{ item.date.slice(5) }}</span>
        </label>
        <button class="btn mini" data-testid="rollover-move-picked" @click="movePicked">移入选中的</button>
      </div>
    </div>

    <EmptyState
      v-if="stats.total === 0"
      title="这天还没有安排"
      desc="把要做的事加进来，或在各模块里点「加入今天」。"
      action-label="填入示例"
      data-testid="today-empty"
      @action="seed"
    />

    <PlanList :date="date" />
  </section>
</template>

<style scoped>
.date-nav {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-xs);
}

.date-text {
  font-size: var(--fs-sm);
  font-weight: 500;
  padding: 0 8px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.rollover {
  border: 1px solid var(--warn);
  border-radius: var(--radius-lg);
  padding: 12px 14px;
  margin-bottom: 16px;
  background: var(--warn-soft);
  font-size: var(--fs-sm);
}

.rollover-icon {
  color: var(--warn-text);
  display: inline-flex;
}

.rollover-text b {
  color: var(--warn-text);
}

.rollover-list {
  margin-top: 10px;
  border-top: 1px solid rgba(217, 134, 24, 0.25);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rollover-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-sm);
}

.rollover-item input {
  width: auto;
}

.rollover-item .hint {
  margin-left: auto;
}

.mini {
  height: 24px;
  font-size: var(--fs-xs);
  padding: 0 8px;
}
</style>

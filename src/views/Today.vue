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
  const base = `${formatDate(date.value)} ${weekdayName(date.value)}`
  if (!stats.value.total) return base
  return `${base} · 完成 ${stats.value.done} / ${stats.value.total}`
})

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
      <button class="btn ghost" data-testid="date-prev" @click="go(addDays(date, -1))">‹</button>
      <button v-if="date !== today" class="btn" data-testid="date-today" @click="go(today)">回到今天</button>
      <button class="btn ghost" data-testid="date-next" @click="go(addDays(date, 1))">›</button>
    </PageHeader>

    <div v-if="showRollover" class="rollover" data-testid="rollover-bar">
      <div class="row">
        <span>昨天还有 {{ candidates.length }} 件没做完</span>
        <div class="spacer" />
        <button class="btn mini" data-testid="rollover-expand" @click="expanded = !expanded">
          {{ expanded ? '收起' : '逐条选择' }}
        </button>
        <button class="btn mini" data-testid="rollover-all" @click="moveAll">全部移到今天</button>
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
          <span>{{ item.title }}</span>
          <span class="hint">{{ item.date.slice(5) }}</span>
        </label>
        <button class="btn mini" data-testid="rollover-move-picked" @click="movePicked">移入选中的</button>
      </div>
    </div>

    <EmptyState
      v-if="stats.total === 0"
      title="今天还没有安排"
      desc="把要做的事加进来，或在各模块里点「加入今天」。"
      action-label="填入示例"
      data-testid="today-empty"
      @action="seed"
    />

    <PlanList :date="date" />
  </section>
</template>

<style scoped>
.rollover {
  border: 0.5px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 8px 12px;
  margin-bottom: 14px;
  background: var(--bg-secondary);
  font-size: 12px;
}

.rollover-list {
  margin-top: 8px;
  border-top: 0.5px solid var(--border);
  padding-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rollover-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.rollover-item input {
  width: auto;
}

.rollover-item .hint {
  margin-left: auto;
}

.mini {
  font-size: 11px;
  padding: 1px 7px;
}
</style>

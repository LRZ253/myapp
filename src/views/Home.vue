<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import PlanList from '@/features/plan/PlanList.vue'
import MemoDrawer from '@/features/memo/MemoDrawer.vue'
import { db, patch } from '@/store/db'
import { addMemo, recentMemos } from '@/features/memo/memoLogic'
import { isDoneToday } from '@/features/plan/planLogic'
import { buildSummary, publishText } from '@/features/home/summary'
import { formatDate, relativeTime, todayKey, weekdayName } from '@/lib/date'
import { openDrawer } from '@/store/ui'

const router = useRouter()
const today = todayKey()
const memoDraft = ref('')

const stats = computed(() => isDoneToday(db.doc, today))
const summary = computed(() => buildSummary(db.doc, today))
const memos = computed(() => recentMemos(db.doc, 3))

const subtitle = computed(() => {
  const base = `${formatDate(today)} ${weekdayName(today)}`
  if (!stats.value.total) return base
  return `${base} · 完成 ${stats.value.done} / ${stats.value.total}`
})

const cards = computed(() => {
  const s = summary.value
  return [
    {
      key: 'media',
      label: '自媒体',
      main: `${s.media.ready} 篇待发布`,
      sub: publishText(s.media.nextPublish),
      to: '/media',
    },
    {
      key: 'dev',
      label: '开发工作',
      main: `${s.dev.activeProjects} 个项目在跑`,
      sub: `${s.dev.openBugs} 个 bug 未解`,
      to: '/dev',
    },
    {
      key: 'consult',
      label: '咨询工作',
      main: s.consult.nextSession ? `下次会谈 ${s.consult.nextSession.slice(5).replace('-', '/')}` : '暂无会谈安排',
      sub: `${s.consult.pending} 件待跟进${s.consult.overdue ? ` · ${s.consult.overdue} 件逾期` : ''}`,
      to: '/consult?tab=followups',
    },
    {
      key: 'fitness',
      label: '健身计划',
      main: s.fitness.today,
      sub: `本周 ${s.fitness.weekDone} / ${s.fitness.weekTotal} 次`,
      to: '/fitness',
    },
    {
      key: 'diet',
      label: '饮食计划',
      main: s.diet.meals || '今天还没排',
      sub: `水 ${s.diet.water} / 8 杯`,
      to: '/diet',
    },
    {
      key: 'play',
      label: '游戏娱乐',
      main: `本周 ${s.play.weekHours} 小时`,
      sub: s.play.current || '暂无在玩',
      to: '/play',
    },
  ]
})

function saveMemo() {
  const value = memoDraft.value.trim()
  if (!value) return
  patch((doc) => addMemo(doc, value))
  memoDraft.value = ''
}

function editMemo(id: string) {
  openDrawer({ title: '备忘', component: MemoDrawer, props: { memoId: id } })
}
</script>

<template>
  <section data-testid="page-home">
    <PageHeader title="今天" :subtitle="subtitle" />

    <div class="home-top">
      <div class="card block plan-block">
        <header class="block-head">
          <span class="block-title">今日计划</span>
          <span class="hint">{{ stats.done }} / {{ stats.total }}</span>
          <span class="spacer" />
          <RouterLink to="/today" class="hint">打开今日计划</RouterLink>
        </header>
        <div class="plan-scroll">
          <PlanList :date="today" />
        </div>
      </div>

      <div class="card block memo-block">
        <header class="block-head">
          <span class="block-title">快速备忘</span>
        </header>
        <input
          v-model="memoDraft"
          class="memo-input"
          placeholder="想到什么先扔进来"
          data-testid="memo-input"
          @keydown.enter="saveMemo"
        />
        <ul class="memo-list">
          <li v-for="memo in memos" :key="memo.id" class="memo-item" :data-testid="`memo-item-${memo.id}`" @click="editMemo(memo.id)">
            <div class="memo-text">{{ memo.content }}</div>
            <div class="hint">{{ relativeTime(memo.createdAt) }}</div>
          </li>
          <li v-if="!memos.length" class="hint">还没有备忘，上面写一句试试。</li>
        </ul>
      </div>
    </div>

    <div class="summary-grid">
      <button
        v-for="card in cards"
        :key="card.key"
        class="summary-card"
        :data-testid="`summary-${card.key}`"
        @click="router.push(card.to)"
      >
        <span class="summary-label">{{ card.label }}</span>
        <span class="summary-main">{{ card.main }}</span>
        <span class="summary-sub">{{ card.sub }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.home-top {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.block {
  padding: 12px;
}

.block-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
}

.block-title {
  font-size: 13px;
  font-weight: 500;
}

.plan-scroll {
  max-height: 360px;
  overflow: auto;
}

.memo-input {
  margin-bottom: 10px;
  font-size: 12px;
}

.memo-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.memo-item {
  cursor: pointer;
}

.memo-item:hover .memo-text {
  color: var(--accent-text);
}

.memo-text {
  font-size: 12px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  text-align: left;
  background: var(--bg-secondary);
  border: 0.5px solid transparent;
  border-radius: var(--radius-lg);
  padding: 10px 12px;
  min-width: 0;
}

.summary-card:hover {
  border-color: var(--border);
}

.summary-label {
  font-size: 11px;
  color: var(--text-3);
}

.summary-main {
  font-size: 12.5px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.summary-sub {
  font-size: 11px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
</style>

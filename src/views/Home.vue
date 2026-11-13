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

const percent = computed(() =>
  stats.value.total ? Math.round((stats.value.done / stats.value.total) * 100) : 0,
)

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const subtitle = computed(() => `${formatDate(today)} ${weekdayName(today)}`)

const cards = computed(() => {
  const s = summary.value
  return [
    {
      key: 'media',
      label: '自媒体',
      main: `${s.media.ready} 篇待发布`,
      sub: publishText(s.media.nextPublish),
      to: '/media',
      tone: 'blue',
      icon: 'M3.8 5.4h16.4v13.2H3.8z m6.4 3.9 4.6 2.7-4.6 2.7z',
    },
    {
      key: 'dev',
      label: '开发工作',
      main: `${s.dev.activeProjects} 个项目在跑`,
      sub: `${s.dev.openBugs} 个 bug 未解`,
      to: '/dev',
      tone: 'indigo',
      icon: 'm8.4 8.2-3.9 3.8 3.9 3.8 m7.2-7.6 3.9 3.8-3.9 3.8',
    },
    {
      key: 'consult',
      label: '咨询工作',
      main: s.consult.nextSession ? `下次会谈 ${s.consult.nextSession.slice(5).replace('-', '/')}` : '暂无会谈安排',
      sub: `${s.consult.pending} 件待跟进${s.consult.overdue ? ` · ${s.consult.overdue} 件逾期` : ''}`,
      to: '/consult?tab=followups',
      tone: 'teal',
      icon: 'M15.5 19.2v-1.7a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 17.5v1.7 M9.25 10.4a3.35 3.35 0 1 0 0-6.7 3.35 3.35 0 0 0 0 6.7',
    },
    {
      key: 'fitness',
      label: '健身计划',
      main: s.fitness.today,
      sub: `本周 ${s.fitness.weekDone} / ${s.fitness.weekTotal} 次`,
      to: '/fitness',
      tone: 'amber',
      icon: 'M6.4 7.2v9.6 M17.6 7.2v9.6 M3.4 9.4v5.2 M20.6 9.4v5.2 M6.4 12h11.2',
    },
    {
      key: 'diet',
      label: '饮食计划',
      main: s.diet.meals || '今天还没排',
      sub: `水 ${s.diet.water} / 8 杯`,
      to: '/diet',
      tone: 'green',
      icon: 'M5.4 3.2v6.6a2.9 2.9 0 0 0 5.8 0V3.2 M8.3 9.8v11 M17.4 3.2c-1.7 1.8-2.4 3.6-2.4 5.6 0 1.9.8 2.9 2.4 2.9s2.4-1 2.4-2.9c0-2-.7-3.8-2.4-5.6z M17.4 11.7v9.1',
    },
    {
      key: 'play',
      label: '游戏娱乐',
      main: `本周 ${s.play.weekHours} 小时`,
      sub: s.play.current || '暂无在玩',
      to: '/play',
      tone: 'violet',
      icon: 'M7.2 7.4h9.6a4.8 4.8 0 0 1 4.8 4.8 4.8 4.8 0 0 1-4.8 4.8H7.2A4.8 4.8 0 0 1 2.4 12.2 4.8 4.8 0 0 1 7.2 7.4z M8 10.2v4 M6 12.2h4',
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

    <div class="card hero">
      <div class="hero-text">
        <div class="hero-greet">{{ greeting }}{{ db.doc.settings.userName ? '，' + db.doc.settings.userName : '' }}</div>
        <div class="hero-sub">
          {{ stats.total ? `今天安排了 ${stats.total} 件事，已完成 ${stats.done} 件` : '今天还没有安排，去「今日计划」列几件吧' }}
        </div>
      </div>
      <div class="hero-progress">
        <svg viewBox="0 0 44 44" class="ring" aria-hidden="true">
          <circle cx="22" cy="22" r="18" class="ring-track" />
          <circle
            cx="22"
            cy="22"
            r="18"
            class="ring-fill"
            :stroke-dasharray="`${(percent / 100) * 113} 113`"
          />
        </svg>
        <span class="hero-percent">{{ percent }}<i>%</i></span>
      </div>
    </div>

    <div class="home-top">
      <div class="card block plan-block">
        <header class="block-head">
          <span class="section-title">今日计划</span>
          <span class="chip">{{ stats.done }} / {{ stats.total }}</span>
          <span class="spacer" />
          <RouterLink to="/today" class="link-more">打开今日计划</RouterLink>
        </header>
        <div class="plan-scroll">
          <PlanList :date="today" />
        </div>
      </div>

      <div class="card block memo-block">
        <header class="block-head">
          <span class="section-title">快速备忘</span>
          <span class="spacer" />
          <span class="hint">回车即存</span>
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
          <li v-if="!memos.length" class="hint memo-empty">还没有备忘，上面写一句试试。</li>
        </ul>
      </div>
    </div>

    <div class="summary-grid">
      <button
        v-for="card in cards"
        :key="card.key"
        class="summary-card"
        :data-tone="card.tone"
        :data-testid="`summary-${card.key}`"
        @click="router.push(card.to)"
      >
        <span class="summary-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path :d="card.icon" />
          </svg>
        </span>
        <span class="summary-body">
          <span class="summary-label">{{ card.label }}</span>
          <span class="summary-main">{{ card.main }}</span>
          <span class="summary-sub">{{ card.sub }}</span>
        </span>
        <svg class="summary-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m9.5 6 6 6-6 6" />
        </svg>
      </button>
    </div>
  </section>
</template>

<style scoped>
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 22px;
  margin-bottom: 16px;
  background:
    radial-gradient(120% 180% at 0% 0%, rgba(61, 109, 242, 0.1), transparent 55%),
    var(--surface);
}

.hero-greet {
  font-size: var(--fs-xl);
  font-weight: 650;
  letter-spacing: -0.02em;
}

.hero-sub {
  font-size: var(--fs-sm);
  color: var(--text-3);
  margin-top: 4px;
}

.hero-progress {
  position: relative;
  width: 52px;
  height: 52px;
  flex: 0 0 52px;
}

.ring {
  width: 52px;
  height: 52px;
  transform: rotate(-90deg);
}

.ring-track {
  fill: none;
  stroke: var(--accent);
  stroke-width: 4;
  opacity: 0.18;
}

.ring-fill {
  fill: none;
  stroke: var(--accent);
  stroke-width: 4;
  stroke-linecap: round;
  transition: stroke-dasharray 0.4s ease;
}

.hero-percent {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
  line-height: 1;
  font-size: var(--fs-xs);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.hero-percent i {
  font-style: normal;
  font-size: 8px;
  color: var(--text-3);
}

.home-top {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
}

/* 左栏更高时右栏跟着拉齐，避免中间留一个空洞 */
.memo-block {
  display: flex;
  flex-direction: column;
}

.memo-list {
  flex: 1;
}

.block {
  padding: 18px;
}

.block-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.link-more {
  font-size: var(--fs-sm);
  color: var(--accent-text);
}

.link-more:hover {
  text-decoration: underline;
}

.plan-scroll {
  /* 默认三段（上午/下午/晚上）都要露出来，再多才滚动 */
  max-height: 480px;
  overflow: auto;
  scrollbar-gutter: stable;
}

.memo-input {
  margin-bottom: 12px;
}

.memo-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.memo-item {
  cursor: pointer;
  padding: 8px 10px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  transition: background 0.14s ease, border-color 0.14s ease;
}

.memo-item:hover {
  background: var(--surface-2);
  border-color: var(--border);
}

.memo-text {
  font-size: var(--fs-sm);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 2px;
}

.memo-empty {
  padding: 8px 2px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.summary-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  text-align: left;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
  padding: 14px;
  min-width: 0;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}

.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--border-strong);
}

.summary-icon {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: var(--accent-soft);
  color: var(--accent-text);
}

.summary-icon svg {
  width: 17px;
  height: 17px;
}

.summary-card[data-tone="teal"] .summary-icon {
  background: var(--ok-soft);
  color: var(--ok-text);
}

.summary-card[data-tone="amber"] .summary-icon {
  background: var(--warn-soft);
  color: var(--warn-text);
}

.summary-card[data-tone="green"] .summary-icon {
  background: var(--ok-soft);
  color: var(--ok-text);
}

.summary-card[data-tone="violet"] .summary-icon {
  background: #f0ecff;
  color: #5b46c9;
}

:global([data-theme="dark"]) .summary-card[data-tone="violet"] .summary-icon {
  background: #241f3d;
  color: #b4a4f7;
}

.summary-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.summary-label {
  font-size: var(--fs-xs);
  color: var(--text-3);
}

.summary-main {
  font-size: var(--fs-base);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.summary-sub {
  font-size: var(--fs-xs);
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.summary-arrow {
  width: 15px;
  height: 15px;
  color: var(--text-3);
  opacity: 0;
  transform: translateX(-3px);
  transition: opacity 0.16s ease, transform 0.16s ease;
  align-self: center;
}

.summary-card:hover .summary-arrow {
  opacity: 1;
  transform: translateX(0);
}

@media (max-width: 1080px) {
  .home-top,
  .summary-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

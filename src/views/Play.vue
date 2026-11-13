<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import InlineDelete from '@/components/InlineDelete.vue'
import Game2048 from '@/features/play/Game2048.vue'
import MemoryFlip from '@/features/play/MemoryFlip.vue'
import { db, patch } from '@/store/db'
import { toast } from '@/store/ui'
import { todayKey, weekdayIndex } from '@/lib/date'
import { WEEKDAY_LABELS } from '@/lib/labels'
import type { Game, LeisureLog, Show } from '@/types'
import {
  LEISURE_KINDS,
  addGame,
  addLeisure,
  addShow,
  bestScore,
  formatMinutes,
  gamesOf,
  removeGame,
  removeShow,
  setGameProgress,
  setGameRating,
  setGameStatus,
  setMiniScore,
  setShowStatus,
  setShowTotal,
  showPercent,
  todayMinutes,
  updateShowProgress,
  weekMinutes,
  weekMinutesByDay,
} from '@/features/play/playLogic'

const today = todayKey()

const GAME_GROUPS: { key: Game['status']; label: string }[] = [
  { key: 'playing', label: '在玩' },
  { key: 'wish', label: '想玩' },
  { key: 'done', label: '已通关' },
  { key: 'dropped', label: '搁置' },
]

const SHOW_GROUPS: { key: Show['status']; label: string }[] = [
  { key: 'watching', label: '在看' },
  { key: 'wish', label: '想看' },
  { key: 'done', label: '看完' },
]

const SHOW_TYPES: { key: Show['type']; label: string }[] = [
  { key: 'series', label: '剧集' },
  { key: 'anime', label: '番剧' },
  { key: 'movie', label: '电影' },
]

const weekTotal = computed(() => weekMinutes(db.doc, today))
const todayTotal = computed(() => todayMinutes(db.doc, today))
const playingCount = computed(() => gamesOf(db.doc, 'playing').length)
const watchingCount = computed(() => db.doc.shows.filter((s) => s.status === 'watching').length)

const subtitle = computed(
  () => `本周娱乐 ${formatMinutes(weekTotal.value)} · 在玩 ${playingCount.value} 个 · 在追 ${watchingCount.value} 部`,
)

const gameGroups = computed(() =>
  GAME_GROUPS.map((g) => ({ ...g, items: gamesOf(db.doc, g.key) })).filter(
    (g) => g.key !== 'dropped' || g.items.length > 0,
  ),
)

const showGroups = computed(() =>
  SHOW_GROUPS.map((g) => ({ ...g, items: db.doc.shows.filter((s) => s.status === g.key) })).filter(
    (g) => g.items.length > 0,
  ),
)

const dayBars = computed(() => {
  const rows = weekMinutesByDay(db.doc, today)
  const max = Math.max(30, ...rows.map((r) => r.minutes))
  return rows.map((r) => ({ ...r, height: r.minutes ? Math.max(6, Math.round((r.minutes / max) * 100)) : 0 }))
})

const recentLogs = computed(() =>
  db.doc.leisureLogs.slice().sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)).slice(0, 6),
)

/* ---------- 娱乐计时 ---------- */

const timerKind = ref<LeisureLog['kind']>('game')
const startedAt = ref<number | null>(null)
const nowMs = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null

const running = computed(() => startedAt.value !== null)

const elapsedSec = computed(() =>
  startedAt.value ? Math.max(0, Math.floor((nowMs.value - startedAt.value) / 1000)) : 0,
)

const elapsedText = computed(() => {
  const m = Math.floor(elapsedSec.value / 60)
  const s = elapsedSec.value % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

function stopTick() {
  if (tick) clearInterval(tick)
  tick = null
}

function toggleTimer() {
  if (!startedAt.value) {
    startedAt.value = Date.now()
    nowMs.value = startedAt.value
    stopTick()
    tick = setInterval(() => {
      nowMs.value = Date.now()
    }, 1000)
    return
  }

  const minutes = Math.max(1, Math.round((Date.now() - startedAt.value) / 60000))
  const kind = timerKind.value
  stopTick()
  startedAt.value = null
  patch((doc) => addLeisure(doc, today, minutes, kind))
  toast(`记了 ${formatMinutes(minutes)}`)
}

onBeforeUnmount(stopTick)

/* ---------- 手填时长 ---------- */

const manualMinutes = ref<number | null>(null)
const manualKind = ref<LeisureLog['kind']>('game')

function addManual() {
  const minutes = Number(manualMinutes.value || 0)
  if (!minutes || minutes <= 0) {
    toast('先填分钟数')
    return
  }
  const kind = manualKind.value
  patch((doc) => addLeisure(doc, today, minutes, kind))
  manualMinutes.value = null
  toast(`记了 ${formatMinutes(minutes)}`)
}

/* ---------- 游戏 ---------- */

const gameTitle = ref('')
const gamePlatform = ref('')

function submitGame() {
  let created: Game | null = null
  patch((doc) => {
    created = addGame(doc, gameTitle.value, gamePlatform.value.trim())
  })
  if (!created) {
    toast('先写游戏名')
    return
  }
  gameTitle.value = ''
  gamePlatform.value = ''
}

function onGameStatus(id: string, event: Event) {
  const value = (event.target as HTMLSelectElement).value as Game['status']
  patch((doc) => setGameStatus(doc, id, value))
}

function onGameProgress(id: string, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  patch((doc) => setGameProgress(doc, id, value))
}

function rate(id: string, value: number, current: number) {
  patch((doc) => setGameRating(doc, id, value === current ? 0 : value))
}

/* ---------- 追剧 ---------- */

const showTitle = ref('')
const showType = ref<Show['type']>('series')

function submitShow() {
  let created: Show | null = null
  patch((doc) => {
    created = addShow(doc, showTitle.value, showType.value)
  })
  if (!created) {
    toast('先写剧名')
    return
  }
  showTitle.value = ''
}

function onEpisode(id: string, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  patch((doc) => updateShowProgress(doc, id, value))
}

function onTotal(id: string, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  patch((doc) => setShowTotal(doc, id, value))
}

function onShowStatus(id: string, event: Event) {
  const value = (event.target as HTMLSelectElement).value as Show['status']
  patch((doc) => setShowStatus(doc, id, value))
}

/* ---------- 小游戏 ---------- */

type MiniKey = '2048' | 'memory'

const miniOpen = ref<MiniKey | null>(null)

const MINI_GAMES: { key: MiniKey; name: string; desc: string; testid: string }[] = [
  { key: '2048', name: '2048', desc: '方向键移动，相同数字合并', testid: '2048' },
  { key: 'memory', name: '记忆翻牌', desc: '两两配对，步数越少分越高', testid: 'memory' },
]

function openMini(key: MiniKey) {
  miniOpen.value = key
}

function closeMini() {
  miniOpen.value = null
}

function onMiniFinish(score: number) {
  const key = miniOpen.value
  if (!key) return
  patch((doc) => setMiniScore(doc, key, score))
  toast(`得分 ${score}，已记录`)
}

function onWindowKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && miniOpen.value) {
    e.stopPropagation()
    closeMini()
  }
}

onMounted(() => window.addEventListener('keydown', onWindowKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onWindowKeydown))

function kindLabel(kind: LeisureLog['kind']) {
  return LEISURE_KINDS.find((k) => k.key === kind)?.label || kind
}

function typeLabel(type: Show['type']) {
  return SHOW_TYPES.find((t) => t.key === type)?.label || type
}

function dayLabel(date: string) {
  return WEEKDAY_LABELS[weekdayIndex(date) - 1]
}
</script>

<template>
  <section data-testid="page-play">
    <PageHeader title="游戏娱乐" :subtitle="subtitle">
      <button class="btn" data-testid="play-open-2048" @click="openMini('2048')">玩 2048</button>
      <button class="btn" data-testid="play-open-memory" @click="openMini('memory')">记忆翻牌</button>
    </PageHeader>

    <div class="grid">
      <div class="card block">
        <header class="block-head">
          <span class="block-title">娱乐时长</span>
          <span class="hint" data-testid="play-week-minutes">本周 {{ formatMinutes(weekTotal) }}</span>
          <span class="spacer" />
          <span class="hint">今天 {{ formatMinutes(todayTotal) }}</span>
        </header>

        <div class="bars" data-testid="play-week-bars">
          <div v-for="bar in dayBars" :key="bar.date" class="bar-col">
            <div class="bar-track">
              <div class="bar-fill" :class="{ today: bar.date === today }" :style="{ height: `${bar.height}%` }" />
            </div>
            <span class="bar-label" :class="{ today: bar.date === today }">{{ dayLabel(bar.date) }}</span>
          </div>
        </div>

        <div class="timer-row">
          <select v-model="timerKind" class="kind-select" data-testid="play-timer-kind" :disabled="running">
            <option v-for="kind in LEISURE_KINDS" :key="kind.key" :value="kind.key">{{ kind.label }}</option>
          </select>
          <span class="timer-clock" data-testid="play-timer-elapsed">{{ elapsedText }}</span>
          <button
            class="btn"
            :class="{ primary: !running }"
            data-testid="play-timer-toggle"
            @click="toggleTimer"
          >
            {{ running ? '结束并记一笔' : '开始计时' }}
          </button>
        </div>

        <div class="manual-row">
          <input
            v-model.number="manualMinutes"
            type="number"
            min="1"
            placeholder="分钟"
            class="manual-input"
            data-testid="play-manual-minutes"
          />
          <select v-model="manualKind" class="kind-select" data-testid="play-manual-kind">
            <option v-for="kind in LEISURE_KINDS" :key="kind.key" :value="kind.key">{{ kind.label }}</option>
          </select>
          <button class="btn" data-testid="play-manual-add" @click="addManual">手填一笔</button>
        </div>

        <div v-if="recentLogs.length" class="log-list">
          <div v-for="log in recentLogs" :key="log.id" class="log-row" data-testid="play-log-row">
            <span class="log-date">{{ log.date.slice(5) }}</span>
            <span>{{ kindLabel(log.kind) }}</span>
            <span class="hint">{{ formatMinutes(log.minutes) }}</span>
            <span class="spacer" />
            <InlineDelete label="删" @confirm="patch((doc) => { doc.leisureLogs = doc.leisureLogs.filter((l) => l.id !== log.id) })" />
          </div>
        </div>
      </div>

      <div class="card block">
        <header class="block-head">
          <span class="block-title">小游戏</span>
          <span class="hint">全屏打开，Esc 退出</span>
        </header>

        <div v-for="game in MINI_GAMES" :key="game.key" class="mini-row">
          <div>
            <div class="mini-name">{{ game.name }}</div>
            <div class="hint">{{ game.desc }}</div>
          </div>
          <span class="spacer" />
          <span class="tag" :data-testid="`play-best-${game.testid}`">最高 {{ bestScore(db.doc, game.key) }}</span>
          <button class="btn mini" :data-testid="`play-start-${game.testid}`" @click="openMini(game.key)">开局</button>
        </div>
      </div>
    </div>

    <div class="card block" style="margin-top: 12px">
      <header class="block-head">
        <span class="block-title">游戏清单</span>
        <span class="hint">{{ db.doc.games.length }} 个</span>
      </header>

      <div class="add-row">
        <input v-model="gameTitle" placeholder="游戏名，回车添加" data-testid="play-game-input" @keyup.enter="submitGame" />
        <input v-model="gamePlatform" placeholder="平台（可选）" class="narrow" data-testid="play-game-platform" />
        <button class="btn" data-testid="play-game-add" @click="submitGame">加入</button>
      </div>

      <div v-for="group in gameGroups" :key="group.key" class="group">
        <div class="group-head">
          <span>{{ group.label }}</span>
          <span class="hint">{{ group.items.length }}</span>
        </div>
        <div v-for="game in group.items" :key="game.id" class="game-row" :data-testid="`play-game-row-${game.id}`">
          <div class="game-main">
            <span class="game-title">{{ game.title }}</span>
            <span v-if="game.platform" class="tag">{{ game.platform }}</span>
          </div>

          <select
            class="status-select"
            :value="game.status"
            :data-testid="`play-game-status-${game.id}`"
            @change="onGameStatus(game.id, $event)"
          >
            <option v-for="s in GAME_GROUPS" :key="s.key" :value="s.key">{{ s.label }}</option>
          </select>

          <label class="progress-wrap">
            <input
              type="number"
              min="0"
              max="100"
              :value="game.progress"
              class="progress-input"
              :data-testid="`play-game-progress-${game.id}`"
              @change="onGameProgress(game.id, $event)"
            />
            <span class="hint">%</span>
          </label>

          <div class="stars">
            <button
              v-for="n in 5"
              :key="n"
              class="star"
              :class="{ on: n <= game.rating }"
              :data-testid="`play-game-rating-${game.id}-${n}`"
              @click="rate(game.id, n, game.rating)"
            >
              ★
            </button>
          </div>

          <InlineDelete label="删" @confirm="patch((doc) => removeGame(doc, game.id))" />
        </div>
      </div>

      <EmptyState
        v-if="!db.doc.games.length"
        title="还没有游戏"
        desc="想玩的、在玩的都记在这里，通关后留个评分。"
      />
    </div>

    <div class="card block" style="margin-top: 12px">
      <header class="block-head">
        <span class="block-title">追剧追番</span>
        <span class="hint">{{ db.doc.shows.length }} 部</span>
      </header>

      <div class="add-row">
        <input v-model="showTitle" placeholder="剧名，回车添加" data-testid="play-show-input" @keyup.enter="submitShow" />
        <select v-model="showType" class="status-select" data-testid="play-show-type">
          <option v-for="t in SHOW_TYPES" :key="t.key" :value="t.key">{{ t.label }}</option>
        </select>
        <button class="btn" data-testid="play-show-add" @click="submitShow">加入</button>
      </div>

      <div v-for="group in showGroups" :key="group.key" class="group">
        <div class="group-head">
          <span>{{ group.label }}</span>
          <span class="hint">{{ group.items.length }}</span>
        </div>
        <div v-for="show in group.items" :key="show.id" class="show-row" :data-testid="`play-show-row-${show.id}`">
          <div class="show-main">
            <span class="game-title">{{ show.title }}</span>
            <span class="tag">{{ typeLabel(show.type) }}</span>
          </div>

          <div class="show-progress">
            <div class="bar-track wide">
              <div class="bar-fill" :style="{ width: `${showPercent(show)}%` }" :data-testid="`play-show-bar-${show.id}`" />
            </div>
            <span class="hint">{{ show.episode }} / {{ show.totalEpisodes || '?' }} 集</span>
          </div>

          <label class="ep-wrap">
            <span class="hint">看到</span>
            <input
              type="number"
              min="0"
              :value="show.episode"
              class="progress-input"
              :data-testid="`play-show-episode-${show.id}`"
              @change="onEpisode(show.id, $event)"
            />
          </label>

          <label class="ep-wrap">
            <span class="hint">共</span>
            <input
              type="number"
              min="0"
              :value="show.totalEpisodes"
              class="progress-input"
              :data-testid="`play-show-total-${show.id}`"
              @change="onTotal(show.id, $event)"
            />
          </label>

          <select
            class="status-select"
            :value="show.status"
            :data-testid="`play-show-status-${show.id}`"
            @change="onShowStatus(show.id, $event)"
          >
            <option v-for="s in SHOW_GROUPS" :key="s.key" :value="s.key">{{ s.label }}</option>
          </select>

          <InlineDelete label="删" @confirm="patch((doc) => removeShow(doc, show.id))" />
        </div>
      </div>

      <EmptyState v-if="!db.doc.shows.length" title="还没有追的剧" desc="记下想看的，标上共几集，进度会自己算。" />
    </div>

    <div
      v-if="miniOpen"
      class="mini-overlay"
      data-testid="play-game-overlay"
      @click.self="closeMini"
    >
      <div class="mini-panel">
        <header class="mini-panel-head">
          <span>{{ miniOpen === '2048' ? '2048' : '记忆翻牌' }}</span>
          <span class="spacer" />
          <button class="btn ghost" data-testid="play-game-close" @click="closeMini">关闭 (Esc)</button>
        </header>
        <Game2048 v-if="miniOpen === '2048'" @finish="onMiniFinish" />
        <MemoryFlip v-else @finish="onMiniFinish" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 12px;
  align-items: start;
}

.block {
  padding: 12px;
}

.block-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.block-title {
  font-size: 13px;
  font-weight: 500;
}

.bars {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 64px;
}

.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  height: 100%;
}

.bar-track {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  background: var(--bg-secondary);
  border-radius: 3px;
}

.bar-track.wide {
  width: 80px;
  height: 4px;
  flex: none;
  border-radius: 2px;
}

.bar-fill {
  width: 100%;
  background: var(--accent);
  border-radius: 3px;
  min-height: 0;
}

.bar-fill.today {
  background: var(--accent-text);
}

.bar-label {
  font-size: 10px;
  color: var(--text-3);
}

.bar-label.today {
  color: var(--accent-text);
}

.timer-row,
.manual-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.kind-select,
.status-select {
  border: 0.5px solid var(--border-strong);
  background: var(--bg);
  border-radius: var(--radius);
  padding: 4px 6px;
  font-size: 12px;
  outline: none;
}

.timer-clock {
  font-variant-numeric: tabular-nums;
  font-size: 15px;
  min-width: 52px;
}

.manual-input {
  width: 72px;
}

.log-list {
  margin-top: 10px;
  border-top: 0.5px solid var(--border);
}

.log-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 0.5px solid var(--border);
  font-size: 12px;
}

.log-date {
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.mini-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 0.5px solid var(--border);
}

.mini-row:last-child {
  border-bottom: none;
}

.mini-name {
  font-size: 12px;
  font-weight: 500;
}

.mini {
  font-size: 11px;
  padding: 1px 8px;
}

.add-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.add-row .narrow {
  width: 150px;
}

.group {
  margin-top: 6px;
}

.group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-2);
  padding: 4px 0;
}

.game-row,
.show-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 0.5px solid var(--border);
  font-size: 12px;
}

.game-main,
.show-main {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.game-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-wrap,
.ep-wrap {
  display: flex;
  align-items: center;
  gap: 2px;
}

.progress-input {
  width: 56px;
  padding: 2px 4px;
  font-size: 12px;
}

.stars {
  display: flex;
  gap: 1px;
}

.star {
  border: none;
  background: transparent;
  padding: 0 1px;
  font-size: 13px;
  color: var(--text-3);
  line-height: 1;
}

.star.on {
  color: #e8a33d;
}

.show-progress {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mini-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}

.mini-panel {
  background: var(--bg);
  border-radius: var(--radius-lg);
  border: 0.5px solid var(--border);
  padding: 14px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
}

.mini-panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
}
</style>

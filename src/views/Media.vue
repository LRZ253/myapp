<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import Segmented from '@/components/Segmented.vue'
import EmptyState from '@/components/EmptyState.vue'
import InlineDelete from '@/components/InlineDelete.vue'
import ContentDrawer from '@/features/media/ContentDrawer.vue'
import { db, patch } from '@/store/db'
import { openDrawer, toast } from '@/store/ui'
import { formatDate, formatMonth, monthGrid, toKey } from '@/lib/date'
import { STAGE_LABELS } from '@/lib/labels'
import type { MediaStage } from '@/types'
import {
  MEDIA_STAGES,
  calendarMap,
  contentsByStage,
  createContent,
  formatCount,
  platformStats,
  removeContent,
  setStage,
} from '@/features/media/mediaLogic'

const view = ref('kanban')
const newTitle = ref('')
const dragging = ref<string | null>(null)
const today = toKey(new Date())
const cursor = ref({ year: new Date().getFullYear(), month: new Date().getMonth() })

const viewItems = [
  { value: 'kanban', label: '看板' },
  { value: 'calendar', label: '日历' },
  { value: 'list', label: '列表' },
]

const columns = computed(() => MEDIA_STAGES.map((stage) => ({ ...stage, items: contentsByStage(db.doc, stage.key) })))
const grid = computed(() => monthGrid(cursor.value.year, cursor.value.month))
const calMap = computed(() => calendarMap(db.doc))
const stats = computed(() => platformStats(db.doc))
const total = computed(() => db.doc.media.length)

const subtitle = computed(() => {
  const ready = db.doc.media.filter((m) => m.stage === 'ready').length
  return `${total.value} 条内容 · ${ready} 条待发布`
})

function addContent() {
  const title = newTitle.value.trim()
  if (!title) return
  patch((doc) => createContent(doc, { title, platforms: [] }))
  newTitle.value = ''
  toast('已加入选题')
}

function openContent(id: string) {
  openDrawer({ title: '内容详情', component: ContentDrawer, props: { contentId: id } })
}

function drop(stage: MediaStage) {
  const id = dragging.value
  dragging.value = null
  if (!id) return
  patch((doc) => setStage(doc, id, stage))
}

function shiftMonth(delta: number) {
  const d = new Date(cursor.value.year, cursor.value.month + delta, 1)
  cursor.value = { year: d.getFullYear(), month: d.getMonth() }
}

function changeStage(id: string, stage: string) {
  patch((doc) => setStage(doc, id, stage as MediaStage))
}

function isCurrentMonth(key: string) {
  const d = new Date(key)
  return d.getMonth() === cursor.value.month
}
</script>

<template>
  <section data-testid="page-media">
    <PageHeader title="自媒体" :subtitle="subtitle">
      <input v-model="newTitle" class="new-input" placeholder="新选题，回车添加" data-testid="media-new" @keydown.enter="addContent" />
      <Segmented v-model="view" :items="viewItems" />
    </PageHeader>

    <div v-if="stats.length" class="review-bar">
      <span class="hint">复盘</span>
      <span v-for="s in stats" :key="s.platform" class="review-item">
        {{ s.platform }} 均播 {{ formatCount(s.avgViews) }} · 均赞 {{ formatCount(s.avgLikes) }}（{{ s.count }} 条）
      </span>
    </div>

    <EmptyState
      v-if="!total"
      title="还没有内容"
      desc="先把想到的选题写进「选题」列，后面一路拖到已发布。"
      action-label="填入示例选题"
      @action="patch((doc) => { createContent(doc, { title: '为什么我不用 Notion 了', platforms: ['视频号'] }); createContent(doc, { title: '低成本工作台', platforms: ['B站'] }) })"
    />

    <div v-else-if="view === 'kanban'" class="kanban" data-testid="media-kanban">
      <div
        v-for="column in columns"
        :key="column.key"
        class="column"
        :data-testid="`media-column-${column.key}`"
        @dragover.prevent
        @drop="drop(column.key)"
      >
        <header class="column-head">
          <span>{{ column.label }}</span>
          <span class="hint">{{ column.items.length }}</span>
        </header>
        <div
          v-for="item in column.items"
          :key="item.id"
          class="content-card"
          draggable="true"
          :data-testid="`media-card-${item.id}`"
          @dragstart="dragging = item.id"
          @click="openContent(item.id)"
        >
          <div class="card-title">{{ item.title }}</div>
          <div class="card-meta">
            <span v-if="item.platforms.length" class="hint">{{ item.platforms.join(' · ') }}</span>
            <span v-else class="hint">未选平台</span>
            <span v-if="item.stage === 'published'" class="hint">播放 {{ formatCount(item.stats.views) }}</span>
            <span v-else-if="item.publishAt" class="hint">{{ item.publishAt.slice(5, 10).replace('-', '/') }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="view === 'calendar'" class="calendar" data-testid="media-calendar">
      <header class="cal-head">
        <button class="btn ghost" @click="shiftMonth(-1)">‹</button>
        <span>{{ formatMonth(`${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-01`) }}</span>
        <button class="btn ghost" @click="shiftMonth(1)">›</button>
        <div class="spacer" />
        <span class="hint">按计划发布时间布点</span>
      </header>
      <div class="cal-week">
        <span v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w">周{{ w }}</span>
      </div>
      <div class="cal-grid">
        <div
          v-for="key in grid"
          :key="key"
          class="cal-cell"
          :class="{ dim: !isCurrentMonth(key), today: key === today }"
        >
          <div class="cal-day">{{ Number(key.slice(8)) }}</div>
          <button
            v-for="item in (calMap[key] || []).slice(0, 2)"
            :key="item.id"
            class="cal-item"
            @click="openContent(item.id)"
          >
            {{ item.title }}
          </button>
          <span v-if="(calMap[key] || []).length > 2" class="hint">+{{ (calMap[key] || []).length - 2 }}</span>
        </div>
      </div>
    </div>

    <div v-else class="list" data-testid="media-list">
      <div class="list-head">
        <span>标题</span>
        <span>平台</span>
        <span>阶段</span>
        <span>计划发布</span>
        <span>播放</span>
        <span></span>
      </div>
      <div v-for="item in db.doc.media" :key="item.id" class="list-row" :data-testid="`media-row-${item.id}`">
        <button class="row-title" @click="openContent(item.id)">{{ item.title }}</button>
        <span class="hint">{{ item.platforms.join('、') || '—' }}</span>
        <select :value="item.stage" class="stage-select" @change="changeStage(item.id, ($event.target as HTMLSelectElement).value)">
          <option v-for="stage in MEDIA_STAGES" :key="stage.key" :value="stage.key">{{ STAGE_LABELS[stage.key] }}</option>
        </select>
        <span class="hint">{{ item.publishAt ? formatDate(toKey(new Date(item.publishAt))) : '—' }}</span>
        <span class="hint">{{ item.stage === 'published' ? formatCount(item.stats.views) : '—' }}</span>
        <InlineDelete label="删除" @confirm="patch((doc) => removeContent(doc, item.id))" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.new-input {
  width: 180px;
  font-size: 11px;
  padding: 3px 8px;
}

.review-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  background: var(--bg-secondary);
  border-radius: var(--radius);
  margin-bottom: 12px;
  font-size: 11px;
}

.kanban {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  align-items: start;
}

.column {
  background: var(--bg-secondary);
  border-radius: 7px;
  padding: 7px;
  min-height: 120px;
}

.column-head {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-2);
  margin-bottom: 6px;
}

.content-card {
  background: var(--bg);
  border: 0.5px solid var(--border);
  border-radius: 6px;
  padding: 7px;
  margin-bottom: 5px;
  cursor: grab;
}

.content-card:hover {
  border-color: var(--border-strong);
}

.card-title {
  font-size: 11.5px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  margin-top: 4px;
  font-size: 11px;
}

.calendar {
  border: 0.5px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 10px;
}

.cal-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 8px;
}

.cal-week,
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.cal-week span {
  font-size: 11px;
  color: var(--text-3);
  padding: 2px 4px;
}

.cal-cell {
  min-height: 74px;
  border-top: 0.5px solid var(--border);
  border-left: 0.5px solid var(--border);
  padding: 3px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cal-cell:nth-child(7n) {
  border-right: 0.5px solid var(--border);
}

.cal-cell.dim {
  opacity: 0.45;
}

.cal-cell.today {
  background: var(--accent-soft);
}

.cal-day {
  font-size: 11px;
  color: var(--text-2);
}

.cal-item {
  border: 0;
  background: transparent;
  text-align: left;
  font-size: 11px;
  padding: 1px 0;
  color: var(--accent-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list {
  border: 0.5px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 4px 10px;
}

.list-head,
.list-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) 88px 92px 64px 56px;
  gap: 8px;
  align-items: center;
  font-size: 11px;
}

.list-head {
  color: var(--text-3);
  padding: 6px 0;
  border-bottom: 0.5px solid var(--border);
}

.list-row {
  padding: 5px 0;
  border-bottom: 0.5px solid var(--border);
}

.list-row:last-child {
  border-bottom: 0;
}

.row-title {
  border: 0;
  background: transparent;
  text-align: left;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0;
}

.row-title:hover {
  color: var(--accent-text);
}

.stage-select {
  font-size: 11px;
  border: 0.5px solid var(--border);
  background: var(--bg);
  border-radius: 4px;
  padding: 1px 4px;
}
</style>

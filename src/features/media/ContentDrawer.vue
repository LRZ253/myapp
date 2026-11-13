<script setup lang="ts">
import { computed, ref } from 'vue'
import { db, patch } from '@/store/db'
import { closeDrawer, toast } from '@/store/ui'
import { splitDateTime, todayKey } from '@/lib/date'
import { addPlanItem, defaultSection } from '@/features/plan/planLogic'
import { MEDIA_STAGES, findContent, removeContent, setStats, setStage, updateContent } from './mediaLogic'
import type { MediaStage } from '@/types'
import InlineDelete from '@/components/InlineDelete.vue'

const props = defineProps<{ contentId: string }>()

const content = computed(() => findContent(db.doc, props.contentId))
const platforms = computed(() => db.doc.settings.platforms)

const title = ref(content.value?.title || '')
const body = ref(content.value?.body || '')
const publishDate = ref(splitDateTime(content.value?.publishAt || null).date)
const publishTime = ref(splitDateTime(content.value?.publishAt || null).time || '19:00')
const views = ref(content.value?.stats.views || 0)
const likes = ref(content.value?.stats.likes || 0)
const follows = ref(content.value?.stats.follows || 0)
const newPlatform = ref('')

function saveTitle() {
  const value = title.value.trim()
  if (!value) return
  patch((doc) => updateContent(doc, props.contentId, { title: value }))
}

function saveBody() {
  patch((doc) => updateContent(doc, props.contentId, { body: body.value }))
}

function togglePlatform(name: string) {
  patch((doc) => {
    const target = findContent(doc, props.contentId)
    if (!target) return
    target.platforms = target.platforms.includes(name)
      ? target.platforms.filter((p) => p !== name)
      : [...target.platforms, name]
  })
}

function addPlatform() {
  const name = newPlatform.value.trim()
  if (!name) return
  patch((doc) => {
    if (!doc.settings.platforms.includes(name)) doc.settings.platforms.push(name)
    const target = findContent(doc, props.contentId)
    if (target && !target.platforms.includes(name)) target.platforms.push(name)
  })
  newPlatform.value = ''
}

function changeStage(stage: string) {
  patch((doc) => setStage(doc, props.contentId, stage as MediaStage))
}

function saveSchedule() {
  if (!publishDate.value) {
    patch((doc) => updateContent(doc, props.contentId, { publishAt: null }))
    return
  }
  const [y, m, d] = publishDate.value.split('-').map(Number)
  const [h, min] = (publishTime.value || '19:00').split(':').map(Number)
  const iso = new Date(y, m - 1, d, h || 0, min || 0).toISOString()
  patch((doc) => updateContent(doc, props.contentId, { publishAt: iso }))
  toast('已设定发布时间')
}

function saveStats() {
  patch((doc) =>
    setStats(doc, props.contentId, {
      views: Number(views.value) || 0,
      likes: Number(likes.value) || 0,
      follows: Number(follows.value) || 0,
    }),
  )
  toast('已回填数据')
}

function joinToday() {
  const current = content.value
  if (!current) return
  let duplicated = false
  patch((doc) => {
    const result = addPlanItem(doc, {
      date: todayKey(),
      section: defaultSection(),
      title: current.title,
      module: 'media',
      sourceType: 'content',
      sourceId: current.id,
    })
    duplicated = result.duplicated
  })
  toast(duplicated ? '已在今天' : '已加入今天')
}

function remove() {
  patch((doc) => removeContent(doc, props.contentId))
  closeDrawer()
}
</script>

<template>
  <div v-if="content" class="content-drawer">
    <label class="field">
      <span class="field-label">标题</span>
      <input v-model="title" data-testid="content-title" @change="saveTitle" />
    </label>

    <div class="field">
      <span class="field-label">平台</span>
      <div class="chips">
        <button
          v-for="name in platforms"
          :key="name"
          class="chip"
          :class="{ on: content.platforms.includes(name) }"
          :data-testid="`content-platform-${name}`"
          @click="togglePlatform(name)"
        >
          {{ name }}
        </button>
      </div>
      <div class="row" style="margin-top: 6px">
        <input v-model="newPlatform" placeholder="新增平台" class="small-input" @keydown.enter="addPlatform" />
        <button class="btn" @click="addPlatform">加</button>
      </div>
    </div>

    <label class="field">
      <span class="field-label">阶段</span>
      <select :value="content.stage" data-testid="content-stage" @change="changeStage(($event.target as HTMLSelectElement).value)">
        <option v-for="stage in MEDIA_STAGES" :key="stage.key" :value="stage.key">{{ stage.label }}</option>
      </select>
    </label>

    <div class="field">
      <span class="field-label">计划发布</span>
      <div class="row">
        <input v-model="publishDate" type="date" data-testid="content-publish-date" @change="saveSchedule" />
        <input v-model="publishTime" type="time" class="time-input" @change="saveSchedule" />
      </div>
    </div>

    <label class="field">
      <span class="field-label">正文 / 脚本</span>
      <textarea v-model="body" rows="8" data-testid="content-body" @blur="saveBody" />
    </label>

    <div class="field">
      <span class="field-label">发布后回填</span>
      <div class="stats-row">
        <label class="stat"><span>播放</span><input v-model.number="views" type="number" min="0" data-testid="content-views" /></label>
        <label class="stat"><span>点赞</span><input v-model.number="likes" type="number" min="0" data-testid="content-likes" /></label>
        <label class="stat"><span>涨粉</span><input v-model.number="follows" type="number" min="0" /></label>
      </div>
      <button class="btn" style="margin-top: 8px" data-testid="content-save-stats" @click="saveStats">保存数据</button>
    </div>

    <div class="row" style="margin-top: 16px">
      <button class="btn" data-testid="content-join-today" @click="joinToday">加入今天</button>
      <span class="hint">只作提醒，勾掉不会改阶段</span>
      <span class="spacer" />
      <InlineDelete label="删除这条内容" @confirm="remove" />
    </div>
  </div>
</template>

<style scoped>
.content-drawer {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 11px;
  color: var(--text-3);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  border: 0.5px solid var(--border-strong);
  background: var(--bg);
  border-radius: 20px;
  padding: 1px 9px;
  font-size: 11px;
  color: var(--text-2);
}

.chip.on {
  border-color: transparent;
  background: var(--accent-soft);
  color: var(--accent-text);
}

.small-input {
  font-size: 11px;
}

.time-input {
  width: 100px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: var(--text-3);
}
</style>

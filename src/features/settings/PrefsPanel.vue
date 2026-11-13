<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Segmented from '@/components/Segmented.vue'
import { db, patch } from '@/store/db'
import { setTheme, toast } from '@/store/ui'
import { formatPlatforms, parsePlatforms, updateSettings } from './settingsLogic'
import type { Settings } from '@/types'

const theme = computed(() => (db.doc.settings.theme === 'dark' ? 'dark' : 'light'))
const platformText = ref(formatPlatforms(db.doc.settings.platforms))

watch(
  () => db.doc.settings.platforms.join('|'),
  () => {
    platformText.value = formatPlatforms(db.doc.settings.platforms)
  },
)

function save(next: Partial<Settings>) {
  patch((doc) => updateSettings(doc, next))
  toast('已保存')
}

function onTheme(value: string) {
  setTheme(value === 'dark' ? 'dark' : 'light')
}

function onWeekStart(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value) === 7 ? 7 : 1
  save({ weekStart: value })
}

function onPlatforms() {
  save({ platforms: parsePlatforms(platformText.value) })
}

function onRate(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  save({ defaultHourlyRate: Number.isFinite(value) && value > 0 ? value : 0 })
}
</script>

<template>
  <div class="card block" data-testid="prefs-panel">
    <header class="block-head">
      <span class="block-title">偏好设置</span>
    </header>

    <div class="field">
      <span class="field-label">外观</span>
      <Segmented :model-value="theme" :items="[{ value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }]" @update:model-value="onTheme" />
    </div>

    <label class="field">
      <span class="field-label">称呼</span>
      <input
        :value="db.doc.settings.userName"
        placeholder="首页问候用，可留空"
        data-testid="prefs-name"
        @change="save({ userName: ($event.target as HTMLInputElement).value })"
      />
    </label>

    <label class="field">
      <span class="field-label">每周起始日</span>
      <select :value="db.doc.settings.weekStart" data-testid="prefs-week-start" @change="onWeekStart">
        <option :value="1">周一</option>
        <option :value="7">周日</option>
      </select>
    </label>

    <label class="field">
      <span class="field-label">自媒体平台</span>
      <input
        v-model="platformText"
        placeholder="视频号、B站、小红书"
        data-testid="prefs-platforms"
        @change="onPlatforms"
      />
    </label>

    <label class="field">
      <span class="field-label">默认时薪</span>
      <input
        :value="db.doc.settings.defaultHourlyRate"
        type="number"
        min="0"
        data-testid="prefs-rate"
        @change="onRate"
      />
    </label>

    <p class="hint">改完就存，不需要点保存。平台用顿号、逗号或空格分隔。</p>
  </div>
</template>

<style scoped>
.block {
  padding: 12px;
}

.block-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.block-title {
  font-size: var(--fs-base);
  font-weight: 500;
}

.field {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
  border-bottom: 1px solid var(--border);
  font-size: var(--fs-sm);
}

.field-label {
  width: 76px;
  flex: none;
  color: var(--text-2);
}

.field select {
  border: 1px solid var(--border-strong);
  background: var(--surface);
  border-radius: var(--radius);
  padding: 4px 6px;
  font-size: var(--fs-sm);
  outline: none;
  width: 120px;
}

.field input {
  flex: 1;
  min-width: 0;
}
</style>

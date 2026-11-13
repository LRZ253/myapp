<script setup lang="ts">
import { computed, ref } from 'vue'
import { db } from '@/store/db'
import { applyTheme, toast } from '@/store/ui'
import { relativeTime } from '@/lib/date'
import { EXPORT_URL, importDoc } from '@/lib/api'
import {
  countRows,
  docSizeBytes,
  formatBytes,
  parseImport,
  totalEntries,
  type ImportPreview,
} from './settingsLogic'

const rows = computed(() => countRows(db.doc))
const used = computed(() => rows.value.filter((row) => row.count > 0))
const total = computed(() => totalEntries(db.doc))
const size = computed(() => formatBytes(docSizeBytes(db.doc)))
const savedText = computed(() => (db.savedAt ? relativeTime(db.savedAt) : '本次还没保存'))

const preview = ref<ImportPreview | null>(null)
const importError = ref('')
const busy = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function pickFile() {
  importError.value = ''
  fileInput.value?.click()
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  preview.value = null
  importError.value = ''
  const text = await file.text()
  input.value = ''

  const result = parseImport(text)
  if (!result.ok) {
    importError.value = result.error
    toast('这个文件不能导入')
    return
  }
  preview.value = result.preview
}

async function confirmImport() {
  const target = preview.value
  if (!target) return
  busy.value = true
  try {
    await importDoc(target.doc)
    db.doc = target.doc
    db.savedAt = new Date().toISOString()
    db.error = null
    applyTheme(target.doc.settings.theme === 'dark' ? 'dark' : 'light')
    toast(`已导入 ${target.total} 条`)
    preview.value = null
  } catch (err) {
    importError.value = err instanceof Error ? err.message : '导入失败'
    toast('导入失败，原数据没动')
  } finally {
    busy.value = false
  }
}

function cancelImport() {
  preview.value = null
  importError.value = ''
}
</script>

<template>
  <div class="card block" data-testid="data-overview">
    <header class="block-head">
      <span class="block-title">数据总览</span>
      <span class="hint">共 {{ total }} 条 · {{ size }}</span>
      <span class="spacer" />
      <a class="btn" :href="EXPORT_URL" download data-testid="data-export">导出 JSON</a>
      <button class="btn" data-testid="data-import-pick" @click="pickFile">导入</button>
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="file-input"
        data-testid="data-import-file"
        @change="onFile"
      />
    </header>

    <p class="hint path">文件位置：data/app-data.json · 最后保存 {{ savedText }}</p>

    <div class="count-grid" data-testid="data-counts">
      <div v-for="row in rows" :key="row.key" class="count-cell" :class="{ zero: !row.count }">
        <span class="count-label">{{ row.label }}</span>
        <span class="count-value" :data-testid="`count-${row.key}`">{{ row.count }}</span>
      </div>
    </div>

    <p v-if="!used.length" class="hint">还是空的，所有模块都从零开始。</p>

    <div v-if="importError" class="error-box" data-testid="import-error">{{ importError }}</div>

    <div v-if="preview" class="preview" data-testid="import-preview">
      <div class="preview-head">
        将用这个文件覆盖当前数据
        <strong data-testid="import-total">{{ preview.total }}</strong> 条
      </div>
      <div class="preview-list">
        <span v-for="row in preview.rows" :key="row.key" class="tag">{{ row.label }} {{ row.count }}</span>
        <span v-if="!preview.rows.length" class="hint">这个文件里没有任何条目</span>
      </div>
      <p class="hint">导入前会自动把当前数据存一份到 data 目录，确认后可从这里恢复。</p>
      <div class="row">
        <button class="btn primary" :disabled="busy" data-testid="import-confirm" @click="confirmImport">
          确认导入
        </button>
        <button class="btn" data-testid="import-cancel" @click="cancelImport">取消</button>
      </div>
    </div>
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
  font-size: 13px;
  font-weight: 500;
}

.file-input {
  display: none;
}

.path {
  margin-bottom: 10px;
}

.count-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  gap: 2px 12px;
}

.count-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 2px 0;
  border-bottom: 0.5px solid var(--border);
}

.count-label {
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count-value {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.count-cell.zero .count-value {
  color: var(--text-3);
}

.error-box {
  margin-top: 10px;
  padding: 6px 8px;
  border-radius: var(--radius);
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 12px;
}

.preview {
  margin-top: 10px;
  padding: 10px;
  border: 0.5px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--bg-secondary);
}

.preview-head {
  font-size: 12px;
  margin-bottom: 6px;
}

.preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
</style>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { db } from '@/store/db'
import { applyTheme, toast } from '@/store/ui'
import { relativeTime } from '@/lib/date'
import { listBackups, restoreBackup } from '@/lib/api'
import { formatBytes } from './settingsLogic'
import type { BackupItem } from '@/types'

const items = ref<BackupItem[]>([])
const loading = ref(false)
const error = ref('')
const pending = ref<string | null>(null)
const busy = ref(false)

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    items.value = await listBackups()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '读不到备份列表'
    items.value = []
  } finally {
    loading.value = false
  }
}

async function restore(item: BackupItem) {
  if (pending.value !== item.file) {
    pending.value = item.file
    return
  }

  busy.value = true
  try {
    const doc = await restoreBackup(item.file)
    db.doc = doc
    db.savedAt = new Date().toISOString()
    db.error = null
    applyTheme(doc.settings.theme === 'dark' ? 'dark' : 'light')
    toast('已从备份恢复')
    pending.value = null
    await refresh()
  } catch (err) {
    toast(err instanceof Error ? err.message : '恢复失败')
  } finally {
    busy.value = false
  }
}

/** app-20261113.json → 2026-11-13 */
function backupDay(file: string): string {
  const m = /^app-(\d{4})(\d{2})(\d{2})\.json$/.exec(file)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : file
}

onMounted(refresh)
</script>

<template>
  <div class="card block" data-testid="backup-panel">
    <header class="block-head">
      <span class="block-title">自动备份</span>
      <span class="hint">{{ items.length }} 份</span>
      <span class="spacer" />
      <button class="btn mini" data-testid="backup-refresh" @click="refresh">刷新</button>
    </header>

    <p class="hint">每天第一次打开时存一份，最多留 14 份。恢复前会先把当前数据再存一份。</p>

    <div v-if="error" class="error-box" data-testid="backup-error">{{ error }}</div>

    <div v-if="loading" class="hint">正在读备份…</div>

    <div v-else-if="items.length" class="backup-list">
      <div v-for="item in items" :key="item.file" class="backup-row" data-testid="backup-item">
        <span class="backup-day">{{ backupDay(item.file) }}</span>
        <span class="hint">{{ formatBytes(item.size) }}</span>
        <span class="hint">{{ relativeTime(item.mtime) }}</span>
        <span class="spacer" />
        <button
          class="btn mini"
          :class="{ danger: pending === item.file }"
          :disabled="busy"
          :data-testid="`backup-restore-${item.file}`"
          @click="restore(item)"
        >
          {{ pending === item.file ? '确认恢复' : '恢复' }}
        </button>
      </div>
    </div>

    <p v-else-if="!error" class="hint" data-testid="backup-empty">还没有备份，改动过数据之后会出现。</p>
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

.mini {
  font-size: 11px;
  padding: 1px 8px;
}

.mini.danger {
  border-color: var(--danger);
  color: var(--danger);
}

.error-box {
  margin-top: 8px;
  padding: 6px 8px;
  border-radius: var(--radius);
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 12px;
}

.backup-list {
  margin-top: 8px;
}

.backup-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
  border-bottom: 0.5px solid var(--border);
  font-size: 12px;
}

.backup-day {
  font-variant-numeric: tabular-nums;
}
</style>

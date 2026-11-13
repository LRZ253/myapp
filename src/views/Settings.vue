<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import DataOverview from '@/features/settings/DataOverview.vue'
import BackupPanel from '@/features/settings/BackupPanel.vue'
import PrefsPanel from '@/features/settings/PrefsPanel.vue'
import { db } from '@/store/db'
import { applyTheme, toast } from '@/store/ui'
import { resetDoc } from '@/lib/api'

const CONFIRM_WORD = '清空'

const confirmText = ref('')
const resetting = ref(false)
const canReset = computed(() => confirmText.value.trim() === CONFIRM_WORD)

async function doReset() {
  if (!canReset.value || resetting.value) return
  resetting.value = true
  try {
    const doc = await resetDoc()
    db.doc = doc
    db.savedAt = new Date().toISOString()
    db.error = null
    applyTheme(doc.settings.theme === 'dark' ? 'dark' : 'light')
    confirmText.value = ''
    toast('已清空，清空前那份数据在自动备份里')
  } catch (err) {
    toast(err instanceof Error ? err.message : '清空失败')
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <section data-testid="page-settings">
    <PageHeader title="数据与设置" subtitle="数据总览 · 导入导出 · 备份恢复 · 偏好" />

    <DataOverview />

    <div class="grid">
      <BackupPanel />
      <PrefsPanel />
    </div>

    <div class="card block danger" data-testid="danger-zone">
      <header class="block-head">
        <span class="block-title">危险区</span>
        <span class="hint">清空全部数据，只保留偏好设置</span>
      </header>

      <p class="hint">
        清空前会自动存一份到 data 目录，之后可以从上面的备份列表恢复。确认请在下面输入「{{ CONFIRM_WORD }}」。
      </p>

      <div class="row" style="margin-top: 8px">
        <input
          v-model="confirmText"
          class="confirm-input"
          :placeholder="CONFIRM_WORD"
          data-testid="reset-confirm-input"
        />
        <button
          class="btn"
          :disabled="!canReset || resetting"
          data-testid="reset-button"
          @click="doReset"
        >
          清空全部数据
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
  margin-top: 12px;
}

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

.danger {
  margin-top: 12px;
  border-color: var(--border-strong);
}

.danger .block-title {
  color: var(--danger);
}

.confirm-input {
  width: 120px;
}
</style>

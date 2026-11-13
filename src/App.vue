<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import SideNav from '@/components/SideNav.vue'
import Drawer from '@/components/Drawer.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import { db, loadDoc, saveNow } from '@/store/db'
import { applyTheme, closeDrawer, currentTheme, openDrawer, setTheme, toast, ui } from '@/store/ui'
import { rebuildDoc, restoreBackup } from '@/lib/api'
import { hhmm } from '@/lib/date'
import MemoDrawer from '@/features/memo/MemoDrawer.vue'

const theme = computed(() => currentTheme())

const saveText = computed(() => {
  if (db.error && db.error.code === 'SAVE') return '保存失败'
  if (db.saving) return '保存中…'
  if (db.dirty) return '未保存改动'
  if (db.savedAt) return `已保存 ${hhmm(db.savedAt)}`
  return ''
})

const saveTone = computed(() => {
  if (db.error && db.error.code === 'SAVE') return 'error'
  if (db.saving) return 'busy'
  if (db.dirty) return 'dirty'
  if (db.savedAt) return 'ok'
  return 'idle'
})

async function manualSave() {
  const ok = await saveNow()
  toast(ok ? '已保存到本地文件' : '保存失败，请检查本地服务')
}

function onKeydown(e: KeyboardEvent) {
  const meta = e.metaKey || e.ctrlKey
  if (meta && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    ui.paletteOpen = !ui.paletteOpen
    return
  }
  if (meta && e.key.toLowerCase() === 'j') {
    e.preventDefault()
    openDrawer({ title: '快速备忘', component: MemoDrawer, props: {} })
    return
  }
  if (meta && e.key.toLowerCase() === 's') {
    e.preventDefault()
    void manualSave()
    return
  }
  if (e.key === 'Escape' && ui.paletteOpen) {
    ui.paletteOpen = false
  }
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!db.dirty) return
  e.preventDefault()
  e.returnValue = ''
}

async function rebuild() {
  try {
    await rebuildDoc()
    window.location.reload()
  } catch (err) {
    toast(err instanceof Error ? err.message : '重建失败')
  }
}

async function recover(file: string) {
  try {
    await restoreBackup(file)
    window.location.reload()
  } catch (err) {
    toast(err instanceof Error ? err.message : '恢复失败')
  }
}

onMounted(async () => {
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)
  await loadDoc()
  applyTheme(db.doc.settings.theme)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
})
</script>

<template>
  <div class="shell" :class="{ 'drawer-open': !!ui.drawer }">
    <SideNav @command="ui.paletteOpen = true" />

    <main class="main">
      <div class="topbar">
        <span
          class="save-state"
          :data-tone="saveTone"
          role="status"
          aria-live="polite"
          data-testid="save-status"
        ><span v-if="saveText" class="dot" />{{ saveText }}</span>
        <button
          class="btn sm save-btn"
          data-testid="save-now"
          :disabled="db.saving || !db.ready"
          title="立即保存到本地文件（Ctrl/⌘ + S）"
          @click="manualSave"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 4.5h11l3 3v12H5z" />
            <path d="M8.5 4.5v5h7v-5" />
            <path d="M8.5 19.5v-5h7v5" />
          </svg>
          保存
        </button>
        <button
          class="btn sm theme-toggle"
          data-testid="theme-toggle"
          :aria-label="theme === 'dark' ? '切换到浅色' : '切换到深色'"
          @click="setTheme(theme === 'dark' ? 'light' : 'dark')"
        >
          <svg v-if="theme !== 'dark'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
            <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
          </svg>
          {{ theme === 'dark' ? '浅色' : '深色' }}
        </button>
      </div>

      <div class="content">
        <template v-if="db.ready">
          <RouterView v-slot="{ Component }">
            <Transition name="view" mode="out-in">
              <component :is="Component" />
            </Transition>
          </RouterView>
        </template>

        <div v-else-if="db.error?.code === 'CORRUPT'" class="fatal" data-testid="corrupt-screen">
          <h2 class="fatal-title">数据文件无法解析</h2>
          <p class="hint">
            程序已进入只读保护状态，不会覆盖你的原文件。可以从下面的备份恢复，或以空白数据重建。
          </p>
          <p class="hint fatal-detail">{{ db.error.message }}</p>

          <div v-if="db.error.backups.length" class="backup-list">
            <div v-for="b in db.error.backups" :key="b.file" class="backup-row" data-testid="corrupt-backup">
              <span>{{ b.file }}</span>
              <span class="hint">{{ Math.round(b.size / 1024) }} KB</span>
              <span class="spacer" />
              <button
                class="btn ghost"
                :data-testid="`corrupt-restore-${b.file}`"
                @click="recover(b.file)"
              >
                用这份恢复
              </button>
            </div>
          </div>

          <div class="row" style="margin-top: 14px">
            <button class="btn" data-testid="rebuild-btn" @click="rebuild">以空白数据重建</button>
          </div>
        </div>

        <div v-else-if="db.error" class="fatal" data-testid="error-screen">
          <h2 class="fatal-title">无法读取数据</h2>
          <p class="hint">{{ db.error.message }}</p>
          <p class="hint">请确认本地服务仍在运行，然后刷新页面。</p>
        </div>

        <div v-else class="loading hint">正在读取数据…</div>
      </div>
    </main>

    <Drawer v-if="ui.drawer" :title="ui.drawer.title" @close="closeDrawer">
      <component :is="ui.drawer.component" v-bind="ui.drawer.props || {}" />
    </Drawer>

    <CommandPalette v-if="ui.paletteOpen" @close="ui.paletteOpen = false" />

    <Transition name="fade">
      <div v-if="ui.toastVisible" class="toast" data-testid="toast">{{ ui.toastText }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  min-height: 100vh;
  align-items: flex-start;
}

.main {
  flex: 1;
  min-width: 0;
  height: 100vh;
  overflow: auto;
  transition: margin-right 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.shell.drawer-open .main {
  margin-right: var(--drawer-w);
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 32px;
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: saturate(180%) blur(10px);
  border-bottom: 1px solid transparent;
}

.save-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-xs);
  color: var(--text-3);
  margin-right: 4px;
  min-height: 18px;
  font-variant-numeric: tabular-nums;
}

.save-state[data-tone="dirty"] {
  color: var(--warn-text);
}

.save-state[data-tone="error"] {
  color: var(--danger);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ok);
}

.save-state[data-tone="busy"] .dot {
  background: var(--accent);
  animation: pulse 1s ease-in-out infinite;
}

.save-state[data-tone="dirty"] .dot {
  background: var(--warn);
}

.save-state[data-tone="error"] .dot {
  background: var(--danger);
}

@keyframes pulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}

.save-btn svg,
.theme-toggle svg {
  width: 15px;
  height: 15px;
}

.theme-toggle {
  gap: 6px;
}

.content {
  padding: 4px 32px 56px;
  max-width: 1280px;
}

.toast {
  position: fixed;
  right: 24px;
  bottom: 22px;
  background: var(--text);
  color: var(--surface);
  font-size: var(--fs-sm);
  font-weight: 500;
  padding: 8px 14px;
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  z-index: 80;
}

.fatal {
  max-width: 580px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  padding: 24px;
}

.fatal-title {
  font-size: var(--fs-lg);
  font-weight: 600;
  margin-bottom: 8px;
}

.fatal-detail {
  margin-top: 8px;
  word-break: break-all;
}

.backup-list {
  margin-top: 14px;
  border-top: 1px solid var(--border);
}

.backup-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: var(--fs-sm);
}

.loading {
  padding: 32px 0;
}
</style>

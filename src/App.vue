<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import SideNav from '@/components/SideNav.vue'
import Drawer from '@/components/Drawer.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import { db, loadDoc } from '@/store/db'
import { applyTheme, closeDrawer, currentTheme, openDrawer, setTheme, toast, ui } from '@/store/ui'
import { rebuildDoc, restoreBackup } from '@/lib/api'
import { hhmm } from '@/lib/date'
import MemoDrawer from '@/features/memo/MemoDrawer.vue'

const theme = computed(() => currentTheme())

const saveText = computed(() => {
  if (db.error && db.error.code === 'SAVE') return '保存失败'
  if (db.saving) return '保存中…'
  if (db.savedAt) return `已保存 ${hhmm(db.savedAt)}`
  return ''
})

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
  if (e.key === 'Escape' && ui.paletteOpen) {
    ui.paletteOpen = false
  }
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
  await loadDoc()
  applyTheme(db.doc.settings.theme)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="shell" :class="{ 'drawer-open': !!ui.drawer }">
    <SideNav @command="ui.paletteOpen = true" />

    <main class="main">
      <div class="topbar">
        <span class="save-state" role="status" aria-live="polite" data-testid="save-status">{{ saveText }}</span>
        <button
          class="btn ghost theme-toggle"
          data-testid="theme-toggle"
          :aria-label="theme === 'dark' ? '切换到浅色' : '切换到深色'"
          @click="setTheme(theme === 'dark' ? 'light' : 'dark')"
        >
          {{ theme === 'dark' ? '浅色' : '深色' }}
        </button>
      </div>

      <div class="content">
        <template v-if="db.ready">
          <RouterView />
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

          <div class="row" style="margin-top: 12px">
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
  transition: margin-right 0.18s ease;
}

.shell.drawer-open .main {
  margin-right: var(--drawer-w);
}

.topbar {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 24px;
}

.theme-toggle {
  font-size: 11px;
  padding: 2px 8px;
}

.save-state {
  font-size: 11px;
  color: var(--text-3);
  margin-right: 10px;
  min-height: 16px;
}

.content {
  padding: 0 24px 48px;
  max-width: 1180px;
}

.toast {
  position: fixed;
  right: 20px;
  bottom: 18px;
  background: var(--text);
  color: var(--bg);
  font-size: 12px;
  padding: 5px 10px;
  border-radius: var(--radius);
  z-index: 80;
}

.fatal {
  max-width: 560px;
  border: 0.5px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
}

.fatal-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 6px;
}

.fatal-detail {
  margin-top: 8px;
  word-break: break-all;
}

.backup-list {
  margin-top: 12px;
  border-top: 0.5px solid var(--border);
}

.backup-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 0.5px solid var(--border);
  font-size: 12px;
}

.loading {
  padding: 24px 0;
}
</style>

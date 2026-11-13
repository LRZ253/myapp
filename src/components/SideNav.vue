<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { NAV_ITEMS } from '@/router'
import { db } from '@/store/db'
import { formatDate, todayKey, weekdayName } from '@/lib/date'

const route = useRoute()
const emit = defineEmits<{ command: [] }>()

const badges = computed(() => {
  const today = todayKey()
  return {
    today: db.doc.plans.filter((p) => p.date === today && !p.done).length,
    consult: db.doc.followups.filter((f) => f.status === 'open' && f.dueDate && f.dueDate <= today).length,
    media: db.doc.media.filter((m) => m.stage === 'ready').length,
  } as Record<string, number>
})

const dateText = computed(() => `${formatDate(todayKey())} ${weekdayName(todayKey())}`)

function isActive(path: string) {
  return route.path === path
}
</script>

<template>
  <aside class="nav" data-testid="sidenav">
    <div class="brand">
      <div class="brand-name">{{ db.doc.settings.userName || '我的工作台' }}</div>
      <div class="brand-date">{{ dateText }}</div>
    </div>

    <nav class="nav-list">
      <RouterLink
        v-for="item in NAV_ITEMS"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
        :data-testid="`nav-${item.name}`"
      >
        <span class="nav-label">{{ item.label }}</span>
        <span v-if="item.badge && badges[item.badge]" class="badge">{{ badges[item.badge] }}</span>
      </RouterLink>
    </nav>

    <div class="nav-foot">
      <button class="btn ghost" style="width: 100%; justify-content: flex-start" @click="emit('command')">
        ⌘K 命令
      </button>
    </div>
  </aside>
</template>

<style scoped>
.nav {
  width: var(--nav-w);
  flex: 0 0 var(--nav-w);
  background: var(--bg-secondary);
  border-right: 0.5px solid var(--border);
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
}

.brand {
  padding: 0 8px 14px;
}

.brand-name {
  font-size: 13px;
  font-weight: 500;
}

.brand-date {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 2px;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-2);
}

.nav-item:hover {
  background: var(--bg-tertiary);
  color: var(--text);
}

.nav-item.active {
  background: var(--bg);
  color: var(--text);
  font-weight: 500;
}

.badge {
  font-size: 11px;
  color: var(--text-3);
}

.nav-foot {
  margin-top: auto;
  border-top: 0.5px solid var(--border);
  padding-top: 8px;
}
</style>

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
const initial = computed(() => (db.doc.settings.userName || '我').slice(0, 1))

function isActive(path: string) {
  return route.path === path
}

/** 每个模块一个线性图标，避免依赖图标库 */
const ICONS: Record<string, string[]> = {
  home: ['M3.5 10.6 12 3.6l8.5 7V20a.9.9 0 0 1-.9.9h-4.9v-5.7H9.3v5.7H4.4a.9.9 0 0 1-.9-.9z'],
  today: ['M4.5 5.5h15v14h-15z', 'M8.2 3.4v4', 'M15.8 3.4v4', 'M4.5 10h15', 'm9 15 2.1 2.1L15.5 13'],
  media: ['M3.8 5.4h16.4v13.2H3.8z', 'm10.2 9.3 4.6 2.7-4.6 2.7z'],
  dev: ['m8.4 8.2-3.9 3.8 3.9 3.8', 'm15.6 8.2 3.9 3.8-3.9 3.8', 'm13.4 5.4-2.8 13.2'],
  consult: [
    'M15.5 19.2v-1.7a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 17.5v1.7',
    'M9.25 10.4a3.35 3.35 0 1 0 0-6.7 3.35 3.35 0 0 0 0 6.7',
    'M21 19.2v-1.7a3.6 3.6 0 0 0-2.7-3.48',
    'M15.6 3.86a3.35 3.35 0 0 1 0 6.49',
  ],
  fitness: ['M6.4 7.2v9.6', 'M17.6 7.2v9.6', 'M3.4 9.4v5.2', 'M20.6 9.4v5.2', 'M6.4 12h11.2'],
  diet: ['M5.4 3.2v6.6a2.9 2.9 0 0 0 5.8 0V3.2', 'M8.3 9.8v11', 'M17.4 3.2c-1.7 1.8-2.4 3.6-2.4 5.6 0 1.9.8 2.9 2.4 2.9s2.4-1 2.4-2.9c0-2-.7-3.8-2.4-5.6z', 'M17.4 11.7v9.1'],
  play: [
    'M7.2 7.4h9.6a4.8 4.8 0 0 1 4.8 4.8 4.8 4.8 0 0 1-4.8 4.8H7.2A4.8 4.8 0 0 1 2.4 12.2 4.8 4.8 0 0 1 7.2 7.4z',
    'M8 10.2v4', 'M6 12.2h4', 'M16.2 11h.01', 'M18.2 13.2h.01',
  ],
  settings: ['M4 6.5h9', 'M17.5 6.5h2.5', 'M4 12h3', 'M11.5 12H20', 'M4 17.5h9', 'M17.5 17.5h2.5', 'M14.6 4.6v3.8', 'M8.4 10.1v3.8', 'M14.6 15.6v3.8'],
}
</script>

<template>
  <aside class="nav" data-testid="sidenav">
    <div class="brand">
      <div class="avatar">{{ initial }}</div>
      <div class="brand-text">
        <div class="brand-name">{{ db.doc.settings.userName || '我的工作台' }}</div>
        <div class="brand-date">{{ dateText }}</div>
      </div>
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
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path v-for="(d, i) in ICONS[item.name] || []" :key="i" :d="d" />
        </svg>
        <span class="nav-label">{{ item.label }}</span>
        <span v-if="item.badge && badges[item.badge]" class="badge">{{ badges[item.badge] }}</span>
      </RouterLink>
    </nav>

    <div class="nav-foot">
      <button class="command-btn" type="button" @click="emit('command')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
          <circle cx="10.8" cy="10.8" r="6.4" />
          <path d="m15.6 15.6 4 4" />
        </svg>
        <span>搜索与命令</span>
        <kbd>⌘K</kbd>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.nav {
  width: var(--nav-w);
  flex: 0 0 var(--nav-w);
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 18px 12px 12px;
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 6px 18px;
}

.avatar {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(140deg, #5b86f7, #3d6df2 55%, #6a5bf0);
  box-shadow: var(--shadow-accent);
}

.brand-text {
  min-width: 0;
}

.brand-name {
  font-size: var(--fs-base);
  font-weight: 600;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-date {
  font-size: var(--fs-xs);
  color: var(--text-3);
  white-space: nowrap;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--radius);
  font-size: var(--fs-base);
  color: var(--text-2);
  transition: background 0.14s ease, color 0.14s ease;
}

.nav-icon {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  opacity: 0.76;
}

.nav-item:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.nav-item.active {
  background: var(--accent-soft);
  color: var(--accent-text);
  font-weight: 600;
}

.nav-item.active::before {
  content: "";
  position: absolute;
  left: -12px;
  top: 9px;
  bottom: 9px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--accent);
}

.nav-item.active .nav-icon {
  opacity: 1;
}

.nav-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  display: inline-grid;
  place-items: center;
  font-size: var(--fs-2xs);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--accent-text);
  background: var(--surface);
  border: 1px solid var(--accent-line);
}

.nav-item.active .badge {
  background: var(--accent);
  border-color: transparent;
  color: #fff;
}

.nav-foot {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.command-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--text-2);
  font-size: var(--fs-sm);
  transition: background 0.14s ease, color 0.14s ease;
}

.command-btn:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.command-btn svg {
  width: 15px;
  height: 15px;
  opacity: 0.7;
}

.command-btn span {
  flex: 1;
  text-align: left;
}

kbd {
  font-family: var(--font);
  font-size: var(--fs-2xs);
  color: var(--text-3);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0 4px;
  line-height: 16px;
}
</style>

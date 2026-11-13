<script setup lang="ts">
import { computed } from 'vue'
import { formatMonth, monthGrid } from '@/lib/date'

const props = defineProps<{
  year: number
  month: number
  today: string
  /** 右上角附加说明 */
  note?: string
}>()

const emit = defineEmits<{ shift: [delta: number]; today: [] }>()

const grid = computed(() => monthGrid(props.year, props.month))
const title = computed(() => formatMonth(`${props.year}-${String(props.month + 1).padStart(2, '0')}-01`))
const weekLabels = ['一', '二', '三', '四', '五', '六', '日']

function isDim(key: string) {
  const [y, m] = key.split('-').map(Number)
  return y !== props.year || m - 1 !== props.month
}
</script>

<template>
  <section class="month-calendar" data-testid="month-grid">
    <header class="mc-head">
      <button class="icon-btn" aria-label="上个月" data-testid="cal-prev" @click="emit('shift', -1)">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 6-6 6 6 6" /></svg>
      </button>
      <div class="mc-title">{{ title }}</div>
      <button class="icon-btn" aria-label="下个月" data-testid="cal-next" @click="emit('shift', 1)">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.5 6 6 6-6 6" /></svg>
      </button>
      <button class="btn mini" data-testid="cal-today" @click="emit('today')">回到今天</button>
      <div class="spacer" />
      <span v-if="note" class="hint">{{ note }}</span>
      <slot name="legend" />
    </header>

    <div class="mc-week">
      <span v-for="label in weekLabels" :key="label">周{{ label }}</span>
    </div>

    <div class="mc-grid">
      <div
        v-for="key in grid"
        :key="key"
        class="mc-cell"
        :class="{ dim: isDim(key), today: key === today }"
        :data-testid="`month-cell-${key}`"
      >
        <slot name="cell" :date="key" :dim="isDim(key)" :is-today="key === today" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.month-calendar {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  padding: 16px;
}

.mc-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}

.mc-title {
  font-size: var(--fs-md);
  font-weight: 600;
  letter-spacing: -0.01em;
  min-width: 96px;
}

.mc-week,
.mc-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.mc-week {
  margin-bottom: 6px;
}

.mc-week span {
  font-size: var(--fs-xs);
  color: var(--text-3);
  font-weight: 500;
  padding: 0 6px;
}

.mc-cell {
  min-height: 96px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow: hidden;
  transition: border-color 0.14s ease, background 0.14s ease, box-shadow 0.14s ease;
}

.mc-cell:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-xs);
}

.mc-cell.dim {
  opacity: 0.42;
  background: var(--surface-2);
}

.mc-cell.today {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent-line);
}
</style>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { PlanItem } from '@/types'
import { db, patch } from '@/store/db'
import { moduleLabel, PRIORITY_LABELS } from '@/lib/labels'
import { addDays } from '@/lib/date'
import {
  cyclePriority,
  displayTitle,
  isSourceMissing,
  movePlanItem,
  removePlanItem,
  renamePlanItem,
  togglePlanItem,
} from './planLogic'
import InlineDelete from '@/components/InlineDelete.vue'

defineOptions({ name: 'PlanItemRow' })

const props = defineProps<{ item: PlanItem }>()
const emit = defineEmits<{ dragstart: [id: string]; changed: [] }>()

const editing = ref(false)
const draft = ref('')
const moveOpen = ref(false)
const moveDate = ref('')
const editInput = ref<HTMLInputElement | null>(null)

const title = computed(() => displayTitle(db.doc, props.item))
const missing = computed(() => isSourceMissing(db.doc, props.item))
/** 回写型条目引用源实体，名字在源里改，这里不给编辑 */
const canEdit = computed(() => !props.item.sourceType)

async function startEdit() {
  if (!canEdit.value) return
  draft.value = props.item.title
  editing.value = true
  await nextTick()
  editInput.value?.focus()
  editInput.value?.select()
}

function commitEdit() {
  if (!editing.value) return
  editing.value = false
  const next = draft.value.trim()
  if (!next || next === props.item.title) return
  patch((doc) => renamePlanItem(doc, props.item.id, next))
  emit('changed')
}

function toggle() {
  patch((doc) => togglePlanItem(doc, props.item.id))
  emit('changed')
}

function cycle() {
  patch((doc) => {
    const target = doc.plans.find((p) => p.id === props.item.id)
    if (target) target.priority = cyclePriority(target)
  })
}

function remove() {
  patch((doc) => removePlanItem(doc, props.item.id))
  emit('changed')
}

function openMove() {
  moveOpen.value = !moveOpen.value
  moveDate.value = props.item.date
}

function moveTo(date: string) {
  if (!date) return
  patch((doc) => movePlanItem(doc, props.item.id, date))
  moveOpen.value = false
  emit('changed')
}

function estimateText(min: number | null) {
  if (!min) return ''
  return min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? `${min % 60}m` : ''}` : `${min}m`
}
</script>

<template>
  <div
    class="plan-row"
    :class="{ done: item.done }"
    draggable="true"
    :data-testid="`plan-item-${item.id}`"
    :data-done="item.done ? 'true' : 'false'"
    @dragstart="emit('dragstart', item.id)"
  >
    <button
      class="check"
      role="checkbox"
      :aria-checked="item.done"
      :data-testid="`plan-check-${item.id}`"
      @click="toggle"
    />

    <input
      v-if="editing"
      ref="editInput"
      v-model="draft"
      class="title-input"
      :data-testid="`plan-edit-${item.id}`"
      @keydown.enter="commitEdit"
      @keydown.esc="editing = false"
      @blur="commitEdit"
    />
    <span
      v-else
      class="plan-title"
      :class="{ missing }"
      :data-testid="`plan-title-${item.id}`"
      @click="startEdit"
    >{{ title }}</span>

    <span v-if="missing" class="tag danger" data-testid="plan-missing">来源已删除</span>

    <span v-if="item.module !== 'plan'" class="tag" :data-module="item.module">{{ moduleLabel(item.module) }}</span>
    <span v-if="item.estimateMin" class="hint estimate">{{ estimateText(item.estimateMin) }}</span>

    <button
      class="prio"
      :data-priority="item.priority"
      :title="`优先级：${PRIORITY_LABELS[item.priority]}`"
      @click="cycle"
    />

    <div class="row-actions">
      <button class="btn ghost mini" :data-testid="`plan-move-${item.id}`" @click="openMove">移到</button>
      <InlineDelete :label="missing ? '清理' : '删除'" @confirm="remove" />
    </div>

    <div v-if="moveOpen" class="move-pop" @click.stop>
      <button class="btn mini" @click="moveTo(item.date)">今天</button>
      <button class="btn mini" @click="moveTo(addDays(item.date, 1))">明天</button>
      <input v-model="moveDate" type="date" class="date-input" :data-testid="`plan-date-${item.id}`" />
      <button class="btn mini" @click="moveTo(moveDate)">确定</button>
    </div>
  </div>
</template>

<style scoped>
.plan-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  font-size: var(--fs-sm);
  border-radius: var(--radius-sm);
  transition: background 0.12s ease;
}

.plan-row:hover {
  background: var(--surface-hover);
}

.check {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  border-radius: 5px;
  border: 1.5px solid var(--border-strong);
  background-color: transparent;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 11px;
  padding: 0;
  transition: background-color 0.14s ease, border-color 0.14s ease;
}

.check:hover {
  border-color: var(--accent);
}

.check[aria-checked='true'] {
  background-color: var(--ok);
  border-color: var(--ok);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 12.5 4.5 4.5L19 7'/%3E%3C/svg%3E");
}

.plan-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
  min-width: 0;
  flex: 1;
}

.plan-title.missing {
  color: var(--text-3);
  text-decoration: line-through;
  cursor: default;
}

.plan-row.done .plan-title {
  color: var(--text-3);
  text-decoration: line-through;
}

.title-input {
  padding: 2px 6px;
  font-size: var(--fs-sm);
}

.estimate {
  flex: 0 0 auto;
}

.prio {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  border: 0;
  background: transparent;
  border-radius: 50%;
  padding: 0;
  position: relative;
}

.prio::after {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  background: var(--border-strong);
  transition: background 0.14s ease;
}

.prio[data-priority='1']::after {
  background: var(--warn);
}

.prio[data-priority='2']::after {
  background: var(--danger);
}

.row-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0.45;
  transition: opacity 0.14s ease;
}

.plan-row:hover .row-actions,
.row-actions:focus-within {
  opacity: 1;
}

.mini {
  height: 24px;
  font-size: var(--fs-xs);
  padding: 0 7px;
}

.move-pop {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
}

.date-input {
  width: 130px;
  font-size: var(--fs-xs);
  padding: 3px 6px;
}
</style>

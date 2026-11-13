<script setup lang="ts">
import { computed, ref } from 'vue'
import { db, patch } from '@/store/db'
import type { Section } from '@/types'
import { SECTIONS, addPlanItem, itemsBySection, reorderSection } from './planLogic'
import PlanItemRow from './PlanItemRow.vue'

const props = withDefaults(defineProps<{ date: string; limit?: number }>(), { limit: 0 })

const drafts = ref<Record<string, string>>({ am: '', pm: '', eve: '' })
const draggingId = ref<string | null>(null)
const editingDraft = ref<Record<string, boolean>>({ am: false, pm: false, eve: false })

const grouped = computed(() =>
  SECTIONS.map((s) => {
    const all = itemsBySection(db.doc, props.date, s.key)
    return { ...s, total: all.length, items: props.limit ? all.slice(0, props.limit) : all }
  }),
)

function submit(section: Section) {
  const title = (drafts.value[section] || '').trim()
  if (!title) return
  patch((doc) => addPlanItem(doc, { date: props.date, section, title }))
  drafts.value[section] = ''
  editingDraft.value[section] = false
}

function dropOn(targetId: string | null, section: Section) {
  const id = draggingId.value
  draggingId.value = null
  if (!id) return
  const ids = itemsBySection(db.doc, props.date, section)
    .map((i) => i.id)
    .filter((x) => x !== id)
  if (targetId) {
    const at = ids.indexOf(targetId)
    if (at < 0) ids.push(id)
    else ids.splice(at, 0, id)
  } else {
    ids.push(id)
  }
  patch((doc) => reorderSection(doc, props.date, section, ids))
}
</script>

<template>
  <div class="plan-list">
    <section
      v-for="sec in grouped"
      :key="sec.key"
      class="plan-section"
      :data-testid="`plan-section-${sec.key}`"
      @dragover.prevent
      @drop="dropOn(null, sec.key)"
    >
      <header class="section-head">
        <span>{{ sec.label }}</span>
        <span v-if="sec.total" class="hint">{{ sec.items.length }} / {{ sec.total }}</span>
      </header>

      <div
        v-for="item in sec.items"
        :key="item.id"
        class="row-wrap"
        @dragover.prevent
        @drop.stop="dropOn(item.id, sec.key)"
      >
        <PlanItemRow :item="item" @dragstart="draggingId = $event" />
      </div>

      <div v-if="props.limit && sec.total > sec.items.length" class="hint more">
        还有 {{ sec.total - sec.items.length }} 条，去今日计划看全部
      </div>

      <form class="add-row" @submit.prevent="submit(sec.key)">
        <input
          v-model="drafts[sec.key]"
          class="add-input"
          :placeholder="`加一条${sec.label}的事，回车确认`"
          :data-testid="`plan-add-${sec.key}`"
          @focus="editingDraft[sec.key] = true"
        />
      </form>
    </section>
  </div>
</template>

<style scoped>
.plan-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.plan-section {
  border: 0.5px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 10px 12px 8px;
  background: var(--bg);
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 11px;
  color: var(--text-3);
  margin-bottom: 4px;
}

.row-wrap {
  border-radius: 6px;
}

.add-row {
  margin-top: 4px;
}

.add-input {
  border: 0;
  border-radius: 6px;
  padding: 3px 0;
  font-size: 12px;
  background: transparent;
  color: var(--text);
}

.add-input:focus {
  border: 0;
}

.add-input::placeholder {
  color: var(--text-3);
}

.more {
  padding: 2px 0 4px;
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Segmented from '@/components/Segmented.vue'
import MealPicker from '@/features/diet/MealPicker.vue'
import { db, patch } from '@/store/db'
import { toast } from '@/store/ui'
import type { MealType } from '@/types'
import { MEAL_TYPES, dayCalories, logPlannedMeals, mealText } from './dietLogic'

const props = defineProps<{ date: string }>()

const meal = ref<MealType>('breakfast')
const items = MEAL_TYPES.map((m) => ({ value: m.key, label: m.label }))
const calories = computed(() => dayCalories(db.doc, props.date))
const logged = computed(() => db.doc.mealLogs.filter((l) => l.date === props.date).length)

function eatAsPlanned() {
  let count = 0
  patch((doc) => {
    count = logPlannedMeals(doc, props.date)
  })
  toast(count ? `已按计划记了 ${count} 餐` : '这天还没有排餐')
}
</script>

<template>
  <div class="day-meals">
    <div class="summary">
      <span class="chip">约 {{ calories }} 千卡</span>
      <span class="chip">{{ logged }} 餐已打卡</span>
      <span class="spacer" />
      <button class="btn mini" data-testid="day-eat-planned" @click="eatAsPlanned">照这个吃</button>
    </div>

    <Segmented v-model="meal" :items="items" />

    <div class="preview">
      <div v-for="item in MEAL_TYPES" :key="item.key" class="preview-row" :class="{ active: item.key === meal }">
        <span class="pv-label">{{ item.label }}</span>
        <span class="pv-text" :class="{ 'is-empty': !mealText(db.doc, date, item.key) }">
          {{ mealText(db.doc, date, item.key) || '还没排' }}
        </span>
      </div>
    </div>

    <MealPicker :date="date" :meal-type="meal" />
  </div>
</template>

<style scoped>
.day-meals {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.summary {
  display: flex;
  align-items: center;
  gap: 6px;
}

.preview {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.preview-row {
  display: flex;
  gap: 10px;
  padding: 7px 10px;
  font-size: var(--fs-sm);
  border-bottom: 1px solid var(--border);
}

.preview-row:last-child {
  border-bottom: 0;
}

.preview-row.active {
  background: var(--accent-soft);
}

.pv-label {
  color: var(--text-3);
  flex: 0 0 40px;
}

.pv-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pv-text.is-empty {
  color: var(--text-3);
}
</style>

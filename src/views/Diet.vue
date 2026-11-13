<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import InlineDelete from '@/components/InlineDelete.vue'
import MealPicker from '@/features/diet/MealPicker.vue'
import { db, patch } from '@/store/db'
import { openDrawer, toast } from '@/store/ui'
import { todayKey, weekdayIndex } from '@/lib/date'
import { WEEKDAY_LABELS } from '@/lib/labels'
import type { MealType } from '@/types'
import {
  MEAL_TYPES,
  addDish,
  addWater,
  dayCalories,
  logPlannedMeals,
  mealText,
  removeDish,
  setMealSource,
  weekDates,
  weekMealStats,
  waterCups,
} from '@/features/diet/dietLogic'

const today = todayKey()
const days = computed(() => weekDates(today))
const stats = computed(() => weekMealStats(db.doc, today))
const cups = computed(() => waterCups(db.doc, today))
const todayLogs = computed(() => db.doc.mealLogs.filter((l) => l.date === today))
const calories = computed(() => dayCalories(db.doc, today))

const subtitle = computed(() => {
  const avgWater = Math.round((stats.value.water / 7) * 10) / 10
  return `本周在家 ${stats.value.home} 餐 · 外卖 ${stats.value.takeout} 餐 · 日均喝水 ${avgWater} 杯`
})

function openCell(date: string, mealType: MealType) {
  const label = MEAL_TYPES.find((m) => m.key === mealType)?.label || ''
  openDrawer({ title: `${date.slice(5)} ${label}`, component: MealPicker, props: { date, mealType } })
}

function eatAsPlanned() {
  let count = 0
  patch((doc) => {
    count = logPlannedMeals(doc, today)
  })
  toast(count ? `已按计划记了 ${count} 餐` : '今天还没有排餐')
}

function markSource(source: 'home' | 'takeout') {
  patch((doc) => setMealSource(doc, today, source))
  toast(source === 'home' ? '记为在家吃' : '记为外卖')
}

function clickCup(cup: number) {
  const current = cups.value
  const next = cup <= current ? cup - 1 : cup
  patch((doc) => addWater(doc, today, next - current))
}

function seedDishes() {
  patch((doc) => {
    addDish(doc, '燕麦牛奶', 'breakfast', 260)
    addDish(doc, '番茄炒蛋', 'lunch', 350)
    addDish(doc, '青椒肉丝', 'dinner', 420)
  })
  toast('已填入 3 个家常菜')
}

function dayLabel(date: string) {
  return WEEKDAY_LABELS[weekdayIndex(date) - 1]
}
</script>

<template>
  <section data-testid="page-diet">
    <PageHeader title="饮食计划" :subtitle="subtitle" />

    <div class="card week-grid" data-testid="diet-week">
      <div class="wg-head">
        <span></span>
        <span v-for="day in days" :key="day" :class="{ today: day === today }">
          {{ dayLabel(day) }}<br /><span class="hint">{{ Number(day.slice(8)) }}</span>
        </span>
      </div>
      <div v-for="meal in MEAL_TYPES" :key="meal.key" class="wg-row">
        <span class="hint meal-label">{{ meal.label }}</span>
        <button
          v-for="day in days"
          :key="`${day}-${meal.key}`"
          class="wg-cell"
          :data-testid="`diet-cell-${day}-${meal.key}`"
          @click="openCell(day, meal.key)"
        >
          <span v-if="mealText(db.doc, day, meal.key)" class="cell-text">{{ mealText(db.doc, day, meal.key) }}</span>
          <span v-else class="plus">＋</span>
        </button>
      </div>
    </div>

    <div class="grid" style="margin-top: 12px">
      <div class="card block">
        <header class="block-head">
          <span class="block-title">今天</span>
          <span class="hint">约 {{ calories }} 千卡</span>
          <span class="spacer" />
          <button class="btn mini" data-testid="diet-eat-planned" @click="eatAsPlanned">照这个吃</button>
        </header>

        <div v-for="meal in MEAL_TYPES" :key="meal.key" class="today-meal">
          <div class="tm-head">
            <span>{{ meal.label }}</span>
            <span class="hint">{{ mealText(db.doc, today, meal.key) || '还没排' }}</span>
          </div>
        </div>

        <div class="row" style="margin-top: 8px">
          <button class="btn mini" data-testid="diet-home" @click="markSource('home')">在家吃</button>
          <button class="btn mini" data-testid="diet-takeout" @click="markSource('takeout')">外卖</button>
          <span class="hint">{{ todayLogs.length }} 餐已打卡</span>
        </div>

        <div class="water">
          <span class="hint">喝水 {{ cups }} / 8</span>
          <div class="cups">
            <button
              v-for="i in 8"
              :key="i"
              class="cup"
              :class="{ on: i <= cups }"
              :data-testid="`diet-cup-${i}`"
              @click="clickCup(i)"
            />
          </div>
        </div>
      </div>

      <div class="card block">
        <header class="block-head">
          <span class="block-title">菜品库</span>
          <span class="hint">{{ db.doc.dishes.length }} 个</span>
        </header>
        <div class="dish-list">
          <div v-for="dish in db.doc.dishes" :key="dish.id" class="dish-row">
            <span class="ellipsis">{{ dish.name }}</span>
            <span class="hint">{{ dish.calories ? `${dish.calories} 千卡` : '—' }}</span>
            <InlineDelete label="删" @confirm="patch((doc) => removeDish(doc, dish.id))" />
          </div>
        </div>
        <EmptyState
          v-if="!db.doc.dishes.length"
          title="菜品库还是空的"
          desc="先把常吃的几样存进来，排餐时点格子就能选。"
          action-label="填入几个家常菜"
          @action="seedDishes"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.week-grid {
  padding: 8px 10px;
}

.wg-head,
.wg-row {
  display: grid;
  grid-template-columns: 52px repeat(7, minmax(0, 1fr));
  gap: 4px;
  align-items: stretch;
}

.wg-head {
  font-size: 11px;
  color: var(--text-2);
  padding-bottom: 4px;
  text-align: center;
}

.wg-head .today {
  color: var(--accent-text);
  font-weight: 500;
}

.wg-row {
  margin-bottom: 4px;
}

.meal-label {
  display: flex;
  align-items: center;
}

.wg-cell {
  border: 0.5px solid var(--border);
  background: var(--bg);
  border-radius: 6px;
  min-height: 46px;
  padding: 3px 5px;
  text-align: left;
  font-size: 11px;
  overflow: hidden;
}

.wg-cell:hover {
  border-color: var(--border-strong);
}

.cell-text {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

.plus {
  color: var(--text-3);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}

.block {
  padding: 12px;
}

.block-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.block-title {
  font-size: 13px;
  font-weight: 500;
}

.mini {
  font-size: 11px;
  padding: 1px 8px;
}

.today-meal {
  border-bottom: 0.5px solid var(--border);
  padding: 4px 0;
}

.tm-head {
  display: flex;
  gap: 8px;
  font-size: 12px;
}

.tm-head .hint {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.water {
  margin-top: 10px;
}

.cups {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.cup {
  width: 22px;
  height: 26px;
  border: 0.5px solid var(--border-strong);
  border-radius: 3px 3px 6px 6px;
  background: transparent;
  padding: 0;
}

.cup.on {
  background: var(--accent-soft);
  border-color: var(--accent);
}

.dish-list {
  display: flex;
  flex-direction: column;
}

.dish-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  border-bottom: 0.5px solid var(--border);
  font-size: 12px;
}

.dish-row .hint {
  margin-left: auto;
}
</style>

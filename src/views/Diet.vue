<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import InlineDelete from '@/components/InlineDelete.vue'
import MonthGrid from '@/components/MonthGrid.vue'
import DayMeals from '@/features/diet/DayMeals.vue'
import { db, patch } from '@/store/db'
import { openDrawer, toast } from '@/store/ui'
import { monthGrid, todayKey } from '@/lib/date'
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
  weekMealStats,
  waterCups,
} from '@/features/diet/dietLogic'

interface DayMealsInfo {
  lines: { key: MealType; label: string; text: string }[]
  calories: number
  logged: number
}

const today = todayKey()
const now = new Date()
const cursor = ref({ year: now.getFullYear(), month: now.getMonth() })

const stats = computed(() => weekMealStats(db.doc, today))
const cups = computed(() => waterCups(db.doc, today))
const todayLogs = computed(() => db.doc.mealLogs.filter((l) => l.date === today))
const calories = computed(() => dayCalories(db.doc, today))

const subtitle = computed(() => {
  const avgWater = Math.round((stats.value.water / 7) * 10) / 10
  return `本周在家 ${stats.value.home} 餐 · 外卖 ${stats.value.takeout} 餐 · 日均喝水 ${avgWater} 杯`
})

const dayInfo = computed<Record<string, DayMealsInfo>>(() => {
  const map: Record<string, DayMealsInfo> = {}
  for (const key of monthGrid(cursor.value.year, cursor.value.month)) {
    const lines = MEAL_TYPES.map((meal) => ({
      key: meal.key,
      label: meal.label.slice(0, 1),
      text: mealText(db.doc, key, meal.key),
    })).filter((line) => line.key !== 'snack' || line.text)
    map[key] = {
      lines,
      calories: dayCalories(db.doc, key),
      logged: db.doc.mealLogs.filter((l) => l.date === key).length,
    }
  }
  return map
})

const monthCalories = computed(() => {
  const keys = monthGrid(cursor.value.year, cursor.value.month).filter((key) => {
    const [y, m] = key.split('-').map(Number)
    return y === cursor.value.year && m - 1 === cursor.value.month
  })
  const total = keys.reduce((sum, key) => sum + dayCalories(db.doc, key), 0)
  const filled = keys.filter((key) => MEAL_TYPES.some((meal) => mealText(db.doc, key, meal.key))).length
  return { total, filled }
})

/** 只显示排了菜的餐次，空格子留白，靠悬停提示可点 */
function filledLines(date: string) {
  return (dayInfo.value[date]?.lines || []).filter((line) => line.text)
}

function shiftMonth(delta: number) {
  const d = new Date(cursor.value.year, cursor.value.month + delta, 1)
  cursor.value = { year: d.getFullYear(), month: d.getMonth() }
}

function backToToday() {
  const d = new Date()
  cursor.value = { year: d.getFullYear(), month: d.getMonth() }
}

function openDay(date: string) {
  openDrawer({ title: `${date.slice(5)} 的饮食`, component: DayMeals, props: { date } })
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
  const currentCups = cups.value
  const next = cup <= currentCups ? cup - 1 : cup
  patch((doc) => addWater(doc, today, next - currentCups))
}

function seedDishes() {
  patch((doc) => {
    addDish(doc, '燕麦牛奶', 'breakfast', 260)
    addDish(doc, '番茄炒蛋', 'lunch', 350)
    addDish(doc, '青椒肉丝', 'dinner', 420)
  })
  toast('已填入 3 个家常菜')
}
</script>

<template>
  <section data-testid="page-diet">
    <PageHeader title="饮食计划" :subtitle="subtitle">
      <span class="chip">本月已排 {{ monthCalories.filled }} 天</span>
      <span class="chip">合计 {{ monthCalories.total }} 千卡</span>
    </PageHeader>

    <MonthGrid
      :year="cursor.year"
      :month="cursor.month"
      :today="today"
      note="点任意一天安排三餐"
      @shift="shiftMonth"
      @today="backToToday"
    >
      <template #cell="{ date }">
        <button class="day-cell" :data-testid="`diet-cell-${date}`" @click="openDay(date)">
          <span class="dc-head">
            <span class="dc-num">{{ Number(date.slice(8)) }}</span>
            <span v-if="dayInfo[date]?.calories" class="dc-kcal">{{ dayInfo[date].calories }}</span>
            <span v-else-if="dayInfo[date]?.logged" class="dc-logged" title="已打卡">{{ dayInfo[date].logged }}</span>
          </span>
          <span v-for="line in filledLines(date)" :key="line.key" class="dc-line">
            <span class="dc-tag">{{ line.label }}</span>
            <span class="dc-text">{{ line.text }}</span>
          </span>
          <span v-if="!filledLines(date).length" class="dc-hint is-empty">＋ 安排</span>
        </button>
      </template>
    </MonthGrid>

    <div class="grid">
      <div class="card block">
        <header class="block-head">
          <span class="section-title">今天</span>
          <span class="chip">约 {{ calories }} 千卡</span>
          <span class="spacer" />
          <button class="btn mini" data-testid="diet-eat-planned" @click="eatAsPlanned">照这个吃</button>
        </header>

        <div v-for="meal in MEAL_TYPES" :key="meal.key" class="today-meal">
          <span class="tm-label">{{ meal.label }}</span>
          <span class="tm-text" :class="{ 'is-empty': !mealText(db.doc, today, meal.key) }">
            {{ mealText(db.doc, today, meal.key) || '还没排' }}
          </span>
        </div>

        <div class="row" style="margin-top: 12px">
          <button class="btn mini" data-testid="diet-home" @click="markSource('home')">在家吃</button>
          <button class="btn mini" data-testid="diet-takeout" @click="markSource('takeout')">外卖</button>
          <span class="hint">{{ todayLogs.length }} 餐已打卡</span>
        </div>

        <div class="water">
          <span class="hint">喝水 {{ cups }} / 8 杯</span>
          <div class="cups">
            <button
              v-for="i in 8"
              :key="i"
              class="cup"
              :class="{ on: i <= cups }"
              :data-testid="`diet-cup-${i}`"
              :aria-label="`第 ${i} 杯水`"
              @click="clickCup(i)"
            />
          </div>
        </div>
      </div>

      <div class="card block">
        <header class="block-head">
          <span class="section-title">菜品库</span>
          <span class="hint">{{ db.doc.dishes.length }} 个</span>
        </header>
        <div class="dish-list">
          <div v-for="dish in db.doc.dishes" :key="dish.id" class="dish-row">
            <span class="ellipsis">{{ dish.name }}</span>
            <span class="hint">{{ dish.calories ? `${dish.calories} 千卡` : '—' }}</span>
            <InlineDelete label="删" compact @confirm="patch((doc) => removeDish(doc, dish.id))" />
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
.day-cell {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1px;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 0;
  color: var(--text);
  min-width: 0;
}

.dc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.dc-num {
  font-size: var(--fs-xs);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-2);
}

.dc-kcal {
  font-size: var(--fs-2xs);
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.dc-logged {
  font-size: var(--fs-2xs);
  font-weight: 600;
  color: var(--ok-text);
  background: var(--ok-soft);
  border-radius: 4px;
  padding: 0 3px;
}

.dc-line {
  display: flex;
  align-items: baseline;
  gap: 3px;
  min-width: 0;
  font-size: var(--fs-2xs);
  line-height: 1.55;
}

.dc-tag {
  flex: 0 0 auto;
  color: var(--text-3);
}

.dc-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-2);
}

.dc-hint {
  margin-top: auto;
  font-size: var(--fs-2xs);
  color: var(--text-3);
  opacity: 0;
  transition: opacity 0.12s ease;
}

.day-cell:hover .dc-hint,
.day-cell:focus-visible .dc-hint {
  opacity: 1;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
  margin-top: 16px;
}

.block {
  padding: 18px;
}

.block-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.mini {
  height: 26px;
  font-size: var(--fs-xs);
}

.today-meal {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px solid var(--border);
  font-size: var(--fs-sm);
}

.tm-label {
  flex: 0 0 40px;
  color: var(--text-3);
}

.tm-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tm-text.is-empty {
  color: var(--text-3);
}

.water {
  margin-top: 12px;
}

.cups {
  display: flex;
  gap: 5px;
  margin-top: 6px;
}

.cup {
  width: 24px;
  height: 28px;
  border: 1px solid var(--border-strong);
  border-radius: 3px 3px 7px 7px;
  background: transparent;
  padding: 0;
  transition: background 0.14s ease, border-color 0.14s ease, transform 0.1s ease;
}

.cup:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}

.cup.on {
  background: linear-gradient(180deg, #9fc0ff, var(--accent));
  border-color: transparent;
}

.dish-list {
  display: flex;
  flex-direction: column;
}

.dish-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  font-size: var(--fs-sm);
}

.dish-row .hint {
  margin-left: auto;
}
</style>

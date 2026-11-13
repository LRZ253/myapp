<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import MonthGrid from '@/components/MonthGrid.vue'
import { db, patch } from '@/store/db'
import { toast } from '@/store/ui'
import { formatDate, monthGrid, todayKey, weekdayIndex, weekdayName } from '@/lib/date'
import { WEEKDAY_LABELS } from '@/lib/labels'
import type { WeekPlan } from '@/types'
import {
  BODY_PARTS,
  addBodyMetric,
  addExercise,
  ensureWeekPlan,
  ensureWorkout,
  exerciseList,
  planOf,
  setDayPlan,
  setWorkoutCompleted,
  sparklinePoints,
  toggleDayExercise,
  toggleSet,
  updateSet,
  weekWorkoutStats,
  weightTrend,
} from '@/features/fitness/fitnessLogic'

interface DayInfo {
  focus: string
  train: boolean
  exerciseCount: number
  setCount: number
  completed: boolean
}

const today = todayKey()
const now = new Date()
const cursor = ref({ year: now.getFullYear(), month: now.getMonth() })
const selectedDate = ref(today)

const weightInput = ref<number | null>(null)
const bodyFatInput = ref<number | null>(null)
const newExercise = ref('')
const newBodyPart = ref('胸')

onMounted(() => {
  if (!db.doc.weekPlans.length) patch((doc) => ensureWeekPlan(doc))
})

const stats = computed(() => weekWorkoutStats(db.doc, today))
const exercises = computed(() => exerciseList(db.doc))

const selectedPlan = computed(() => planOf(db.doc, weekdayIndex(selectedDate.value)))
const selectedWorkout = computed(() => db.doc.workouts.find((w) => w.date === selectedDate.value))

const trend = computed(() => weightTrend(db.doc, 30))
const points = computed(() => sparklinePoints(trend.value.map((t) => t.weight), 260, 56))

const subtitle = computed(() => `本周 ${stats.value.done} / ${stats.value.planned} 次`)

const dayInfo = computed<Record<string, DayInfo>>(() => {
  const map: Record<string, DayInfo> = {}
  for (const key of monthGrid(cursor.value.year, cursor.value.month)) {
    const plan = planOf(db.doc, weekdayIndex(key))
    const workout = db.doc.workouts.find((w) => w.date === key)
    const items = workout?.items || []
    map[key] = {
      focus: workout?.focus || plan?.focus || '',
      train: !!workout || plan?.type === 'train',
      exerciseCount: items.length || plan?.exerciseIds.length || 0,
      setCount: items.reduce((sum, item) => sum + item.sets.length, 0),
      completed: !!workout?.completed,
    }
  }
  return map
})

const monthStats = computed(() => {
  const keys = monthGrid(cursor.value.year, cursor.value.month).filter((key) => {
    const [y, m] = key.split('-').map(Number)
    return y === cursor.value.year && m - 1 === cursor.value.month
  })
  const workouts = db.doc.workouts.filter((w) => keys.includes(w.date))
  const planned = keys.filter((key) => planOf(db.doc, weekdayIndex(key))?.type === 'train').length
  return {
    done: workouts.filter((w) => w.completed).length,
    planned,
    sets: workouts.reduce((sum, w) => sum + w.items.reduce((s, item) => s + item.doneSets, 0), 0),
  }
})

const selectedLabel = computed(() => `${formatDate(selectedDate.value)} ${weekdayName(selectedDate.value)}`)

function shiftMonth(delta: number) {
  const d = new Date(cursor.value.year, cursor.value.month + delta, 1)
  cursor.value = { year: d.getFullYear(), month: d.getMonth() }
}

function backToToday() {
  const d = new Date()
  cursor.value = { year: d.getFullYear(), month: d.getMonth() }
  selectedDate.value = today
}

function selectDate(date: string) {
  selectedDate.value = date
}

function setType(type: 'train' | 'rest') {
  patch((doc) => setDayPlan(doc, weekdayIndex(selectedDate.value), { type }))
}

function setFocus(value: string) {
  patch((doc) => setDayPlan(doc, weekdayIndex(selectedDate.value), { focus: value }))
}

function toggleExercise(id: string) {
  patch((doc) => toggleDayExercise(doc, weekdayIndex(selectedDate.value), id))
}

function startWorkout() {
  let created = false
  patch((doc) => {
    created = !!ensureWorkout(doc, selectedDate.value)
  })
  toast(created ? '训练已建好，逐组打卡吧' : '这天是休息日')
}

function markCompleted() {
  if (!selectedWorkout.value) return
  const target = selectedWorkout.value.completed
  patch((doc) => setWorkoutCompleted(doc, selectedWorkout.value!.id, !target))
  toast(target ? '已取消完成' : '记一次完成')
}

function addNewExercise() {
  const name = newExercise.value.trim()
  if (!name) return
  patch((doc) => addExercise(doc, name, newBodyPart.value))
  newExercise.value = ''
  toast('已加入动作库')
}

function seedExercises() {
  patch((doc) => {
    addExercise(doc, '卧推', '胸')
    addExercise(doc, '深蹲', '腿')
    addExercise(doc, '硬拉', '背')
  })
  toast('已填入 3 个常用动作')
}

function saveWeight() {
  if (!weightInput.value) return
  patch((doc) => addBodyMetric(doc, today, Number(weightInput.value), bodyFatInput.value ? Number(bodyFatInput.value) : null))
  toast('已记录体重')
  weightInput.value = null
}

function planText(plan: WeekPlan | undefined) {
  if (!plan || plan.type === 'rest') return '休息'
  return plan.focus || '训练'
}

function bodyPartOf(exerciseId: string) {
  return db.doc.exercises.find((e) => e.id === exerciseId)?.bodyPart || ''
}
</script>

<template>
  <section data-testid="page-fitness">
    <PageHeader title="健身计划" :subtitle="subtitle">
      <span class="chip">本月完成 {{ monthStats.done }} / 计划 {{ monthStats.planned }}</span>
      <span class="chip">已打卡 {{ monthStats.sets }} 组</span>
    </PageHeader>

    <MonthGrid
      :year="cursor.year"
      :month="cursor.month"
      :today="today"
      note="格子里是当天的部位与组数"
      @shift="shiftMonth"
      @today="backToToday"
    >
      <template #cell="{ date }">
        <button
          class="day-cell"
          :class="{ selected: date === selectedDate, done: dayInfo[date]?.completed }"
          :data-testid="`fitness-cell-${date}`"
          @click="selectDate(date)"
        >
          <span class="day-top">
            <span class="day-num">{{ Number(date.slice(8)) }}</span>
            <span v-if="dayInfo[date]?.completed" class="done-dot" title="已完成" />
          </span>
          <span class="day-focus" :class="{ rest: !dayInfo[date]?.train }">
            {{ dayInfo[date]?.train ? dayInfo[date]?.focus || '训练' : '休息' }}
          </span>
          <span v-if="dayInfo[date]?.train && dayInfo[date]?.exerciseCount" class="day-meta">
            {{ dayInfo[date].exerciseCount }} 动作 · {{ dayInfo[date].setCount }} 组
          </span>
        </button>
      </template>
    </MonthGrid>

    <div class="detail-grid">
      <div class="card block">
        <header class="block-head">
          <div>
            <div class="section-title">{{ selectedLabel }}</div>
            <div class="section-sub">{{ selectedPlan?.type === 'train' ? '训练日（按周重复）' : '休息日（按周重复）' }}</div>
          </div>
          <span class="spacer" />
          <button class="btn mini" :class="{ primary: selectedPlan?.type === 'train' }" data-testid="fitness-type-train" @click="setType('train')">训练</button>
          <button class="btn mini" :class="{ primary: selectedPlan?.type === 'rest' }" data-testid="fitness-type-rest" @click="setType('rest')">休息</button>
        </header>

        <template v-if="selectedPlan?.type === 'train'">
          <input
            class="focus-input"
            :value="selectedPlan?.focus"
            placeholder="练什么，例如 胸 + 三头"
            data-testid="fitness-focus"
            @change="setFocus(($event.target as HTMLInputElement).value)"
          />
          <p
            v-if="selectedWorkout?.focus && selectedWorkout.focus !== selectedPlan?.focus"
            class="hint actual-hint"
            data-testid="fitness-focus-diff"
          >
            这天实际练的是「{{ selectedWorkout.focus }}」，改这里只影响以后每周的模板。
          </p>
          <div class="exercise-pick">
            <label v-for="exercise in exercises" :key="exercise.id" class="pick-item">
              <input
                type="checkbox"
                :checked="selectedPlan?.exerciseIds.includes(exercise.id)"
                :data-testid="`fitness-pick-${exercise.id}`"
                @change="toggleExercise(exercise.id)"
              />
              <span>{{ exercise.name }}</span>
              <span class="tag">{{ exercise.bodyPart }}</span>
            </label>
            <p v-if="!exercises.length" class="hint">动作库还是空的，先在右边加两个动作。</p>
          </div>
        </template>
        <p v-else class="hint">休息日。点上面的「训练」可以把这一天改成训练日。</p>

        <div class="divider" />

        <template v-if="selectedWorkout">
          <div class="workout-head">
            <span class="section-title">当天记录</span>
            <span v-if="selectedWorkout.focus" class="tag accent">{{ selectedWorkout.focus }}</span>
            <span class="tag" :class="selectedWorkout.completed ? 'ok' : ''">{{ selectedWorkout.completed ? '已完成' : '进行中' }}</span>
            <span class="spacer" />
            <button class="btn sm" data-testid="fitness-complete" @click="markCompleted">
              {{ selectedWorkout.completed ? '取消完成' : '完成这次训练' }}
            </button>
          </div>

          <div v-for="(item, i) in selectedWorkout.items" :key="`${item.exerciseId}-${i}`" class="ex-block">
            <div class="ex-head">
              <span class="ex-name">{{ item.name }}</span>
              <span v-if="bodyPartOf(item.exerciseId)" class="tag">{{ bodyPartOf(item.exerciseId) }}</span>
              <span class="spacer" />
              <span class="hint">{{ item.doneSets }} / {{ item.sets.length }} 组</span>
            </div>
            <div class="set-rows">
              <div v-for="(set, si) in item.sets" :key="si" class="set-row">
                <button
                  class="set-pill"
                  :class="{ done: si < item.doneSets }"
                  :data-testid="`fitness-set-${i}-${si}`"
                  @click="patch((doc) => toggleSet(doc, selectedWorkout!.id, i, si))"
                >
                  第 {{ si + 1 }} 组
                </button>
                <input
                  :value="set.reps"
                  type="number"
                  min="1"
                  class="num-input"
                  :data-testid="`fitness-reps-${i}-${si}`"
                  @change="patch((doc) => updateSet(doc, selectedWorkout!.id, i, si, { reps: Number(($event.target as HTMLInputElement).value) }))"
                />
                <span class="hint">次</span>
                <input
                  :value="set.weight"
                  type="number"
                  min="0"
                  step="0.5"
                  class="num-input"
                  :data-testid="`fitness-weight-${i}-${si}`"
                  @change="patch((doc) => updateSet(doc, selectedWorkout!.id, i, si, { weight: Number(($event.target as HTMLInputElement).value) }))"
                />
                <span class="hint">kg</span>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <p class="hint">{{ selectedPlan?.type === 'train' ? '这天还没开始练。' : '这天是休息日。' }}</p>
          <button v-if="selectedPlan?.type === 'train'" class="btn primary" data-testid="fitness-start" @click="startWorkout">
            {{ selectedDate === today ? '开始今天的训练' : '为这天补记一次训练' }}
          </button>
        </template>
      </div>

      <div class="stack">
        <div class="card block">
          <header class="block-head"><span class="section-title">动作库</span></header>
          <div class="row" style="margin-bottom: 10px">
            <input v-model="newExercise" placeholder="动作名" data-testid="fitness-exercise-name" @keydown.enter="addNewExercise" />
            <select v-model="newBodyPart" class="part-select">
              <option v-for="part in BODY_PARTS" :key="part" :value="part">{{ part }}</option>
            </select>
            <button class="btn" data-testid="fitness-exercise-add" @click="addNewExercise">加</button>
          </div>
          <div class="exercise-list">
            <span v-for="exercise in exercises" :key="exercise.id" class="tag">{{ exercise.name }} · {{ exercise.bodyPart }}</span>
          </div>
          <EmptyState
            v-if="!exercises.length"
            title="动作库还是空的"
            desc="先把常练的几个加进来，排计划时就能直接勾。"
            action-label="填入常用动作"
            @action="seedExercises"
          />
        </div>

        <div class="card block">
          <header class="block-head">
            <span class="section-title">体重</span>
            <span class="spacer" />
            <span v-if="trend.length" class="hint">{{ trend[trend.length - 1].weight }} kg · {{ trend[trend.length - 1].date.slice(5) }}</span>
          </header>
          <div class="row" style="margin-bottom: 10px">
            <input v-model.number="weightInput" type="number" step="0.1" placeholder="kg" class="num-input" data-testid="fitness-weight" />
            <input v-model.number="bodyFatInput" type="number" step="0.1" placeholder="体脂 %" class="num-input" />
            <button class="btn" data-testid="fitness-weight-add" @click="saveWeight">记录</button>
          </div>
          <svg v-if="points" viewBox="0 0 260 56" class="spark" data-testid="fitness-trend">
            <polyline :points="points" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" />
          </svg>
          <p v-else class="hint">还没有体重记录，记两次就能看到趋势。</p>
        </div>
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
  gap: 2px;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 0;
  color: var(--text);
  border-radius: 4px;
}

.day-cell.selected {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.day-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.day-num {
  font-size: var(--fs-xs);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-2);
}

.done-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ok);
  box-shadow: 0 0 0 2px var(--ok-soft);
}

.day-focus {
  font-size: var(--fs-xs);
  font-weight: 500;
  line-height: 1.3;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  color: var(--accent-text);
}

.day-focus.rest {
  color: var(--text-3);
  font-weight: 400;
}

.day-meta {
  font-size: var(--fs-2xs);
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
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

.focus-input {
  margin-bottom: 10px;
}

.actual-hint {
  margin: -4px 0 10px;
}

.exercise-pick {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow: auto;
}

.pick-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-sm);
  padding: 4px 6px;
  border-radius: var(--radius-xs);
}

.pick-item:hover {
  background: var(--surface-2);
}

.pick-item input {
  width: auto;
}

.pick-item .tag {
  margin-left: auto;
}

.workout-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.ex-block {
  border-top: 1px solid var(--border);
  padding: 10px 0 6px;
}

.ex-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.ex-name {
  font-size: var(--fs-sm);
  font-weight: 600;
}

.set-rows {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.set-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.set-pill {
  border: 1px solid var(--border-strong);
  background: var(--surface);
  border-radius: 999px;
  font-size: var(--fs-xs);
  padding: 2px 10px;
  color: var(--text-2);
  min-width: 68px;
  transition: background 0.14s ease, color 0.14s ease, border-color 0.14s ease;
}

.set-pill.done {
  background: var(--ok-soft);
  border-color: transparent;
  color: var(--ok-text);
  font-weight: 600;
}

.num-input {
  width: 64px;
  font-size: var(--fs-xs);
  padding: 3px 6px;
  font-variant-numeric: tabular-nums;
}

.part-select {
  width: 76px;
  font-size: var(--fs-xs);
  height: var(--control-h);
  padding: 0 6px;
}

.exercise-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.spark {
  width: 100%;
  height: 56px;
}
</style>

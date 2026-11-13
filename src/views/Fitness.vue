<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { db, patch } from '@/store/db'
import { toast } from '@/store/ui'
import { addDays, todayKey, weekdayIndex } from '@/lib/date'
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

const today = todayKey()
const selectedWeekday = ref(weekdayIndex(today))
const weightInput = ref<number | null>(null)
const bodyFatInput = ref<number | null>(null)
const newExercise = ref('')
const newBodyPart = ref('胸')

onMounted(() => {
  if (!db.doc.weekPlans.length) patch((doc) => ensureWeekPlan(doc))
})

const weekKeys = computed(() => Array.from({ length: 7 }, (_, i) => addDays(today, i - (weekdayIndex(today) - 1))))
const stats = computed(() => weekWorkoutStats(db.doc, today))
const selectedPlan = computed(() => planOf(db.doc, selectedWeekday.value))
const exercises = computed(() => exerciseList(db.doc))

const todayPlan = computed(() => planOf(db.doc, weekdayIndex(today)))
const todayWorkout = computed(() => db.doc.workouts.find((w) => w.date === today))

const trend = computed(() => weightTrend(db.doc, 30))
const points = computed(() => sparklinePoints(trend.value.map((t) => t.weight), 260, 60))

const subtitle = computed(() => `本周 ${stats.value.done} / ${stats.value.planned} 次`)

function setType(type: 'train' | 'rest') {
  patch((doc) => setDayPlan(doc, selectedWeekday.value, { type }))
}

function setFocus(value: string) {
  patch((doc) => setDayPlan(doc, selectedWeekday.value, { focus: value }))
}

function toggleExercise(id: string) {
  patch((doc) => toggleDayExercise(doc, selectedWeekday.value, id))
}

function startToday() {
  let created = false
  patch((doc) => {
    created = !!ensureWorkout(doc, today)
  })
  toast(created ? '开始练吧' : '今天是休息日')
}

function markCompleted() {
  if (!todayWorkout.value) return
  const target = todayWorkout.value.completed
  patch((doc) => setWorkoutCompleted(doc, todayWorkout.value!.id, !target))
  toast(target ? '已取消完成' : '记一次完成')
}

function addNewExercise() {
  const name = newExercise.value.trim()
  if (!name) return
  patch((doc) => addExercise(doc, name, newBodyPart.value))
  newExercise.value = ''
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

function dayLabel(key: string) {
  return WEEKDAY_LABELS[weekdayIndex(key) - 1]
}

function planText(plan: WeekPlan | undefined) {
  if (!plan || plan.type === 'rest') return '休息'
  return plan.focus || '训练'
}
</script>

<template>
  <section data-testid="page-fitness">
    <PageHeader title="健身计划" :subtitle="subtitle" />

    <div class="week-strip">
      <button
        v-for="key in weekKeys"
        :key="key"
        class="week-day"
        :class="{ active: weekdayIndex(key) === selectedWeekday, today: key === today }"
        :data-testid="`fitness-day-${weekdayIndex(key)}`"
        @click="selectedWeekday = weekdayIndex(key)"
      >
        <span class="wd">{{ dayLabel(key) }}</span>
        <span class="hint">{{ planText(planOf(db.doc, weekdayIndex(key))) }}</span>
      </button>
    </div>

    <div class="grid">
      <div class="card block">
        <header class="block-head">
          <span class="block-title">{{ WEEKDAY_LABELS[selectedWeekday - 1] }}的安排</span>
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
          <div class="exercise-pick">
            <label v-for="exercise in exercises" :key="exercise.id" class="pick-item">
              <input
                type="checkbox"
                :checked="selectedPlan?.exerciseIds.includes(exercise.id)"
                :data-testid="`fitness-pick-${exercise.id}`"
                @change="toggleExercise(exercise.id)"
              />
              <span>{{ exercise.name }}</span>
              <span class="hint">{{ exercise.bodyPart }}</span>
            </label>
            <p v-if="!exercises.length" class="hint">动作库还是空的，先在下面加两个动作。</p>
          </div>
        </template>
        <p v-else class="hint">休息日。点上面的「训练」可以改成训练日。</p>
      </div>

      <div class="card block">
        <header class="block-head">
          <span class="block-title">今天</span>
          <span class="spacer" />
          <span v-if="todayWorkout?.completed" class="tag accent">已完成</span>
        </header>

        <template v-if="todayWorkout">
          <div v-for="(item, i) in todayWorkout.items" :key="`${item.exerciseId}-${i}`" class="workout-item">
            <div class="wi-head">
              <span>{{ item.name }}</span>
              <span class="hint">{{ item.doneSets }} / {{ item.sets.length }} 组</span>
            </div>
            <div class="sets">
              <button
                v-for="(set, si) in item.sets"
                :key="si"
                class="set"
                :class="{ done: si < item.doneSets }"
                :data-testid="`fitness-set-${i}-${si}`"
                @click="patch((doc) => toggleSet(doc, todayWorkout!.id, i, si))"
              >
                {{ set.reps }} × {{ set.weight }}kg
              </button>
            </div>
            <div class="set-edit">
              <input
                :value="item.sets[0].reps"
                type="number"
                min="1"
                class="num"
                @change="patch((doc) => updateSet(doc, todayWorkout!.id, i, 0, { reps: Number(($event.target as HTMLInputElement).value) }))"
              />
              <span class="hint">次</span>
              <input
                :value="item.sets[0].weight"
                type="number"
                min="0"
                class="num"
                @change="patch((doc) => updateSet(doc, todayWorkout!.id, i, 0, { weight: Number(($event.target as HTMLInputElement).value) }))"
              />
              <span class="hint">kg</span>
            </div>
          </div>

          <button class="btn" style="margin-top: 8px" data-testid="fitness-complete" @click="markCompleted">
            {{ todayWorkout.completed ? '取消完成' : '完成这次训练' }}
          </button>
        </template>

        <template v-else>
          <p class="hint">{{ todayPlan?.type === 'train' ? '今天安排了训练，还没开始。' : '今天休息。' }}</p>
          <button v-if="todayPlan?.type === 'train'" class="btn primary" data-testid="fitness-start" @click="startToday">开始今天的训练</button>
        </template>
      </div>
    </div>

    <div class="grid" style="margin-top: 12px">
      <div class="card block">
        <header class="block-head"><span class="block-title">动作库</span></header>
        <div class="row" style="margin-bottom: 8px">
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
        <header class="block-head"><span class="block-title">体重</span></header>
        <div class="row" style="margin-bottom: 10px">
          <input v-model.number="weightInput" type="number" step="0.1" placeholder="kg" class="num" data-testid="fitness-weight" />
          <input v-model.number="bodyFatInput" type="number" step="0.1" placeholder="体脂 %" class="num" />
          <button class="btn" data-testid="fitness-weight-add" @click="saveWeight">记录</button>
        </div>
        <svg v-if="points" viewBox="0 0 260 60" class="spark" data-testid="fitness-trend">
          <polyline :points="points" fill="none" stroke="var(--accent)" stroke-width="1.5" />
        </svg>
        <p v-else class="hint">还没有体重记录，记两次就能看到趋势。</p>
        <p v-if="trend.length" class="hint" style="margin-top: 4px">
          最近 {{ trend[trend.length - 1].weight }} kg（{{ trend[trend.length - 1].date }}）
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.week-strip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 12px;
}

.week-day {
  border: 0.5px solid var(--border);
  background: var(--bg);
  border-radius: var(--radius);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  align-items: flex-start;
  font-size: 11px;
}

.week-day.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.week-day.today .wd {
  font-weight: 500;
}

.wd {
  font-size: 12px;
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

.focus-input {
  font-size: 12px;
  margin-bottom: 8px;
}

.exercise-pick {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 220px;
  overflow: auto;
}

.pick-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.pick-item input {
  width: auto;
}

.pick-item .hint {
  margin-left: auto;
}

.workout-item {
  border-bottom: 0.5px solid var(--border);
  padding: 6px 0;
}

.wi-head {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 4px;
}

.sets {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.set {
  border: 0.5px solid var(--border-strong);
  background: var(--bg);
  border-radius: 4px;
  font-size: 11px;
  padding: 1px 6px;
}

.set.done {
  background: var(--accent-soft);
  border-color: transparent;
  color: var(--accent-text);
}

.set-edit {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.num {
  width: 62px;
  font-size: 11px;
  padding: 2px 6px;
}

.part-select {
  width: 72px;
  font-size: 11px;
  border: 0.5px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--bg);
  padding: 3px;
}

.exercise-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.spark {
  width: 100%;
  height: 60px;
}
</style>

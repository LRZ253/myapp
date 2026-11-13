import type { BodyMetric, DeskDoc, Exercise, WeekPlan, Workout, WorkoutItem } from '@/types'
import { addDays, weekStartKey, weekdayIndex } from '@/lib/date'

export const BODY_PARTS = ['胸', '背', '腿', '肩', '手臂', '核心', '有氧']

export function ensureWeekPlan(doc: DeskDoc): void {
  for (let weekday = 1; weekday <= 7; weekday++) {
    if (!doc.weekPlans.some((w) => w.weekday === weekday)) {
      const plan: WeekPlan = { id: `wp_${weekday}`, weekday, type: 'rest', focus: '', exerciseIds: [] }
      doc.weekPlans.push(plan)
    }
  }
}

export function planOf(doc: DeskDoc, weekday: number): WeekPlan | undefined {
  return doc.weekPlans.find((w) => w.weekday === weekday)
}

export function setDayPlan(doc: DeskDoc, weekday: number, patchData: Partial<WeekPlan>): void {
  ensureWeekPlan(doc)
  const plan = planOf(doc, weekday)
  if (plan) Object.assign(plan, patchData)
}

export function toggleDayExercise(doc: DeskDoc, weekday: number, exerciseId: string): void {
  ensureWeekPlan(doc)
  const plan = planOf(doc, weekday)
  if (!plan) return
  plan.exerciseIds = plan.exerciseIds.includes(exerciseId)
    ? plan.exerciseIds.filter((id) => id !== exerciseId)
    : [...plan.exerciseIds, exerciseId]
}

export function addExercise(doc: DeskDoc, name: string, bodyPart = '胸'): Exercise | null {
  const text = name.trim()
  if (!text) return null
  const exercise: Exercise = {
    id: `ex_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: text,
    bodyPart,
    note: '',
  }
  doc.exercises.push(exercise)
  return exercise
}

function emptyItem(name: string, exerciseId: string): WorkoutItem {
  return {
    exerciseId,
    name,
    sets: [
      { reps: 8, weight: 0 },
      { reps: 8, weight: 0 },
      { reps: 8, weight: 0 },
    ],
    doneSets: 0,
  }
}

/** 取得某天的训练；没有就按周计划生成 */
export function ensureWorkout(doc: DeskDoc, date: string): Workout | null {
  const existing = doc.workouts.find((w) => w.date === date)
  if (existing) return existing

  const weekday = weekdayIndex(date)
  const plan = planOf(doc, weekday)
  if (!plan || plan.type === 'rest') return null

  const items = plan.exerciseIds
    .map((id) => doc.exercises.find((e) => e.id === id))
    .filter((e): e is Exercise => !!e)
    .map((e) => emptyItem(e.name, e.id))

  const workout: Workout = {
    id: `work_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    date,
    focus: plan.focus,
    items,
    completed: false,
    durationMin: 0,
  }
  doc.workouts.push(workout)
  return workout
}

export function exerciseList(doc: DeskDoc): Exercise[] {
  return doc.exercises.slice().sort((a, b) => a.bodyPart.localeCompare(b.bodyPart))
}

export function toggleSet(doc: DeskDoc, workoutId: string, itemIndex: number, setIndex: number): void {
  const workout = doc.workouts.find((w) => w.id === workoutId)
  const item = workout?.items[itemIndex]
  if (!item) return
  item.doneSets = item.doneSets === setIndex + 1 ? setIndex : setIndex + 1
}

export function updateSet(doc: DeskDoc, workoutId: string, itemIndex: number, setIndex: number, patchData: { reps?: number; weight?: number }): void {
  const workout = doc.workouts.find((w) => w.id === workoutId)
  const set = workout?.items[itemIndex]?.sets[setIndex]
  if (!set) return
  if (patchData.reps !== undefined) set.reps = Math.max(0, Math.round(patchData.reps))
  if (patchData.weight !== undefined) set.weight = Math.max(0, patchData.weight)
}

export function setWorkoutCompleted(doc: DeskDoc, workoutId: string, completed: boolean): void {
  const workout = doc.workouts.find((w) => w.id === workoutId)
  if (!workout) return
  workout.completed = completed
}

export function weekWorkoutStats(doc: DeskDoc, date: string) {
  const start = weekStartKey(date, 1)
  const keys = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const done = doc.workouts.filter((w) => w.completed && keys.includes(w.date)).length
  const planned = doc.weekPlans.filter((w) => w.type === 'train').length
  return { done, planned }
}

export function addBodyMetric(doc: DeskDoc, date: string, weight: number, bodyFat: number | null = null): BodyMetric | null {
  if (!weight || weight <= 0) return null
  const existing = doc.bodyMetrics.find((m) => m.date === date)
  if (existing) {
    existing.weight = weight
    existing.bodyFat = bodyFat
    return existing
  }
  const metric: BodyMetric = {
    id: `bm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    date,
    weight,
    bodyFat,
  }
  doc.bodyMetrics.push(metric)
  return metric
}

export function weightTrend(doc: DeskDoc, limit = 30): BodyMetric[] {
  return doc.bodyMetrics
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-limit)
}

export function sparklinePoints(values: number[], width: number, height: number): string {
  if (values.length < 2) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / span) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

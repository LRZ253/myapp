import type { DeskDoc, Dish, MealLog, MealPlan, MealType } from '@/types'
import { addDays, weekStartKey } from '@/lib/date'

export const MEAL_TYPES: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '加餐' },
]

export function addDish(doc: DeskDoc, name: string, mealType: MealType | 'any' = 'any', calories = 0): Dish | null {
  const text = name.trim()
  if (!text) return null
  const dish: Dish = {
    id: `dish_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: text,
    mealType,
    calories,
    note: '',
  }
  doc.dishes.push(dish)
  return dish
}

export function removeDish(doc: DeskDoc, id: string): void {
  doc.dishes = doc.dishes.filter((d) => d.id !== id)
  for (const plan of doc.mealPlans) plan.dishIds = plan.dishIds.filter((dishId) => dishId !== id)
  for (const log of doc.mealLogs) log.dishIds = log.dishIds.filter((dishId) => dishId !== id)
}

export function planOf(doc: DeskDoc, date: string, mealType: MealType): MealPlan | undefined {
  return doc.mealPlans.find((m) => m.date === date && m.mealType === mealType)
}

export function setMealPlan(doc: DeskDoc, date: string, mealType: MealType, dishIds: string[]): void {
  const existing = planOf(doc, date, mealType)
  if (existing) {
    existing.dishIds = dishIds
    return
  }
  const plan: MealPlan = {
    id: `mp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    date,
    mealType,
    dishIds,
  }
  doc.mealPlans.push(plan)
}

export function toggleMealDish(doc: DeskDoc, date: string, mealType: MealType, dishId: string): void {
  const current = planOf(doc, date, mealType)?.dishIds || []
  const next = current.includes(dishId) ? current.filter((id) => id !== dishId) : [...current, dishId]
  setMealPlan(doc, date, mealType, next)
}

export function dishNames(doc: DeskDoc, ids: string[]): string[] {
  return ids.map((id) => doc.dishes.find((d) => d.id === id)?.name).filter((n): n is string => !!n)
}

export function mealText(doc: DeskDoc, date: string, mealType: MealType): string {
  const plan = planOf(doc, date, mealType)
  if (!plan || !plan.dishIds.length) return ''
  return dishNames(doc, plan.dishIds).join('、')
}

/** 把今天的计划落成饮食打卡 */
export function logPlannedMeals(doc: DeskDoc, date: string, source: 'home' | 'takeout' = 'home'): number {
  let count = 0
  for (const meal of MEAL_TYPES) {
    const plan = planOf(doc, date, meal.key)
    if (!plan || !plan.dishIds.length) continue
    const existing = doc.mealLogs.find((l) => l.date === date && l.mealType === meal.key)
    if (existing) {
      existing.dishIds = [...plan.dishIds]
      existing.source = source
    } else {
      const log: MealLog = {
        id: `ml_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${meal.key}`,
        date,
        mealType: meal.key,
        dishIds: [...plan.dishIds],
        source,
      }
      doc.mealLogs.push(log)
    }
    count += 1
  }
  return count
}

export function setMealSource(doc: DeskDoc, date: string, source: 'home' | 'takeout'): void {
  for (const log of doc.mealLogs) {
    if (log.date === date) log.source = source
  }
}

export function waterCups(doc: DeskDoc, date: string): number {
  return doc.waterLogs.find((w) => w.date === date)?.cups || 0
}

export function addWater(doc: DeskDoc, date: string, delta: number): number {
  const existing = doc.waterLogs.find((w) => w.date === date)
  const next = Math.max(0, Math.min(8, (existing?.cups || 0) + delta))
  if (existing) existing.cups = next
  else doc.waterLogs.push({ id: `water_${date}`, date, cups: next })
  return next
}

export function weekDates(date: string): string[] {
  const start = weekStartKey(date, 1)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function weekMealStats(doc: DeskDoc, date: string) {
  const days = weekDates(date)
  const logs = doc.mealLogs.filter((l) => days.includes(l.date))
  return {
    home: logs.filter((l) => l.source === 'home').length,
    takeout: logs.filter((l) => l.source === 'takeout').length,
    water: days.reduce((sum, d) => sum + waterCups(doc, d), 0),
  }
}

export function dayCalories(doc: DeskDoc, date: string): number {
  const ids = doc.mealPlans.filter((m) => m.date === date).flatMap((m) => m.dishIds)
  return ids.reduce((sum, id) => sum + (doc.dishes.find((d) => d.id === id)?.calories || 0), 0)
}

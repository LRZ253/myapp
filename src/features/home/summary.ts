import type { DeskDoc } from '@/types'
import { addDays, hhmm, weekStartKey, weekdayIndex } from '@/lib/date'
import { MEAL_LABELS } from '@/lib/labels'

export interface HomeSummary {
  media: { ready: number; nextPublish: string | null }
  dev: { activeProjects: number; openBugs: number }
  consult: { nextSession: string | null; pending: number; overdue: number }
  fitness: { today: string; weekDone: number; weekTotal: number }
  diet: { meals: string; water: number }
  play: { weekHours: number; current: string | null }
}

function inWeek(date: string, today: string): boolean {
  const start = weekStartKey(today, 1)
  const end = addDays(start, 6)
  return date >= start && date <= end
}

export function buildSummary(doc: DeskDoc, today: string): HomeSummary {
  const ready = doc.media.filter((m) => m.stage === 'ready')
  const nextPublish =
    ready
      .map((m) => m.publishAt)
      .filter((v): v is string => !!v)
      .sort()[0] || null

  const activeProjects = doc.projects.filter((p) => p.status === 'active').length
  const openBugs = doc.bugs.filter((b) => b.status === 'open').length

  const upcoming = doc.sessions
    .map((s) => s.date)
    .filter((d) => d >= today)
    .sort()
  const pendingFollowups = doc.followups.filter((f) => f.status === 'open')
  const overdue = pendingFollowups.filter((f) => f.dueDate && f.dueDate < today).length

  const weekday = weekdayIndex(today)
  const todayPlan = doc.weekPlans.find((w) => w.weekday === weekday)
  const todayFitness = !todayPlan || todayPlan.type === 'rest' ? '今天休息' : todayPlan.focus || '训练'
  const weekDone = doc.workouts.filter((w) => w.completed && inWeek(w.date, today)).length
  const weekTotal = doc.weekPlans.filter((w) => w.type === 'train').length

  const todaysMeals = doc.mealPlans
    .filter((m) => m.date === today && m.mealType !== 'snack')
    .sort((a, b) => mealOrder(a.mealType) - mealOrder(b.mealType))
  const mealText = todaysMeals
    .map((m) => {
      const names = m.dishIds
        .map((id) => doc.dishes.find((d) => d.id === id)?.name)
        .filter(Boolean)
        .join('、')
      return names ? `${MEAL_LABELS[m.mealType]} ${names}` : ''
    })
    .filter(Boolean)
    .join(' · ')
  const water = doc.waterLogs.find((w) => w.date === today)?.cups || 0

  const weekMinutes = doc.leisureLogs.filter((l) => inWeek(l.date, today)).reduce((sum, l) => sum + l.minutes, 0)
  const playing = doc.games.find((g) => g.status === 'playing')
  const watching = doc.shows.find((s) => s.status === 'watching')
  const current = playing
    ? `${playing.title} ${playing.progress}%`
    : watching
      ? `${watching.title} 第 ${watching.episode} 集`
      : null

  return {
    media: { ready: ready.length, nextPublish },
    dev: { activeProjects, openBugs },
    consult: { nextSession: upcoming[0] || null, pending: pendingFollowups.length, overdue },
    fitness: { today: todayFitness, weekDone, weekTotal },
    diet: { meals: mealText, water },
    play: { weekHours: Math.round((weekMinutes / 60) * 10) / 10, current },
  }
}

function mealOrder(type: string): number {
  return ['breakfast', 'lunch', 'dinner', 'snack'].indexOf(type)
}

export function publishText(iso: string | null): string {
  if (!iso) return '还没定时'
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const tomorrow = new Date(today.getTime() + 86400000)
  if (sameDay) return `今天 ${hhmm(iso)}`
  if (d.toDateString() === tomorrow.toDateString()) return `明天 ${hhmm(iso)}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hhmm(iso)}`
}

import { createEmptyDoc as buildEmptyDoc, COLLECTIONS as RAW_COLLECTIONS } from '../shared/schema.mjs'

export type ID = string
export type ModuleKey = 'dev' | 'consult' | 'media' | 'fitness' | 'diet' | 'play' | 'plan'
export type SourceType = 'task' | 'bug' | 'followup' | 'workout' | 'content'
export type Section = 'am' | 'pm' | 'eve'
export type Priority = 0 | 1 | 2

export interface Settings {
  theme: 'light' | 'dark'
  weekStart: 1 | 7
  platforms: string[]
  defaultHourlyRate: number
  userName: string
}

export interface TimerState {
  projectId: string
  taskId: string | null
  startedAt: number
  accumulatedMs: number
  running: boolean
}

export interface PlanItem {
  id: ID
  date: string
  section: Section
  title: string
  module: ModuleKey
  priority: Priority
  estimateMin: number | null
  done: boolean
  doneAt: string | null
  sourceType: SourceType | null
  sourceId: ID | null
  sortIndex: number
}

export interface Memo {
  id: ID
  content: string
  createdAt: string
  archived: boolean
}

export type MediaStage = 'idea' | 'draft' | 'ready' | 'published'

export interface MediaStats {
  views: number
  likes: number
  follows: number
  recordedAt: string | null
}

export interface MediaContent {
  id: ID
  title: string
  platforms: string[]
  stage: MediaStage
  publishAt: string | null
  publishedAt: string | null
  body: string
  stats: MediaStats
  createdAt: string
  updatedAt: string
}

export type ProjectStatus = 'active' | 'paused' | 'done'

export interface Project {
  id: ID
  name: string
  status: ProjectStatus
  repoUrl: string
  note: string
  createdAt: string
}

export type TaskStatus = 'todo' | 'doing' | 'done'

export interface Task {
  id: ID
  projectId: ID
  title: string
  status: TaskStatus
  priority: Priority
  estimateMin: number | null
  dueDate: string | null
  createdAt: string
}

export type BugSeverity = 'blocker' | 'major' | 'normal' | 'minor'

export interface Bug {
  id: ID
  projectId: ID
  title: string
  severity: BugSeverity
  status: 'open' | 'fixed'
  note: string
  createdAt: string
}

export interface TimeLog {
  id: ID
  projectId: ID
  taskId: ID | null
  startedAt: string
  endedAt: string
  minutes: number
  note: string
}

export interface DevLog {
  id: ID
  date: string
  projectId: ID | null
  content: string
  createdAt: string
}

export interface Client {
  id: ID
  name: string
  contact: string
  status: 'active' | 'paused' | 'ended'
  note: string
}

export type EngagementStage = 'lead' | 'active' | 'closing' | 'closed'

export interface Engagement {
  id: ID
  clientId: ID
  name: string
  stage: EngagementStage
  amount: number
  received: number
  startDate: string | null
  endDate: string | null
  note: string
}

export interface Session {
  id: ID
  clientId: ID
  engagementId: ID | null
  date: string
  durationMin: number
  topic: string
  conclusion: string
  nextFollowUpDate: string | null
}

export interface FollowUp {
  id: ID
  clientId: ID
  title: string
  dueDate: string | null
  status: 'open' | 'done'
  fromSessionId: ID | null
  createdAt: string
}

export interface WeekPlan {
  id: ID
  weekday: number
  type: 'train' | 'rest'
  focus: string
  exerciseIds: ID[]
}

export interface Exercise {
  id: ID
  name: string
  bodyPart: string
  note: string
}

export interface WorkoutSet {
  reps: number
  weight: number
}

export interface WorkoutItem {
  exerciseId: ID
  name: string
  sets: WorkoutSet[]
  doneSets: number
}

export interface Workout {
  id: ID
  date: string
  focus: string
  items: WorkoutItem[]
  completed: boolean
  durationMin: number
}

export interface BodyMetric {
  id: ID
  date: string
  weight: number
  bodyFat: number | null
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface Dish {
  id: ID
  name: string
  mealType: MealType | 'any'
  calories: number
  note: string
}

export interface MealPlan {
  id: ID
  date: string
  mealType: MealType
  dishIds: ID[]
}

export interface MealLog {
  id: ID
  date: string
  mealType: MealType
  dishIds: ID[]
  source: 'home' | 'takeout'
}

export interface WaterLog {
  id: ID
  date: string
  cups: number
}

export interface Game {
  id: ID
  title: string
  platform: string
  status: 'wish' | 'playing' | 'done' | 'dropped'
  rating: number
  progress: number
  note: string
}

export interface Show {
  id: ID
  title: string
  type: 'series' | 'anime' | 'movie'
  status: 'wish' | 'watching' | 'done'
  episode: number
  totalEpisodes: number
  note: string
}

export interface LeisureLog {
  id: ID
  date: string
  kind: 'game' | 'show' | 'other'
  minutes: number
  note: string
}

export interface MiniScore {
  key: '2048' | 'memory'
  best: number
  updatedAt: string
}

export interface DeskDoc {
  schemaVersion: number
  exportedAt: string | null
  settings: Settings
  runtime: { timer: TimerState | null }
  plans: PlanItem[]
  memos: Memo[]
  media: MediaContent[]
  projects: Project[]
  tasks: Task[]
  bugs: Bug[]
  timeLogs: TimeLog[]
  devLogs: DevLog[]
  clients: Client[]
  engagements: Engagement[]
  sessions: Session[]
  followups: FollowUp[]
  weekPlans: WeekPlan[]
  exercises: Exercise[]
  workouts: Workout[]
  bodyMetrics: BodyMetric[]
  dishes: Dish[]
  mealPlans: MealPlan[]
  mealLogs: MealLog[]
  waterLogs: WaterLog[]
  games: Game[]
  shows: Show[]
  leisureLogs: LeisureLog[]
  miniScores: MiniScore[]
}

export const COLLECTIONS = RAW_COLLECTIONS as string[]

export function createEmptyDoc(): DeskDoc {
  return buildEmptyDoc() as DeskDoc
}

export interface BackupItem {
  file: string
  size: number
  mtime: string
}

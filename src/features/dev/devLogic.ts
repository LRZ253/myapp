import type { Bug, BugSeverity, DeskDoc, DevLog, Project, Task, TaskStatus, TimeLog, TimerState } from '@/types'

const SEVERITY_ORDER: Record<BugSeverity, number> = { blocker: 0, major: 1, normal: 2, minor: 3 }

export function createProject(doc: DeskDoc, name: string): Project | null {
  const text = name.trim()
  if (!text) return null
  const project: Project = {
    id: `proj_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: text,
    status: 'active',
    repoUrl: '',
    note: '',
    createdAt: new Date().toISOString(),
  }
  doc.projects.push(project)
  return project
}

export function updateProject(doc: DeskDoc, id: string, patchData: Partial<Project>): void {
  const project = doc.projects.find((p) => p.id === id)
  if (!project) return
  Object.assign(project, patchData)
}

export function removeProject(doc: DeskDoc, id: string): void {
  doc.projects = doc.projects.filter((p) => p.id !== id)
  doc.tasks = doc.tasks.filter((t) => t.projectId !== id)
  doc.bugs = doc.bugs.filter((b) => b.projectId !== id)
  doc.timeLogs = doc.timeLogs.filter((t) => t.projectId !== id)
  doc.devLogs = doc.devLogs.filter((l) => l.projectId !== id)
  // 今日计划里的引用按 PRD 保留，只标记为「来源已删除」
}

export function sortedProjects(doc: DeskDoc): Project[] {
  const rank: Record<string, number> = { active: 0, paused: 1, done: 2 }
  return doc.projects
    .slice()
    .sort((a, b) => (rank[a.status] - rank[b.status] === 0 ? a.name.localeCompare(b.name) : rank[a.status] - rank[b.status]))
}

export function projectSummary(doc: DeskDoc, projectId: string) {
  const logs = doc.timeLogs.filter((t) => t.projectId === projectId)
  return {
    minutes: logs.reduce((sum, t) => sum + t.minutes, 0),
    openTasks: doc.tasks.filter((t) => t.projectId === projectId && t.status !== 'done').length,
    openBugs: doc.bugs.filter((b) => b.projectId === projectId && b.status === 'open').length,
  }
}

export function addTask(doc: DeskDoc, projectId: string, title: string): Task | null {
  const text = title.trim()
  if (!text) return null
  const task: Task = {
    id: `task_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    projectId,
    title: text,
    status: 'todo',
    priority: 0,
    estimateMin: null,
    dueDate: null,
    createdAt: new Date().toISOString(),
  }
  doc.tasks.push(task)
  return task
}

export function setTaskStatus(doc: DeskDoc, id: string, status: TaskStatus): void {
  const task = doc.tasks.find((t) => t.id === id)
  if (task) task.status = status
}

export function nextTaskStatus(status: TaskStatus): TaskStatus {
  if (status === 'todo') return 'doing'
  if (status === 'doing') return 'done'
  return 'todo'
}

export function removeTask(doc: DeskDoc, id: string): void {
  doc.tasks = doc.tasks.filter((t) => t.id !== id)
}

export function tasksOf(doc: DeskDoc, projectId: string): Task[] {
  const rank: Record<TaskStatus, number> = { doing: 0, todo: 1, done: 2 }
  return doc.tasks.filter((t) => t.projectId === projectId).sort((a, b) => rank[a.status] - rank[b.status])
}

export function addBug(doc: DeskDoc, projectId: string, title: string, severity: BugSeverity = 'normal'): Bug | null {
  const text = title.trim()
  if (!text) return null
  const bug: Bug = {
    id: `bug_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    projectId,
    title: text,
    severity,
    status: 'open',
    note: '',
    createdAt: new Date().toISOString(),
  }
  doc.bugs.push(bug)
  return bug
}

export function setBugStatus(doc: DeskDoc, id: string, status: 'open' | 'fixed'): void {
  const bug = doc.bugs.find((b) => b.id === id)
  if (bug) bug.status = status
}

export function setBugSeverity(doc: DeskDoc, id: string, severity: BugSeverity): void {
  const bug = doc.bugs.find((b) => b.id === id)
  if (bug) bug.severity = severity
}

export function removeBug(doc: DeskDoc, id: string): void {
  doc.bugs = doc.bugs.filter((b) => b.id !== id)
}

export function bugsOf(doc: DeskDoc, projectId: string): Bug[] {
  return doc.bugs
    .filter((b) => b.projectId === projectId)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'open' ? -1 : 1
      return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    })
}

export function startTimer(doc: DeskDoc, projectId: string, taskId: string | null = null, now = Date.now()): TimerState {
  const timer: TimerState = { projectId, taskId, startedAt: now, accumulatedMs: 0, running: true }
  doc.runtime.timer = timer
  return timer
}

export function pauseTimer(doc: DeskDoc, now = Date.now()): void {
  const timer = doc.runtime.timer
  if (!timer || !timer.running) return
  timer.accumulatedMs += now - timer.startedAt
  timer.running = false
}

export function resumeTimer(doc: DeskDoc, now = Date.now()): void {
  const timer = doc.runtime.timer
  if (!timer || timer.running) return
  timer.startedAt = now
  timer.running = true
}

export function elapsedMs(timer: TimerState | null, now = Date.now()): number {
  if (!timer) return 0
  return timer.accumulatedMs + (timer.running ? Math.max(0, now - timer.startedAt) : 0)
}

/** 结束计时，落一条工时记录 */
export function stopTimer(doc: DeskDoc, now = Date.now(), note = ''): TimeLog | null {
  const timer = doc.runtime.timer
  if (!timer) return null
  const totalMs = elapsedMs(timer, now)
  const minutes = Math.max(1, Math.round(totalMs / 60000))
  const startedAt = new Date(now - totalMs).toISOString()
  const log: TimeLog = {
    id: `time_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    projectId: timer.projectId,
    taskId: timer.taskId,
    startedAt,
    endedAt: new Date(now).toISOString(),
    minutes,
    note,
  }
  doc.timeLogs.push(log)
  doc.runtime.timer = null
  return log
}

export function addTimeLog(doc: DeskDoc, projectId: string, minutes: number, note = '', date = new Date()): TimeLog | null {
  if (!projectId || !minutes || minutes <= 0) return null
  const started = new Date(date.getTime() - minutes * 60000)
  const log: TimeLog = {
    id: `time_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    projectId,
    taskId: null,
    startedAt: started.toISOString(),
    endedAt: date.toISOString(),
    minutes: Math.round(minutes),
    note,
  }
  doc.timeLogs.push(log)
  return log
}

export function timeLogsOf(doc: DeskDoc, projectId: string): TimeLog[] {
  return doc.timeLogs
    .filter((t) => t.projectId === projectId)
    .slice()
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
}

/** 写开发日志：同一天同一项目已有记录时追加 */
export function upsertDevLog(doc: DeskDoc, date: string, projectId: string | null, content: string): DevLog | null {
  const text = content.trim()
  if (!text) return null
  const existing = doc.devLogs.find((l) => l.date === date && l.projectId === projectId)
  if (existing) {
    existing.content = existing.content ? `${existing.content}\n${text}` : text
    return existing
  }
  const log: DevLog = {
    id: `devlog_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    date,
    projectId,
    content: text,
    createdAt: new Date().toISOString(),
  }
  doc.devLogs.push(log)
  return log
}

export function devLogsOf(doc: DeskDoc, projectId: string): DevLog[] {
  return doc.devLogs
    .filter((l) => l.projectId === projectId)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function formatMinutes(minutes: number): string {
  if (!minutes) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`
}

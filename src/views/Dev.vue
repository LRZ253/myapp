<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import Segmented from '@/components/Segmented.vue'
import EmptyState from '@/components/EmptyState.vue'
import InlineDelete from '@/components/InlineDelete.vue'
import { db, patch } from '@/store/db'
import { toast } from '@/store/ui'
import { todayKey } from '@/lib/date'
import { SEVERITY_LABELS, TASK_STATUS_LABELS } from '@/lib/labels'
import type { BugSeverity, ProjectStatus, TaskStatus } from '@/types'
import { addPlanItem, defaultSection } from '@/features/plan/planLogic'
import {
  addBug,
  addTask,
  addTimeLog,
  bugsOf,
  createProject,
  devLogsOf,
  elapsedMs,
  formatMinutes,
  nextTaskStatus,
  pauseTimer,
  projectSummary,
  removeBug,
  removeProject,
  removeTask,
  resumeTimer,
  setBugSeverity,
  setBugStatus,
  setTaskStatus,
  sortedProjects,
  startTimer,
  stopTimer,
  tasksOf,
  timeLogsOf,
  updateProject,
  upsertDevLog,
} from '@/features/dev/devLogic'

const projects = computed(() => sortedProjects(db.doc))
const selectedId = ref<string>('')
const tab = ref('tasks')
const now = ref(Date.now())

const taskDraft = ref('')
const bugDraft = ref('')
const logDraft = ref('')
const timeMinutes = ref<number | null>(null)
const timeNote = ref('')
const newProjectName = ref('')
const creating = ref(false)

let tick: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  tick = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onBeforeUnmount(() => {
  if (tick) clearInterval(tick)
})

watch(
  projects,
  (list) => {
    if (!selectedId.value && list.length) selectedId.value = list[0].id
    if (selectedId.value && !list.some((p) => p.id === selectedId.value)) selectedId.value = list[0]?.id || ''
  },
  { immediate: true },
)

const current = computed(() => db.doc.projects.find((p) => p.id === selectedId.value))
const summary = computed(() =>
  current.value ? projectSummary(db.doc, current.value.id) : { minutes: 0, openTasks: 0, openBugs: 0 },
)
const tasks = computed(() => (current.value ? tasksOf(db.doc, current.value.id) : []))
const bugs = computed(() => (current.value ? bugsOf(db.doc, current.value.id) : []))
const logs = computed(() => (current.value ? devLogsOf(db.doc, current.value.id) : []))
const timers = computed(() => (current.value ? timeLogsOf(db.doc, current.value.id) : []))
const timer = computed(() => db.doc.runtime.timer)
const timerRunning = computed(() => !!timer.value?.running)
const timerProject = computed(() => db.doc.projects.find((p) => p.id === timer.value?.projectId)?.name || '')

const elapsedText = computed(() => {
  const ms = elapsedMs(db.doc.runtime.timer, now.value)
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const subtitle = computed(() => {
  const active = db.doc.projects.filter((p) => p.status === 'active').length
  const openBugs = db.doc.bugs.filter((b) => b.status === 'open').length
  return `${active} 个项目在跑 · ${openBugs} 个 bug 未解`
})

const tabItems = [
  { value: 'tasks', label: '任务' },
  { value: 'bugs', label: 'Bug' },
  { value: 'time', label: '工时' },
  { value: 'logs', label: '日志' },
]

function createNewProject() {
  const name = newProjectName.value.trim()
  if (!name) return
  let id = ''
  patch((doc) => {
    const project = createProject(doc, name)
    if (project) id = project.id
  })
  selectedId.value = id
  newProjectName.value = ''
  creating.value = false
  toast('已创建项目')
}

function addNewTask() {
  if (!current.value) return
  const title = taskDraft.value
  if (!title.trim()) return
  patch((doc) => addTask(doc, current.value!.id, title))
  taskDraft.value = ''
}

function cycleTask(taskId: string, status: TaskStatus) {
  patch((doc) => setTaskStatus(doc, taskId, nextTaskStatus(status)))
}

function addNewBug() {
  if (!current.value) return
  const title = bugDraft.value
  if (!title.trim()) return
  patch((doc) => addBug(doc, current.value!.id, title))
  bugDraft.value = ''
}

function joinToday(title: string, sourceType: 'task' | 'bug', sourceId: string) {
  let duplicated = false
  patch((doc) => {
    const result = addPlanItem(doc, {
      date: todayKey(),
      section: defaultSection(),
      title,
      module: 'dev',
      sourceType,
      sourceId,
    })
    duplicated = result.duplicated
  })
  toast(duplicated ? '已在今天' : '已加入今天')
}

function toggleTimer() {
  if (!current.value) return
  patch((doc) => {
    const active = doc.runtime.timer
    if (!active) startTimer(doc, current.value!.id, null, Date.now())
    else if (active.running) pauseTimer(doc)
    else resumeTimer(doc)
  })
}

function finishTimer() {
  let minutes = 0
  patch((doc) => {
    const log = stopTimer(doc)
    minutes = log?.minutes || 0
  })
  toast(minutes ? `已记录 ${formatMinutes(minutes)}` : '已结束计时')
}

function saveManualTime() {
  if (!current.value || !timeMinutes.value) return
  const minutes = timeMinutes.value
  const note = timeNote.value
  patch((doc) => addTimeLog(doc, current.value!.id, minutes, note))
  timeMinutes.value = null
  timeNote.value = ''
  toast(`已补录 ${formatMinutes(minutes)}`)
}

function saveLog() {
  if (!current.value || !logDraft.value.trim()) return
  patch((doc) => upsertDevLog(doc, todayKey(), current.value!.id, logDraft.value))
  logDraft.value = ''
  toast('已记录')
}

function changeStatus(status: string) {
  if (!current.value) return
  patch((doc) => updateProject(doc, current.value!.id, { status: status as ProjectStatus }))
}

function dropProject() {
  if (!current.value) return
  patch((doc) => removeProject(doc, current.value!.id))
  selectedId.value = ''
}
</script>

<template>
  <section data-testid="page-dev">
    <PageHeader title="开发工作" :subtitle="subtitle">
      <button class="btn" data-testid="dev-new-project" @click="creating = !creating">+ 新建项目</button>
    </PageHeader>

    <div v-if="creating" class="card create-row">
      <input
        v-model="newProjectName"
        placeholder="项目名，回车创建"
        data-testid="dev-project-name"
        @keydown.enter="createNewProject"
      />
      <button class="btn primary" @click="createNewProject">创建</button>
    </div>

    <EmptyState
      v-if="!projects.length"
      title="还没有项目"
      desc="先建一个项目，任务、Bug 和工时都挂在它下面。"
      action-label="新建第一个项目"
      @action="creating = true"
    />

    <div v-else class="dev-layout">
      <aside class="rail">
        <button
          v-for="project in projects"
          :key="project.id"
          class="rail-item"
          :class="{ active: project.id === selectedId }"
          :data-testid="`dev-project-${project.id}`"
          @click="selectedId = project.id"
        >
          <span class="rail-name">{{ project.name }}</span>
          <span class="hint">{{ TASK_STATUS_LABELS[project.status === 'active' ? 'doing' : project.status === 'done' ? 'done' : 'todo'] }}</span>
        </button>
      </aside>

      <div v-if="current" class="detail card">
        <header class="detail-head">
          <input
            class="project-name"
            :value="current.name"
            data-testid="dev-project-title"
            @change="patch((doc) => updateProject(doc, current!.id, { name: ($event.target as HTMLInputElement).value }))"
          />
          <select
            class="status-select"
            :value="current.status"
            data-testid="dev-project-status"
            @change="changeStatus(($event.target as HTMLSelectElement).value)"
          >
            <option value="active">进行中</option>
            <option value="paused">暂停</option>
            <option value="done">已完成</option>
          </select>
          <div class="spacer" />
          <InlineDelete label="删除项目" @confirm="dropProject" />
        </header>

        <div class="metrics">
          <div class="metric"><div class="metric-label">累计工时</div><div class="metric-value">{{ formatMinutes(summary.minutes) }}</div></div>
          <div class="metric"><div class="metric-label">未完成任务</div><div class="metric-value">{{ summary.openTasks }}</div></div>
          <div class="metric"><div class="metric-label">未解 Bug</div><div class="metric-value">{{ summary.openBugs }}</div></div>
        </div>

        <div class="tabs">
          <Segmented v-model="tab" :items="tabItems" />
          <div class="spacer" />
          <div v-if="timer" class="timer-chip" :data-testid="'dev-timer-elapsed'">
            {{ timerProject }} · {{ elapsedText }}
          </div>
        </div>

        <div v-if="tab === 'tasks'" class="tab-body">
          <div v-for="task in tasks" :key="task.id" class="line" :data-testid="`dev-task-${task.id}`">
            <button
              class="status-btn"
              :data-status="task.status"
              :data-testid="`dev-task-toggle-${task.id}`"
              @click="cycleTask(task.id, task.status)"
            >
              {{ TASK_STATUS_LABELS[task.status] }}
            </button>
            <span class="line-title" :class="{ done: task.status === 'done' }">{{ task.title }}</span>
            <div class="row-actions">
              <button class="btn ghost mini" @click="joinToday(task.title, 'task', task.id)">加入今天</button>
              <InlineDelete label="删除" @confirm="patch((doc) => removeTask(doc, task.id))" />
            </div>
          </div>
          <input v-model="taskDraft" class="add-input" placeholder="加一条任务，回车确认" data-testid="dev-task-add" @keydown.enter="addNewTask" />
        </div>

        <div v-else-if="tab === 'bugs'" class="tab-body">
          <div v-for="bug in bugs" :key="bug.id" class="line" :data-testid="`dev-bug-${bug.id}`">
            <select
              class="sev-select"
              :value="bug.severity"
              @change="patch((doc) => setBugSeverity(doc, bug.id, ($event.target as HTMLSelectElement).value as BugSeverity))"
            >
              <option v-for="(label, key) in SEVERITY_LABELS" :key="key" :value="key">{{ label }}</option>
            </select>
            <span class="line-title" :class="{ done: bug.status === 'fixed' }">{{ bug.title }}</span>
            <span class="tag" :class="{ accent: bug.status === 'fixed' }">{{ bug.status === 'fixed' ? '已解' : '未解' }}</span>
            <div class="row-actions">
              <button
                class="btn ghost mini"
                :data-testid="`dev-bug-toggle-${bug.id}`"
                @click="patch((doc) => setBugStatus(doc, bug.id, bug.status === 'fixed' ? 'open' : 'fixed'))"
              >
                {{ bug.status === 'fixed' ? '重开' : '标记已解' }}
              </button>
              <button class="btn ghost mini" @click="joinToday(bug.title, 'bug', bug.id)">加入今天</button>
              <InlineDelete label="删除" @confirm="patch((doc) => removeBug(doc, bug.id))" />
            </div>
          </div>
          <input v-model="bugDraft" class="add-input" placeholder="记一个 Bug，回车确认" data-testid="dev-bug-add" @keydown.enter="addNewBug" />
        </div>

        <div v-else-if="tab === 'time'" class="tab-body">
          <div class="timer-box">
            <button class="btn primary" data-testid="dev-timer-toggle" @click="toggleTimer">
              {{ !timer ? '开始计时' : timerRunning ? '暂停' : '继续' }}
            </button>
            <button v-if="timer" class="btn" data-testid="dev-timer-stop" @click="finishTimer">结束并记录</button>
            <span class="hint" data-testid="dev-timer-text">{{ elapsedText }}</span>
          </div>

          <div class="manual">
            <input v-model.number="timeMinutes" type="number" min="1" placeholder="分钟" class="minutes-input" data-testid="dev-time-minutes" />
            <input v-model="timeNote" placeholder="补录说明（可选）" />
            <button class="btn" data-testid="dev-time-add" @click="saveManualTime">补录</button>
          </div>

          <div v-for="log in timers" :key="log.id" class="line">
            <span class="hint">{{ log.startedAt.slice(5, 10) }}</span>
            <span class="line-title">{{ log.note || '未填说明' }}</span>
            <span class="tag">{{ formatMinutes(log.minutes) }}</span>
          </div>
          <p v-if="!timers.length" class="hint">还没有工时记录。</p>
        </div>

        <div v-else class="tab-body">
          <textarea v-model="logDraft" rows="3" placeholder="今天推进了什么、卡在哪" data-testid="dev-log-input" />
          <div class="row" style="margin-top: 6px">
            <button class="btn" data-testid="dev-log-save" @click="saveLog">记一笔</button>
          </div>
          <div v-for="log in logs" :key="log.id" class="log-item">
            <div class="hint">{{ log.date }}</div>
            <div class="log-content">{{ log.content }}</div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.create-row {
  display: flex;
  gap: 8px;
  padding: 10px;
  margin-bottom: 12px;
}

.dev-layout {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.rail {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  text-align: left;
}

.rail-item:hover {
  background: var(--bg-secondary);
}

.rail-item.active {
  background: var(--bg-secondary);
  font-weight: 500;
}

.rail-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail {
  padding: 14px;
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.project-name {
  border: 0;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  padding: 2px 0;
  width: 240px;
}

.project-name:focus {
  border-bottom: 0.5px solid var(--accent);
}

.status-select {
  border: 0.5px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--bg);
  font-size: 11px;
  padding: 2px 4px;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.metric {
  background: var(--bg-secondary);
  border-radius: var(--radius);
  padding: 8px 10px;
}

.metric-label {
  font-size: 11px;
  color: var(--text-3);
}

.metric-value {
  font-size: 14px;
  font-weight: 500;
}

.tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 0.5px solid var(--border);
  padding-bottom: 8px;
  margin-bottom: 8px;
}

.timer-chip {
  font-size: 11px;
  color: var(--accent-text);
  background: var(--accent-soft);
  border-radius: 4px;
  padding: 1px 6px;
}

.tab-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
  border-radius: 6px;
}

.line:hover {
  background: var(--bg-tertiary);
}

.line-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.line-title.done {
  color: var(--text-3);
  text-decoration: line-through;
}

.status-btn,
.sev-select {
  font-size: 11px;
  border: 0.5px solid var(--border);
  background: var(--bg);
  border-radius: 4px;
  padding: 1px 6px;
  flex: 0 0 auto;
}

.status-btn[data-status='doing'] {
  color: var(--accent-text);
  background: var(--accent-soft);
  border-color: transparent;
}

.status-btn[data-status='done'] {
  color: var(--text-3);
}

.row-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
}

.line:hover .row-actions {
  opacity: 1;
}

.mini {
  font-size: 11px;
  padding: 1px 6px;
}

.add-input {
  border: 0;
  background: transparent;
  padding: 4px 0;
  font-size: 12px;
}

.add-input::placeholder {
  color: var(--text-3);
}

.timer-box {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.manual {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}

.minutes-input {
  width: 80px;
}

.log-item {
  border-top: 0.5px solid var(--border);
  padding: 8px 0 4px;
}

.log-content {
  font-size: 12px;
  white-space: pre-wrap;
  line-height: 1.6;
}
</style>

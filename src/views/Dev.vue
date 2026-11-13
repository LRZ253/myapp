<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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

const taskComposer = ref(false)
const bugComposer = ref(false)
const taskInput = ref<HTMLInputElement | null>(null)
const bugInput = ref<HTMLInputElement | null>(null)

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

const doneTasks = computed(() => tasks.value.filter((t) => t.status === 'done').length)
const taskProgress = computed(() =>
  tasks.value.length ? Math.round((doneTasks.value / tasks.value.length) * 100) : 0,
)

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

async function openTaskComposer() {
  taskComposer.value = true
  await nextTick()
  taskInput.value?.focus()
}

function closeTaskComposer() {
  taskComposer.value = false
  taskDraft.value = ''
}

function addNewTask() {
  if (!current.value) return
  const title = taskDraft.value.trim()
  if (!title) {
    taskInput.value?.focus()
    return
  }
  patch((doc) => addTask(doc, current.value!.id, title))
  taskDraft.value = ''
  taskInput.value?.focus()
  toast('已添加任务')
}

async function openBugComposer() {
  bugComposer.value = true
  await nextTick()
  bugInput.value?.focus()
}

function closeBugComposer() {
  bugComposer.value = false
  bugDraft.value = ''
}

function addNewBug() {
  if (!current.value) return
  const title = bugDraft.value.trim()
  if (!title) {
    bugInput.value?.focus()
    return
  }
  patch((doc) => addBug(doc, current.value!.id, title))
  bugDraft.value = ''
  bugInput.value?.focus()
  toast('已记录 Bug')
}

function cycleTask(taskId: string, status: TaskStatus) {
  patch((doc) => setTaskStatus(doc, taskId, nextTaskStatus(status)))
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
      <button class="btn primary" data-testid="dev-new-project" @click="creating = !creating">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5.5v13M5.5 12h13" /></svg>
        新建项目
      </button>
    </PageHeader>

    <div v-if="creating" class="card create-row">
      <input
        v-model="newProjectName"
        placeholder="给项目起个名字，回车创建"
        data-testid="dev-project-name"
        @keydown.enter="createNewProject"
      />
      <button class="btn primary" @click="createNewProject">创建</button>
      <button class="btn ghost" @click="creating = false">取消</button>
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
        <div class="rail-head">项目 · {{ projects.length }}</div>
        <button
          v-for="project in projects"
          :key="project.id"
          class="rail-item"
          :class="{ active: project.id === selectedId }"
          :data-testid="`dev-project-${project.id}`"
          @click="selectedId = project.id"
        >
          <span class="rail-dot" :data-status="project.status" />
          <span class="rail-name">{{ project.name }}</span>
          <span class="rail-count">{{ projectSummary(db.doc, project.id).openTasks }}</span>
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

        <div class="stat-grid metrics">
          <div class="stat">
            <div class="stat-label">累计工时</div>
            <div class="stat-value">{{ formatMinutes(summary.minutes) }}</div>
          </div>
          <div class="stat">
            <div class="stat-label">未完成任务</div>
            <div class="stat-value">{{ summary.openTasks }}</div>
          </div>
          <div class="stat">
            <div class="stat-label">未解 Bug</div>
            <div class="stat-value" :class="{ 'text-danger': summary.openBugs > 0 }">{{ summary.openBugs }}</div>
          </div>
          <div class="stat">
            <div class="stat-label">任务完成度</div>
            <div class="stat-value">{{ taskProgress }}<span class="unit">%</span></div>
          </div>
        </div>

        <div class="tabs">
          <Segmented v-model="tab" :items="tabItems" />
          <div class="spacer" />
          <div v-if="timer" class="timer-chip" :data-testid="'dev-timer-elapsed'">
            <span class="pulse" :class="{ live: timerRunning }" />
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

          <p v-if="!tasks.length && !taskComposer" class="hint list-empty">这个项目还没有任务。</p>

          <div v-if="taskComposer" class="composer">
            <input
              ref="taskInput"
              v-model="taskDraft"
              placeholder="任务标题，回车保存；Esc 关闭"
              data-testid="dev-task-add"
              @keydown.enter="addNewTask"
              @keydown.esc="closeTaskComposer"
            />
            <button class="btn primary sm" @click="addNewTask">添加</button>
            <button class="btn ghost sm" @click="closeTaskComposer">取消</button>
          </div>
          <button v-else class="add-row" data-testid="dev-task-new" @click="openTaskComposer">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5.5v13M5.5 12h13" /></svg>
            添加任务
          </button>
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
            <span class="tag" :class="bug.status === 'fixed' ? 'ok' : 'danger'">{{ bug.status === 'fixed' ? '已解' : '未解' }}</span>
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

          <p v-if="!bugs.length && !bugComposer" class="hint list-empty">还没有 Bug 记录。</p>

          <div v-if="bugComposer" class="composer">
            <input
              ref="bugInput"
              v-model="bugDraft"
              placeholder="Bug 描述，回车保存；Esc 关闭"
              data-testid="dev-bug-add"
              @keydown.enter="addNewBug"
              @keydown.esc="closeBugComposer"
            />
            <button class="btn primary sm" @click="addNewBug">添加</button>
            <button class="btn ghost sm" @click="closeBugComposer">取消</button>
          </div>
          <button v-else class="add-row" data-testid="dev-bug-new" @click="openBugComposer">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5.5v13M5.5 12h13" /></svg>
            记录 Bug
          </button>
        </div>

        <div v-else-if="tab === 'time'" class="tab-body">
          <div class="timer-box">
            <button class="btn primary" data-testid="dev-timer-toggle" @click="toggleTimer">
              {{ !timer ? '开始计时' : timerRunning ? '暂停' : '继续' }}
            </button>
            <button v-if="timer" class="btn" data-testid="dev-timer-stop" @click="finishTimer">结束并记录</button>
            <span class="timer-digits" data-testid="dev-timer-text">{{ elapsedText }}</span>
          </div>

          <div class="manual">
            <input v-model.number="timeMinutes" type="number" min="1" placeholder="分钟" class="minutes-input" data-testid="dev-time-minutes" />
            <input v-model="timeNote" placeholder="补录说明（可选）" />
            <button class="btn" data-testid="dev-time-add" @click="saveManualTime">补录</button>
          </div>

          <div v-for="log in timers" :key="log.id" class="line">
            <span class="hint log-date">{{ log.startedAt.slice(5, 10) }}</span>
            <span class="line-title">{{ log.note || '未填说明' }}</span>
            <span class="tag">{{ formatMinutes(log.minutes) }}</span>
          </div>
          <p v-if="!timers.length" class="hint list-empty">还没有工时记录，上面可以直接开计时。</p>
        </div>

        <div v-else class="tab-body">
          <textarea v-model="logDraft" rows="3" placeholder="今天推进了什么、卡在哪" data-testid="dev-log-input" />
          <div class="row" style="margin-top: 8px">
            <button class="btn primary sm" data-testid="dev-log-save" @click="saveLog">记一笔</button>
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
  padding: 12px;
  margin-bottom: 14px;
}

.dev-layout {
  display: grid;
  grid-template-columns: 208px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.rail {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.rail-head {
  font-size: var(--fs-2xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3);
  padding: 4px 8px 8px;
}

.rail-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  padding: 7px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  text-align: left;
  color: var(--text-2);
  transition: background 0.14s ease, color 0.14s ease;
}

.rail-item:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.rail-item.active {
  background: var(--accent-soft);
  color: var(--accent-text);
  font-weight: 600;
}

.rail-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: 0 0 6px;
  background: var(--text-3);
}

.rail-dot[data-status="active"] {
  background: var(--ok);
}

.rail-dot[data-status="paused"] {
  background: var(--warn);
}

.rail-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-count {
  font-size: var(--fs-2xs);
  font-variant-numeric: tabular-nums;
  color: var(--text-3);
}

.rail-item.active .rail-count {
  color: var(--accent-text);
}

.detail {
  padding: 18px;
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.project-name {
  border: 1px solid transparent;
  background: transparent;
  font-size: var(--fs-lg);
  font-weight: 600;
  letter-spacing: -0.02em;
  padding: 2px 6px;
  margin-left: -6px;
  width: 260px;
  box-shadow: none;
}

.project-name:hover {
  border-color: var(--border);
  background: var(--surface);
}

.project-name:focus {
  border-color: var(--accent);
  background: var(--surface);
}

.status-select {
  width: auto;
  height: 26px;
  font-size: var(--fs-xs);
  padding: 0 6px;
  border-radius: var(--radius-xs);
}

.metrics {
  margin-bottom: 16px;
}

.stat-value .unit {
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--text-3);
  margin-left: 1px;
}

.text-danger {
  color: var(--danger);
}

.tabs {
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 10px;
  margin-bottom: 10px;
}

.timer-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-xs);
  font-variant-numeric: tabular-nums;
  color: var(--accent-text);
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 3px 10px;
}

.pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-3);
}

.pulse.live {
  background: var(--ok);
  animation: blink 1.4s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

.tab-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.line {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  font-size: var(--fs-sm);
  border-radius: var(--radius-sm);
  transition: background 0.12s ease;
}

.line:hover {
  background: var(--surface-2);
}

.line-title {
  flex: 1;
  min-width: 0;
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
  font-size: var(--fs-xs);
  font-weight: 500;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 999px;
  padding: 1px 9px;
  flex: 0 0 auto;
  width: auto;
  height: 22px;
  line-height: 20px;
}

.status-btn[data-status='doing'] {
  color: var(--accent-text);
  background: var(--accent-soft);
  border-color: transparent;
}

.status-btn[data-status='done'] {
  color: var(--text-3);
  background: var(--surface-2);
}

.row-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0.55;
  transition: opacity 0.14s ease;
}

.line:hover .row-actions,
.row-actions:focus-within {
  opacity: 1;
}

.mini {
  font-size: var(--fs-xs);
  padding: 0 7px;
  height: 24px;
}

.list-empty {
  padding: 14px 8px;
}

.add-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  margin-top: 6px;
  padding: 9px 10px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-3);
  font-size: var(--fs-sm);
  transition: color 0.14s ease, border-color 0.14s ease, background 0.14s ease;
}

.add-row:hover {
  color: var(--accent-text);
  border-color: var(--accent);
  background: var(--accent-soft);
}

.composer {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 8px;
  padding: 8px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.composer input {
  flex: 1;
}

.timer-box {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.timer-digits {
  font-family: var(--font-num);
  font-size: var(--fs-lg);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  color: var(--text-2);
}

.manual {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}

.minutes-input {
  width: 88px;
}

.log-date {
  font-variant-numeric: tabular-nums;
}

.log-item {
  border-top: 1px solid var(--border);
  padding: 10px 2px 6px;
}

.log-content {
  font-size: var(--fs-sm);
  white-space: pre-wrap;
  line-height: 1.7;
}
</style>

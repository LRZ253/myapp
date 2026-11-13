<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NAV_ITEMS } from '@/router'
import { db } from '@/store/db'
import { openDrawer } from '@/store/ui'
import MemoDrawer from '@/features/memo/MemoDrawer.vue'
import { itemsForDate } from '@/features/plan/planLogic'
import { STAGE_LABELS } from '@/lib/labels'
import { todayKey } from '@/lib/date'

const emit = defineEmits<{ close: [] }>()
const router = useRouter()

interface Command {
  label: string
  hint: string
  run: () => void
}

const query = ref('')
const index = ref(0)
const input = ref<HTMLInputElement | null>(null)
const list = ref<HTMLElement | null>(null)

const commands = computed<Command[]>(() => {
  const items: Command[] = NAV_ITEMS.map((item) => ({
    label: item.label,
    hint: '模块',
    run: () => router.push(item.path),
  }))

  items.push({
    label: '记一条快速备忘',
    hint: '新建',
    run: () => openDrawer({ title: '快速备忘', component: MemoDrawer, props: {} }),
  })

  const today = todayKey()
  for (const item of itemsForDate(db.doc, today).filter((i) => !i.done).slice(0, 6)) {
    items.push({ label: item.title, hint: '今日未完成', run: () => router.push('/today') })
  }
  for (const task of db.doc.tasks.filter((t) => t.status !== 'done').slice(0, 6)) {
    items.push({ label: task.title, hint: '任务', run: () => router.push('/dev') })
  }
  for (const content of db.doc.media.slice(0, 6)) {
    items.push({
      label: content.title,
      hint: `内容 · ${STAGE_LABELS[content.stage]}`,
      run: () => router.push('/media'),
    })
  }
  for (const client of db.doc.clients.slice(0, 6)) {
    items.push({ label: client.name, hint: '客户', run: () => router.push('/consult') })
  }
  for (const game of db.doc.games.slice(0, 4)) {
    items.push({ label: game.title, hint: '游戏', run: () => router.push('/play') })
  }
  for (const show of db.doc.shows.slice(0, 4)) {
    items.push({ label: show.title, hint: '追剧', run: () => router.push('/play') })
  }

  return items
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return commands.value
  return commands.value.filter((c) => c.label.toLowerCase().includes(q) || c.hint.includes(q))
})

function choose(cmd: Command | undefined) {
  if (!cmd) return
  cmd.run()
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    index.value = Math.min(index.value + 1, filtered.value.length - 1)
    scrollIntoView()
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    index.value = Math.max(index.value - 1, 0)
    scrollIntoView()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    choose(filtered.value[index.value])
  }
}

function scrollIntoView() {
  nextTick(() => {
    const el = list.value?.querySelector('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  })
}

onMounted(() => input.value?.focus())
</script>

<template>
  <Teleport to="body">
    <div class="palette-mask" data-testid="palette" @click.self="emit('close')">
      <div class="palette" role="dialog" aria-label="命令面板">
        <input
          ref="input"
          v-model="query"
          class="palette-input"
          placeholder="跳到模块、搜索条目…"
          data-testid="palette-input"
          @keydown="onKeydown"
          @input="index = 0"
        />
        <div ref="list" class="palette-list">
          <button
            v-for="(cmd, i) in filtered"
            :key="`${cmd.hint}-${i}`"
            class="palette-item"
            :class="{ active: i === index }"
            :data-active="i === index"
            :data-testid="`palette-item-${i}`"
            @click="choose(cmd)"
            @mouseenter="index = i"
          >
            <span class="ellipsis">{{ cmd.label }}</span>
            <span class="tag">{{ cmd.hint }}</span>
          </button>
          <div v-if="!filtered.length" class="palette-empty hint">没有匹配项</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.palette-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.18);
  display: flex;
  justify-content: center;
  padding-top: 12vh;
  z-index: 60;
}

.palette {
  width: 420px;
  max-height: 380px;
  background: var(--bg);
  border: 0.5px solid var(--border-strong);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.palette-input {
  border: 0;
  border-bottom: 0.5px solid var(--border);
  border-radius: 0;
  padding: 10px 12px;
  font-size: 13px;
}

.palette-input:focus {
  border-color: var(--border);
}

.palette-list {
  overflow: auto;
  padding: 4px;
}

.palette-item {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12.5px;
  text-align: left;
}

.palette-item .ellipsis {
  flex: 1;
}

.palette-item.active {
  background: var(--bg-secondary);
}

.palette-empty {
  padding: 16px;
  text-align: center;
}
</style>

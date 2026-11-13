<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { memoryDeck, memoryScore, type MemoryCard } from './playLogic'

const emit = defineEmits<{ finish: [score: number] }>()

const cards = ref<MemoryCard[]>(memoryDeck(8))
const flipped = ref<string[]>([])
const matched = ref<string[]>([])
const moves = ref(0)
const done = ref(false)
let lock = false
let timer: ReturnType<typeof setTimeout> | null = null

function flip(card: MemoryCard) {
  if (lock || done.value) return
  if (flipped.value.includes(card.id) || matched.value.includes(card.id)) return
  flipped.value.push(card.id)
  if (flipped.value.length < 2) return

  moves.value += 1
  const [first, second] = flipped.value
  const a = cards.value.find((c) => c.id === first)
  const b = cards.value.find((c) => c.id === second)
  if (a && b && a.value === b.value) {
    matched.value.push(first, second)
    flipped.value = []
    if (matched.value.length === cards.value.length) {
      done.value = true
      emit('finish', memoryScore(moves.value))
    }
    return
  }

  lock = true
  timer = setTimeout(() => {
    flipped.value = []
    lock = false
  }, 700)
}

function restart() {
  if (timer) clearTimeout(timer)
  cards.value = memoryDeck(8)
  flipped.value = []
  matched.value = []
  moves.value = 0
  done.value = false
  lock = false
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div class="memory" data-testid="game-memory">
    <header class="g-head">
      <span>记忆翻牌</span>
      <span class="hint">步数 {{ moves }}</span>
      <button class="btn mini" data-testid="memory-restart" @click="restart">重开</button>
    </header>

    <div class="grid">
      <button
        v-for="card in cards"
        :key="card.id"
        class="card-cell"
        :class="{ open: flipped.includes(card.id) || matched.includes(card.id), matched: matched.includes(card.id) }"
        :data-testid="`memory-card-${card.id}`"
        @click="flip(card)"
      >
        <span v-if="flipped.includes(card.id) || matched.includes(card.id)">{{ card.value }}</span>
      </button>
    </div>

    <p v-if="done" class="hint done" data-testid="memory-done">全部配对，得分 {{ memoryScore(moves) }}。</p>
    <p v-else class="hint">点两张牌，配对成功会留在正面。</p>
  </div>
</template>

<style scoped>
.memory {
  width: 300px;
}

.g-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: var(--fs-base);
  font-weight: 500;
}

.g-head .hint {
  font-weight: 400;
}

.mini {
  margin-left: auto;
  font-size: var(--fs-xs);
  padding: 1px 8px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.card-cell {
  aspect-ratio: 1;
  border: 1px solid var(--border-strong);
  background: var(--surface-2);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--text-2);
}

.card-cell.open {
  background: var(--surface);
  border-color: var(--accent);
  color: var(--accent-text);
}

.card-cell.matched {
  background: var(--accent-soft);
  border-color: transparent;
}

.done {
  color: var(--accent-text);
}
</style>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { addRandomTile, canMove, maxTile, moveBoard, newGame, type Board, type Direction } from './playLogic'

const emit = defineEmits<{ finish: [score: number] }>()

const board = ref<Board>(newGame())
const score = ref(0)
const over = ref(false)
const finished = ref(false)

function finish() {
  over.value = true
  if (!finished.value) {
    finished.value = true
    emit('finish', score.value)
  }
}

function doMove(direction: Direction) {
  if (over.value) return
  const result = moveBoard(board.value, direction)
  if (!result.moved) return
  board.value = addRandomTile(result.board)
  score.value += result.gained
  if (!canMove(board.value)) finish()
}

function restart() {
  board.value = newGame()
  score.value = 0
  over.value = false
  finished.value = false
}

function onKeydown(e: KeyboardEvent) {
  const map: Record<string, Direction> = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    a: 'left',
    d: 'right',
    w: 'up',
    s: 'down',
  }
  const direction = map[e.key]
  if (!direction) return
  e.preventDefault()
  doMove(direction)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="game-2048" data-testid="game-2048">
    <header class="g-head">
      <span>2048</span>
      <span class="hint">得分 {{ score }} · 最大 {{ maxTile(board) }}</span>
      <button class="btn mini" data-testid="g2048-restart" @click="restart">重开</button>
    </header>

    <div class="board">
      <template v-for="(row, r) in board" :key="r">
        <div v-for="(value, c) in row" :key="`${r}-${c}`" class="cell" :data-value="value">
          {{ value || '' }}
        </div>
      </template>
    </div>

    <p v-if="over" class="hint over" data-testid="g2048-over">这局结束，得分 {{ score }}。按方向键再来或点重开。</p>
    <p v-else class="hint">用方向键（或 WASD）移动，相同数字合并。</p>
  </div>
</template>

<style scoped>
.game-2048 {
  width: 320px;
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

.board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  background: var(--surface-2);
  border-radius: var(--radius-lg);
  padding: 6px;
}

.cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--surface);
  font-size: 18px;
  font-weight: 500;
  color: var(--text-2);
}

.cell[data-value='2'] { background: #f4f1e8; color: #6b6455; }
.cell[data-value='4'] { background: #ece4d2; color: #6b6455; }
.cell[data-value='8'] { background: #f2c98a; color: #5a3c12; }
.cell[data-value='16'] { background: #efb06a; color: #5a3c12; }
.cell[data-value='32'] { background: #e88f5a; color: #fff; }
.cell[data-value='64'] { background: #dd6b45; color: #fff; }
.cell[data-value='128'] { background: #6aa9f0; color: #fff; }
.cell[data-value='256'] { background: #4b8ee0; color: #fff; }
.cell[data-value='512'] { background: #3b74c4; color: #fff; }
.cell[data-value='1024'] { background: #2f5da3; color: #fff; }
.cell[data-value='2048'] { background: #234878; color: #fff; }

.over {
  color: var(--accent-text);
}
</style>

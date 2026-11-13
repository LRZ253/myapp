import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import Play from '@/views/Play.vue'
import Game2048 from '@/features/play/Game2048.vue'
import MemoryFlip from '@/features/play/MemoryFlip.vue'
import { db, resetDbForTests } from '@/store/db'
import { createEmptyDoc, type DeskDoc } from '@/types'
import { addDays, todayKey, weekStartKey } from '@/lib/date'
import {
  addGame,
  addLeisure,
  addRandomTile,
  addShow,
  bestScore,
  canMove,
  emptyBoard,
  formatMinutes,
  gamesOf,
  maxTile,
  memoryDeck,
  memoryScore,
  moveBoard,
  newGame,
  removeGame,
  removeShow,
  setGameProgress,
  setGameRating,
  setGameStatus,
  setMiniScore,
  setShowStatus,
  setShowTotal,
  showPercent,
  todayMinutes,
  updateShowProgress,
  weekMinutes,
  weekMinutesByDay,
  type Board,
} from '@/features/play/playLogic'

const TODAY = todayKey()
const WEEK_START = weekStartKey(TODAY, 1)

let wrapper: VueWrapper | null = null

beforeEach(() => {
  resetDbForTests()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, savedAt: new Date().toISOString() }) })),
  )
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllGlobals()
})

describe('游戏清单', () => {
  it('新增游戏默认想玩，空名字不入库', () => {
    const doc = createEmptyDoc()
    const game = addGame(doc, '  塞尔达  ', 'Switch')!
    expect(game.title).toBe('塞尔达')
    expect(game.status).toBe('wish')
    expect(game.rating).toBe(0)
    expect(addGame(doc, '   ')).toBeNull()
    expect(doc.games).toHaveLength(1)
  })

  it('改成已通关会把进度补到 100', () => {
    const doc = createEmptyDoc()
    const game = addGame(doc, '哈迪斯')!
    expect(game.status).toBe('wish')

    setGameStatus(doc, game.id, 'playing')
    expect(doc.games[0].status).toBe('playing')
    expect(doc.games[0].progress).toBe(0)

    setGameStatus(doc, game.id, 'done')
    expect(doc.games[0].progress).toBe(100)
  })

  it('进度超出范围被夹在 0–100，满 100 自动通关', () => {
    const doc = createEmptyDoc()
    const game = addGame(doc, '星露谷物语')!

    setGameProgress(doc, game.id, 130)
    expect(doc.games[0].progress).toBe(100)
    expect(doc.games[0].status).toBe('done')

    setGameProgress(doc, game.id, -5)
    expect(doc.games[0].progress).toBe(0)
  })

  it('评分夹在 0–5', () => {
    const doc = createEmptyDoc()
    const game = addGame(doc, '空洞骑士')!
    setGameRating(doc, game.id, 4)
    expect(doc.games[0].rating).toBe(4)
    setGameRating(doc, game.id, 9)
    expect(doc.games[0].rating).toBe(5)
  })

  it('按状态分组，删除后不再出现', () => {
    const doc = createEmptyDoc()
    const a = addGame(doc, 'A')!
    addGame(doc, 'B')
    setGameStatus(doc, a.id, 'playing')

    expect(gamesOf(doc, 'playing').map((g) => g.title)).toEqual(['A'])
    expect(gamesOf(doc, 'wish').map((g) => g.title)).toEqual(['B'])
    expect(gamesOf(doc)).toHaveLength(2)

    removeGame(doc, a.id)
    expect(gamesOf(doc, 'playing')).toHaveLength(0)
  })
})

describe('追剧清单', () => {
  it('记进度后状态变为在看', () => {
    const doc = createEmptyDoc()
    const show = addShow(doc, '漫长的季节', 'series', 12)!

    updateShowProgress(doc, show.id, 4)
    expect(doc.shows[0].episode).toBe(4)
    expect(doc.shows[0].status).toBe('watching')
  })

  it('看到最后一集自动看完，进度不超过总集数', () => {
    const doc = createEmptyDoc()
    const show = addShow(doc, '进击的巨人', 'anime', 10)!

    updateShowProgress(doc, show.id, 99)
    expect(doc.shows[0].episode).toBe(10)
    expect(doc.shows[0].status).toBe('done')
  })

  it('进度条百分比按总集数算，没设总集数为 0', () => {
    const doc = createEmptyDoc()
    const show = addShow(doc, '某电影', 'movie')!
    expect(showPercent(doc.shows[0])).toBe(0)

    setShowTotal(doc, show.id, 10)
    updateShowProgress(doc, show.id, 5)
    expect(showPercent(doc.shows[0])).toBe(50)
  })

  it('改总集数时把超出的集数收回来', () => {
    const doc = createEmptyDoc()
    const show = addShow(doc, '测试剧', 'series', 20)!
    updateShowProgress(doc, show.id, 18)
    setShowTotal(doc, show.id, 8)
    expect(doc.shows[0].episode).toBe(8)
  })

  it('手动改状态：看完补集数，想看清零', () => {
    const doc = createEmptyDoc()
    const show = addShow(doc, '测试剧', 'series', 6)!
    updateShowProgress(doc, show.id, 2)

    setShowStatus(doc, show.id, 'done')
    expect(doc.shows[0].episode).toBe(6)

    setShowStatus(doc, show.id, 'wish')
    expect(doc.shows[0].episode).toBe(0)
  })

  it('删除追剧记录', () => {
    const doc = createEmptyDoc()
    const show = addShow(doc, '测试剧')!
    removeShow(doc, show.id)
    expect(doc.shows).toHaveLength(0)
  })
})

describe('娱乐时长', () => {
  it('0 或负分钟不入库', () => {
    const doc = createEmptyDoc()
    expect(addLeisure(doc, TODAY, 0)).toBeNull()
    expect(addLeisure(doc, TODAY, -30)).toBeNull()
    expect(doc.leisureLogs).toHaveLength(0)
  })

  it('本周累计只算本周', () => {
    const doc = createEmptyDoc()
    addLeisure(doc, TODAY, 45, 'game')
    addLeisure(doc, WEEK_START, 30, 'show')
    addLeisure(doc, addDays(WEEK_START, -1), 120, 'game')
    addLeisure(doc, addDays(WEEK_START, 7), 60, 'game')

    expect(weekMinutes(doc, TODAY)).toBe(75)
    expect(todayMinutes(doc, TODAY)).toBe(45)
  })

  it('记 45 分钟后本周累计增加 45 分钟', () => {
    const doc = createEmptyDoc()
    const before = weekMinutes(doc, TODAY)
    addLeisure(doc, TODAY, 45)
    expect(weekMinutes(doc, TODAY)).toBe(before + 45)
  })

  it('周柱状图从周一开始共 7 天', () => {
    const doc = createEmptyDoc()
    addLeisure(doc, addDays(WEEK_START, 2), 20)
    const rows = weekMinutesByDay(doc, TODAY)
    expect(rows).toHaveLength(7)
    expect(rows[0].date).toBe(WEEK_START)
    expect(rows[2].minutes).toBe(20)
  })

  it('时长展示：不足一小时按分钟，够一小时按小时', () => {
    expect(formatMinutes(0)).toBe('0 分钟')
    expect(formatMinutes(45)).toBe('45 分钟')
    expect(formatMinutes(60)).toBe('1 小时')
    expect(formatMinutes(90)).toBe('1.5 小时')
  })
})

describe('小游戏分数', () => {
  it('只保留更高分', () => {
    const doc = createEmptyDoc()
    setMiniScore(doc, '2048', 512)
    expect(bestScore(doc, '2048')).toBe(512)

    setMiniScore(doc, '2048', 256)
    expect(bestScore(doc, '2048')).toBe(512)

    setMiniScore(doc, '2048', 1024)
    expect(bestScore(doc, '2048')).toBe(1024)
    expect(doc.miniScores).toHaveLength(1)
  })

  it('两个游戏各记各的，没玩过是 0', () => {
    const doc = createEmptyDoc()
    expect(bestScore(doc, 'memory')).toBe(0)
    setMiniScore(doc, 'memory', 800)
    expect(bestScore(doc, 'memory')).toBe(800)
    expect(bestScore(doc, '2048')).toBe(0)
  })
})

describe('2048 玩法', () => {
  it('相同数字合并，一次移动每格只合一次', () => {
    const board: Board = [
      [2, 2, 2, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    const result = moveBoard(board, 'left')
    expect(result.board[0]).toEqual([4, 4, 0, 0])
    expect(result.gained).toBe(8)
    expect(result.moved).toBe(true)
  })

  it('没有可合并和位移时 moved 为 false', () => {
    const board: Board = [
      [2, 4, 8, 16],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    expect(moveBoard(board, 'left').moved).toBe(false)
  })

  it('四个方向都能正确移动', () => {
    const board: Board = [
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [4, 0, 0, 0],
      [4, 0, 0, 0],
    ]

    expect(moveBoard(board, 'up').board.map((r) => r[0])).toEqual([4, 8, 0, 0])
    expect(moveBoard(board, 'down').board.map((r) => r[0])).toEqual([0, 0, 4, 8])

    const row: Board = [
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    expect(moveBoard(row, 'right').board[0]).toEqual([0, 0, 0, 4])
  })

  it('每次移动后只多一个 2 或 4', () => {
    const base = emptyBoard()
    const seq = [0, 0]
    const next = addRandomTile(base, () => seq.shift() ?? 0)

    const flat = next.flat().filter((v) => v > 0)
    expect(flat).toHaveLength(1)
    expect([2, 4]).toContain(flat[0])
  })

  it('棋盘满了不再加新格子', () => {
    const full: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]
    expect(addRandomTile(full, () => 0)).toEqual(full)
  })

  it('空格或有相邻相同才还能动', () => {
    const full: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]
    expect(canMove(full)).toBe(false)

    expect(canMove(emptyBoard())).toBe(true)

    const mergeable: Board = [
      [2, 2, 4, 8],
      [4, 8, 16, 32],
      [8, 16, 32, 64],
      [16, 32, 64, 128],
    ]
    expect(canMove(mergeable)).toBe(true)
  })

  it('开局两个格子，最大方块至少是 2', () => {
    const board = newGame(() => 0.5)
    expect(board.flat().filter((v) => v > 0)).toHaveLength(2)
    expect(maxTile(board)).toBeGreaterThanOrEqual(2)
  })
})

describe('记忆翻牌玩法', () => {
  it('8 对共 16 张，符号两两成对', () => {
    const deck = memoryDeck(8)
    expect(deck).toHaveLength(16)
    expect(new Set(deck.map((c) => c.id)).size).toBe(16)

    const counts = new Map<string, number>()
    for (const card of deck) counts.set(card.value, (counts.get(card.value) || 0) + 1)
    expect([...counts.values()].every((n) => n === 2)).toBe(true)
  })

  it('步数越少得分越高，最低 0', () => {
    expect(memoryScore(8)).toBeGreaterThan(memoryScore(16))
    expect(memoryScore(200)).toBe(0)
  })
})

/* ---------- 页面 ---------- */

function mountPlay(doc: DeskDoc) {
  db.doc = doc
  db.ready = true
  wrapper = mount(Play, { attachTo: document.body })
  return wrapper!
}

describe('游戏娱乐页面', () => {
  it('页面显示本周娱乐时长', async () => {
    const doc = createEmptyDoc()
    addLeisure(doc, TODAY, 45)
    const w = mountPlay(doc)
    await flushPromises()

    expect(w.find('[data-testid="page-play"]').exists()).toBe(true)
    expect(w.find('[data-testid="play-week-minutes"]').text()).toContain('45 分钟')
  })

  it('加一个游戏后出现在清单里', async () => {
    const w = mountPlay(createEmptyDoc())
    await flushPromises()

    await w.find('[data-testid="play-game-input"]').setValue('艾尔登法环')
    await w.find('[data-testid="play-game-add"]').trigger('click')
    await flushPromises()

    expect(db.doc.games).toHaveLength(1)
    expect(db.doc.games[0].title).toBe('艾尔登法环')
    const rows = w.findAll('[data-testid^="play-game-row-"]')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('艾尔登法环')
  })

  it('下拉改状态会落到数据里', async () => {
    const doc = createEmptyDoc()
    const game = addGame(doc, '只狼')!
    const w = mountPlay(doc)
    await flushPromises()

    await w.find(`[data-testid="play-game-status-${game.id}"]`).setValue('done')
    await flushPromises()

    expect(db.doc.games[0].status).toBe('done')
    expect(db.doc.games[0].progress).toBe(100)
  })

  it('点星星打分，再点一次取消', async () => {
    const doc = createEmptyDoc()
    const game = addGame(doc, '血源诅咒')!
    const w = mountPlay(doc)
    await flushPromises()

    await w.find(`[data-testid="play-game-rating-${game.id}-4"]`).trigger('click')
    await flushPromises()
    expect(db.doc.games[0].rating).toBe(4)

    await w.find(`[data-testid="play-game-rating-${game.id}-4"]`).trigger('click')
    await flushPromises()
    expect(db.doc.games[0].rating).toBe(0)
  })

  it('加一部剧并记总集数，进度条按比例显示', async () => {
    const w = mountPlay(createEmptyDoc())
    await flushPromises()

    await w.find('[data-testid="play-show-input"]').setValue('三体')
    await w.find('[data-testid="play-show-add"]').trigger('click')
    await flushPromises()

    expect(db.doc.shows).toHaveLength(1)
    const id = db.doc.shows[0].id

    const total = w.find(`[data-testid="play-show-total-${id}"]`)
    ;(total.element as HTMLInputElement).value = '10'
    await total.trigger('change')

    const episode = w.find(`[data-testid="play-show-episode-${id}"]`)
    ;(episode.element as HTMLInputElement).value = '5'
    await episode.trigger('change')
    await flushPromises()

    expect(db.doc.shows[0].episode).toBe(5)
    expect(db.doc.shows[0].status).toBe('watching')
    expect(w.find(`[data-testid="play-show-bar-${id}"]`).attributes('style')).toContain('width: 50%')
  })

  it('手填 45 分钟后本周累计增加 45 分钟', async () => {
    const w = mountPlay(createEmptyDoc())
    await flushPromises()

    await w.find('[data-testid="play-manual-minutes"]').setValue('45')
    await w.find('[data-testid="play-manual-add"]').trigger('click')
    await flushPromises()

    expect(db.doc.leisureLogs).toHaveLength(1)
    expect(db.doc.leisureLogs[0].minutes).toBe(45)
    expect(db.doc.leisureLogs[0].kind).toBe('game')
    expect(w.find('[data-testid="play-week-minutes"]').text()).toContain('45 分钟')
  })

  it('计时器开始后按钮变结束，结束落一条记录', async () => {
    const w = mountPlay(createEmptyDoc())
    await flushPromises()

    await w.find('[data-testid="play-timer-toggle"]').trigger('click')
    expect(w.find('[data-testid="play-timer-toggle"]').text()).toContain('结束')

    await w.find('[data-testid="play-timer-toggle"]').trigger('click')
    await flushPromises()

    expect(db.doc.leisureLogs).toHaveLength(1)
    expect(db.doc.leisureLogs[0].minutes).toBeGreaterThanOrEqual(1)
    expect(w.find('[data-testid="play-timer-toggle"]').text()).toContain('开始')
  })

  it('打开 2048 遮罩后可以 Esc 退出', async () => {
    const w = mountPlay(createEmptyDoc())
    await flushPromises()

    await w.find('[data-testid="play-open-2048"]').trigger('click')
    await nextTick()

    expect(w.find('[data-testid="play-game-overlay"]').exists()).toBe(true)
    expect(w.findComponent(Game2048).exists()).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(w.find('[data-testid="play-game-overlay"]').exists()).toBe(false)
    expect(w.findComponent(Game2048).exists()).toBe(false)
  })

  it('2048 结束自动记最高分', async () => {
    const w = mountPlay(createEmptyDoc())
    await flushPromises()

    await w.find('[data-testid="play-open-2048"]').trigger('click')
    await nextTick()

    w.findComponent(Game2048).vm.$emit('finish', 768)
    await flushPromises()

    expect(db.doc.miniScores).toHaveLength(1)
    expect(bestScore(db.doc, '2048')).toBe(768)
    expect(w.find('[data-testid="play-best-2048"]').text()).toContain('768')
  })

  it('记忆翻牌也能打开并保存分数', async () => {
    const w = mountPlay(createEmptyDoc())
    await flushPromises()

    await w.find('[data-testid="play-open-memory"]').trigger('click')
    await nextTick()
    expect(w.findComponent(MemoryFlip).exists()).toBe(true)

    w.findComponent(MemoryFlip).vm.$emit('finish', 640)
    await flushPromises()

    expect(bestScore(db.doc, 'memory')).toBe(640)
    expect(w.find('[data-testid="play-best-memory"]').text()).toContain('640')
  })
})

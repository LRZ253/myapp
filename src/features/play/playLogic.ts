import type { DeskDoc, Game, LeisureLog, MiniScore, Show } from '@/types'
import { addDays, weekStartKey } from '@/lib/date'

export function addGame(doc: DeskDoc, title: string, platform = ''): Game | null {
  const text = title.trim()
  if (!text) return null
  const game: Game = {
    id: `game_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    title: text,
    platform,
    status: 'wish',
    rating: 0,
    progress: 0,
    note: '',
  }
  doc.games.push(game)
  return game
}

export const GAME_STATUS_ORDER = ['playing', 'wish', 'done', 'dropped'] as const

export function gamesOf(doc: DeskDoc, status?: Game['status']): Game[] {
  return doc.games.filter((g) => (status ? g.status === status : true))
}

export function addShow(doc: DeskDoc, title: string, type: Show['type'] = 'series', totalEpisodes = 0): Show | null {
  const text = title.trim()
  if (!text) return null
  const show: Show = {
    id: `show_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    title: text,
    type,
    status: 'wish',
    episode: 0,
    totalEpisodes,
    note: '',
  }
  doc.shows.push(show)
  return show
}

export function updateShowProgress(doc: DeskDoc, id: string, episode: number): void {
  const show = doc.shows.find((s) => s.id === id)
  if (!show) return
  show.episode = Math.max(0, Math.min(show.totalEpisodes || 9999, Math.round(episode)))
  if (show.totalEpisodes && show.episode >= show.totalEpisodes) show.status = 'done'
  else if (show.episode > 0) show.status = 'watching'
}

export function setShowTotal(doc: DeskDoc, id: string, totalEpisodes: number): void {
  const show = doc.shows.find((s) => s.id === id)
  if (!show) return
  show.totalEpisodes = Math.max(0, Math.round(totalEpisodes))
  if (show.totalEpisodes && show.episode > show.totalEpisodes) show.episode = show.totalEpisodes
  if (show.totalEpisodes && show.episode >= show.totalEpisodes) show.status = 'done'
}

export function setShowStatus(doc: DeskDoc, id: string, status: Show['status']): void {
  const show = doc.shows.find((s) => s.id === id)
  if (!show) return
  show.status = status
  if (status === 'done' && show.totalEpisodes) show.episode = show.totalEpisodes
  if (status === 'wish') show.episode = 0
}

export function removeShow(doc: DeskDoc, id: string): void {
  doc.shows = doc.shows.filter((s) => s.id !== id)
}

/** 追剧进度百分比，未设总集数时为 0 */
export function showPercent(show: Show): number {
  if (!show.totalEpisodes) return 0
  return Math.max(0, Math.min(100, Math.round((show.episode / show.totalEpisodes) * 100)))
}

export function setGameStatus(doc: DeskDoc, id: string, status: Game['status']): void {
  const game = doc.games.find((g) => g.id === id)
  if (!game) return
  game.status = status
  if (status === 'done') game.progress = 100
}

export function setGameProgress(doc: DeskDoc, id: string, progress: number): void {
  const game = doc.games.find((g) => g.id === id)
  if (!game) return
  game.progress = Math.max(0, Math.min(100, Math.round(progress)))
  if (game.progress === 100 && game.status !== 'done') game.status = 'done'
}

export function setGameRating(doc: DeskDoc, id: string, rating: number): void {
  const game = doc.games.find((g) => g.id === id)
  if (!game) return
  game.rating = Math.max(0, Math.min(5, Math.round(rating)))
}

export function removeGame(doc: DeskDoc, id: string): void {
  doc.games = doc.games.filter((g) => g.id !== id)
}

export const LEISURE_KINDS: { key: LeisureLog['kind']; label: string }[] = [
  { key: 'game', label: '玩游戏' },
  { key: 'show', label: '看剧' },
  { key: 'other', label: '其他' },
]

/** 分钟数转「X.X 小时」展示，不足 1 小时显示分钟 */
export function formatMinutes(minutes: number): string {
  if (!minutes) return '0 分钟'
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.round((minutes / 60) * 10) / 10
  return `${hours} 小时`
}

/** 本周每天（周一起）的娱乐分钟数，用于迷你柱状图 */
export function weekMinutesByDay(doc: DeskDoc, date: string): { date: string; minutes: number }[] {
  const start = weekStartKey(date, 1)
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i)
    const minutes = doc.leisureLogs.filter((l) => l.date === day).reduce((sum, l) => sum + l.minutes, 0)
    return { date: day, minutes }
  })
}

export function addLeisure(doc: DeskDoc, date: string, minutes: number, kind: LeisureLog['kind'] = 'game', note = ''): LeisureLog | null {
  if (!minutes || minutes <= 0) return null
  const log: LeisureLog = {
    id: `leisure_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    date,
    kind,
    minutes: Math.round(minutes),
    note,
  }
  doc.leisureLogs.push(log)
  return log
}

export function weekMinutes(doc: DeskDoc, date: string): number {
  const start = weekStartKey(date, 1)
  const end = addDays(start, 6)
  return doc.leisureLogs.filter((l) => l.date >= start && l.date <= end).reduce((sum, l) => sum + l.minutes, 0)
}

export function todayMinutes(doc: DeskDoc, date: string): number {
  return doc.leisureLogs.filter((l) => l.date === date).reduce((sum, l) => sum + l.minutes, 0)
}

export function setMiniScore(doc: DeskDoc, key: MiniScore['key'], score: number): MiniScore {
  let record = doc.miniScores.find((s) => s.key === key)
  if (!record) {
    record = { key, best: 0, updatedAt: new Date().toISOString() }
    doc.miniScores.push(record)
  }
  if (score > record.best) record.best = score
  record.updatedAt = new Date().toISOString()
  return record
}

export function bestScore(doc: DeskDoc, key: MiniScore['key']): number {
  return doc.miniScores.find((s) => s.key === key)?.best || 0
}

/* ---------- 2048 ---------- */

export type Board = number[][]

export function emptyBoard(): Board {
  return Array.from({ length: 4 }, () => [0, 0, 0, 0])
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice())
}

function slideLine(line: number[]): { line: number[]; gained: number } {
  const filtered = line.filter((v) => v > 0)
  const out: number[] = []
  let gained = 0
  for (let i = 0; i < filtered.length; i++) {
    if (filtered[i] === filtered[i + 1]) {
      const merged = filtered[i] * 2
      out.push(merged)
      gained += merged
      i += 1
    } else {
      out.push(filtered[i])
    }
  }
  while (out.length < 4) out.push(0)
  return { line: out, gained }
}

function transpose(board: Board): Board {
  return board[0].map((_, c) => board.map((row) => row[c]))
}

export type Direction = 'left' | 'right' | 'up' | 'down'

export function moveBoard(board: Board, direction: Direction): { board: Board; gained: number; moved: boolean } {
  let work = cloneBoard(board)
  if (direction === 'right') work = work.map((row) => row.slice().reverse())
  if (direction === 'up') work = transpose(work)
  if (direction === 'down') work = transpose(work).map((row) => row.slice().reverse())

  let gained = 0
  work = work.map((row) => {
    const result = slideLine(row)
    gained += result.gained
    return result.line
  })

  if (direction === 'right') work = work.map((row) => row.slice().reverse())
  if (direction === 'up') work = transpose(work)
  if (direction === 'down') work = transpose(work.map((row) => row.slice().reverse()))

  const moved = JSON.stringify(work) !== JSON.stringify(board)
  return { board: work, gained, moved }
}

export function addRandomTile(board: Board, rng: () => number = Math.random): Board {
  const empties: [number, number][] = []
  board.forEach((row, r) => row.forEach((v, c) => { if (!v) empties.push([r, c]) }))
  if (!empties.length) return board
  const [r, c] = empties[Math.floor(rng() * empties.length)]
  const next = cloneBoard(board)
  next[r][c] = rng() < 0.9 ? 2 : 4
  return next
}

export function canMove(board: Board): boolean {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (!board[r][c]) return true
      if (c < 3 && board[r][c] === board[r][c + 1]) return true
      if (r < 3 && board[r][c] === board[r + 1][c]) return true
    }
  }
  return false
}

export function maxTile(board: Board): number {
  return board.reduce((max, row) => Math.max(max, ...row), 0)
}

export function newGame(rng: () => number = Math.random): Board {
  return addRandomTile(addRandomTile(emptyBoard(), rng), rng)
}

/* ---------- 记忆翻牌 ---------- */

const MEMORY_SYMBOLS = ['★', '●', '▲', '■', '◆', '✚', '☾', '❖']

export interface MemoryCard {
  id: string
  value: string
}

export function memoryDeck(pairs = 8, rng: () => number = Math.random): MemoryCard[] {
  const chosen = MEMORY_SYMBOLS.slice(0, pairs)
  const cards: MemoryCard[] = []
  for (const value of chosen) {
    cards.push({ id: `${value}-a`, value }, { id: `${value}-b`, value })
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

/** 翻牌得分：步数越少分越高，最低 0 */
export function memoryScore(moves: number): number {
  return Math.max(0, 1000 - moves * 20)
}

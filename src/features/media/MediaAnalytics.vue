<script setup lang="ts">
import { computed } from 'vue'
import { db } from '@/store/db'
import { formatCount } from './mediaLogic'
import {
  areaPath,
  contentRows,
  dailySeries,
  formatRate,
  linePath,
  platformRows,
  pointCoords,
  totals,
} from './mediaAnalytics'

const series = computed(() => dailySeries(db.doc))
const total = computed(() => totals(db.doc))
const contents = computed(() => contentRows(db.doc))
const platforms = computed(() => platformRows(db.doc))

const W = 720
const H = 240
/** 右侧留 54px 放 Y 轴数字，底部留 26px 放日期，避免和数据点重叠 */
const PAD = { top: 14, right: 54, bottom: 26, left: 8 }

const viewValues = computed(() => series.value.map((p) => p.views))
const likeValues = computed(() => series.value.map((p) => p.likes))

const viewsLine = computed(() => linePath(viewValues.value, W, H, PAD))
const viewsArea = computed(() => areaPath(viewValues.value, W, H, PAD))
const likesLine = computed(() => linePath(likeValues.value, W, H, PAD))
const points = computed(() => pointCoords(viewValues.value, W, H, PAD))

const plot = { x1: PAD.left, x2: W - PAD.right, y1: PAD.top, y2: H - PAD.bottom }

const maxViews = computed(() => Math.max(...viewValues.value, 1))
const gridLines = computed(() =>
  [0, 1, 2, 3].map((i) => {
    const y = PAD.top + ((H - PAD.top - PAD.bottom) / 3) * i
    return { y, label: formatCount(Math.round(maxViews.value * (1 - i / 3))) }
  }),
)

const xLabels = computed(() => {
  const list = series.value
  if (!list.length) return []
  const step = Math.max(1, Math.ceil(list.length / 5))
  const xs = points.value.map((p) => p.x)
  const out: { x: number; text: string; anchor: string }[] = []
  for (let i = 0; i < list.length; i += step) {
    // 首个标签贴左边界、末个贴右边界，避免被画布裁掉
    const anchor = i === 0 ? 'start' : i === list.length - 1 ? 'end' : 'middle'
    out.push({ x: xs[i], text: list[i].date.slice(5), anchor })
  }
  const lastX = xs[xs.length - 1]
  if (!out.length || lastX - out[out.length - 1].x > 40) {
    out.push({ x: lastX, text: list[list.length - 1].date.slice(5), anchor: 'end' })
  }
  return out
})

const maxContentViews = computed(() => Math.max(...contents.value.map((c) => c.views), 1))
const maxPlatformViews = computed(() => Math.max(...platforms.value.map((p) => p.views), 1))

function barWidth(value: number, max: number) {
  return `${Math.max(2, (value / max) * 100)}%`
}
</script>

<template>
  <div class="analytics" data-testid="media-analytics">
    <div class="stat-grid">
      <div class="stat">
        <div class="stat-label">总播放</div>
        <div class="stat-value">{{ formatCount(total.views) }}</div>
        <div class="stat-delta">{{ total.count }} 条已发布</div>
      </div>
      <div class="stat">
        <div class="stat-label">总点赞</div>
        <div class="stat-value">{{ formatCount(total.likes) }}</div>
        <div class="stat-delta">赞播比 {{ formatRate(total.engagement) }}</div>
      </div>
      <div class="stat">
        <div class="stat-label">累计涨粉</div>
        <div class="stat-value">{{ formatCount(total.follows) }}</div>
        <div class="stat-delta">来自全部已发布内容</div>
      </div>
      <div class="stat">
        <div class="stat-label">记录天数</div>
        <div class="stat-value">{{ series.length }}</div>
        <div class="stat-delta">每次记录留一个点</div>
      </div>
    </div>

    <div class="card chart-card">
      <header class="chart-head">
        <div>
          <div class="section-title">播放趋势</div>
          <div class="section-sub">按记录日期汇总全部内容的播放量</div>
        </div>
        <div class="legend">
          <span class="legend-item"><i class="swatch views" />播放</span>
          <span class="legend-item"><i class="swatch likes" />点赞</span>
        </div>
      </header>

      <svg v-if="series.length" viewBox="0 0 720 240" class="trend" role="img" aria-label="播放与点赞趋势">
        <defs>
          <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.28" />
            <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.02" />
          </linearGradient>
        </defs>

        <g class="grid">
          <line
            v-for="line in gridLines"
            :key="line.y"
            :x1="plot.x1"
            :y1="line.y"
            :x2="plot.x2"
            :y2="line.y"
          />
        </g>

        <path :d="viewsArea" fill="url(#viewsFill)" />
        <path :d="viewsLine" class="line views" />
        <path :d="likesLine" class="line likes" />

        <circle v-for="(p, i) in points" :key="i" :cx="p.x" :cy="p.y" r="3" class="dot">
          <title>{{ series[i].date }}：播放 {{ formatCount(series[i].views) }} · 点赞 {{ formatCount(series[i].likes) }}</title>
        </circle>

        <text
          v-for="line in gridLines"
          :key="`t-${line.y}`"
          :x="W - 6"
          :y="line.y"
          class="axis"
          text-anchor="end"
          dominant-baseline="middle"
        >
          {{ line.label }}
        </text>
        <text
          v-for="label in xLabels"
          :key="`x-${label.x}`"
          :x="label.x"
          :y="H - 6"
          class="axis"
          :text-anchor="label.anchor"
        >
          {{ label.text }}
        </text>
      </svg>

      <div v-else class="chart-empty">
        <p class="hint">还没有数据点。到「已发布」的内容详情里填一次播放和点赞，这里就会开始画线。</p>
      </div>
    </div>

    <div class="split">
      <div class="card list-card">
        <header class="chart-head">
          <div>
            <div class="section-title">单条表现</div>
            <div class="section-sub">按播放量排序</div>
          </div>
        </header>
        <div v-for="row in contents.slice(0, 6)" :key="row.id" class="bar-row">
          <div class="bar-label">
            <span class="ellipsis">{{ row.title }}</span>
            <span class="num hint">{{ formatCount(row.views) }}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" :style="{ width: barWidth(row.views, maxContentViews) }" />
          </div>
          <div class="bar-meta">
            <span>{{ row.date || '未记日期' }}</span>
            <span>{{ row.platforms.join(' · ') || '未选平台' }}</span>
            <span>赞播比 {{ formatRate(row.engagement) }}</span>
          </div>
        </div>
        <p v-if="!contents.length" class="hint">还没有已发布的内容。</p>
      </div>

      <div class="card list-card">
        <header class="chart-head">
          <div>
            <div class="section-title">平台对比</div>
            <div class="section-sub">同一内容挂多个平台时各记一次</div>
          </div>
        </header>
        <div v-for="row in platforms" :key="row.platform" class="bar-row">
          <div class="bar-label">
            <span class="ellipsis">{{ row.platform }}</span>
            <span class="num hint">{{ formatCount(row.views) }}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill alt" :style="{ width: barWidth(row.views, maxPlatformViews) }" />
          </div>
          <div class="bar-meta">
            <span>{{ row.count }} 条</span>
            <span>均播 {{ formatCount(Math.round(row.views / row.count)) }}</span>
            <span>赞播比 {{ formatRate(row.engagement) }}</span>
          </div>
        </div>
        <p v-if="!platforms.length" class="hint">已发布内容还没有标注平台。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analytics {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.chart-card {
  padding: 18px 18px 10px;
}

.chart-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.legend {
  display: flex;
  gap: 14px;
  padding-top: 3px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-xs);
  color: var(--text-3);
}

.swatch {
  width: 14px;
  height: 3px;
  border-radius: 2px;
}

.swatch.views {
  background: var(--accent);
}

.swatch.likes {
  background: var(--warn);
}

.trend {
  width: 100%;
  height: auto;
  display: block;
}

.grid line {
  stroke: var(--border);
  stroke-width: 1;
  stroke-dasharray: 3 4;
}

.line {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.line.views {
  stroke: var(--accent);
}

.line.likes {
  stroke: var(--warn);
  stroke-width: 1.6;
  opacity: 0.9;
}

.dot {
  fill: var(--surface);
  stroke: var(--accent);
  stroke-width: 2;
}

.axis {
  fill: var(--text-3);
  font-size: 10px;
  font-family: var(--font);
}

.chart-empty {
  padding: 40px 8px 48px;
  text-align: center;
}

.split {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.list-card {
  padding: 16px 18px;
}

.bar-row {
  padding: 8px 0;
  border-top: 1px solid var(--border);
}

.bar-row:first-of-type {
  border-top: 0;
}

.bar-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: var(--fs-sm);
  margin-bottom: 5px;
}

.bar-track {
  height: 7px;
  border-radius: 4px;
  background: var(--surface-2);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--accent), #7d9df8);
}

.bar-fill.alt {
  background: linear-gradient(90deg, var(--ok), #58c9a4);
}

.bar-meta {
  display: flex;
  gap: 12px;
  margin-top: 4px;
  font-size: var(--fs-xs);
  color: var(--text-3);
}

@media (max-width: 1100px) {
  .split {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

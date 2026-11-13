# 开发计划 · 个人工作生活台 v1

> 依据：`PRD.md` v1.0（2026-11-13）
> 目标：把 PRD 的 38 条验收标准拆成 12 个可顺序执行、每步都有明确完成标准的阶段
> 状态：待执行

---

## 0. 计划怎么用

- 阶段必须按顺序做，Phase N 的完成标准不通过，不进入 Phase N+1。
- 每阶段结束跑一次质量闸门（见 4.1），并把该阶段对应的 AC 编号在 PRD 里打勾。
- 阶段内任务用复选框管理，做完一项勾一项，不靠记忆。
- 需要改 PRD 才能继续的情况：先改 PRD，再改代码，不出现「代码和文档两套事实」。

---

## 1. 技术选型

### 1.1 结论

| 层 | 选择 | 理由 |
|---|---|---|
| 框架 | Vue 3（Composition API）+ TypeScript | 九个页面、二十多个实体、大量表单与联动，组件化和响应式能显著减少手写 DOM 的错误；TS 能在编译期拦住字段写错 |
| 构建 | Vite | 开发热更新快，产物是纯静态文件，运行时不依赖任何 CDN |
| 路由 | vue-router（history 模式） | 本地服务可做 SPA 回退，地址干净 |
| 状态 | 自建轻量 store（`reactive` + 统一 `patch`） | 单用户单标签页，不需要 Pinia；核心是要强制所有写入走同一个入口，才能保证保存与回写一致 |
| 服务端 | Node 内置 `http` + `fs`，零第三方依赖 | 只做三件事：发静态文件、读写 JSON、管理备份。依赖越少，几年后越不容易坏 |
| 样式 | 原生 CSS + CSS 变量 | 不引 UI 库，避免为了统一视觉再去覆盖别人的样式 |
| 图表 | 手写 SVG | 只有一条体重折线和一个时长条形，不值得引图表库 |
| 拖拽 | 原生 HTML5 `draggable` | 看板换列、今日计划排序，两处足够 |
| 字体 | 系统字体栈 | 不联网、不加载外部字体 |

### 1.2 明确不引入

- 不引 UI 组件库（Element / Naive 等）、不引 Tailwind、不引图表库、不引日期库、不引状态库。
- 理由统一：这是要长期一个人维护的本地小工具，依赖越少，升级和排错成本越低。需要的交互都不复杂，手写可控。

### 1.3 开发期依赖（仅开发用，不进产物）

`vue`、`vue-router`、`vite`、`@vitejs/plugin-vue`、`typescript`、`vue-tsc`、`concurrently`。

安装时不锁小版本，用当前稳定版：

```bash
npm init -y
npm i vue vue-router
npm i -D vite @vitejs/plugin-vue typescript vue-tsc concurrently
```

---

## 2. 工程结构

```
APP/
├─ 启动.bat                  双击启动：检查产物 → 起服务 → 开浏览器
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ index.html
├─ PRD.md
├─ DEV_PLAN.md
├─ server/
│  ├─ index.mjs              HTTP 服务、静态资源、API 路由、SPA 回退、单实例检测
│  ├─ store.mjs              读取、原子写入、日备份、损坏保护
│  └─ backup.mjs             备份列表、恢复、按 14 份清理
├─ data/                     运行时生成，不进版本管理
│  ├─ app-data.json
│  └─ backups/
└─ src/
   ├─ main.ts
   ├─ App.vue
   ├─ router.ts
   ├─ styles/
   │  ├─ tokens.css          颜色、字号、圆角、间距变量
   │  └─ global.css          重置、排版、滚动条、焦点环
   ├─ types/
   │  └─ schema.ts           全部实体接口、枚举、默认文档、空文档工厂
   ├─ store/
   │  ├─ db.ts               载入、patch、防抖保存、保存状态、损坏态
   │  └─ ui.ts               抽屉栈、命令面板、Toast、主题
   ├─ lib/
   │  ├─ date.ts             今天、加减天、周起点、相对时间
   │  ├─ id.ts               randomUUID 封装
   │  ├─ format.ts           时长、金额、百分比、截断
   │  ├─ drag.ts             拖拽排序的通用处理
   │  └─ download.ts         前端文件下载与读取
   ├─ components/
   │  ├─ AppShell.vue        布局骨架，抽屉打开时主区让位
   │  ├─ SideNav.vue         九项导航 + 角标
   │  ├─ PageHeader.vue      页面标题 + 状态摘要 + 主操作
   │  ├─ Drawer.vue          380px 右侧抽屉，Esc、焦点回归、外部点击关闭
   │  ├─ Toast.vue           右下角淡出提示
   │  ├─ EmptyState.vue      空状态 + 填入示例
   │  ├─ InlineDelete.vue    两段式删除，不弹模态
   │  ├─ Tag.vue             模块标签、平台标签
   │  ├─ Segmented.vue       视图切换（看板/日历/列表、四个页签）
   │  └─ CommandPalette.vue  ⌘K 命令面板
   ├─ features/
   │  ├─ plan/               PlanList、PlanItemRow、AddRow、RolloverBar、joinToday.ts
   │  ├─ memo/               QuickMemo、MemoDrawer
   │  ├─ home/               SummaryCard、summary.ts
   │  ├─ media/              MediaKanban、MediaCalendar、MediaList、ContentDrawer
   │  ├─ dev/                ProjectRail、TaskTab、BugTab、TimeTab、LogTab、TimerButton
   │  ├─ consult/            ClientTab、EngagementTab、SessionTab、FollowUpTab、SessionDrawer
   │  ├─ fitness/            WeekPlanEditor、TodayWorkout、ExerciseLib、WeightChart
   │  ├─ diet/               DishLib、WeekGrid、TodayMeals、WaterCups
   │  ├─ play/               GameList、ShowList、LeisureTimer、Game2048、MemoryFlip
   │  └─ settings/           DataOverview、BackupPanel、PrefsPanel
   └─ views/                 九个一级页面，只负责组装，不写业务逻辑
```

原则：`views` 只拼装，业务在 `features`，数据只经 `store/db`，工具只在 `lib`。

---

## 3. 数据与接口契约

### 3.1 数据文档

单一 JSON 文档，`schemaVersion = 1`，顶层集合与 PRD 7.2 一致，另加一个运行时字段：

```jsonc
{
  "schemaVersion": 1,
  "exportedAt": null,
  "settings": { "theme": "light", "weekStart": 1, "platforms": [], "defaultHourlyRate": 0, "userName": "" },
  "runtime": { "timer": null },   // 计时器状态，刷新不丢
  "plans": [], "memos": [], "media": [],
  "projects": [], "tasks": [], "bugs": [], "timeLogs": [], "devLogs": [],
  "clients": [], "engagements": [], "sessions": [], "followups": [],
  "weekPlans": [], "exercises": [], "workouts": [], "bodyMetrics": [],
  "dishes": [], "mealPlans": [], "mealLogs": [], "waterLogs": [],
  "games": [], "shows": [], "leisureLogs": [], "miniScores": []
}
```

`runtime.timer` 用于跨页面、跨刷新保持计时：`{ projectId, taskId, startedAt, accumulatedMs, running }`。

### 3.2 接口

| 方法 | 路径 | 请求体 | 响应 |
|---|---|---|---|
| GET | `/api/health` | – | `{ ok, version }` |
| GET | `/api/data` | – | `{ ok, doc, savedAt }`；文件损坏时 `409 { ok:false, code:'CORRUPT', backups:[...] }` |
| PUT | `/api/data` | `{ doc }` | `{ ok, savedAt }`；只读保护态返回 `409` |
| GET | `/api/backups` | – | `{ ok, items:[{ file, size, mtime }] }` |
| POST | `/api/backups/restore` | `{ file }` | `{ ok, doc }` |
| GET | `/api/export` | – | 附件 `工作生活台-YYYY-MM-DD.json` |
| POST | `/api/import` | `{ doc }` | `{ ok, counts }`；校验失败 `400 { ok:false, errors:[...] }` |
| POST | `/api/reset` | `{ confirm: "清空" }` | `{ ok }` |
| POST | `/api/rebuild` | `{ confirm: true }` | 归档损坏文件并重建空文档 |

### 3.3 写入流程（服务端 `store.mjs`）

1. 当天首写时若 `backups/app-YYYYMMDD.json` 不存在，先复制一份当前主文件。
2. 写 `data/app-data.json.tmp`。
3. 读回并 `JSON.parse` 自检，确认可解析。
4. 把现有 `app-data.json` 复制为 `app-data.json.bak`。
5. `rename(tmp → app-data.json)`；若 Windows 下报错，退化为 `unlink` 后 `rename`，再失败则报错并保留 tmp。
6. 返回 `savedAt`。

### 3.4 损坏保护

- 启动读取失败 → 服务进入只读保护态，不写任何东西，接口返回 `CORRUPT` 与可用备份列表。
- 前端显示错误页：说明情况 + 备份列表 + 「以空白重建」。
- 用户选择恢复或重建时，才把原文件归档为 `app-data.corrupt-<时间戳>.json`，永不静默覆盖。

---

## 4. 通用实现约定

### 4.1 质量闸门（每阶段结束必跑）

```bash
npm run typecheck     # vue-tsc --noEmit，零错误
npm run build         # 构建通过
```

外加手动三条：刷新后数据一致、无 `console.error`、空状态可见。

### 4.2 写入唯一入口

所有改动走 `db.patch(fn)`，内部负责标脏、300ms 防抖、保存状态与错误提示。禁止组件里直接改对象不保存，禁止绕过 `patch` 调 `fetch`。

### 4.3 回写映射集中管理

`features/plan/joinToday.ts` 一个文件定义：

| sourceType | 勾选 | 取消勾选 |
|---|---|---|
| `task` | `status = done` | `status = todo` |
| `bug` | `status = fixed` | `status = open` |
| `followup` | `status = done` | `status = open` |
| `workout` | `completed = true`，本周次数 +1 | `completed = false`，次数回退 |
| `content` / `null` | 只改 PlanItem | 只改 PlanItem |

新增来源只能改这个文件，不允许在页面里散写。

### 4.4 交互一致性

- 删除 = `<InlineDelete>` 两段式，2 秒内第二次点击生效，不用模态框。
- 新增 = 列表底部一行输入，回车提交，Esc 取消。
- 保存 = 无按钮，右下角 12px 灰字淡出 1.5 秒。
- 空状态 = `<EmptyState>` 统一文案结构 + 「填入示例」。
- 抽屉 = 全站唯一 `<Drawer>`，380px，打开时 `AppShell` 主区 `margin-right: 380px`。
- 日期 = 只用 `lib/date.ts`，禁止页面里手拼 `YYYY-MM-DD`。

---

## 5. 阶段计划

### Phase 0 · 工程与运行骨架

**目标**：一条命令能开发，双击能打开一个空白但真实运行的应用。

- [ ] 初始化 `package.json`，写 `dev / build / start / typecheck` 四个脚本
- [ ] 配 `vite.config.ts`：Vue 插件、`/api` 代理到 `127.0.0.1:4173`
- [ ] 配 `tsconfig.json`、`index.html`
- [ ] `server/index.mjs` 最小版：静态服务 + SPA 回退 + `/api/health` + 单实例检测（端口占用则直接打开已有地址并退出）
- [ ] 服务只监听 `127.0.0.1`，启动后自动 `start` 浏览器
- [ ] 写 `启动.bat`：切到脚本目录 → 检查 `dist` 是否存在 → 起服务
- [ ] `src/main.ts` + `App.vue` 挂一个占位页

**完成标准**：`npm run dev` 有热更新；`npm run build && 启动.bat` 能打开页面；重复双击不出现两个服务。
**对应**：AC-01。

---

### Phase 1 · 数据层与持久化

**目标**：能存、能读、坏了不覆盖。这是整个项目的地基，必须先于任何界面。

- [ ] `types/schema.ts`：全部实体接口、枚举、`createEmptyDoc()`、默认设置
- [ ] `server/store.mjs`：`load` / `writeAtomic` / `ensureDailyBackup` / 只读保护态
- [ ] `server/backup.mjs`：列表、恢复、保留 14 份清理
- [ ] `server/index.mjs` 接上 `/api/data` 的 GET 与 PUT
- [ ] `store/db.ts`：启动拉取、`patch`、300ms 防抖、保存状态、`CORRUPT` 分支
- [ ] 临时调试按钮：写入一条测试备忘，验证落盘
- [ ] 手动演练：改坏 `app-data.json` → 确认拒绝写入并给出备份列表

**完成标准**：写一条 → 刷新在 → 关服务重开在 → 改坏文件时页面显示恢复入口且原文件未被覆盖。
**对应**：AC-02、AC-03、AC-04、AC-05、AC-35。

---

### Phase 2 · 应用外壳（这一版就是可点原型）

**目标**：九个页面能走通、抽屉能开合、主题能切换。做完这一阶段请你实际点一遍，再定后面的视觉细节。

- [ ] `AppShell` 两栏布局，侧栏固定 180px
- [ ] `SideNav`：九项 + 三处角标（先接 0，Phase 4 接真数据）
- [ ] `router.ts`：九条路由 + 未匹配回首页
- [ ] `PageHeader`：标题、状态摘要、主操作插槽
- [ ] `Drawer`：380px、`Esc`、外部点击、焦点回归、主区让位、过渡动画
- [ ] `ui.ts`：抽屉栈、Toast、主题读写
- [ ] `CommandPalette`：⌘K 打开，可列模块与跳转（搜索与新建在 Phase 11 补全）
- [ ] 深浅色切换 + `html[data-theme]` 持久化
- [ ] 九个 view 放占位内容，确认路由与布局不错位

**完成标准**：九个导航项都能打开、当前项高亮；抽屉开合正常、Esc 可关；深色切换刷新后保持。
**对应**：AC-06、AC-08、AC-10、AC-37。

---

### Phase 3 · 今日计划

**目标**：全站「今天」的唯一出口先立起来，后面所有模块都要往里接。

- [ ] `PlanList`：按 am/pm/eve 三段渲染，空段不显示
- [ ] `PlanItemRow`：勾选、标题行内编辑、来源标签、预估时长
- [ ] `AddRow`：底部一行输入，回车即建，默认落当前段
- [ ] 勾选联动：完成态、删除线、3 秒后下沉、进度与预估总时长重算
- [ ] 拖拽排序（同段内）+ 跨段拖动改 `section`
- [ ] 优先级切换、预估时长编辑
- [ ] 日期条：前一天 / 后一天 / 回今天；`/today?date=` 支持任意日期
- [ ] 「移到其他日期」：今天 / 明天 / 选日期
- [ ] `RolloverBar`：昨日未完成提示，全部移入 / 逐条 / 忽略
- [ ] `InlineDelete` 删除
- [ ] 空状态 + 示例数据

**完成标准**：建、改、勾、拖、移、删六件事刷新后全部保持；顺延提示三种选择行为正确。
**对应**：AC-12、AC-14、AC-15、AC-16、AC-17。

---

### Phase 4 · 首页

**目标**：把首页从占位变成真正的落点，并接上角标。

- [ ] 首页今日计划区：复用 `PlanItem` 行组件，最多 12 条内滚
- [ ] 快速备忘：一行输入、最近 3 条、相对时间
- [ ] `MemoDrawer`：编辑全文、删除、转为今日任务
- [ ] ⌘J 全局唤起快速备忘
- [ ] `summary.ts`：六个聚合函数（待发布数、在跑项目、未解 Bug、下次会谈、本周训练、今日三餐、本周娱乐）
- [ ] `SummaryCard` ×6，顺序与字段按 PRD 3.4
- [ ] 六张卡点击跳转（自媒体定位到待发布列、咨询定位到跟进页签）
- [ ] 三处角标接真实数据

**完成标准**：首页数字与各模块实际数据一致；勾选今日任务后进度即时变化；⌘J 在任何页面都能存备忘。
**对应**：AC-07、AC-09、AC-11、AC-13。

---

### Phase 5 · 开发工作

**目标**：把「项目 → 任务 / Bug / 工时 / 日志」这条线跑通，并成为第一个接入回写型「加入今天」的模块。

- [ ] `ProjectRail`：按状态分组，运行中在前，可增改归档
- [ ] 详情四个页签骨架（`Segmented`）
- [ ] `TaskTab`：增删改、三态流转、优先级、截止日、拖拽改状态
- [ ] `BugTab`：增删改、严重程度、未解优先排序、标记已解
- [ ] `TimerButton` + `TimeTab`：开始 / 暂停 / 结束，落 TimeLog，累计到项目；状态存 `runtime.timer`
- [ ] `TimeTab` 支持手动补录时长
- [ ] `LogTab`：一天一条，可追加，按日期倒序
- [ ] 项目头部汇总：累计工时、未完成任务、未解 Bug
- [ ] 「加入今天」接入（`task` / `bug` 回写）
- [ ] 重复加入拦截、来源删除降级显示

**完成标准**：五类实体增改正常；计时刷新页面不丢；勾选今日计划能回写任务与 Bug 状态。
**对应**：AC-20、AC-21、AC-30、AC-31、AC-32。

---

### Phase 6 · 自媒体

**目标**：内容流水线的四种视图形态，以及提醒型「加入今天」。

- [ ] `MediaKanban`：四列 + 卡片，拖拽换列改 `stage`
- [ ] `ContentDrawer`：标题、平台多选、正文、定时、阶段
- [ ] 阶段改 `published` 时自动写 `publishedAt`
- [ ] 数据回填：播放 / 点赞 / 涨粉 + `recordedAt`
- [ ] `MediaCalendar`：月历按 `publishAt` 布点，点开进抽屉
- [ ] `MediaList`：表格，按平台 / 阶段 / 时间筛选排序
- [ ] 复盘条：按平台算平均播放与点赞
- [ ] 「加入今天」（提醒型，不改阶段）
- [ ] 平台列表读设置，可临时新增

**完成标准**：拖拽结果刷新后保持；改为已发布并回填后，列表与首页摘要同步。
**对应**：AC-18、AC-19、AC-33。

---

### Phase 7 · 健身计划 + 饮食计划

**目标**：两块「计划 → 执行 → 记录」的日常高频模块。

健身：
- [ ] `WeekPlanEditor`：七天，训练 / 休息，训练日选部位并挂动作
- [ ] `ExerciseLib`：动作增改、归部位
- [ ] `TodayWorkout`：按当天计划生成动作清单，逐组打勾、改次数与重量，改动即存
- [ ] 完成整次训练 → `completed = true`，本周次数 +1；取消则回退
- [ ] 补记某天训练
- [ ] `WeightChart`：手写 SVG 折线，近 30 条
- [ ] 「加入今天」（`workout` 回写）

饮食：
- [ ] `DishLib`：菜品增改、热量、归餐次
- [ ] `WeekGrid`：7 列 × 4 行，点格子从菜品库多选
- [ ] `TodayMeals`：今日四餐，「照这个吃」生成 MealLog，可单条补记
- [ ] 每餐标记在家 / 外卖
- [ ] `WaterCups`：8 格加减
- [ ] 本周统计：在家 / 外卖次数、日均喝水

**完成标准**：训练逐组状态刷新不丢；整次完成才计数；周表格点选与今日打卡联动。
**对应**：AC-24、AC-25、AC-26、AC-27。

---

### Phase 8 · 咨询工作

**目标**：客户到交付的完整链路，重点在会谈与跟进之间的转化。

- [ ] `ClientTab`：增改、状态、备注
- [ ] `EngagementTab`：挂客户、阶段、金额、已收、周期
- [ ] `SessionTab`：会谈时间线，记日期 / 时长 / 议题 / 结论 / 下次跟进
- [ ] 会谈记录「生成跟进」→ 建 FollowUp，默认截止日取下次跟进日期
- [ ] `FollowUpTab`：勾完成、改截止日、逾期标红排最前
- [ ] 「加入今天」（`followup` 回写）
- [ ] 客户详情汇总：进行中项目、会谈次数与时长、待跟进数
- [ ] 金额视图：按月汇总应收 / 已收

**完成标准**：会谈一键生成跟进；逾期条目置顶标红；勾选今日计划能回写跟进状态。
**对应**：AC-22、AC-23。

---

### Phase 9 · 游戏娱乐

**目标**：清单管理 + 时长记录 + 两个能真玩的小游戏。

- [ ] `GameList`：三组（想玩 / 在玩 / 已通关），状态、进度、评分
- [ ] `ShowList`：追剧追番，看到第几集 / 共几集，进度条
- [ ] `LeisureTimer`：开始 / 结束记一条 LeisureLog；支持手填
- [ ] 本周娱乐时长累计 + 周目标对比
- [ ] `Game2048`：4×4，键盘方向键 + 滑动手势，合成即得分，结束判定
- [ ] `MemoryFlip`：4×4 翻牌配对，计时与步数
- [ ] 全屏遮罩打开，Esc 退出，最高分写入 `miniScores`

**完成标准**：两局游戏都能玩完整局并保存最高分；时长记录跨周正确归零。
**对应**：AC-28、AC-29。

---

### Phase 10 · 数据与设置

**目标**：让这份数据能被搬走、被找回、被清空。

- [ ] `DataOverview`：各模块条目数 + 文件大小 + 最后保存时间
- [ ] 导出：调 `/api/export` 下载完整 JSON
- [ ] 导入：选文件 → 校验 schemaVersion 与结构 → 预览「将覆盖 N 条」→ 确认（服务端先备份）
- [ ] `BackupPanel`：备份列表（时间、大小）、恢复、恢复前自动备份
- [ ] 清空：输入「清空」二字才可执行，先自动备份
- [ ] `PrefsPanel`：主题、每周起始日、平台列表、默认时薪、称呼
- [ ] 损坏态页面：错误说明 + 备份列表 + 以空白重建

**完成标准**：导出→清空→导入能完整还原；清空前必有备份；改坏文件能从这里救回来。
**对应**：AC-34、AC-36、AC-38。

---

### Phase 11 · 打磨与一致性

**目标**：把散在各处的细节收成一套体验。

- [ ] 九个页面空状态全覆盖，示例数据可一键清除
- [ ] 命令面板补全：搜索条目、新建入口
- [ ] 键盘可达：所有可点元素有焦点环，Tab 顺序合理
- [ ] 长文本截断、长列表滚动、超宽内容不撑破布局
- [ ] 保存状态提示统一（右下角淡出）
- [ ] 深色模式逐页检查对比度
- [ ] 统一标签、分段控件、按钮的尺寸与间距
- [ ] 全站扫一遍 `console` 与未捕获异常

**完成标准**：逐页走查无视觉错位；深色下无不可读文字。
**对应**：AC-38、AC-10。

---

### Phase 12 · 全量验收与交付

**目标**：按 PRD 第十章逐条跑一遍，形成验收记录。

- [ ] 按 AC-01 ~ AC-38 顺序执行，记录通过 / 不通过
- [ ] 不通过项修完后重跑该条
- [ ] 数据安全三演练：断电式杀进程、手动改坏文件、备份恢复
- [ ] 真实数据试运行一周后再决定是否补功能
- [ ] `README.md`：怎么启动、数据文件在哪、怎么备份

**完成标准**：38 条全部通过，验收记录留档。

---

## 6. 里程碑与顺序

```
M1 能跑能存      Phase 0 ─▶ Phase 1
M2 可点原型      Phase 2            ← 在这里请你点一遍，定视觉与手感
M3 今日闭环      Phase 3 ─▶ Phase 4
M4 工作主线      Phase 5 ─▶ Phase 6 ─▶ Phase 8
M5 身体与娱乐    Phase 7 ─▶ Phase 9
M6 可交付        Phase 10 ─▶ Phase 11 ─▶ Phase 12
```

依赖关系：

- Phase 2 依赖 Phase 1（没有存储，外壳点了也白点）。
- Phase 4 依赖 Phase 3（首页的今日计划区复用同一套组件）。
- Phase 5 是「加入今天」的第一个接入点，`joinToday.ts` 在这一阶段定型，后续模块只加映射不改结构。
- Phase 10 依赖至少两个模块有真实数据（Phase 5、6 之后即可）。
- Phase 12 必须在全部阶段完成后。

**不做独立原型阶段**：Phase 2 的交付物就是可点外壳，比另做一份假原型更省事，也更能反映真实手感。

---

## 7. 风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| Windows 下 `rename` 覆盖已有文件失败 | 保存报错、数据写不进 | 失败时退化 `unlink + rename`；再失败保留 `.tmp` 并明确报错，不静默丢数据 |
| 端口被占用 | 双击启动后打不开 | 检测到占用直接打开已有地址并退出，不启动第二实例 |
| 整包 PUT 数据变大后变慢 | 保存延迟 | 单用户数据量小；超过 5MB 再考虑按集合分片，本期不做 |
| 计时器刷新丢失 | 工时记录断掉 | 计时状态存 `runtime.timer`，写进数据文件 |
| 拖拽与文本选中冲突 | 看板误选文字 | 拖拽容器 `user-select: none`，仅卡片可拖 |
| 导入非法文件覆盖好数据 | 数据被毁 | 先校验结构与版本 → 预览条数 → 服务端强制备份后才写 |
| 长时间不打开导致备份堆积 | 占空间 | 只保留 14 份，启动时清理 |
| 一个人维护，几个月后忘了结构 | 改不动 | PRD + 本计划 + 集中式 schema 与 joinToday 映射，三处即可恢复上下文 |

---

## 8. 验收怎么执行

1. 每阶段结束时，只跑该阶段对应的 AC 编号，通过后打勾。
2. 阶段之间不重复跑旧项；Phase 12 一次性全量重跑。
3. 记录格式建议直接在 PRD 第十章表格后追加一列「结果」，写「通过 / 日期 / 备注」。
4. 数据安全类（AC-34、35、36）必须真做一遍，不能靠读代码确认。

---

## 9. 交付物

| 交付物 | 说明 |
|---|---|
| 可运行的应用 | 双击 `启动.bat` 打开 |
| `data/app-data.json` | 全部数据 |
| 自动备份 | `data/backups/`，14 份滚动 |
| `PRD.md` | 需求与验收依据 |
| `DEV_PLAN.md` | 本文件，开发过程中的执行清单 |
| `README.md` | 启动、备份、迁移说明（Phase 12 产出） |
| 验收记录 | 38 条 AC 的执行结果 |

# 第一版验收记录

对应 `PRD.md` 第十章 AC-01 ~ AC-38。逐条执行后记录结果与依据，便于日后复查。

- 执行时间：2026-11-13
- 代码状态：全部 12 个阶段完成
- 自动测试：17 个文件、254 条用例全部通过（`npm run test`）
- 构建：`npm run build` 通过（`vue-tsc` 无错误，产物 217.6 KB / gzip 74.2 KB）
- 真实启动：`node server/index.mjs` 起在 `127.0.0.1:4173`，`/api/health`、`/`、`/api/data` 均正常，数据文件落在 `data/app-data.json`

## 结果总表

| 编号 | 检查内容 | 结果 | 依据 |
|---|---|---|---|
| AC-01 | 双击启动脚本，浏览器自动打开，重复启动不起第二个窗口 | 通过 | `start.bat` 调 `node server/index.mjs`，服务启动后自动开浏览器；端口占用时打印「已经在运行」并退出（`server/index.mjs`）。本机已实际启动验证 |
| AC-02 | 今日计划新建 3 条，F5 后仍在且顺序一致 | 通过 | `tests/today.spec.ts`、`tests/plan.spec.ts`；`tests/e2e-data.spec.ts` 验证写入后重新读取内容一致 |
| AC-03 | 关浏览器、关服务、重开，数据完整 | 通过 | `tests/e2e-data.spec.ts`「重启后数据仍在」：新起一个 store 读同一目录，内容完整 |
| AC-04 | 断网后全模块可用 | 通过 | 无任何外部依赖：数据走本地 `/api`，小游戏与图表均为本地逻辑；`src` 内无外部域名请求 |
| AC-05 | Network 面板无外部域名 | 通过 | 全局检索 `src` 只有相对路径 `/api/*`，构建产物不含外部 CDN |
| AC-06 | 九个导航项均可打开，当前项高亮 | 通过 | `tests/shell.spec.ts`「侧边栏渲染九个入口」「点击导航切换路由」「active 跟随移动」 |
| AC-07 | 三处角标显示 5 / 3 / 2 | 通过 | `tests/polish.spec.ts`「导航角标」：今日未完成 5、待跟进 3、待发布 2 |
| AC-08 | ⌘K 输入模块名可跳转 | 通过 | `tests/shell.spec.ts`、`tests/polish.spec.ts`（搜索任务、客户、内容并回车跳转） |
| AC-09 | ⌘J 记备忘，首页可见 | 通过 | `tests/home.spec.ts`「⌘J 打开备忘抽屉」、`tests/polish.spec.ts`「⌘J 保存后写入数据」 |
| AC-10 | 抽屉按 Esc 关闭，焦点回到触发元素 | 通过 | `tests/shell.spec.ts` Esc 关闭；焦点恢复在 `Drawer.vue` 卸载时对记录的元素调 `focus()`（代码检查） |
| AC-11 | 首页勾选任务，行变淡、进度 +1、今日计划一致 | 通过 | `tests/home.spec.ts`（条目与进度）、`tests/today.spec.ts`（勾选同步数据）；两处共用同一 `PlanList` |
| AC-12 | 首页底部加一条任务，刷新仍在 | 通过 | `tests/today.spec.ts`「底部输入回车即新增」；保存链路由 `tests/e2e-data.spec.ts` 覆盖 |
| AC-13 | 六张摘要卡可跳转，数字与模块一致 | 通过 | `tests/home.spec.ts`「摘要卡显示各模块数字，点击可跳转」、`tests/summary.spec.ts`（10 条统计口径） |
| AC-14 | 拖动换顺序、跨段拖动 | 通过 | `tests/plan.spec.ts`「重排按给定顺序写回」「可跨段移动」；页面拖拽在 `PlanList.vue` |
| AC-15 | 移到明天，今天不再显示 | 通过 | `tests/plan.spec.ts`（`movePlanItem` 改日期与排序）；行内「移到 → 明天」入口在 `PlanItemRow.vue` |
| AC-16 | 昨天有 2 条未完成，出现顺延提示并可全部移到今天 | 通过 | `tests/today.spec.ts` 顺延条三条用例、`tests/plan.spec.ts` 顺延选取与落位 |
| AC-17 | 删除需二次点击，无模态弹窗 | 通过 | `InlineDelete.vue` 两步确认（`data-pending`），`tests/today.spec.ts` 覆盖 |
| AC-18 | 看板拖到「待发布」，刷新仍在 | 通过 | `tests/media.spec.ts` 阶段流转与视图分列 |
| AC-19 | 改已发布并回填播放 12000，摘要与日历同步 | 通过 | `tests/media.spec.ts` 回填数据、`calendarMap` 按月归集、`platformStats` 复盘数据 |
| AC-20 | 计时 1 分钟结束，落工时并累计 | 通过 | `tests/dev.spec.ts` 计时开始/暂停/恢复/结束、`addTimeLog` 与项目汇总 |
| AC-21 | 新建 Bug 标为已解，未解数同步 | 通过 | `tests/dev.spec.ts` Bug 状态与项目未解数 |
| AC-22 | 会谈记录「生成跟进」，截止日等于下次跟进日 | 通过 | `tests/consult.spec.ts` `generateFollowUp` |
| AC-23 | 逾期跟进标红并排最前 | 通过 | `tests/consult.spec.ts` `isOverdue` + `sortedFollowUps` 排序 |
| AC-24 | 打勾 3 组后关闭页面，重开仍是已完成 | 通过 | `tests/fitness.spec.ts` 逐组打勾写入 `doneSets`，数据随文档保存 |
| AC-25 | 完成整次训练本周 +1，取消回退 | 通过 | `tests/fitness.spec.ts`「完成整次训练才计入本周次数」 |
| AC-26 | 周表格选 2 道菜，「照这个吃」生成打卡 | 通过 | `tests/diet.spec.ts` 排餐与 `logPlannedMeals` |
| AC-27 | 喝水点 3 次显示 3/8，刷新保持 | 通过 | `tests/diet.spec.ts` 杯子点击与 `addWater` 边界（0–8） |
| AC-28 | 记 45 分钟，本周累计 +45，跨周从 0 计 | 通过 | `tests/play.spec.ts`「记 45 分钟后本周累计增加 45 分钟」「本周累计只算本周」 |
| AC-29 | 玩一局 2048 后最高分更新 | 通过 | `tests/play.spec.ts`「2048 结束自动记最高分」（页面级）与分数只升不降 |
| AC-30 | 任务「加入今天」后勾掉，源任务变完成 | 通过 | `tests/dev.spec.ts` 加入今天、`tests/plan.spec.ts` 回写映射（task/bug/followup/workout） |
| AC-31 | 重复「加入今天」不新增，提示「已在今天」 | 通过 | `tests/dev.spec.ts` 去重；`Dev.vue` 重复时 toast「已在今天」 |
| AC-32 | 删除已加入今天的任务，条目保留并标「来源已删除」 | 通过 | `tests/plan.spec.ts` 来源引用三条、`tests/polish.spec.ts` 页面显示「来源已删除」、`tests/dev.spec.ts` 删除后保留 |
| AC-33 | 内容「加入今天」并勾掉，阶段不变 | 通过 | `tests/media.spec.ts`「只建提醒条目…勾掉不改阶段」 |
| AC-34 | 导出 → 清空 → 导入，条目数一致 | 通过 | `tests/e2e-data.spec.ts`「导出 → 清空 → 导入能完整还原」 |
| AC-35 | 改坏 `app-data.json` 后启动，有错误提示与恢复入口，不覆盖原文件 | 通过 | `tests/e2e-data.spec.ts` 损坏保护三条、`tests/settings.spec.ts`「损坏态页面」 |
| AC-36 | 清空必须输入「清空」，执行前自动备份 | 通过 | `tests/settings.spec.ts` 确认词门禁；`tests/e2e-data.spec.ts` 校验 `app-data.pre-reset-*.json` 已生成 |
| AC-37 | 切深色后刷新仍为深色，文字可读 | 通过 | `tests/shell.spec.ts`「载入时按设置应用主题」；深色 `--text-2/--text-3` 已提亮（`styles.css`） |
| AC-38 | 空模块有引导文案与「填入示例」 | 通过 | 自媒体/今日计划/游戏/健身/饮食的空状态与示例按钮；`tests/polish.spec.ts` 验证动作库、菜品库一键填入 |

## 数据安全三演练

| 演练 | 做法 | 结果 |
|---|---|---|
| 进程被强杀 | 写入后新建 store 读同一目录，模拟重启 | 通过：内容完整，无半截文件（原子替换 + 回读校验） |
| 手动改坏文件 | 把 `app-data.json` 写成非法 JSON | 通过：接口返回 409 `CORRUPT`，写入被拒（`READONLY`），原文件字节未变 |
| 备份恢复 | 列出当日备份 → 恢复 → 再读 | 通过：恢复内容正确，恢复前当前数据另存 |
| 以空白重建 | 坏文件状态下点「以空白数据重建」 | 通过：坏文件被挪为 `app-data.corrupt-*`，服务恢复可写 |

## 遗留与后续

1. 真机双击 `start.bat` 的 5 秒内开窗属于人工体验项，本机已用同一命令验证启动，未在桌面双击计时。
2. 深色模式对比度做了 token 层调整并逐页看过主要页面，未做像素级对比度测量。
3. 长时间真实使用一周后再定是否补功能，避免为想象中的需求加复杂度。

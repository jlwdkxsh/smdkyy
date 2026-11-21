# 第一版验收记录

对照 `PRD.md` 第 10 章逐条核对。测试命令：

```
runtime\node.exe --test --test-isolation=none "tests/*.test.mjs"
```

结果：**117 项测试全部通过**。

| 测试文件 | 用例数 | 覆盖 |
|---|---|---|
| tests/model.test.mjs | 33 | 数据模型、校验、平均分、按天查询、外观字段、记录备份格式 |
| tests/view.test.mjs | 20 | 首页小页、卡片、表单、导航、设置入口 |
| tests/calendar.test.mjs | 15 | 圆环、平均分上色、长按菜单、当天详情 |
| tests/list.test.mjs | 8 | 分组、筛选、卡片操作入口 |
| tests/chart.test.mjs | 8 | 平滑曲线、柔光点、最新点细环、坐标简化、单点与空态 |
| tests/settings.test.mjs | 12 | 设置页、背景三模式、滑块、裁剪弹层、导入确认 |
| tests/server.test.mjs | 10 | 读写接口、原子写、导入备份、备份保留 10 份 |
| tests/deploy.test.mjs | 5 | 启动器、静态资源、服务重启后数据仍在 |
| tests/app.test.mjs | 6 | 分数换算、表单输入构造、无 DOM 安全加载 |

> 说明：自动化测试覆盖数据模型、页面渲染、图表/圆环几何、本地服务与启动器。真实浏览器里的拖拽手感、系统文件选择框、原生取色器属于人工检查项，见文末清单。

## A. 首页与记录

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| A1 | 今日页：日期 + `＋ 记录`、三个入口、无大事件 | `view.test` 首页结构 | ✅ |
| A2 | 三个入口顺序与平均分 | `view.test` 入口顺序与数值 | ✅ |
| A3 | 表单默认类型 = 当前小页、5 分、无时间 | `view.test` 表单默认值；`app.test` buildRecordInput | ✅ |
| A4 | 只填分数可保存并提示 | `app.test` 输入构造；`model.test` 默认时间 | ✅ |
| A5 | 三条心情 → 三个点、平均分 6.7 | `chart.test` 三点与曲线；`model.test` typeAverage | ✅ |
| A6 | 刷新后仍在 | `deploy.test` 服务重启后读取 | ✅ |

## B. 小页切换

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| B1 | 切到精力只出现精力内容 | `view.test` 切页后不出现其他类型 | ✅ |
| B2 | 当前入口高亮、role=tab | `view.test` 切换按钮与 aria-selected | ✅ |
| B3 | 保存后停在新记录的类型 | `app.mjs` 保存后设置 todayType；`view.test` 按类型渲染 | ✅ |
| B4 | 不串类、不串天 | `view.test` 三类互斥；`model.test` 按天查询 | ✅ |

## C. 日历

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| C1 | 两类记录 → 两段彩环 + 一段灰底 | `calendar.test` 圆环段数 | ✅ |
| C2 | 平均分四舍五入取色（20/3→7） | `calendar.test` 心情段；`model.test` typeAverage | ✅ |
| C3 | 有大事件才显示圆点 | `calendar.test` 圆点数量 | ✅ |
| C4 | 今天加粗 + 描边 | `calendar.test` is-today；`styles.css` | ✅ |
| C5 | 详情无卡片、有日期/平均分/图/事件行 | `calendar.test` 详情结构 | ✅ |
| C6 | 三标签切换图表 | `calendar.test` 切换 | ✅ |
| C7 | 空月份只有灰圈 | `calendar.test` 空日期 | ✅ |
| C8 | 齿轮只在日历页 | `view.test` 三个页面齿轮检查 | ✅ |

## D. 列表

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| D1 | 按天分组、组内倒序 | `list.test` 分组顺序 | ✅ |
| D2 | 按类型筛选 | `list.test` 心情/大事件筛选 | ✅ |
| D3 | 编辑不改时间 | `model.test` updateRecord | ✅ |
| D4 | 复制内容相同、时间变此刻 | `model.test` duplicateRecord | ✅ |
| D5 | 删除需确认 | `view.test` 确认框；`model.test` delete | ✅ |
| D6 | 空状态提示 | `list.test` 两处空状态 | ✅ |

## E. 折线图

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| E1 | 只含当天数据 | `model.test` chartPoints；`chart.test` 按天 | ✅ |
| E2 | 单点不连线、时间居中 | `chart.test` 单点用例 | ✅ |
| E3 | 空状态 | `view.test` / `calendar.test` | ✅ |
| E4 | 无周/月视图 | 全项目仅单日接口 | ✅ |
| E5 | 平滑曲线、柔光点、最新细环、两时间、10/5/1 | `chart.test` 八条用例 | ✅ |
| E6 | 点上有时间/分数/备注 | `chart.test` title 与 data 属性 | ✅ |

## F. 表情与颜色

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| F1 | 换图后同分记录立即变 | `model.test` levelFace；`settings.test` 设置页 | ✅ |
| F2 | 改色后圆环/角标/点同步 | `model.test` levelColor；`calendar.test` 自定义颜色 | ✅ |
| F3 | 未设置时用默认脸 | `model.test` 默认表情 | ✅ |

## G. 持久化

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| G1 | 刷新不丢 | 服务端落盘 + `deploy.test` | ✅ |
| G2 | 关浏览器再开不丢 | 数据在 `data/data.json` | ✅ |
| G3 | 重启电脑不丢 | 同上（磁盘文件） | ✅ |
| G4 | data.json 可直接打开 | `server.test` 读取落盘文件 | ✅ |
| G5 | 换浏览器一致 | 数据与浏览器无关 | ✅ |

## H. 导出与导入

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| H1 | 导出只含记录与事件 | `model.test` buildRecordsBackup | ✅ |
| H2 | 导入替换记录、外观不变 | `app.mjs` 合并逻辑；`model.test` 解析 | ✅ |
| H3 | 导入前自动备份 | `server.test` 备份生成 | ✅ |
| H4 | 损坏文件拒绝 | `server.test` 非法导入；`model.test` 解析错误 | ✅ |
| H5 | 兼容旧版整份数据 | `model.test` legacy 用例 | ✅ |
| H6 | 备份保留 10 份 | `server.test` 12 次导入 | ✅ |

## I. 边界与异常

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| I1 | 分数只能 1–10 | `model.test` 分数校验；`app.test` clampScore | ✅ |
| I2 | 备注上限 500 | `model.test` 备注长度 | ✅ |
| I3 | 事件文字必填 | `model.test` 事件校验 | ✅ |
| I4 | 同天同类型多次 | `model.test` 三条心情 | ✅ |
| I5 | 5000 条性能 | 未做压力测试；量级远低于目标 | ⚠️ 待实测 |
| I6 | 删除 data 后不崩溃 | `boot()` 捕获并提示 | ✅ |
| I7 | 背景图超限提示 | `model.test` 背景图上限；`app.mjs` 压缩失败提示 | ✅ |

## J. 导航

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| J1 | 底部顺序 日历/今日/列表 | `view.test` 导航顺序 | ✅ |
| J2 | 三个标签切换 | `view.test` 渲染；`app.mjs` 事件 | ✅ |
| J3 | 导航固定 | `styles.css` `.nav{position:fixed}` | ✅ |
| J4 | 齿轮进设置、隐藏导航、可返回 | `view.test` / `settings.test` | ✅ |
| J5 | 点今日回到今天 | 今日页始终用 `state.today` | ✅ |

## K. 外观

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| K1 | 三种背景模式切换 | `view.test` 背景模式按钮；`settings.test` backgroundCss | ✅ |
| K2 | 渐变颜色与方向 | `settings.test` 渐变色与方向字段 | ✅ |
| K3 | 图片选择 / 清除 | `settings.test` 图片模式 | ✅ |
| K4 | 透明度滑块作用于面板 | `settings.test` 滑块存在；`styles.css` `--surface` | ✅ |
| K5 | 遮罩只在图片模式 | `settings.test` 按模式渲染 | ✅ |
| K6 | 恢复默认外观保留颜色 | `model.test` resetAppearance | ✅ |
| K7 | 3MB 图片压缩效果与保存耗时 | 依赖浏览器 canvas，需人工验证 | ⚠️ 人工 |
| K8 | 导出/导入不影响外观 | `model.test` 备份不含 settings | ✅ |

---

## 需要在浏览器里人工过一遍

1. 竖向滑条拖拽手感：按住上下拖、松手吸附；点轨道跳档；滚轮与 ↑↓。
2. 日历长按 0.5 秒弹出补记菜单；长按未来日期弹出失败提示。
3. 点“换图”打开系统文件选择框，选图后拖动 + 缩放裁剪，点“使用”后缩略图变化。
4. 点颜色圆点打开系统取色器，改色后圆环与卡片立刻变色。
5. 外观：三种背景切换、渐变方向、选图/清除、透明度与遮罩滑块的实际观感。
6. 用一张约 3MB 的照片做背景：能否选成功、背景是否清晰、记一条时是否可感知卡顿。
7. “导出记录”触发浏览器下载，检查文件里没有 settings 与图片；“导入记录”选择文件后出现覆盖确认。
8. 关掉小黑窗口再双击 `启动.bat`，数据与外观都还在。
9. 窄窗口（约 360px 宽）下页面不横向溢出。
10. 折线图观感：曲线是否顺滑、点是否好看、最新点是否能一眼认出。

以上 10 条需要在真实浏览器里人工确认；逻辑、渲染与存储已由 117 项自动化测试覆盖。

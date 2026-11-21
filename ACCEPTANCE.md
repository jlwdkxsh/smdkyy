# 第一版验收记录

对照 `PRD.md` 第 10 章逐条核对。测试命令：

```
runtime\node.exe --test --test-isolation=none "tests/*.test.mjs"
```

结果：**92 项测试全部通过**（model 25 / view 16 / calendar 15 / list 8 / app 6 / settings 7 / server 10 / deploy 5）。

说明：本项目的自动化测试覆盖数据模型、页面渲染、图表/圆环几何、本地服务与启动器。真实浏览器里的拖拽手感、系统文件选择框、原生颜色选择器属于人工检查项，列在最后一节。

## A. 记录与保存

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| A1 | 打开表单默认身体、5 分、无日期时间 | `view.test` 记录表单默认值 | ✅ |
| A2 | 滑条最顶 10 分、最底 1 分 | `view.test` 滑条位置两例 | ✅ |
| A3 | 点轨道/键盘/± 按整数档变化 | `app.test` clampScore / scoreFromRatio；`view.test` 滑块位置 | ✅ |
| A4 | 只填分数可保存，时间取此刻 | `model.test` addRecord 默认时间 | ✅ |
| A5 | 同日 3 条心情画出 3 点并连线 | `view.test` 三数据点；`model.test` chartPoints | ✅ |
| A6 | 刷新后记录仍在 | `deploy.test` 服务重启后数据仍在 | ✅ |

## B. 补记

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| B1 | 长按日期弹出补记菜单 | `calendar.test` 长按菜单 | ✅ |
| B2 | 补记表单带日期与时间（默认当前钟点） | `view.test` 补记表单；`app.test` buildRecordInput | ✅ |
| B3 | 补记保存在对应日期与时刻 | `app.test` 输入能直接写入 model | ✅ |
| B4 | 未来日期不能记 | `model.test` 拒绝未来日期；`calendar.test` 菜单文案 | ✅ |
| B5 | 取消不产生记录 | 菜单 close 分支；渲染测试覆盖取消按钮存在 | ✅ |

## C. 日历

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| C1 | 两类记录 → 两段彩色 + 一段灰底 | `calendar.test` 圆环段数 | ✅ |
| C2 | 平均分四舍五入取色（20/3→7） | `model.test` typeAverage；`calendar.test` 心情段 | ✅ |
| C3 | 有事件显示圆点，无事件不显示 | `calendar.test` 圆点数量 | ✅ |
| C4 | 今天加粗 + 描边 | `calendar.test` `is-today`；`styles.css` `.day.is-today` | ✅ |
| C5 | 详情=日期+三平均分+图表，无卡片 | `calendar.test` 详情结构 | ✅ |
| C6 | 三标签切换图表与平均分 | `calendar.test` 切换 | ✅ |
| C7 | 空月份无彩色段 | `calendar.test` 11-19 空日期 | ✅ |

## D. 列表

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| D1 | 按天分组、组内倒序 | `list.test` 分组顺序 | ✅ |
| D2 | 按类型筛选 | `list.test` 心情/大事件筛选 | ✅ |
| D3 | 编辑后内容更新、时间不变 | `model.test` updateRecord | ✅ |
| D4 | 复制内容相同、时间变此刻 | `model.test` duplicateRecord | ✅ |
| D5 | 删除需确认，取消保留 | `view.test` 确认框；`model.test` delete | ✅ |
| D6 | 无数据显示空状态 | `list.test` 空状态两例 | ✅ |

## E. 折线图

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| E1 | 两天的曲线互不混 | `model.test` chartPoints 只取当天；`calendar.test` 详情 | ✅ |
| E2 | 单点不连线 | `chart.mjs` 逻辑 + `view.test` 单点场景 | ✅ |
| E3 | 无记录显示空状态 | `calendar.test` “这天没有精力记录” | ✅ |
| E4 | 不存在周/月折线图 | 全项目仅单日接口；`chartPoints` 必须传 dateKey | ✅ |

## F. 表情与颜色

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| F1 | 换图后所有同分记录跟着变 | `model.test` levelFace；`settings.test` 设置页图片 | ✅ |
| F2 | 改色后圆环/角标/点同步 | `model.test` levelColor；`calendar.test` 自定义颜色 | ✅ |
| F3 | 未设置时用内置默认脸 | `model.test` 默认表情 | ✅ |

## G. 持久化

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| G1 | 刷新不丢 | 服务端落盘 + `deploy.test` 重启读取 | ✅ |
| G2 | 关浏览器再开不丢 | 数据在 `data/data.json`，不依赖浏览器 | ✅ |
| G3 | 重启电脑不丢 | 同上（磁盘文件） | ✅ |
| G4 | data.json 可直接打开 | `server.test` 读取落盘文件；`deploy.test` | ✅ |
| G5 | 换浏览器一致 | 数据在磁盘，与浏览器无关 | ✅ |

## H. 备份与恢复

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| H1 | 导出包含全部数据 | `server.test` /api/export；`settings.test` 导出按钮 | ✅ |
| H2 | 导入后完整恢复 | `server.test` import 覆盖 | ✅ |
| H3 | 导入前自动备份 | `server.test` 备份生成 | ✅ |
| H4 | 损坏文件拒绝 | `server.test` 非法导入；`app.test` 校验入口 | ✅ |
| H5 | 备份保留最近 10 份 | `server.test` 12 次导入后 10 份 | ✅ |

## I. 边界

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| I1 | 分数只能 1–10 | `model.test` 分数校验 | ✅ |
| I2 | 备注上限 500 | `model.test` 备注长度 | ✅ |
| I3 | 事件文字必填 | `model.test` 事件校验 | ✅ |
| I4 | 同天同类型多次 | `model.test` typeAverage 三条心情 | ✅ |
| I5 | 5000 条性能 | 未做压力测试；数据量级远低于目标 | ⚠️ 待实测 |
| I6 | 删除 data 后不崩溃 | `boot()` 捕获并显示提示（代码路径） | ✅ |

## J. 导航

| 编号 | 验收点 | 验证 | 结果 |
|---|---|---|---|
| J1 | 底部顺序 日历/今日/列表，今日高亮 | `view.test` 导航顺序 | ✅ |
| J2 | 三个标签切换正确 | `view.test` 导航渲染；事件绑定在 `app.mjs` | ✅ |
| J3 | 滚动时导航固定 | `styles.css` `.nav{position:fixed}` | ✅ |
| J4 | 齿轮进设置、隐藏导航、可返回 | `settings.test` / `view.test` | ✅ |
| J5 | 点今日回到今天 | 今日页始终用 `state.today` | ✅ |

---

## 需要在浏览器里人工过一遍（自动化测试覆盖不到）

1. 竖向滑条**拖拽**手感：按住上下拖、松手吸附到整数档；点轨道跳档；滚轮与 ↑↓。
2. 日历**长按** 0.5 秒弹出补记菜单；长按未来日期弹出失败提示。
3. 点“换图”打开系统文件选择框，选图后**拖动 + 缩放**裁剪，点“使用”后设置页缩略图变化。
4. 点颜色圆点打开系统取色器，改色后圆环与卡片立刻变色。
5. “导出备份”触发浏览器下载；“导入备份”选择文件后出现覆盖确认框。
6. 关掉小黑窗口再双击 `启动.bat`，数据仍在。
7. 窄窗口（约 360px 宽）下页面不横向溢出。

以上 7 条需要在真实浏览器里点一遍确认；逻辑与结构层已由 92 项自动化测试覆盖。

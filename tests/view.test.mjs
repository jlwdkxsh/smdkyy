import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../app/js/model.mjs';
import { renderApp, renderNav, renderToday, renderRecordSheet, renderEventSheet, renderCard, esc } from '../app/js/view.mjs';

const NOW = new Date(2026, 10, 21, 19, 30);
const TODAY = '2026-11-21';

function stateWith(overrides = {}) {
  return {
    data: M.createEmptyData(NOW),
    today: TODAY,
    tab: 'today',
    returnTab: 'today',
    calendar: { year: 2026, month: 11, selected: TODAY },
    filter: 'all',
    sheet: null,
    menu: null,
    dialog: null,
    ...overrides,
  };
}

test('底部导航：顺序为 日历 / 今日 / 列表，今日默认高亮', () => {
  const nav = renderNav(stateWith());
  const calendar = nav.indexOf('data-tab="calendar"');
  const today = nav.indexOf('data-tab="today"');
  const list = nav.indexOf('data-tab="list"');
  assert.ok(calendar > -1 && today > -1 && list > -1, '三个标签都存在');
  assert.ok(calendar < today && today < list, '顺序为 日历、今日、列表');
  assert.match(nav, /data-tab="today" aria-current="page"/);
  assert.equal((nav.match(/is-active/g) || []).length, 1);
});

test('今日页：日期标题、三个入口、当前小页空状态、右上角记录按钮', () => {
  const html = renderToday(stateWith());
  assert.match(html, /11月21日 周六/);
  assert.doesNotMatch(html, /· 今天<\/h1>/, '今日页标题不重复标注今天，避免窄屏换行');
  assert.equal((html.match(/class="type-nav__item/g) || []).length, 3);
  assert.equal((html.match(/class="chart-block"/g) || []).length, 1);
  assert.match(html, /今天还没有身体记录/);
  assert.doesNotMatch(html, /今天还没有精力记录/);
  assert.match(html, /class="page-head page-head--today"/);
  assert.match(html, /class="today-add" data-action="add-record">＋ 记录/);
  assert.doesNotMatch(html, /data-action="add-event"/);
});

function sectionOf(html, key) {
  const marker = `id="type-${key}"`;
  const start = html.indexOf(marker);
  if (start < 0) return '';
  const next = html.indexOf('<section class="type-section"', start + marker.length);
  return html.slice(start, next > -1 ? next : html.length);
}

test('今日页：三个状态入口是切换按钮，默认停在身体小页', () => {
  const html = renderToday(stateWith());
  const types = [...html.matchAll(/data-action="switch-type" data-type="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(types, ['body', 'energy', 'mood']);
  assert.match(html, /role="tablist"/);
  assert.equal((html.match(/is-active/g) || []).length, 1);
  assert.match(html, /class="type-nav__item is-active"[^>]*aria-selected="true"[^>]*data-type="body"/);
  assert.match(html, /id="type-body"/);
});

test('今日页：切到精力小页，只出现精力内容，不出现身体和心情', () => {
  let data = M.createEmptyData(NOW);
  data = M.addRecord(data, { type: 'body', score: 6, note: '身体的话', recordedAt: '2026-11-21T08:00' }, NOW);
  data = M.addRecord(data, { type: 'energy', score: 7, note: '精力的话', recordedAt: '2026-11-21T12:00' }, NOW);
  data = M.addRecord(data, { type: 'mood', score: 8, note: '心情的话', recordedAt: '2026-11-21T21:14' }, NOW);

  const energy = renderToday(stateWith({ data, todayType: 'energy' }));
  assert.match(energy, /id="type-energy"/);
  assert.doesNotMatch(energy, /id="type-body"/);
  assert.doesNotMatch(energy, /id="type-mood"/);
  assert.match(energy, /精力的话/);
  assert.doesNotMatch(energy, /身体的话/);
  assert.doesNotMatch(energy, /心情的话/);

  const mood = renderToday(stateWith({ data, todayType: 'mood' }));
  assert.match(mood, /心情的话/);
  assert.doesNotMatch(mood, /身体的话|精力的话/);
});

test('今日页：不再显示大事件，也没有大事件入口', () => {
  let data = M.createEmptyData(NOW);
  data = M.addRecord(data, { type: 'body', score: 6, note: '身体的话', recordedAt: '2026-11-21T08:00' }, NOW);
  data = M.addEvent(data, { text: '搬家', date: TODAY }, NOW);
  const html = renderToday(stateWith({ data }));
  assert.doesNotMatch(html, /搬家/);
  assert.doesNotMatch(html, /大事件/);
  assert.doesNotMatch(html, /id="type-event"/);
  assert.doesNotMatch(html, /data-action="add-event"/);
});

test('今日页：区块标题显示平均分与条数', () => {
  let data = M.createEmptyData(NOW);
  data = M.addRecord(data, { type: 'mood', score: 5, note: '', recordedAt: '2026-11-21T09:20' }, NOW);
  data = M.addRecord(data, { type: 'mood', score: 8, note: '', recordedAt: '2026-11-21T15:00' }, NOW);
  data = M.addRecord(data, { type: 'mood', score: 7, note: '', recordedAt: '2026-11-21T21:14' }, NOW);
  const html = renderToday(stateWith({ data, todayType: 'mood' }));
  const moodSection = sectionOf(html, 'mood');
  assert.match(moodSection, /class="type-section__avg" style="color:#97B842">6\.7</);
  assert.match(moodSection, /3 条/);
  assert.match(html, /class="type-nav__avg" style="color:#97B842">6\.7</);
});

test('今日页：只显示今天的卡片', () => {
  let data = M.createEmptyData(NOW);
  data = M.addRecord(data, { type: 'mood', score: 8, note: '今天', recordedAt: '2026-11-21T21:14' }, NOW);
  data = M.addRecord(data, { type: 'body', score: 4, note: '昨天的', recordedAt: '2026-11-20T08:00' }, NOW);
  const html = renderToday(stateWith({ data, todayType: 'mood' }));
  assert.match(html, /今天/);
  assert.match(html, /21:14/);
  assert.doesNotMatch(html, /昨天的/);
});

test('今日页：有记录时画出该类型的折线图与数据点', () => {
  let data = M.createEmptyData(NOW);
  data = M.addRecord(data, { type: 'mood', score: 5, note: '', recordedAt: '2026-11-21T09:20' }, NOW);
  data = M.addRecord(data, { type: 'mood', score: 8, note: '', recordedAt: '2026-11-21T15:00' }, NOW);
  data = M.addRecord(data, { type: 'mood', score: 7, note: '', recordedAt: '2026-11-21T21:14' }, NOW);
  const html = renderToday(stateWith({ data, todayType: 'mood' }));
  const start = html.indexOf('data-chart="mood"');
  const block = html.slice(start, start + 4000);
  assert.match(block, /<svg/);
  assert.equal((block.match(/class="chart-dot"/g) || []).length, 3);
  assert.match(block, /fill="#E5C13F"/);
  assert.match(block, /fill="#6EA84B"/);
  assert.match(block, /fill="#97B842"/);
  assert.match(block, /class="chart-line"/);
  // 数据点带时间/分数/备注，供悬停与点击查看
  assert.match(block, /<title>09:20 · 心情 5 分<\/title>/);
  assert.match(block, /data-clock="21:14" data-score="7"/);
  // 切到身体小页时不画心情的图
  const body = renderToday(stateWith({ data, todayType: 'body' }));
  assert.doesNotMatch(body, /data-chart="mood"/);
  assert.match(body, /今天还没有身体记录/);
});

test('记录卡片：表情、类型、分数颜色、时间、备注', () => {
  let data = M.createEmptyData(NOW);
  data = M.addRecord(data, { type: 'mood', score: 8, note: '下午终于把方案定下来了', recordedAt: '2026-11-21T21:14' }, NOW);
  const card = M.dayCards(data, TODAY)[0];
  const html = renderCard(card, stateWith({ data }));
  assert.match(html, /心情/);
  assert.match(html, /class="card__score" style="color:#6EA84B">8</);
  assert.match(html, /21:14/);
  assert.match(html, /下午终于把方案定下来了/);
  assert.match(html, /data-action="card-menu"/);
  assert.match(html, /data-action="edit-card" data-kind="record"/);
});

test('大事件卡片：没有分数，显示 📌 与文字', () => {
  let data = M.createEmptyData(NOW);
  data = M.addEvent(data, { text: '搬家', date: TODAY }, NOW);
  const card = M.dayCards(data, TODAY)[0];
  const html = renderCard(card, stateWith({ data }));
  assert.match(html, /📌/);
  assert.match(html, /大事件/);
  assert.match(html, /搬家/);
  assert.doesNotMatch(html, /card__score/);
});

test('大事件卡片：换过图标后显示自定义图片', () => {
  let data = M.createEmptyData(NOW);
  data = M.addEvent(data, { text: '搬家', date: TODAY }, NOW);
  data.settings.eventIcon = 'data:image/png;base64,AAAA';
  const card = M.dayCards(data, TODAY)[0];
  const html = renderCard(card, stateWith({ data }));
  assert.match(html, /<img class="face-img" src="data:image\/png;base64,AAAA"/);
  assert.doesNotMatch(html, /📌/);
});

test('卡片里的备注会被转义，不会破坏结构', () => {
  let data = M.createEmptyData(NOW);
  data = M.addRecord(data, { type: 'body', score: 3, note: '<b>腰疼</b> & "酸"', recordedAt: '2026-11-21T08:00' }, NOW);
  const card = M.dayCards(data, TODAY)[0];
  const html = renderCard(card, stateWith({ data }));
  assert.match(html, /&lt;b&gt;腰疼&lt;\/b&gt; &amp; &quot;酸&quot;/);
  assert.doesNotMatch(html, /<b>腰疼<\/b>/);
  assert.equal(esc('<x>'), '&lt;x&gt;');
});

test('记录表单：默认 5 分、身体、无时间输入、10 色渐变、备注上限 500', () => {
  const state = stateWith({
    sheet: { kind: 'record', mode: 'create', type: 'body', score: 5, note: '' },
  });
  const html = renderRecordSheet(state);
  assert.match(html, /添加记录/);
  assert.match(html, /class="type-tab is-active" data-action="sheet-type" data-type="body"/);
  assert.match(html, /aria-valuenow="5"/);
  assert.match(html, /role="slider"/);
  assert.match(html, /linear-gradient\(to top, #C64B3C/);
  assert.equal((html.match(/#[0-9A-F]{6}/g) || []).length >= 10, true);
  assert.match(html, /maxlength="500"/);
  assert.doesNotMatch(html, /type="time"/);
  // 滑块位置：分数 5 → (10-5)/9 ≈ 0.5556，用百分比定位随轨道高度自适应
  assert.match(html, /class="slider__thumb" style="top:calc\(0\.5556 \* \(100% - 46px\)\)"/);
});

test('记录表单：分数 10 在最顶、分数 1 在最底', () => {
  const top = renderRecordSheet(stateWith({ sheet: { kind: 'record', mode: 'create', type: 'body', score: 10, note: '' } }));
  assert.match(top, /class="slider__thumb" style="top:calc\(0\.0000 \* \(100% - 46px\)\)"/);
  const bottom = renderRecordSheet(stateWith({ sheet: { kind: 'record', mode: 'create', type: 'body', score: 1, note: '' } }));
  assert.match(bottom, /class="slider__thumb" style="top:calc\(1\.0000 \* \(100% - 46px\)\)"/);
});

test('记录表单：补记时带日期与时间，默认时间可改', () => {
  const html = renderRecordSheet(
    stateWith({ sheet: { kind: 'record', mode: 'backfill', date: '2026-11-20', time: '22:10', type: 'mood', score: 7, note: '补记一条' } }),
  );
  assert.match(html, /补记记录/);
  assert.match(html, /11月20日 周五/);
  assert.match(html, /type="time" data-field="time" value="22:10"/);
  assert.match(html, /补记一条/);
});

test('记录表单：编辑时显示原时间且不可修改', () => {
  const html = renderRecordSheet(
    stateWith({ sheet: { kind: 'record', mode: 'edit', id: 'rec_1', type: 'energy', score: 6, note: '原备注', originalTime: '09:20' } }),
  );
  assert.match(html, /编辑记录/);
  assert.match(html, /09:20/);
  assert.match(html, /不可修改/);
  assert.doesNotMatch(html, /type="time"/);
  assert.match(html, /原备注/);
});

test('记录表单：大数字用当前档位颜色，随分数变化', () => {
  const seven = renderRecordSheet(stateWith({ sheet: { kind: 'record', mode: 'create', type: 'body', score: 7, note: '' } }));
  assert.match(seven, /class="sheet__number" style="color:#97B842">7</);
  const one = renderRecordSheet(stateWith({ sheet: { kind: 'record', mode: 'create', type: 'body', score: 1, note: '' } }));
  assert.match(one, /class="sheet__number" style="color:#C64B3C">1</);
});

test('大事件表单：内容与日期，日期不得超过今天', () => {
  const state = stateWith({ sheet: { kind: 'event', mode: 'create', text: '搬家', date: TODAY } });
  const html = renderEventSheet(state);
  assert.match(html, /添加大事件/);
  assert.match(html, /maxlength="200"/);
  assert.match(html, /type="date" data-field="date" value="2026-11-21" max="2026-11-21"/);
  assert.match(html, /搬家/);
});

test('弹层遮罩：有表单时会渲染背景遮罩与关闭按钮', () => {
  const html = renderApp(stateWith({ sheet: { kind: 'record', mode: 'create', type: 'body', score: 5, note: '' } }));
  assert.match(html, /sheet-backdrop" data-action="close-sheet"/);
  assert.match(html, /data-action="close-sheet" aria-label="关闭"/);
});

test('卡片菜单与删除确认框', () => {
  const menu = renderApp(stateWith({ menu: { kind: 'record', id: 'rec_1', type: 'mood' } }));
  assert.match(menu, /data-action="menu-edit"/);
  assert.match(menu, /data-action="menu-copy"/);
  assert.match(menu, /data-action="menu-delete"/);

  const dialog = renderApp(
    stateWith({ dialog: { kind: 'delete', cardKind: 'record', id: 'rec_1', text: '删除后不能恢复，确定删除这条记录吗？' } }),
  );
  assert.match(dialog, /data-action="confirm-delete"/);
  assert.match(dialog, /data-action="cancel-delete"/);
  assert.match(dialog, /删除后不能恢复/);
});

test('设置入口：只在日历页出现齿轮，设置页隐藏底部导航并带返回', () => {
  const today = renderApp(stateWith({ tab: 'today' }));
  assert.doesNotMatch(today, /data-action="open-settings"/);
  assert.match(today, /<nav class="nav"/);

  const list = renderApp(stateWith({ tab: 'list' }));
  assert.doesNotMatch(list, /data-action="open-settings"/);

  const calendar = renderApp(stateWith({ tab: 'calendar' }));
  assert.match(calendar, /data-action="open-settings"/);
  assert.match(calendar, /aria-label="设置"/);

  const settings = renderApp(stateWith({ tab: 'settings' }));
  assert.doesNotMatch(settings, /<nav class="nav"/);
  assert.match(settings, /data-action="close-settings"/);
  assert.doesNotMatch(settings, /data-action="open-settings"/);
});

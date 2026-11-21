import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../app/js/model.mjs';
import { renderApp, renderListPage } from '../app/js/view.mjs';

const NOW = new Date(2026, 10, 21, 19, 30);
const TODAY = '2026-11-21';

function makeData() {
  let data = M.createEmptyData(NOW);
  data = M.addRecord(data, { type: 'mood', score: 8, note: '今天的心情', recordedAt: '2026-11-21T21:14' }, NOW);
  data = M.addRecord(data, { type: 'body', score: 6, note: '今天的身体', recordedAt: '2026-11-21T08:00' }, NOW);
  data = M.addRecord(data, { type: 'energy', score: 5, note: '昨天的精力', recordedAt: '2026-11-20T15:00' }, NOW);
  data = M.addEvent(data, { text: '搬家', date: '2026-11-20' }, NOW);
  return data;
}

function stateWith(overrides = {}) {
  return {
    data: makeData(),
    today: TODAY,
    tab: 'list',
    returnTab: 'today',
    calendar: { year: 2026, month: 11, selected: TODAY, chartType: 'body' },
    filter: 'all',
    sheet: null,
    menu: null,
    dayMenu: null,
    dialog: null,
    ...overrides,
  };
}

test('列表：五个筛选标签，默认“全部”高亮', () => {
  const html = renderListPage(stateWith());
  for (const label of ['全部', '身体', '精力', '心情', '大事件']) {
    assert.match(html, new RegExp(`>${label}</button>`));
  }
  assert.match(html, /class="chip is-active" data-action="filter" data-filter="all">全部/);
  assert.equal((html.match(/class="chip"/g) || []).length, 4);
});

test('列表：按天分组，日期从新到旧', () => {
  const html = renderListPage(stateWith());
  const todayIndex = html.indexOf('2026年11月21日 周六 · 今天');
  const yesterdayIndex = html.indexOf('2026年11月20日 周五 · 昨天');
  assert.ok(todayIndex > -1 && yesterdayIndex > -1);
  assert.ok(todayIndex < yesterdayIndex);
});

test('列表：组内记录按时间倒序，事件排在当天最后', () => {
  const html = renderListPage(stateWith());
  const group = html.slice(html.indexOf('2026年11月20日'), html.indexOf('2026年11月20日') + 3000);
  const energyIndex = group.indexOf('昨天的精力');
  const eventIndex = group.indexOf('搬家');
  assert.ok(energyIndex > -1 && eventIndex > -1);
  assert.ok(energyIndex < eventIndex);
});

test('列表：筛选“心情”只留下心情记录', () => {
  const html = renderListPage(stateWith({ filter: 'mood' }));
  assert.match(html, /今天的心情/);
  assert.doesNotMatch(html, /今天的身体/);
  assert.doesNotMatch(html, /搬家/);
  assert.match(html, /class="chip is-active" data-action="filter" data-filter="mood"/);
});

test('列表：筛选“大事件”只留下事件卡片', () => {
  const html = renderListPage(stateWith({ filter: 'event' }));
  assert.match(html, /搬家/);
  assert.doesNotMatch(html, /今天的心情/);
  assert.doesNotMatch(html, /今天的身体/);
  assert.doesNotMatch(html, /card__score/);
});

test('列表：筛选结果为空时给出提示', () => {
  const html = renderListPage(stateWith({ filter: 'mood', data: M.createEmptyData(NOW) }));
  assert.match(html, /没有符合条件的记录/);
});

test('列表：完全没有数据时提示“还没有任何记录”', () => {
  const html = renderListPage(stateWith({ data: M.createEmptyData(NOW) }));
  assert.match(html, /还没有任何记录/);
});

test('列表：卡片带编辑入口与更多菜单，没有新增按钮', () => {
  const html = renderApp(stateWith());
  assert.match(html, /data-action="edit-card"/);
  assert.match(html, /data-action="card-menu"/);
  assert.doesNotMatch(html, /data-action="add-record"/);
  assert.doesNotMatch(html, /data-action="add-event"/);
  assert.match(html, /<nav class="nav"/);
});

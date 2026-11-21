import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../app/js/model.mjs';
import { ringSvg, RING_CIRCUMFERENCE } from '../app/js/ring.mjs';
import { renderApp, renderDayDetail } from '../app/js/view.mjs';

const NOW = new Date(2026, 10, 21, 19, 30);
const TODAY = '2026-11-21';

function makeData() {
  let data = M.createEmptyData(NOW);
  data = M.addRecord(data, { type: 'body', score: 6, note: '腰有点僵', recordedAt: '2026-11-21T08:00' }, NOW);
  data = M.addRecord(data, { type: 'mood', score: 5, note: '', recordedAt: '2026-11-21T09:20' }, NOW);
  data = M.addRecord(data, { type: 'mood', score: 8, note: '方案定了', recordedAt: '2026-11-21T15:00' }, NOW);
  data = M.addRecord(data, { type: 'mood', score: 7, note: '', recordedAt: '2026-11-21T21:14' }, NOW);
  data = M.addEvent(data, { text: '搬家', date: TODAY }, NOW);
  return data;
}

function stateWith(overrides = {}) {
  return {
    data: makeData(),
    today: TODAY,
    tab: 'calendar',
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

test('圆环：没有记录的日子只有浅灰底圈', () => {
  const data = M.createEmptyData(NOW);
  const svg = ringSvg(data, '2026-11-19');
  assert.match(svg, /class="ring-track"/);
  assert.match(svg, /stroke="#ECECEA"/);
  assert.doesNotMatch(svg, /ring-seg/);
});

test('圆环：一段圆弧的位置、颜色与长度', () => {
  const data = M.createEmptyData(NOW);
  const withBody = M.addRecord(data, { type: 'body', score: 6, note: '', recordedAt: '2026-11-20T08:00' }, NOW);
  const svg = ringSvg(withBody, '2026-11-20');
  assert.equal((svg.match(/class="ring-seg"/g) || []).length, 1);
  assert.match(svg, /data-type="body"/);
  assert.match(svg, /data-level="6"/);
  assert.match(svg, new RegExp(`stroke="${M.levelColor(withBody, 6)}"`));
  assert.match(svg, /stroke-dasharray="36\.13 108\.38"/);
  assert.match(svg, /stroke-dashoffset="0\.00"/);
  assert.ok(Math.abs(RING_CIRCUMFERENCE - 108.38) < 0.01);
});

test('圆环：三段圆弧按 身体→精力→心情 顺序偏移', () => {
  const data = makeData();
  const withEnergy = M.addRecord(data, { type: 'energy', score: 5, note: '', recordedAt: '2026-11-21T12:00' }, NOW);
  const svg = ringSvg(withEnergy, TODAY);
  assert.equal((svg.match(/class="ring-seg"/g) || []).length, 3);
  const body = svg.slice(svg.indexOf('data-type="body"'));
  const energy = svg.slice(svg.indexOf('data-type="energy"'));
  const mood = svg.slice(svg.indexOf('data-type="mood"'));
  assert.match(body.slice(0, 400), /stroke-dashoffset="0\.00"/);
  assert.match(energy.slice(0, 400), /stroke-dashoffset="-36\.13"/);
  assert.match(mood.slice(0, 400), /stroke-dashoffset="-72\.26"/);
});

test('圆环：颜色取当天平均分四舍五入后的档位色', () => {
  const data = makeData(); // 心情 5 + 8 + 7 = 20 → 6.67 → 7 → #97B842
  const svg = ringSvg(data, TODAY);
  const mood = svg.slice(svg.indexOf('data-type="mood"'));
  assert.match(mood.slice(0, 400), /data-level="7"/);
  assert.match(mood.slice(0, 400), /stroke="#97B842"/);
});

test('圆环：自定义颜色会立刻反映到圆弧上', () => {
  const data = makeData();
  data.settings.levels[6].color = '#123456';
  const svg = ringSvg(data, TODAY);
  assert.match(svg, /stroke="#123456"/);
});

test('日历：42 个日期格、星期行、长按提示', () => {
  const html = renderApp(stateWith());
  assert.equal((html.match(/data-day="/g) || []).length, 42);
  assert.match(html, /calendar__week/);
  assert.match(html, /2026 年 11 月/);
  assert.match(html, /长按日期可以补记/);
});

test('日历：今天标记、选中态、事件圆点、圆环', () => {
  const html = renderApp(stateWith());
  assert.match(html, /class="day is-today is-selected" data-day="2026-11-21"/);
  assert.equal((html.match(/class="day__dot"/g) || []).length, 1);
  assert.match(html, /class="ring-track"/);
  assert.match(html, /class="ring-seg" data-type="body"/);
  assert.match(html, /class="ring-seg" data-type="mood"/);
});

test('日历：没有记录的日期不画彩色圆弧，也没有圆点', () => {
  const html = renderApp(stateWith());
  const day19 = html.slice(html.indexOf('data-day="2026-11-19"'));
  const cell = day19.slice(0, day19.indexOf('</button>'));
  assert.match(cell, /class="ring-track"/);
  assert.doesNotMatch(cell, /ring-seg/);
  assert.doesNotMatch(cell, /day__dot/);
});

test('日历详情：日期、三个平均分、折线图，且没有记录卡片', () => {
  const html = renderDayDetail(stateWith());
  assert.match(html, /2026年11月21日 周六 · 今天/);
  assert.match(html, /身体/);
  assert.match(html, /6\.0/);
  assert.match(html, /—/);
  assert.match(html, /6\.7/);
  assert.match(html, /<svg/);
  assert.doesNotMatch(html, /class="card /);
  assert.doesNotMatch(html, /今天的记录/);
});

test('日历详情：点不同类型标签切换图表数据', () => {
  const body = renderDayDetail(stateWith({ calendar: { year: 2026, month: 11, selected: TODAY, chartType: 'body' } }));
  assert.equal((body.match(/class="chart-dot"/g) || []).length, 1);

  const mood = renderDayDetail(stateWith({ calendar: { year: 2026, month: 11, selected: TODAY, chartType: 'mood' } }));
  assert.equal((mood.match(/class="chart-dot"/g) || []).length, 3);
  assert.match(mood, /data-action="chart-type" data-type="mood"/);
});

test('日历详情：某类型当天没有记录时显示空状态', () => {
  const html = renderDayDetail(stateWith({ calendar: { year: 2026, month: 11, selected: TODAY, chartType: 'energy' } }));
  assert.match(html, /这天没有精力记录/);
  assert.doesNotMatch(html, /<svg/);
});

test('日历详情：当天的大事件以一行文字显示', () => {
  const html = renderDayDetail(stateWith());
  assert.match(html, /大事件 · 搬家/);
});

test('日历详情：没有事件时不显示事件行', () => {
  const data = M.createEmptyData(NOW);
  const html = renderDayDetail(stateWith({ data }));
  assert.doesNotMatch(html, /大事件 ·/);
  assert.match(html, /这天没有身体记录/);
});

test('长按菜单：显示日期与已有条数，提供记状态/记大事件', () => {
  const html = renderApp(stateWith({ dayMenu: { date: '2026-11-20', count: 3 } }));
  assert.match(html, /11月20日 周五 · 已有 3 条/);
  assert.match(html, /data-action="day-menu-record"/);
  assert.match(html, /data-action="day-menu-event"/);
  assert.match(html, /data-action="close-day-menu"/);
});

test('长按菜单：没有记录时显示“还没有记录”', () => {
  const html = renderApp(stateWith({ dayMenu: { date: '2026-11-20', count: 0 } }));
  assert.match(html, /还没有记录/);
});

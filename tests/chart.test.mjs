import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../app/js/model.mjs';
import { chartSvg, smoothPath } from '../app/js/chart.mjs';

const NOW = new Date(2026, 10, 21, 19, 30);
const TODAY = '2026-11-21';

function makeData() {
  let data = M.createEmptyData(NOW);
  data = M.addRecord(data, { type: 'mood', score: 5, note: '早', recordedAt: '2026-11-21T09:20' }, NOW);
  data = M.addRecord(data, { type: 'mood', score: 8, note: '中', recordedAt: '2026-11-21T15:00' }, NOW);
  data = M.addRecord(data, { type: 'mood', score: 7, note: '晚', recordedAt: '2026-11-21T21:14' }, NOW);
  return data;
}

test('折线：两个点以上用三次贝塞尔平滑曲线，不再用折线', () => {
  const svg = chartSvg(makeData(), TODAY, 'mood', { height: 132 });
  assert.match(svg, /<path class="chart-line"/);
  assert.match(svg, / C /);
  assert.doesNotMatch(svg, /<polyline/);
});

test('折线：控制点不会让曲线越过相邻两点的真实分数', () => {
  const points = [
    { minutes: 0, score: 5 },
    { minutes: 100, score: 10 },
    { minutes: 200, score: 5 },
  ];
  const xOf = (minutes) => minutes;
  const yOf = (score) => 100 - score * 10;
  const d = smoothPath(points, xOf, yOf);
  const segments = [...d.matchAll(/C ([\d.-]+) ([\d.-]+), ([\d.-]+) ([\d.-]+), ([\d.-]+) ([\d.-]+)/g)];
  assert.equal(segments.length, 2);
  segments.forEach((match, index) => {
    const y1 = Number(match[2]);
    const y2 = Number(match[4]);
    const low = Math.min(yOf(points[index].score), yOf(points[index + 1].score));
    const high = Math.max(yOf(points[index].score), yOf(points[index + 1].score));
    assert.ok(y1 >= low - 0.01 && y1 <= high + 0.01, `控制点 1 越界：${y1}`);
    assert.ok(y2 >= low - 0.01 && y2 <= high + 0.01, `控制点 2 越界：${y2}`);
  });
});

test('点：每个点都有柔光晕，只有最新的一条有细环', () => {
  const svg = chartSvg(makeData(), TODAY, 'mood', { height: 132 });
  assert.equal((svg.match(/class="chart-dot-halo"/g) || []).length, 3);
  assert.equal((svg.match(/class="chart-dot-ring"/g) || []).length, 1);
  // 最新一条是 21:14 的 7 分，环用第 7 档颜色
  assert.match(svg, /class="chart-dot-ring"[^>]*stroke="#97B842"/);
  // 点本身仍带白色内圈
  assert.match(svg, /class="chart-dot"[^>]*stroke="#ffffff" stroke-width="1.5"/);
});

test('坐标：只标最早和最晚两个时间，y 轴只留 10 / 5 / 1', () => {
  const svg = chartSvg(makeData(), TODAY, 'mood', { height: 132 });
  assert.equal((svg.match(/class="chart-time-label"/g) || []).length, 2);
  assert.equal((svg.match(/class="chart-value-label"/g) || []).length, 3);
  assert.match(svg, /class="chart-value-label"[^>]*>10</);
  assert.match(svg, /class="chart-value-label"[^>]*>5</);
  assert.match(svg, /class="chart-value-label"[^>]*>1</);
  assert.doesNotMatch(svg, /chart-axis-label/);
});

test('坐标：网格线是虚线', () => {
  const svg = chartSvg(makeData(), TODAY, 'mood', { height: 132 });
  assert.equal((svg.match(/class="chart-grid"/g) || []).length, 3);
});

test('单点：只有点、没有曲线，时间标签居中一个', () => {
  let data = M.createEmptyData(NOW);
  data = M.addRecord(data, { type: 'body', score: 6, note: '', recordedAt: '2026-11-21T10:00' }, NOW);
  const svg = chartSvg(data, TODAY, 'body', { height: 132 });
  assert.doesNotMatch(svg, /chart-line/);
  assert.equal((svg.match(/class="chart-dot"/g) || []).length, 1);
  assert.equal((svg.match(/class="chart-time-label"/g) || []).length, 1);
  assert.match(svg, /class="chart-time-label"[^>]*text-anchor="middle"/);
});

test('空数据：不输出 SVG', () => {
  assert.equal(chartSvg(M.createEmptyData(NOW), TODAY, 'mood'), '');
});

test('点仍带无障碍与悬停信息', () => {
  const svg = chartSvg(makeData(), TODAY, 'mood', { height: 132 });
  assert.match(svg, /<title>09:20 · 心情 5 分 · 早<\/title>/);
  assert.match(svg, /data-clock="21:14" data-score="7"/);
});

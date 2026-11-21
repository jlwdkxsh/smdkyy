import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../app/js/model.mjs';
import { clampScore, scoreFromRatio, buildRecordInput, buildEventInput, state } from '../app/js/app.mjs';

const NOW = new Date(2026, 10, 21, 19, 30);
const TODAY = '2026-11-21';

test('app.mjs 可以在没有 DOM 的环境安全加载', () => {
  assert.equal(typeof state, 'object');
  assert.equal(state.tab, 'today');
});

test('clampScore：始终落在 1–10 的整数', () => {
  assert.equal(clampScore(0), 1);
  assert.equal(clampScore(-5), 1);
  assert.equal(clampScore(11), 10);
  assert.equal(clampScore(5.4), 5);
  assert.equal(clampScore(5.6), 6);
  assert.equal(clampScore('7'), 7);
  assert.equal(clampScore('abc'), 1);
  assert.equal(clampScore(Infinity), 1);
});

test('scoreFromRatio：拖到底 1 分、拖到顶 10 分、中间按档吸附', () => {
  assert.equal(scoreFromRatio(0), 1);
  assert.equal(scoreFromRatio(1), 10);
  assert.equal(scoreFromRatio(0.5), 6);
  assert.equal(scoreFromRatio(0.05), 1);
  assert.equal(scoreFromRatio(0.95), 10);
  assert.equal(scoreFromRatio(-3), 1);
  assert.equal(scoreFromRatio(9), 10);
});

test('buildRecordInput：首页新增不带时间，补记带日期与时刻', () => {
  const created = buildRecordInput({ mode: 'create', type: 'mood', score: 8, note: '今天' });
  assert.deepEqual(created, { type: 'mood', score: 8, note: '今天' });

  const backfill = buildRecordInput({ mode: 'backfill', type: 'body', score: 4, note: '补', date: '2026-11-20', time: '22:10' });
  assert.deepEqual(backfill, { type: 'body', score: 4, note: '补', recordedAt: '2026-11-20T22:10' });

  const fallbackTime = buildRecordInput({ mode: 'backfill', type: 'body', score: 4, note: '', date: '2026-11-20' });
  assert.equal(fallbackTime.recordedAt, '2026-11-20T12:00');

  const edited = buildRecordInput({ mode: 'edit', type: 'energy', score: 6, note: '改' });
  assert.equal(edited.recordedAt, undefined);
  assert.equal(edited.score, 6);
});

test('buildRecordInput 的输出能直接喂给 model 写入', () => {
  const data = M.createEmptyData(NOW);
  const input = buildRecordInput({ mode: 'backfill', type: 'mood', score: 7, note: '长按补记', date: '2026-11-20', time: '22:10' });
  const next = M.addRecord(data, input, NOW);
  assert.equal(next.records[0].recordedAt, '2026-11-20T22:10');
  assert.equal(next.records[0].score, 7);
});

test('buildEventInput：文字与日期', () => {
  assert.deepEqual(buildEventInput({ text: '搬家', date: TODAY }), { text: '搬家', date: TODAY });
  const data = M.addEvent(M.createEmptyData(NOW), buildEventInput({ text: '搬家', date: '2026-11-20' }), NOW);
  assert.equal(data.events[0].date, '2026-11-20');
});

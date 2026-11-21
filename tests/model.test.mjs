import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../app/js/model.mjs';

// 固定「现在」：2026-11-21 19:30（本地时间）
const NOW = new Date(2026, 10, 21, 19, 30);
const TODAY = '2026-11-21';

function baseData() {
  return M.createEmptyData(NOW);
}

test('createEmptyData：10 档、默认颜色、空记录', () => {
  const data = baseData();
  assert.equal(data.version, 1);
  assert.equal(data.settings.levels.length, 10);
  assert.deepEqual(data.settings.levels.map((l) => l.score), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(data.settings.levels[0].color, '#C64B3C');
  assert.equal(data.settings.levels[9].color, '#337A50');
  assert.deepEqual(data.records, []);
  assert.deepEqual(data.events, []);
  assert.equal(data.updatedAt, '2026-11-21T19:30');
});

test('levelColor / levelFace：自定义优先，未设置回落到默认', () => {
  const data = baseData();
  assert.equal(M.levelColor(data, 7), '#97B842');
  assert.equal(M.levelFace(data, 3), '🙁');
  data.settings.levels[6].color = '#123456';
  data.settings.levels[6].image = 'data:image/png;base64,AAAA';
  assert.equal(M.levelColor(data, 7), '#123456');
  assert.equal(M.levelFace(data, 7), 'data:image/png;base64,AAAA');
  // 越界分数被夹到 1–10
  assert.equal(M.levelColor(data, 99), '#337A50');
});

test('时间工具：本地朴素时间与日期键', () => {
  assert.equal(M.toLocalDateTime(NOW), '2026-11-21T19:30');
  assert.equal(M.todayKey(NOW), TODAY);
  assert.equal(M.dateKeyOf('2026-11-20T23:59'), '2026-11-20');
  assert.equal(M.timeKeyOf('2026-11-20T23:59'), '23:59');
  assert.equal(M.isValidDateKey('2026-02-30'), false);
  assert.equal(M.isValidDateKey('2026-02-28'), true);
  assert.equal(M.shiftDate('2026-03-01', -1), '2026-02-28');
});

test('addRecord：正常写入并取现在的时间', () => {
  const data = M.addRecord(baseData(), { type: 'mood', score: 8, note: '下午终于把方案定下来了' }, NOW);
  assert.equal(data.records.length, 1);
  const record = data.records[0];
  assert.equal(record.type, 'mood');
  assert.equal(record.score, 8);
  assert.equal(record.note, '下午终于把方案定下来了');
  assert.equal(record.recordedAt, '2026-11-21T19:30');
  assert.equal(record.createdAt, '2026-11-21T19:30');
  assert.equal(data.updatedAt, '2026-11-21T19:30');
});

test('addRecord：分数必须是 1–10 的整数', () => {
  assert.throws(() => M.addRecord(baseData(), { type: 'body', score: 0, note: '' }, NOW), /1–10/);
  assert.throws(() => M.addRecord(baseData(), { type: 'body', score: 11, note: '' }, NOW), /1–10/);
  assert.throws(() => M.addRecord(baseData(), { type: 'body', score: 5.5, note: '' }, NOW), /1–10/);
});

test('addRecord：类型与备注长度校验', () => {
  assert.throws(() => M.addRecord(baseData(), { type: 'sleep', score: 5, note: '' }, NOW), /未知的记录类型/);
  assert.throws(() => M.addRecord(baseData(), { type: 'body', score: 5, note: 'x'.repeat(501) }, NOW), /最多 500/);
  const data = M.addRecord(baseData(), { type: 'body', score: 5, note: 'x'.repeat(500) }, NOW);
  assert.equal(data.records[0].note.length, 500);
});

test('addRecord：拒绝未来日期，允许补记过去', () => {
  assert.throws(
    () => M.addRecord(baseData(), { type: 'body', score: 5, note: '', recordedAt: '2026-11-22T09:00' }, NOW),
    /还没到的日子/,
  );
  const data = M.addRecord(baseData(), { type: 'body', score: 4, note: '补记', recordedAt: '2026-11-20T22:10' }, NOW);
  assert.equal(data.records[0].recordedAt, '2026-11-20T22:10');
  assert.equal(data.records[0].createdAt, '2026-11-21T19:30');
});

test('recordsOn / eventsOn：只返回指定日期', () => {
  let data = baseData();
  data = M.addRecord(data, { type: 'mood', score: 7, note: '', recordedAt: '2026-11-21T09:00' }, NOW);
  data = M.addRecord(data, { type: 'mood', score: 5, note: '', recordedAt: '2026-11-20T09:00' }, NOW);
  data = M.addEvent(data, { text: '搬家', date: '2026-11-20' }, NOW);
  assert.equal(M.recordsOn(data, '2026-11-21').length, 1);
  assert.equal(M.recordsOn(data, '2026-11-20').length, 1);
  assert.equal(M.eventsOn(data, '2026-11-20').length, 1);
  assert.equal(M.eventsOn(data, '2026-11-21').length, 0);
  assert.equal(M.dayHasContent(data, '2026-11-19'), false);
  assert.equal(M.dayHasContent(data, '2026-11-20'), true);
});

test('dayCards：记录按时间倒序在前，事件在后', () => {
  let data = baseData();
  data = M.addRecord(data, { type: 'mood', score: 5, note: '早', recordedAt: '2026-11-21T09:00' }, NOW);
  data = M.addRecord(data, { type: 'body', score: 6, note: '晚', recordedAt: '2026-11-21T21:00' }, NOW);
  data = M.addEvent(data, { text: '搬家', date: '2026-11-21' }, NOW);
  const cards = M.dayCards(data, '2026-11-21');
  assert.deepEqual(cards.map((c) => c.kind), ['record', 'record', 'event']);
  assert.deepEqual(cards.filter((c) => c.kind === 'record').map((c) => c.note), ['晚', '早']);
});

test('typeAverage：求和 ÷ 次数，四舍五入到档位', () => {
  let data = baseData();
  for (const score of [5, 8, 7]) {
    data = M.addRecord(data, { type: 'mood', score, note: '', recordedAt: `2026-11-21T1${score}:00` }, NOW);
  }
  const stats = M.typeAverage(data, '2026-11-21', 'mood');
  assert.equal(stats.count, 3);
  assert.equal(stats.sum, 20);
  assert.ok(Math.abs(stats.avg - 20 / 3) < 1e-9);
  assert.equal(stats.level, 7);
  assert.equal(M.levelColor(data, stats.level), '#97B842');
  assert.equal(M.typeAverage(data, '2026-11-21', 'body'), null);
});

test('typeAverage：.5 进位（6.5 → 7）', () => {
  let data = baseData();
  data = M.addRecord(data, { type: 'energy', score: 6, note: '', recordedAt: '2026-11-21T08:00' }, NOW);
  data = M.addRecord(data, { type: 'energy', score: 7, note: '', recordedAt: '2026-11-21T09:00' }, NOW);
  assert.equal(M.typeAverage(data, '2026-11-21', 'energy').level, 7);
});

test('ringState：三段各自是否亮、用什么颜色', () => {
  let data = baseData();
  data = M.addRecord(data, { type: 'body', score: 6, note: '', recordedAt: '2026-11-21T08:00' }, NOW);
  data = M.addRecord(data, { type: 'mood', score: 5, note: '', recordedAt: '2026-11-21T09:00' }, NOW);
  data = M.addRecord(data, { type: 'mood', score: 8, note: '', recordedAt: '2026-11-21T10:00' }, NOW);
  data = M.addRecord(data, { type: 'mood', score: 7, note: '', recordedAt: '2026-11-21T11:00' }, NOW);
  const ring = M.ringState(data, '2026-11-21');
  assert.equal(ring.length, 3);
  assert.deepEqual(ring.map((s) => s.type), ['body', 'energy', 'mood']);
  assert.equal(ring[0].present, true);
  assert.equal(ring[0].color, M.levelColor(data, 6));
  assert.equal(ring[1].present, false);
  assert.equal(ring[1].color, null);
  assert.equal(ring[2].present, true);
  assert.equal(ring[2].level, 7);
  assert.equal(ring[2].color, M.levelColor(data, 7));
});

test('chartPoints：只含当天该类型，按时间升序，带档位颜色', () => {
  let data = baseData();
  data = M.addRecord(data, { type: 'mood', score: 7, note: '晚', recordedAt: '2026-11-21T21:14' }, NOW);
  data = M.addRecord(data, { type: 'mood', score: 5, note: '早', recordedAt: '2026-11-21T09:20' }, NOW);
  data = M.addRecord(data, { type: 'body', score: 6, note: '', recordedAt: '2026-11-21T10:00' }, NOW);
  data = M.addRecord(data, { type: 'mood', score: 8, note: '前一天', recordedAt: '2026-11-20T10:00' }, NOW);
  const points = M.chartPoints(data, '2026-11-21', 'mood');
  assert.equal(points.length, 2);
  assert.deepEqual(points.map((p) => p.clock), ['09:20', '21:14']);
  assert.deepEqual(points.map((p) => p.score), [5, 7]);
  assert.equal(points[1].color, M.levelColor(data, 7));
});

test('chartAxis：前后各留 30 分钟、最少 2 小时、不跨天', () => {
  assert.equal(M.chartAxis([]), null);
  const two = M.chartAxis([{ minutes: 9 * 60 + 20 }, { minutes: 21 * 60 + 14 }]);
  assert.deepEqual(two, { start: 530, end: 1304 });
  const early = M.chartAxis([{ minutes: 5 }]);
  assert.equal(early.start, 0);
  assert.ok(early.end - early.start >= 120);
  assert.ok(early.end <= 1440);
  const late = M.chartAxis([{ minutes: 23 * 60 + 55 }]);
  assert.equal(late.end, 1440);
  assert.ok(late.end - late.start >= 120);
});

test('updateRecord：改分数与备注，不改记录时间', () => {
  let data = M.addRecord(baseData(), { type: 'mood', score: 5, note: '原', recordedAt: '2026-11-21T09:00' }, NOW);
  const id = data.records[0].id;
  data = M.updateRecord(data, id, { score: 9, note: '改' }, NOW);
  assert.equal(data.records[0].score, 9);
  assert.equal(data.records[0].note, '改');
  assert.equal(data.records[0].recordedAt, '2026-11-21T09:00');
  assert.throws(() => M.updateRecord(data, id, { score: 99 }, NOW), /1–10/);
  assert.throws(() => M.updateRecord(data, 'nope', { score: 5 }, NOW), /不存在/);
});

test('duplicateRecord：内容照搬、时间变此刻、生成新编号', () => {
  let data = M.addRecord(baseData(), { type: 'energy', score: 7, note: '复制我', recordedAt: '2026-11-20T09:00' }, NOW);
  const source = data.records[0];
  data = M.duplicateRecord(data, source.id, NOW);
  assert.equal(data.records.length, 2);
  const copy = data.records[1];
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.score, 7);
  assert.equal(copy.note, '复制我');
  assert.equal(copy.recordedAt, '2026-11-21T19:30');
});

test('deleteRecord / deleteEvent', () => {
  let data = M.addRecord(baseData(), { type: 'mood', score: 5, note: '' }, NOW);
  data = M.addEvent(data, { text: '搬家', date: TODAY }, NOW);
  const recordId = data.records[0].id;
  const eventId = data.events[0].id;
  data = M.deleteRecord(data, recordId, NOW);
  assert.equal(data.records.length, 0);
  data = M.deleteEvent(data, eventId, NOW);
  assert.equal(data.events.length, 0);
  assert.throws(() => M.deleteRecord(data, recordId, NOW), /不存在/);
});

test('addEvent：文字必填、上限 200、拒绝未来日期', () => {
  assert.throws(() => M.addEvent(baseData(), { text: '  ', date: TODAY }, NOW), /不能为空/);
  assert.throws(() => M.addEvent(baseData(), { text: 'x'.repeat(201), date: TODAY }, NOW), /最多 200/);
  assert.throws(() => M.addEvent(baseData(), { text: '未来', date: '2026-11-22' }, NOW), /还没到的日子/);
  assert.throws(() => M.addEvent(baseData(), { text: '坏日期', date: '2026-02-30' }, NOW), /日期格式/);
  const data = M.addEvent(baseData(), { text: '  搬家  ', date: '2026-11-20' }, NOW);
  assert.equal(data.events[0].text, '搬家');
  assert.equal(data.events[0].date, '2026-11-20');
});

test('updateEvent：可改日期与文字', () => {
  let data = M.addEvent(baseData(), { text: '搬家', date: '2026-11-20' }, NOW);
  const id = data.events[0].id;
  data = M.updateEvent(data, id, { text: '搬到新家', date: '2026-11-18' }, NOW);
  assert.equal(data.events[0].text, '搬到新家');
  assert.equal(data.events[0].date, '2026-11-18');
  assert.throws(() => M.updateEvent(data, id, { date: '2027-01-01' }, NOW), /还没到的日子/);
});

test('groupAllCards：按天倒序分组，组内记录在前事件在后', () => {
  let data = baseData();
  data = M.addRecord(data, { type: 'mood', score: 5, note: '', recordedAt: '2026-11-19T09:00' }, NOW);
  data = M.addRecord(data, { type: 'body', score: 6, note: '', recordedAt: '2026-11-21T09:00' }, NOW);
  data = M.addEvent(data, { text: '搬家', date: '2026-11-21' }, NOW);
  data = M.addEvent(data, { text: '看医生', date: '2026-11-19' }, NOW);
  const groups = M.groupAllCards(data);
  assert.deepEqual(groups.map((g) => g.date), ['2026-11-21', '2026-11-19']);
  assert.deepEqual(groups[0].items.map((c) => c.kind), ['record', 'event']);
  assert.deepEqual(groups[1].items.map((c) => c.kind), ['record', 'event']);
});

test('filterCards：全部 / 单类型 / 大事件', () => {
  const cards = [
    { kind: 'record', type: 'body' },
    { kind: 'record', type: 'mood' },
    { kind: 'event' },
  ];
  assert.equal(M.filterCards(cards, 'all').length, 3);
  assert.equal(M.filterCards(cards, 'mood').length, 1);
  assert.equal(M.filterCards(cards, 'energy').length, 0);
  assert.equal(M.filterCards(cards, 'event').length, 1);
});

test('dayAverages：平均分与占位', () => {
  let data = baseData();
  data = M.addRecord(data, { type: 'body', score: 6, note: '', recordedAt: '2026-11-21T08:00' }, NOW);
  data = M.addRecord(data, { type: 'body', score: 7, note: '', recordedAt: '2026-11-21T18:00' }, NOW);
  const stats = M.dayAverages(data, '2026-11-21');
  assert.equal(stats[0].avg, 6.5);
  assert.equal(M.averageLabel(stats[0]), '6.5');
  assert.equal(stats[1].avg, null);
  assert.equal(M.averageLabel(stats[1]), '—');
});

test('formatDateLabel / formatShortDate：今天、昨天、普通日期', () => {
  assert.equal(M.formatDateLabel('2026-11-21', TODAY), '2026年11月21日 周六 · 今天');
  assert.equal(M.formatDateLabel('2026-11-20', TODAY), '2026年11月20日 周五 · 昨天');
  assert.equal(M.formatDateLabel('2026-11-18', TODAY), '2026年11月18日 周三');
  assert.equal(M.formatShortDate('2026-11-21', TODAY), '11月21日 周六 · 今天');
  assert.equal(M.weekdayOf('2026-11-21'), '周六');
});

test('monthMatrix：42 格、从周日起、标记本月与今天', () => {
  const cells = M.monthMatrix(2026, 11, TODAY);
  assert.equal(cells.length, 42);
  assert.equal(cells[0].key, '2026-11-01');
  assert.equal(cells[0].day, 1);
  const today = cells.find((cell) => cell.key === TODAY);
  assert.equal(today.isToday, true);
  assert.equal(today.inMonth, true);
  // 2026-11-01 是周日
  assert.equal(new Date(2026, 10, 1).getDay(), 0);
  assert.equal(cells.filter((cell) => !cell.inMonth).length > 0, true);
});

test('createEmptyData：包含默认外观设置', () => {
  const data = baseData();
  assert.deepEqual(data.settings.background, M.DEFAULT_BACKGROUND);
  assert.deepEqual(data.settings.appearance, M.DEFAULT_APPEARANCE);
  assert.equal(data.settings.background.mode, 'solid');
  assert.equal(data.settings.background.scrim, 30);
  assert.equal(data.settings.appearance.surfaceAlpha, 100);
});

test('normalizeData：补全旧数据里缺失的外观字段', () => {
  const old = baseData();
  delete old.settings.background;
  delete old.settings.appearance;
  const normalized = M.normalizeData(old);
  assert.deepEqual(normalized.settings.background, M.DEFAULT_BACKGROUND);
  assert.deepEqual(normalized.settings.appearance, M.DEFAULT_APPEARANCE);
  assert.equal(old.settings.background, undefined, '不修改原对象');

  const custom = baseData();
  custom.settings.background = { mode: 'image', image: null };
  const merged = M.normalizeData(custom);
  assert.equal(merged.settings.background.mode, 'image');
  assert.equal(merged.settings.background.color, M.DEFAULT_BACKGROUND.color);
});

test('validateData：外观设置校验', () => {
  const good = baseData();
  good.settings.background = {
    ...M.DEFAULT_BACKGROUND,
    mode: 'gradient',
    from: '#112233',
    to: '#445566',
    angle: 'diagonal',
  };
  assert.deepEqual(M.validateData(good), []);

  const badMode = baseData();
  badMode.settings.background = { ...M.DEFAULT_BACKGROUND, mode: 'video' };
  assert.match(M.validateData(badMode).join(), /背景模式/);

  const badColor = baseData();
  badColor.settings.background = { ...M.DEFAULT_BACKGROUND, color: 'blue' };
  assert.match(M.validateData(badColor).join(), /颜色/);

  const badScrim = baseData();
  badScrim.settings.background = { ...M.DEFAULT_BACKGROUND, scrim: 130 };
  assert.match(M.validateData(badScrim).join(), /遮罩/);

  const badImage = baseData();
  badImage.settings.background = { ...M.DEFAULT_BACKGROUND, mode: 'image', image: 'http://example.com/a.jpg' };
  assert.match(M.validateData(badImage).join(), /背景图/);

  const badAlpha = baseData();
  badAlpha.settings.appearance = { surfaceAlpha: 120 };
  assert.match(M.validateData(badAlpha).join(), /透明度/);

  const oldData = baseData();
  delete oldData.settings.background;
  delete oldData.settings.appearance;
  assert.deepEqual(M.validateData(oldData), [], '旧数据没有外观字段也能通过');
});

test('buildRecordsBackup：只含记录与大事件，不含外观', () => {
  let data = baseData();
  data = M.addRecord(data, { type: 'mood', score: 8, note: '好', recordedAt: '2026-11-21T21:14' }, NOW);
  data = M.addEvent(data, { text: '搬家', date: '2026-11-20' }, NOW);
  data.settings.levels[0].image = 'data:image/png;base64,AAAA';

  const backup = M.buildRecordsBackup(data, NOW);
  assert.equal(backup.kind, M.RECORDS_BACKUP_KIND);
  assert.equal(backup.version, 1);
  assert.equal(backup.exportedAt, '2026-11-21T19:30');
  assert.equal(backup.records.length, 1);
  assert.equal(backup.events.length, 1);
  assert.equal(backup.settings, undefined);
  assert.equal(JSON.stringify(backup).includes('data:image'), false, '导出不应包含图片');
});

test('parseRecordsBackup：接受记录备份与旧版整份数据', () => {
  const empty = M.parseRecordsBackup({ kind: M.RECORDS_BACKUP_KIND, version: 1, records: [], events: [] });
  assert.equal(empty.ok, true);
  assert.deepEqual(empty.records, []);

  const legacy = M.parseRecordsBackup(baseData());
  assert.equal(legacy.ok, true);
  assert.deepEqual(legacy.records, []);
  assert.deepEqual(legacy.events, []);

  const withData = addRecordSample();
  const parsed = M.parseRecordsBackup(withData);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.events.length, 1);
});

function addRecordSample() {
  let data = baseData();
  data = M.addRecord(data, { type: 'body', score: 6, note: '腰有点僵', recordedAt: '2026-11-21T08:00' }, NOW);
  data = M.addEvent(data, { text: '搬家', date: '2026-11-20' }, NOW);
  return data;
}

test('parseRecordsBackup：拒绝损坏或异类文件', () => {
  assert.equal(M.parseRecordsBackup(null).ok, false);
  assert.equal(M.parseRecordsBackup('x').ok, false);
  assert.equal(M.parseRecordsBackup({ kind: 'other' }).ok, false);
  assert.match(M.parseRecordsBackup({ kind: 'other' }).errors.join(), /记录备份/);

  const badRecord = M.parseRecordsBackup({
    kind: M.RECORDS_BACKUP_KIND,
    records: [{ id: 'x', type: 'mood', score: 99, note: '', recordedAt: '2026-11-21T09:00', createdAt: '2026-11-21T09:00' }],
    events: [],
  });
  assert.equal(badRecord.ok, false);
  assert.match(badRecord.errors[0], /记录/);

  const badEvent = M.parseRecordsBackup({
    kind: M.RECORDS_BACKUP_KIND,
    records: [],
    events: [{ id: 'e', text: '  ', date: '2026-11-20', createdAt: '2026-11-20T10:00' }],
  });
  assert.equal(badEvent.ok, false);
  assert.match(badEvent.errors[0], /大事件/);
});

test('resetAppearance：只重置外观，保留颜色、表情图与记录', () => {
  let data = baseData();
  data.settings.background = { ...M.DEFAULT_BACKGROUND, mode: 'image', image: 'data:image/jpeg;base64,AAAA', scrim: 80 };
  data.settings.appearance = { surfaceAlpha: 40 };
  data.settings.levels[6].color = '#123456';
  data.settings.levels[6].image = 'data:image/png;base64,BBBB';
  data = M.addRecord(data, { type: 'mood', score: 7, note: '留着', recordedAt: '2026-11-21T21:14' }, NOW);

  const reset = M.resetAppearance(data, NOW);
  assert.deepEqual(reset.settings.background, M.DEFAULT_BACKGROUND);
  assert.deepEqual(reset.settings.appearance, M.DEFAULT_APPEARANCE);
  assert.equal(reset.settings.levels[6].color, '#123456');
  assert.equal(reset.settings.levels[6].image, 'data:image/png;base64,BBBB');
  assert.equal(reset.records.length, 1);
  assert.equal(reset.updatedAt, '2026-11-21T19:30');
  assert.equal(data.settings.background.mode, 'image', '不修改原对象');
});

test('validateData：接受空数据，拒绝坏版本/坏档位/坏记录', () => {
  assert.deepEqual(M.validateData(baseData()), []);
  assert.match(M.validateData({ ...baseData(), version: 99 }).join(), /版本/);
  const brokenLevels = baseData();
  brokenLevels.settings.levels = brokenLevels.settings.levels.slice(0, 9);
  assert.match(M.validateData(brokenLevels).join(), /10 档/);
  const brokenColor = baseData();
  brokenColor.settings.levels[0].color = 'red';
  assert.match(M.validateData(brokenColor).join(), /颜色/);
  const brokenRecord = baseData();
  brokenRecord.records.push({ id: 'x', type: 'mood', score: 11, note: '', recordedAt: '2026-11-21T09:00', createdAt: '2026-11-21T09:00' });
  assert.match(M.validateData(brokenRecord).join(), /分数/);
  const brokenImage = baseData();
  brokenImage.settings.levels[0].image = 'http://example.com/a.png';
  assert.match(M.validateData(brokenImage).join(), /表情图/);
});

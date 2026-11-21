import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as M from '../app/js/model.mjs';
import { renderApp, renderSettingsPage, renderCropDialog } from '../app/js/view.mjs';
import { startServer } from '../server.mjs';

const NOW = new Date(2026, 10, 21, 19, 30);
const TODAY = '2026-11-21';

function stateWith(overrides = {}) {
  return {
    data: M.createEmptyData(NOW),
    today: TODAY,
    tab: 'settings',
    returnTab: 'today',
    calendar: { year: 2026, month: 11, selected: TODAY, chartType: 'body' },
    filter: 'all',
    sheet: null,
    menu: null,
    dayMenu: null,
    dialog: null,
    crop: null,
    info: { dataFile: 'D:\\jlrc\\data\\data.json' },
    ...overrides,
  };
}

test('设置页：10 行分数、表情、颜色、换图按钮', () => {
  const html = renderSettingsPage(stateWith());
  const rows = html.match(/class="setting-row"/g) || [];
  assert.equal(rows.length, 10);
  for (let score = 1; score <= 10; score += 1) {
    assert.match(html, new RegExp(`data-score="${score}"`));
    assert.match(html, new RegExp(`data-color="${score}"`));
    assert.match(html, new RegExp(`data-action="change-image" data-score="${score}"`));
  }
  assert.match(html, /type="color" value="#C64B3C" data-color="1"/);
  assert.match(html, /type="color" value="#337A50" data-color="10"/);
});

test('设置页：显示数据位置、上次保存时间、导出导入按钮', () => {
  const html = renderSettingsPage(stateWith());
  assert.match(html, /D:\\jlrc\\data\\data\.json/);
  assert.match(html, /上次保存/);
  assert.match(html, /11月21日 周六 · 今天 19:30/);
  assert.match(html, /data-action="export-data"/);
  assert.match(html, /data-action="import-data"/);
  assert.match(html, /data-file="image"/);
  assert.match(html, /data-file="import"/);
});

test('设置页：已设置的表情图以图片形式显示', () => {
  const data = M.createEmptyData(NOW);
  data.settings.levels[6].image = 'data:image/png;base64,AAAA';
  const html = renderSettingsPage(stateWith({ data }));
  assert.match(html, /<img class="face-img" src="data:image\/png;base64,AAAA"/);
});

test('设置页：隐藏底部导航，带返回按钮', () => {
  const html = renderApp(stateWith());
  assert.doesNotMatch(html, /<nav class="nav"/);
  assert.match(html, /data-action="close-settings"/);
  assert.doesNotMatch(html, /data-action="open-settings"/);
});

test('裁剪弹层：画布、缩放、取消与使用', () => {
  const html = renderCropDialog(
    stateWith({ crop: { score: 7, src: 'data:image/png;base64,AAAA', zoom: 1, offsetX: 0, offsetY: 0 } }),
  );
  assert.match(html, /裁剪第 7 分的表情/);
  assert.match(html, /data-crop-canvas/);
  assert.match(html, /type="range"/);
  assert.match(html, /data-action="apply-crop"/);
  assert.match(html, /data-action="cancel-crop"/);
});

test('导入确认框：说明覆盖范围，提供导入/取消', () => {
  const html = renderApp(
    stateWith({
      dialog: { kind: 'import', text: '导入会覆盖现在所有记录（备份里有 3 条状态记录、1 个大事件），并自动备份一份当前数据。确定继续吗？' },
    }),
  );
  assert.match(html, /data-action="confirm-import"/);
  assert.match(html, /data-action="cancel-import"/);
  assert.match(html, /覆盖现在所有记录/);
  assert.doesNotMatch(html, /data-action="confirm-delete"/);
});

test('GET /api/info：返回数据文件位置', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'jlrc-info-'));
  const api = await startServer({ dataDir, port: 0, quiet: true });
  try {
    const created = await fetch(`${api.url}api/data`);
    assert.equal(created.status, 200);
    const res = await fetch(`${api.url}api/info`);
    assert.equal(res.status, 200);
    const info = await res.json();
    assert.match(info.dataFile, /data\.json$/);
    assert.equal(path.dirname(info.dataFile), dataDir);
    const onDisk = JSON.parse(await readFile(info.dataFile, 'utf8'));
    assert.equal(onDisk.version, 1);
  } finally {
    await api.close();
  }
});

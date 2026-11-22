import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as M from '../app/js/model.mjs';
import { renderApp, renderSettingsPage, renderCropDialog, backgroundCss, textColorOn } from '../app/js/view.mjs';
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
  assert.match(html, /data-action="export-data">导出记录</);
  assert.match(html, /data-action="import-data">导入记录</);
  assert.match(html, /data-action="reset-appearance">恢复默认外观</);
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

test('背景 CSS：纯色 / 渐变 / 图片 三种模式', () => {
  assert.equal(backgroundCss({ mode: 'solid', color: '#123456' }), '#123456');
  assert.equal(
    backgroundCss({ mode: 'gradient', from: '#111111', to: '#222222', angle: 'vertical' }),
    'linear-gradient(180deg, #111111, #222222)',
  );
  assert.equal(
    backgroundCss({ mode: 'gradient', from: '#111111', to: '#222222', angle: 'diagonal' }),
    'linear-gradient(135deg, #111111, #222222)',
  );
  assert.equal(
    backgroundCss({ mode: 'image', image: 'data:image/jpeg;base64,AAAA', color: '#F7F6F3' }),
    'url(data:image/jpeg;base64,AAAA) center / cover no-repeat, #F7F6F3',
  );
  assert.equal(backgroundCss({ mode: 'image', image: null, color: '#ABCDEF' }), '#ABCDEF');
  assert.equal(backgroundCss(), '#F7F6F3');
  assert.equal(backgroundCss({}), '#F7F6F3');
});

test('设置页：外观块默认纯色，三种背景模式可选', () => {
  const html = renderSettingsPage(stateWith());
  assert.match(html, /<h2 class="section-title">外观<\/h2>/);
  assert.match(html, /class="bg-preview"/);
  assert.match(html, /class="segmented__item is-active" role="tab" aria-selected="true" data-action="bg-mode" data-mode="solid"/);
  assert.match(html, /data-action="bg-mode" data-mode="gradient"/);
  assert.match(html, /data-action="bg-mode" data-mode="image"/);
  assert.match(html, /data-bg-color="color"/);
  assert.match(html, /data-file="background"/);
  assert.match(html, /background:#F7F6F3/);
});

test('设置页：渐变模式显示两个颜色与方向', () => {
  const data = M.createEmptyData(NOW);
  data.settings.background = { ...M.DEFAULT_BACKGROUND, mode: 'gradient' };
  const html = renderSettingsPage(stateWith({ data }));
  assert.match(html, /data-bg-color="from"/);
  assert.match(html, /data-bg-color="to"/);
  assert.match(html, /data-bg-angle/);
  assert.match(html, />上下</);
  assert.match(html, /linear-gradient\(180deg/);
});

test('设置页：图片模式显示选择图片与清除', () => {
  const empty = M.createEmptyData(NOW);
  empty.settings.background = { ...M.DEFAULT_BACKGROUND, mode: 'image', image: null };
  const emptyHtml = renderSettingsPage(stateWith({ data: empty }));
  assert.match(emptyHtml, /data-action="bg-image">选择图片/);
  assert.doesNotMatch(emptyHtml, /data-action="bg-clear"/);

  const withImage = M.createEmptyData(NOW);
  withImage.settings.background = {
    ...M.DEFAULT_BACKGROUND,
    mode: 'image',
    image: 'data:image/jpeg;base64,AAAA',
  };
  const html = renderSettingsPage(stateWith({ data: withImage }));
  assert.match(html, /data-action="bg-image"/);
  assert.match(html, /data-action="bg-clear">清除图片/);
  assert.match(html, /class="bg-image-thumb" style="background:url\(data:image\/jpeg;base64,AAAA\)/);
});

test('设置页：按钮颜色可调，文字颜色自动选深/浅', () => {
  const html = renderSettingsPage(stateWith());
  assert.match(html, /data-button-color/);
  assert.match(html, /<input type="color" value="#2F6B4F" data-button-color>/);
  assert.equal(textColorOn('#2F6B4F'), '#FFFFFF');
  assert.equal(textColorOn('#F5C518'), '#1F2328');
  assert.equal(textColorOn('nope'), '#FFFFFF');
  assert.equal(textColorOn(), '#FFFFFF');
});

test('设置页：卡片透明度滑块，遮罩滑块只在图片模式出现', () => {
  const solid = renderSettingsPage(stateWith());
  assert.match(solid, /value="100" data-appearance="surfaceAlpha"/);
  assert.match(solid, /class="range-field__value">100%/);
  assert.doesNotMatch(solid, /data-appearance="scrim"/);

  const data = M.createEmptyData(NOW);
  data.settings.background = { ...M.DEFAULT_BACKGROUND, mode: 'image', image: 'data:image/jpeg;base64,AAAA' };
  data.settings.appearance = { ...M.DEFAULT_APPEARANCE, surfaceAlpha: 60 };
  const image = renderSettingsPage(stateWith({ data }));
  assert.match(image, /value="60" data-appearance="surfaceAlpha"/);
  assert.match(image, /data-appearance="scrim"/);
  assert.match(image, /value="30" data-appearance="scrim"/);
  assert.match(image, /class="range-field__value">30%/);
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

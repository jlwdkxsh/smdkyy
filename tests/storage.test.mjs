import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../app/js/model.mjs';
import {
  createServerStorage,
  createLocalStorage,
  pickBackendKind,
  pickExportMode,
  BACKUP_KEEP,
} from '../app/js/storage.mjs';

const NOW = new Date(2026, 10, 21, 19, 30);

function memoryKv() {
  const map = new Map();
  return {
    map,
    async get(key) {
      return map.get(key);
    },
    async set(key, value) {
      map.set(key, value);
    },
  };
}

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, options) => {
    calls.push({ url, options });
    return handler(url, options);
  };
  fn.calls = calls;
  return fn;
}

// ---------------------------------------------------------------- 桌面：本地服务

test('server 存储：读取数据，失败时报错', async () => {
  const data = M.createEmptyData(NOW);
  const okFetch = fakeFetch(() => jsonResponse(data));
  const storage = createServerStorage(okFetch);
  assert.deepEqual(await storage.load(), data);
  assert.equal(okFetch.calls[0].url, '/api/data');

  const badFetch = fakeFetch(() => jsonResponse({}, 500));
  await assert.rejects(() => createServerStorage(badFetch).load(), /读取本地数据失败/);
});

test('server 存储：保存用 PUT，服务端错误信息透传', async () => {
  const data = M.createEmptyData(NOW);
  const okFetch = fakeFetch(() => jsonResponse({ ok: true }));
  const storage = createServerStorage(okFetch);
  assert.equal(await storage.save(data), true);
  assert.equal(okFetch.calls[0].options.method, 'PUT');
  assert.equal(JSON.parse(okFetch.calls[0].options.body).version, 1);

  const badFetch = fakeFetch(() => jsonResponse({ errors: ['数据版本不支持'] }, 400));
  await assert.rejects(() => createServerStorage(badFetch).save(data), /版本/);
});

test('server 存储：导入时保留外观，只替换记录与事件', async () => {
  let current = M.createEmptyData(NOW);
  current.settings.levels[6].color = '#123456';
  current.settings.background = { ...M.DEFAULT_BACKGROUND, mode: 'image', image: 'data:image/webp;base64,AAAA' };
  const fetchImpl = fakeFetch(() => jsonResponse({ ok: true }));
  const storage = createServerStorage(fetchImpl);

  const records = [
    { id: 'rec_1', type: 'mood', score: 8, note: '导入的', recordedAt: '2026-11-20T21:00', createdAt: '2026-11-21T10:00' },
  ];
  const merged = await storage.importRecords(records, [], current);

  assert.equal(fetchImpl.calls[0].url, '/api/import');
  const body = JSON.parse(fetchImpl.calls[0].options.body);
  assert.equal(body.records.length, 1);
  assert.equal(body.settings.background.mode, 'image');
  assert.equal(body.settings.levels[6].color, '#123456');
  assert.equal(merged.records[0].note, '导入的');
});

test('server 存储：info 失败时返回 null，不抛错', async () => {
  const storage = createServerStorage(fakeFetch(() => jsonResponse({ ok: false }, 500)));
  assert.equal(await storage.info(), null);
});

// ---------------------------------------------------------------- 手机：App 内存储

test('local 存储：首次打开创建默认数据并写入', async () => {
  const kv = memoryKv();
  const storage = createLocalStorage(kv);
  const data = await storage.load();
  assert.equal(data.version, 1);
  assert.equal(data.settings.levels.length, 10);
  assert.deepEqual(data.settings.background, M.DEFAULT_BACKGROUND);
  assert.ok(kv.map.get('data'), '应该已经写入存储');
});

test('local 存储：读取旧数据时补全外观字段', async () => {
  const kv = memoryKv();
  const old = M.createEmptyData(NOW);
  delete old.settings.background;
  delete old.settings.appearance;
  await kv.set('data', old);

  const loaded = await createLocalStorage(kv).load();
  assert.deepEqual(loaded.settings.background, M.DEFAULT_BACKGROUND);
  assert.deepEqual(loaded.settings.appearance, M.DEFAULT_APPEARANCE);
});

test('local 存储：保存后能读回', async () => {
  const kv = memoryKv();
  const storage = createLocalStorage(kv);
  let data = await storage.load();
  data = M.addRecord(data, { type: 'mood', score: 8, note: '手机记的' }, NOW);
  await storage.save(data);

  const reloaded = await createLocalStorage(kv).load();
  assert.equal(reloaded.records.length, 1);
  assert.equal(reloaded.records[0].note, '手机记的');
});

test('local 存储：导入替换记录、保留外观、并写备份', async () => {
  const kv = memoryKv();
  const storage = createLocalStorage(kv);
  let current = await storage.load();
  current.settings.levels[6].color = '#123456';
  current = M.addRecord(current, { type: 'body', score: 4, note: '旧的' }, NOW);
  await storage.save(current);

  const records = [
    { id: 'rec_9', type: 'energy', score: 7, note: '导入的', recordedAt: '2026-11-20T09:00', createdAt: '2026-11-21T10:00' },
  ];
  const merged = await storage.importRecords(records, [], current);

  assert.equal(merged.records.length, 1);
  assert.equal(merged.records[0].note, '导入的');
  assert.equal(merged.settings.levels[6].color, '#123456');

  const backups = await storage.readBackups();
  assert.equal(backups.length, 1);
  assert.equal(backups[0].data.records[0].note, '旧的');

  const stored = await kv.get('data');
  assert.equal(stored.records[0].note, '导入的');
});

test('local 存储：备份只保留最近 10 份', async () => {
  const kv = memoryKv();
  const storage = createLocalStorage(kv);
  const current = await storage.load();

  for (let index = 0; index < BACKUP_KEEP + 2; index += 1) {
    await storage.importRecords([], [], current);
  }

  const backups = await storage.readBackups();
  assert.equal(backups.length, BACKUP_KEEP);
});

// ---------------------------------------------------------------- 后端选择

test('后端选择：原生壳用本地存储，网页用本地服务', () => {
  assert.equal(pickBackendKind({ capacitor: { isNativePlatform: () => true } }), 'local');
  assert.equal(pickBackendKind({ capacitor: { isNativePlatform: () => false } }), 'server');
  assert.equal(pickBackendKind({ isNative: true }), 'local');
  assert.equal(pickBackendKind({}), 'server');
  assert.equal(pickBackendKind(), 'server');
});

test('导出方式：有文件插件走系统分享，否则走浏览器下载', () => {
  assert.equal(pickExportMode({ capacitor: { Plugins: { Filesystem: {} } } }), 'share');
  assert.equal(pickExportMode({ capacitor: { Plugins: {} } }), 'download');
  assert.equal(pickExportMode({ capacitor: null }), 'download');
  assert.equal(pickExportMode({}), 'download');
  assert.equal(pickExportMode(), 'download');
});

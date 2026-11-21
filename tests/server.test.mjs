import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startServer } from '../server.mjs';
import { createEmptyData, addRecord } from '../app/js/model.mjs';

const NOW = new Date(2026, 10, 21, 19, 30);

async function withServer(run) {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'jlrc-test-'));
  const api = await startServer({ dataDir, port: 0, quiet: true });
  try {
    await run({ api, dataDir });
  } finally {
    await api.close();
  }
}

async function apiFetch(api, pathname, options) {
  return fetch(`${api.url.replace(/\/$/, '')}${pathname}`, options);
}

test('GET /api/data：首次访问自动创建 data.json 并返回 10 档设置', async () => {
  await withServer(async ({ api, dataDir }) => {
    const res = await apiFetch(api, '/api/data');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.version, 1);
    assert.equal(data.settings.levels.length, 10);
    const onDisk = JSON.parse(await readFile(path.join(dataDir, 'data.json'), 'utf8'));
    assert.equal(onDisk.version, 1);
    assert.deepEqual(await readdir(dataDir).then((list) => list.filter((n) => n.endsWith('.tmp'))), []);
  });
});

test('静态资源：可读取前端脚本，且没有目录穿越', async () => {
  await withServer(async ({ api }) => {
    const js = await apiFetch(api, '/js/model.mjs');
    assert.equal(js.status, 200);
    assert.match(js.headers.get('content-type') || '', /javascript/);
    assert.match(await js.text(), /export function addRecord/);

    const evil = await apiFetch(api, '/..%2F..%2Fserver.mjs');
    assert.equal(evil.status, 404);
  });
});

test('PUT /api/data：合法数据落盘、原子写不留临时文件', async () => {
  await withServer(async ({ api, dataDir }) => {
    let data = createEmptyData(NOW);
    data = addRecord(data, { type: 'mood', score: 8, note: '测试落盘' }, NOW);
    const res = await apiFetch(api, '/api/data', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    assert.equal(res.status, 200);
    const payload = await res.json();
    assert.equal(payload.ok, true);

    const saved = JSON.parse(await readFile(path.join(dataDir, 'data.json'), 'utf8'));
    assert.equal(saved.records.length, 1);
    assert.equal(saved.records[0].note, '测试落盘');
    const names = await readdir(dataDir);
    assert.equal(names.some((name) => name.endsWith('.tmp')), false);
  });
});

test('PUT /api/data：非法数据返回 400 且不覆盖原文件', async () => {
  await withServer(async ({ api, dataDir }) => {
    const good = createEmptyData(NOW);
    await apiFetch(api, '/api/data', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(good),
    });
    const before = await readFile(path.join(dataDir, 'data.json'), 'utf8');

    const bad = { ...good, version: 99 };
    const res = await apiFetch(api, '/api/data', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(bad),
    });
    assert.equal(res.status, 400);
    const payload = await res.json();
    assert.equal(payload.ok, false);
    assert.ok(payload.errors.length > 0);

    const after = await readFile(path.join(dataDir, 'data.json'), 'utf8');
    assert.equal(after, before);
  });
});

test('PUT /api/data：非 JSON 请求体返回 400', async () => {
  await withServer(async ({ api }) => {
    const res = await apiFetch(api, '/api/data', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: '{oops',
    });
    assert.equal(res.status, 400);
    const payload = await res.json();
    assert.match(payload.errors.join(), /JSON/);
  });
});

test('POST /api/import：先备份旧数据，再整体覆盖', async () => {
  await withServer(async ({ api, dataDir }) => {
    const initial = createEmptyData(NOW);
    await apiFetch(api, '/api/data', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(initial),
    });

    const imported = addRecord(createEmptyData(NOW), { type: 'body', score: 4, note: '导入的记录' }, NOW);
    const res = await apiFetch(api, '/api/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(imported),
    });
    assert.equal(res.status, 200);
    const payload = await res.json();
    assert.equal(payload.ok, true);
    assert.ok(payload.backup && payload.backup.includes('backup'));

    const saved = JSON.parse(await readFile(path.join(dataDir, 'data.json'), 'utf8'));
    assert.equal(saved.records[0].note, '导入的记录');
    const backups = await readdir(path.join(dataDir, 'backup'));
    assert.equal(backups.length, 1);
    const backup = JSON.parse(await readFile(path.join(dataDir, 'backup', backups[0]), 'utf8'));
    assert.equal(backup.records.length, 0);
  });
});

test('POST /api/import：损坏文件被拒绝且不影响现有数据与备份', async () => {
  await withServer(async ({ api, dataDir }) => {
    const initial = createEmptyData(NOW);
    await apiFetch(api, '/api/data', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(initial),
    });
    const before = await readFile(path.join(dataDir, 'data.json'), 'utf8');

    const res = await apiFetch(api, '/api/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version: 1, settings: {}, records: 'nope' }),
    });
    assert.equal(res.status, 400);
    assert.equal(await readFile(path.join(dataDir, 'data.json'), 'utf8'), before);
    assert.deepEqual(await readdir(path.join(dataDir, 'backup')), []);
  });
});

test('备份只保留最近 10 份', async () => {
  await withServer(async ({ api, dataDir }) => {
    await apiFetch(api, '/api/data');
    for (let index = 0; index < 12; index += 1) {
      const data = addRecord(createEmptyData(NOW), { type: 'mood', score: 5, note: `第 ${index} 次`, recordedAt: `2026-11-21T0${index % 10}:00` }, NOW);
      const res = await apiFetch(api, '/api/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      assert.equal(res.status, 200);
    }
    const backups = (await readdir(path.join(dataDir, 'backup'))).filter((name) => name.endsWith('.json'));
    assert.equal(backups.length, 10);
    const saved = JSON.parse(await readFile(path.join(dataDir, 'data.json'), 'utf8'));
    assert.equal(saved.records[0].note, '第 11 次');
  });
});

test('GET /api/export：返回可下载的完整 JSON', async () => {
  await withServer(async ({ api }) => {
    await apiFetch(api, '/api/data');
    const res = await apiFetch(api, '/api/export');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition') || '', /attachment/);
    const data = await res.json();
    assert.equal(data.settings.levels.length, 10);
  });
});

test('未知接口返回 404，错误方法被拒绝', async () => {
  await withServer(async ({ api }) => {
    const missing = await apiFetch(api, '/api/nope');
    assert.equal(missing.status, 404);
    const wrongMethod = await apiFetch(api, '/api/data', { method: 'DELETE' });
    assert.equal(wrongMethod.status, 404);
    assert.equal((await wrongMethod.json()).ok, false);
  });
});

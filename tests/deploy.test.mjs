import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';
import { createEmptyData, addRecord } from '../app/js/model.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const NOW = new Date(2026, 10, 21, 19, 30);

test('启动器：存在，并且指向 server.mjs 与随包 Node', async () => {
  const text = await readFile(path.join(ROOT, '启动.bat'), 'utf8');
  assert.match(text, /server\.mjs/);
  assert.match(text, /runtime\\node\.exe/);
  assert.match(text, /chcp 65001/);
});

test('随包 Node 运行时存在且可用', async () => {
  const info = await stat(path.join(ROOT, 'runtime', 'node.exe'));
  assert.ok(info.size > 10 * 1024 * 1024, 'node.exe 应大于 10MB');
});

test('入口页面：标题、入口脚本、样式表都在', async () => {
  const html = await readFile(path.join(ROOT, 'app', 'index.html'), 'utf8');
  assert.match(html, /<title>记录<\/title>/);
  assert.match(html, /src="\/js\/app\.mjs"/);
  assert.match(html, /href="\/styles\.css"/);
  assert.match(html, /id="app"/);
});

test('所有前端资源都能被本地服务正确返回', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'jlrc-static-'));
  const api = await startServer({ dataDir, port: 0, quiet: true });
  try {
    const files = ['/', '/styles.css', '/js/app.mjs', '/js/view.mjs', '/js/model.mjs', '/js/chart.mjs', '/js/ring.mjs'];
    for (const file of files) {
      const res = await fetch(`${api.url}${file.replace(/^\//, '')}`);
      assert.equal(res.status, 200, `${file} 应返回 200`);
    }
    const index = await fetch(api.url).then((res) => res.text());
    assert.match(index, /记录/);
  } finally {
    await api.close();
  }
});

test('服务重启后数据仍在（关闭窗口/重启电脑不丢）', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'jlrc-restart-'));
  let api = await startServer({ dataDir, port: 0, quiet: true });
  let data = createEmptyData(NOW);
  data = addRecord(data, { type: 'mood', score: 8, note: '关机前记的', recordedAt: '2026-11-21T21:14' }, NOW);
  try {
    const put = await fetch(`${api.url}api/data`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    assert.equal(put.status, 200);
  } finally {
    await api.close();
  }

  api = await startServer({ dataDir, port: 0, quiet: true });
  try {
    const res = await fetch(`${api.url}api/data`);
    const loaded = await res.json();
    assert.equal(loaded.records.length, 1);
    assert.equal(loaded.records[0].note, '关机前记的');
    assert.equal(loaded.records[0].recordedAt, '2026-11-21T21:14');
  } finally {
    await api.close();
  }
});

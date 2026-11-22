// 本地服务：只监听 127.0.0.1，提供网页静态文件与数据读写接口。
// 数据文件：<dataDir>/data.json，写入采用「临时文件 + 原子替换」。

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, readFile, writeFile, rename, readdir, unlink, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createEmptyData, validateData, toLocalDateTime } from './app/js/model.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(ROOT, 'app');
const MAX_BODY = 8 * 1024 * 1024;
const BACKUP_KEEP = 10;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) {
      const error = new Error('请求体过大');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readDataFile(file) {
  try {
    const text = await readFile(file, 'utf8');
    return { text, data: JSON.parse(text) };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    if (error instanceof SyntaxError) {
      const parseError = new Error('数据文件不是合法 JSON');
      parseError.statusCode = 500;
      throw parseError;
    }
    throw error;
  }
}

/** 先写临时文件并落盘，再原子替换，避免写一半断电损坏数据 */
async function writeAtomic(file, text) {
  const temp = `${file}.tmp`;
  const handle = await (await import('node:fs/promises')).open(temp, 'w');
  try {
    await handle.writeFile(text, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temp, file);
}

function fileStamp(date = new Date()) {
  const base = toLocalDateTime(date).replace('T', '-').replace(/:/g, '-');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  const rnd = Math.random().toString(36).slice(2, 5);
  return `${base}-${ms}${rnd}`;
}

async function backupCurrent(dataDir, dataFile) {
  const current = await readDataFile(dataFile);
  if (!current) return null;
  const backupDir = path.join(dataDir, 'backup');
  await mkdir(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `data-${fileStamp()}.json`);
  await writeFile(backupFile, current.text, 'utf8');
  // 只保留最近 10 份
  const files = (await readdir(backupDir)).filter((name) => name.startsWith('data-') && name.endsWith('.json')).sort();
  for (const name of files.slice(0, Math.max(0, files.length - BACKUP_KEEP))) {
    await unlink(path.join(backupDir, name)).catch(() => {});
  }
  return backupFile;
}

async function serveStatic(req, res, appDir, pathname) {
  let relative = decodeURIComponent(pathname);
  if (relative === '/' || relative === '') relative = '/index.html';
  const filePath = path.join(appDir, relative);
  const resolved = path.resolve(filePath);
  if (resolved !== path.resolve(appDir) && !resolved.startsWith(path.resolve(appDir) + path.sep)) {
    sendJson(res, 404, { ok: false, error: '未找到' });
    return;
  }
  try {
    const info = await stat(resolved);
    if (!info.isFile()) throw Object.assign(new Error('not file'), { code: 'ENOENT' });
    const body = await readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch {
    sendJson(res, 404, { ok: false, error: '未找到' });
  }
}

async function listen(server, port, host) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await new Promise((resolve, reject) => {
        const onError = (error) => {
          server.removeListener('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          server.removeListener('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port === 0 ? 0 : port + attempt, host);
      });
      return server.address().port;
    } catch (error) {
      if (error.code !== 'EADDRINUSE' || port === 0) throw error;
    }
  }
  throw new Error('找不到可用端口');
}

export async function startServer(options = {}) {
  const dataDir = options.dataDir || path.join(ROOT, 'data');
  const appDir = options.appDir || APP_DIR;
  const host = options.host || '127.0.0.1';
  const requestedPort = options.port === undefined ? 4173 : options.port;
  const quiet = Boolean(options.quiet);

  await mkdir(dataDir, { recursive: true });
  await mkdir(path.join(dataDir, 'backup'), { recursive: true });
  const dataFile = path.join(dataDir, 'data.json');

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${host}`);
    const pathname = url.pathname;

    try {
      if (pathname === '/api/health') {
        sendJson(res, 200, { ok: true, version: 1 });
        return;
      }

      if (pathname === '/api/info' && req.method === 'GET') {
        sendJson(res, 200, { ok: true, dataFile, dataDir, appDir });
        return;
      }

      if (pathname === '/api/data' && req.method === 'GET') {
        const current = await readDataFile(dataFile);
        if (current) {
          sendJson(res, 200, current.data);
          return;
        }
        const empty = createEmptyData();
        await writeAtomic(dataFile, JSON.stringify(empty, null, 2));
        sendJson(res, 200, empty);
        return;
      }

      if (pathname === '/api/data' && (req.method === 'PUT' || req.method === 'POST')) {
        const body = await readBody(req);
        let data;
        try {
          data = JSON.parse(body);
        } catch {
          sendJson(res, 400, { ok: false, errors: ['请求内容不是合法 JSON'] });
          return;
        }
        const errors = validateData(data);
        if (errors.length) {
          sendJson(res, 400, { ok: false, errors });
          return;
        }
        await writeAtomic(dataFile, JSON.stringify(data, null, 2));
        sendJson(res, 200, { ok: true, updatedAt: data.updatedAt });
        return;
      }

      if (pathname === '/api/import' && req.method === 'POST') {
        const body = await readBody(req);
        let data;
        try {
          data = JSON.parse(body);
        } catch {
          sendJson(res, 400, { ok: false, errors: ['请求内容不是合法 JSON'] });
          return;
        }
        const errors = validateData(data);
        if (errors.length) {
          sendJson(res, 400, { ok: false, errors });
          return;
        }
        const backup = await backupCurrent(dataDir, dataFile);
        await writeAtomic(dataFile, JSON.stringify(data, null, 2));
        sendJson(res, 200, { ok: true, backup, updatedAt: data.updatedAt });
        return;
      }

      if (pathname === '/api/export' && req.method === 'GET') {
        const current = await readDataFile(dataFile);
        const data = current ? current.data : createEmptyData();
        const text = JSON.stringify(data, null, 2);
        const name = `jlrc-backup-${toLocalDateTime().replace('T', '-').replace(/:/g, '')}.json`;
        res.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': `attachment; filename="${name}"`,
          'content-length': Buffer.byteLength(text),
          'cache-control': 'no-store',
        });
        res.end(text);
        return;
      }

      if (pathname.startsWith('/api/')) {
        sendJson(res, 404, { ok: false, error: '接口不存在' });
        return;
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        sendJson(res, 405, { ok: false, error: '方法不允许' });
        return;
      }

      await serveStatic(req, res, appDir, pathname);
    } catch (error) {
      const status = error.statusCode || 500;
      if (!quiet) console.error('[server]', error);
      sendJson(res, status, { ok: false, errors: [error.message || '服务器内部错误'] });
    }
  });

  const port = await listen(server, requestedPort, host);
  const url = `http://${host}:${port}/`;

  if (!quiet) {
    console.log('---------------------------------------------');
    console.log(' 记录自己 已启动');
    console.log(` 地址：${url}`);
    console.log(` 数据：${dataFile}`);
    console.log(' 关闭这个窗口即可停止；数据已经保存，不会丢。');
    console.log('---------------------------------------------');
  }

  const api = {
    server,
    port,
    url,
    dataDir,
    dataFile,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };

  if (options.autoOpen) {
    try {
      const command = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
      const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
      spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
    } catch {
      /* 打不开浏览器时用户手动访问 URL 即可 */
    }
  }

  return api;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const port = Number(process.env.JLRC_PORT || 4173);
  const dataDir = process.env.JLRC_DATA_DIR || undefined;
  startServer({ port, dataDir, autoOpen: !process.env.JLRC_NO_OPEN })
    .then((api) => {
      api.server.on('error', (error) => {
        console.error('服务出错：', error.message);
      });
    })
    .catch((error) => {
      console.error('启动失败：', error.message);
      process.exitCode = 1;
    });
}

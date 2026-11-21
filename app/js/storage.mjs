// 存储层：同一套接口，两个后端。
// - server：桌面端，读写电脑上的本地服务（data/data.json）
// - local：手机端，读写 App 内的 IndexedDB（无需任何服务器）

import * as M from './model.mjs';

export const BACKUP_KEEP = 10;

function toError(message, fallback) {
  return new Error(message || fallback);
}

// ---------------------------------------------------------------- 桌面：本地服务

export function createServerStorage(fetchImpl = (...args) => fetch(...args)) {
  return {
    kind: 'server',

    async load() {
      const response = await fetchImpl('/api/data');
      if (!response.ok) throw toError(`读取本地数据失败（${response.status}）`, '读取本地数据失败');
      return response.json();
    },

    async save(data) {
      const response = await fetchImpl('/api/data', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw toError((payload.errors && payload.errors[0]) || '保存失败', '保存失败');
      return true;
    },

    async importRecords(records, events, current) {
      const merged = {
        ...current,
        records,
        events,
        updatedAt: M.toLocalDateTime(new Date()),
      };
      const response = await fetchImpl('/api/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(merged),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw toError((payload.errors && payload.errors[0]) || '导入失败', '导入失败');
      return merged;
    },

    async info() {
      try {
        const response = await fetchImpl('/api/info');
        if (!response.ok) return null;
        return response.json();
      } catch {
        return null;
      }
    },
  };
}

// ---------------------------------------------------------------- 手机：App 内存储

/** kv 只需要两个方法：get(key) / set(key, value) */
export function createLocalStorage(kv) {
  return {
    kind: 'local',

    async load() {
      const stored = await kv.get('data');
      if (!stored) {
        const empty = M.createEmptyData();
        await kv.set('data', empty);
        return empty;
      }
      return M.normalizeData(stored);
    },

    async save(data) {
      await kv.set('data', data);
      return true;
    },

    async importRecords(records, events, current) {
      const backup = { at: M.toLocalDateTime(new Date()), data: current };
      const backups = (await kv.get('backups')) || [];
      await kv.set('backups', [backup, ...backups].slice(0, BACKUP_KEEP));

      const merged = {
        ...current,
        records,
        events,
        updatedAt: M.toLocalDateTime(new Date()),
      };
      await kv.set('data', merged);
      return merged;
    },

    async info() {
      return { dataFile: 'App 内存储（IndexedDB）', dataDir: 'App 内存储' };
    },

    async readBackups() {
      return (await kv.get('backups')) || [];
    },
  };
}

/** 浏览器 / WebView 里的 key-value 适配（IndexedDB） */
export function createBrowserKv(name = 'jlrc') {
  const open = () =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('kv')) request.result.createObjectStore('kv');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('无法打开 App 内存储'));
    });

  return {
    async get(key) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readonly');
        const request = tx.objectStore('kv').get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('读取失败'));
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error || new Error('读取失败'));
        };
      });
    },

    async set(key, value) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(value, key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error || new Error('保存失败'));
        };
      });
    },
  };
}

/** 选择后端：App 内（Capacitor 原生壳）用本地存储，否则走本地服务 */
export function pickBackendKind(env = {}) {
  const native =
    env.isNative === true ||
    Boolean(env.capacitor && typeof env.capacitor.isNativePlatform === 'function' && env.capacitor.isNativePlatform());
  return native ? 'local' : 'server';
}

/** 导出方式：有 Capacitor 文件插件时调系统分享，否则走浏览器下载 */
export function pickExportMode(env = {}) {
  const capacitor = env.capacitor;
  const plugins = capacitor && capacitor.Plugins;
  return plugins && plugins.Filesystem ? 'share' : 'download';
}

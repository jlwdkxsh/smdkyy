// 浏览器端逻辑：状态、事件绑定、与本地服务读写数据。
// 纯计算部分导出为函数，便于在 Node 里做单元测试；DOM 相关代码只在浏览器中执行。

import * as M from './model.mjs';
import { renderApp, backgroundCss } from './view.mjs';

const hasDom = typeof document !== 'undefined';
const appEl = hasDom ? document.getElementById('app') : null;
const toastEl = hasDom ? document.getElementById('toast') : null;

export const state = {
  data: null,
  today: M.todayKey(),
  tab: 'today',
  returnTab: 'today',
  calendar: { year: 2026, month: 11, selected: '', chartType: 'body' },
  todayType: 'body',
  filter: 'all',
  sheet: null,
  menu: null,
  dialog: null,
  dayMenu: null,
  crop: null,
  cropScore: 1,
  pendingImport: null,
  info: null,
  suppressDayClick: false,
};

let toastTimer = null;

// ---------------------------------------------------------------- 纯计算（可测试）

/** 把任意值夹到 1–10 的整数分 */
export function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.max(1, Math.min(10, Math.round(number)));
}

/** 拖拽比例（0 底部、1 顶部）换算成分数 */
export function scoreFromRatio(ratio) {
  const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
  return clampScore(1 + Math.round(clamped * 9));
}

/** 由表单状态生成 addRecord / updateRecord 需要的输入 */
export function buildRecordInput(sheet) {
  const input = {
    type: sheet.type,
    score: clampScore(sheet.score),
    note: typeof sheet.note === 'string' ? sheet.note : '',
  };
  if (sheet.mode === 'backfill') {
    input.recordedAt = `${sheet.date}T${sheet.time || '12:00'}`;
  }
  return input;
}

/** 由表单状态生成 addEvent / updateEvent 需要的输入 */
export function buildEventInput(sheet) {
  return {
    text: typeof sheet.text === 'string' ? sheet.text : '',
    date: sheet.date,
  };
}

// ---------------------------------------------------------------- 提示与渲染

function showToast(message, isError = false) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.toggle('toast--error', Boolean(isError));
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 2400);
}

function render() {
  if (!appEl) return;
  appEl.innerHTML = renderApp(state);
  const slider = appEl.querySelector('[data-slider]');
  if (slider) attachSlider(slider);
  attachDayCells();
  if (state.crop) setupCropCanvas();
  applyBackground();
  applyAppearance();
}

function applyAppearance() {
  if (!state.data) return;
  const appearance = { ...M.DEFAULT_APPEARANCE, ...(state.data.settings.appearance || {}) };
  const alpha = Number.isFinite(appearance.surfaceAlpha) ? appearance.surfaceAlpha : 100;
  document.documentElement.style.setProperty('--surface-alpha', String(alpha / 100));
}

function applyRangeValue(range) {
  if (!state.data) return;
  const key = range.dataset.appearance;
  const value = Math.max(0, Math.min(100, Math.round(Number(range.value) || 0)));
  if (key === 'surfaceAlpha') {
    state.data.settings.appearance = {
      ...M.DEFAULT_APPEARANCE,
      ...(state.data.settings.appearance || {}),
      surfaceAlpha: value,
    };
    document.documentElement.style.setProperty('--surface-alpha', String(value / 100));
  } else if (key === 'scrim') {
    state.data.settings.background = {
      ...M.DEFAULT_BACKGROUND,
      ...(state.data.settings.background || {}),
      scrim: value,
    };
    document.documentElement.style.setProperty('--scrim', String(value / 100));
  }
  const label = range.closest('.range-field') && range.closest('.range-field').querySelector('.range-field__value');
  if (label) label.textContent = `${value}%`;
}

async function persistAppearance() {
  if (!state.data) return;
  const next = structuredClone(state.data);
  next.updatedAt = M.toLocalDateTime(new Date());
  await persist(next, null);
}

function applyBackground() {
  const backdrop = document.getElementById('backdrop');
  if (!backdrop || !state.data) return;
  const bg = { ...M.DEFAULT_BACKGROUND, ...(state.data.settings.background || {}) };
  backdrop.style.background = backgroundCss(bg);
  const scrim = bg.mode === 'image' ? Number(bg.scrim) || 0 : 0;
  document.documentElement.style.setProperty('--scrim', String(scrim / 100));
}

async function updateBackground(patch) {
  const next = structuredClone(state.data);
  next.settings.background = {
    ...M.DEFAULT_BACKGROUND,
    ...(next.settings.background || {}),
    ...patch,
  };
  next.updatedAt = M.toLocalDateTime(new Date());
  const ok = await persist(next);
  if (ok) render();
}

async function resetAppearance() {
  const next = M.resetAppearance(state.data, new Date());
  const ok = await persist(next, '已恢复默认外观');
  if (ok) render();
}

function nowClock() {
  return M.toLocalDateTime(new Date()).slice(11, 16);
}

// ---------------------------------------------------------------- 数据保存

async function persist(next, message) {
  try {
    const response = await fetch('/api/data', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(next),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((payload.errors && payload.errors[0]) || '保存失败');
    }
    state.data = next;
    if (message) showToast(message);
    return true;
  } catch (error) {
    showToast(`保存失败：${error.message}`, true);
    return false;
  }
}

// ---------------------------------------------------------------- 记录表单

function openRecordSheet(mode, extra = {}) {
  if (mode === 'create') {
    state.sheet = { kind: 'record', mode, type: state.todayType || 'body', score: 5, note: '' };
  } else if (mode === 'backfill') {
    state.sheet = {
      kind: 'record',
      mode,
      type: 'body',
      score: 5,
      note: '',
      date: extra.date,
      time: nowClock(),
    };
  } else {
    const record = M.findRecord(state.data, extra.id);
    if (!record) return;
    state.sheet = {
      kind: 'record',
      mode,
      id: record.id,
      type: record.type,
      score: record.score,
      note: record.note,
      originalTime: M.timeKeyOf(record.recordedAt),
    };
  }
  render();
}

function openEventSheet(mode, extra = {}) {
  if (mode === 'create') {
    state.sheet = { kind: 'event', mode, text: '', date: extra.date || state.today };
  } else {
    const event = M.findEvent(state.data, extra.id);
    if (!event) return;
    state.sheet = { kind: 'event', mode, id: event.id, text: event.text, date: event.date };
  }
  render();
}

function setScore(value) {
  if (!state.sheet || state.sheet.kind !== 'record') return;
  const score = clampScore(value);
  state.sheet.score = score;
  const thumb = appEl.querySelector('.slider__thumb');
  if (thumb) thumb.style.top = `${Math.round(((10 - score) / 9) * 254)}px`;
  const face = M.levelImage(state.data, score);
  const faceHtml = face ? `<img class="face-img" src="${face}" alt="">` : M.DEFAULT_FACES[score];
  appEl.querySelectorAll('.slider__thumb, .sheet__face').forEach((node) => {
    node.innerHTML = faceHtml;
  });
  const number = appEl.querySelector('.sheet__number');
  if (number) {
    number.textContent = String(score);
    number.style.color = M.levelColor(state.data, score);
  }
  const slider = appEl.querySelector('[data-slider]');
  if (slider) slider.setAttribute('aria-valuenow', String(score));
}

function attachSlider(slider) {
  let dragging = false;

  const apply = (clientY) => {
    const rect = slider.getBoundingClientRect();
    const ratio = 1 - (clientY - rect.top) / rect.height;
    setScore(scoreFromRatio(ratio));
  };

  slider.addEventListener('pointerdown', (event) => {
    dragging = true;
    try {
      slider.setPointerCapture(event.pointerId);
    } catch {
      /* 某些环境不支持指针捕获，忽略 */
    }
    slider.focus();
    apply(event.clientY);
    event.preventDefault();
  });
  slider.addEventListener('pointermove', (event) => {
    if (dragging) apply(event.clientY);
  });
  const stop = () => {
    dragging = false;
  };
  slider.addEventListener('pointerup', stop);
  slider.addEventListener('pointercancel', stop);
  slider.addEventListener('lostpointercapture', stop);
  slider.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      setScore(state.sheet.score + (event.deltaY < 0 ? 1 : -1));
    },
    { passive: false },
  );
  slider.addEventListener('keydown', (event) => {
    const map = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 };
    if (map[event.key]) {
      setScore(state.sheet.score + map[event.key]);
      event.preventDefault();
    } else if (event.key === 'Home') {
      setScore(1);
      event.preventDefault();
    } else if (event.key === 'End') {
      setScore(10);
      event.preventDefault();
    }
  });
}

async function saveSheet() {
  const sheet = state.sheet;
  if (!sheet) return;
  const now = new Date();
  try {
    let next;
    if (sheet.kind === 'record') {
      if (sheet.mode === 'edit') {
        next = M.updateRecord(state.data, sheet.id, buildRecordInput(sheet), now);
      } else {
        next = M.addRecord(state.data, buildRecordInput(sheet), now);
      }
    } else if (sheet.mode === 'edit') {
      next = M.updateEvent(state.data, sheet.id, buildEventInput(sheet), now);
    } else {
      next = M.addEvent(state.data, buildEventInput(sheet), now);
    }
    const ok = await persist(
      next,
      sheet.mode === 'edit' ? '已更新' : `已保存 ${sheet.mode === 'backfill' ? sheet.time || '12:00' : nowClock()}`,
    );
    if (ok) {
      if (sheet.kind === 'record') state.todayType = sheet.type;
      state.sheet = null;
      render();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

// ---------------------------------------------------------------- 卡片菜单

function openCardMenu(kind, id) {
  const card = kind === 'event' ? M.findEvent(state.data, id) : M.findRecord(state.data, id);
  if (!card) return;
  state.menu = { kind, id, type: card.type };
  render();
}

async function copyCard() {
  const menu = state.menu;
  if (!menu) return;
  try {
    const next =
      menu.kind === 'event'
        ? M.duplicateEvent(state.data, menu.id, new Date())
        : M.duplicateRecord(state.data, menu.id, new Date());
    const ok = await persist(next, '已复制');
    if (ok) {
      state.menu = null;
      render();
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

function askDelete() {
  const menu = state.menu;
  if (!menu) return;
  state.dialog = {
    kind: 'delete',
    cardKind: menu.kind,
    id: menu.id,
    text: menu.kind === 'event' ? '删除后不能恢复，确定删除这个大事件吗？' : '删除后不能恢复，确定删除这条记录吗？',
  };
  state.menu = null;
  render();
}

async function confirmDelete() {
  const dialog = state.dialog;
  if (!dialog) return;
  try {
    const next =
      dialog.cardKind === 'event'
        ? M.deleteEvent(state.data, dialog.id, new Date())
        : M.deleteRecord(state.data, dialog.id, new Date());
    const ok = await persist(next, '已删除');
    if (ok) state.dialog = null;
  } catch (error) {
    showToast(error.message, true);
  }
  render();
}

// ---------------------------------------------------------------- 日历

function shiftMonth(delta) {
  let { year, month } = state.calendar;
  month += delta;
  if (month < 1) {
    month = 12;
    year -= 1;
  } else if (month > 12) {
    month = 1;
    year += 1;
  }
  state.calendar.year = year;
  state.calendar.month = month;
  render();
}

function gotoToday() {
  const [year, month] = state.today.split('-').map(Number);
  state.calendar.year = year;
  state.calendar.month = month;
  state.calendar.selected = state.today;
  state.calendar.chartType = 'body';
  render();
}

function selectDay(date) {
  state.calendar.selected = date;
  const averages = M.dayAverages(state.data, date);
  const firstWithData = averages.find((average) => average.count > 0);
  if (firstWithData) state.calendar.chartType = firstWithData.type;
  render();
}

function openDayMenu(date) {
  if (date > state.today) {
    showToast('还没到的日子不能记', true);
    return;
  }
  state.suppressDayClick = true;
  state.dayMenu = { date, count: M.dayCards(state.data, date).length };
  render();
}

function attachDayCells() {
  appEl.querySelectorAll('[data-day]').forEach((cell) => {
    let timer = null;
    let startX = 0;
    let startY = 0;
    const cancel = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    cell.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      state.suppressDayClick = false;
      startX = event.clientX;
      startY = event.clientY;
      timer = setTimeout(() => {
        timer = null;
        openDayMenu(cell.dataset.day);
      }, 500);
    });
    cell.addEventListener('pointermove', (event) => {
      if (!timer) return;
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) cancel();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((name) => cell.addEventListener(name, cancel));
    cell.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openDayMenu(cell.dataset.day);
    });
  });
}

// ---------------------------------------------------------------- 设置：背景图

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败'));
    image.src = src;
  });
}

/** 把背景图压到长边 2560 以内，优先 WebP，整体不超过约 2MB */
async function compressBackground(file) {
  const src = await readFileAsDataUrl(file);
  const image = await loadImage(src);
  const longest = Math.max(image.width, image.height);
  const encoders = [
    ['image/webp', 0.86],
    ['image/webp', 0.72],
    ['image/jpeg', 0.82],
    ['image/jpeg', 0.65],
  ];
  for (const target of [2560, 2048, 1600]) {
    const scale = Math.min(1, target / longest);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(image, 0, 0, width, height);
    for (const [type, quality] of encoders) {
      const url = canvas.toDataURL(type, quality);
      if (url.length <= M.LIMITS.backgroundDataUrl) return url;
    }
  }
  return null;
}

async function setBackgroundImage(file) {
  try {
    const image = await compressBackground(file);
    if (!image) {
      showToast('这张图压完还是太大，换一张试试', true);
      return;
    }
    await updateBackground({ image, mode: 'image' });
  } catch (error) {
    showToast(error.message, true);
  }
}

// ---------------------------------------------------------------- 设置：颜色与表情图

let cropImage = null;
let cropImageSrc = '';

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

async function updateLevelColor(score, color) {
  if (!/^#[0-9a-fA-F]{6}$/.test(String(color))) return;
  const next = structuredClone(state.data);
  const level = next.settings.levels.find((item) => item.score === score);
  if (!level) return;
  level.color = color;
  next.updatedAt = M.toLocalDateTime(new Date());
  const ok = await persist(next, '颜色已更新');
  if (ok) render();
}

function drawCrop(canvas, image, crop) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const cover = Math.max(size / image.width, size / image.height);
  const drawWidth = image.width * cover * crop.zoom;
  const drawHeight = image.height * cover * crop.zoom;
  const maxX = Math.max(0, (drawWidth - size) / 2);
  const maxY = Math.max(0, (drawHeight - size) / 2);
  crop.offsetX = Math.max(-maxX, Math.min(maxX, crop.offsetX));
  crop.offsetY = Math.max(-maxY, Math.min(maxY, crop.offsetY));
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2 + crop.offsetX, size / 2 + crop.offsetY);
  ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

function setupCropCanvas() {
  const canvas = appEl.querySelector('[data-crop-canvas]');
  if (!canvas || !state.crop) return;

  const draw = () => {
    if (cropImage && cropImage.complete) drawCrop(canvas, cropImage, state.crop);
  };

  if (cropImageSrc !== state.crop.src) {
    cropImageSrc = state.crop.src;
    cropImage = new Image();
    cropImage.onload = draw;
    cropImage.src = state.crop.src;
  } else {
    draw();
  }

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* 忽略 */
    }
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = rect.width ? canvas.width / rect.width : 1;
    state.crop.offsetX += (event.clientX - lastX) * ratio;
    state.crop.offsetY += (event.clientY - lastY) * ratio;
    lastX = event.clientX;
    lastY = event.clientY;
    draw();
  });
  const stop = () => {
    dragging = false;
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  const zoom = appEl.querySelector('[data-field="zoom"]');
  if (zoom) {
    zoom.addEventListener('input', (event) => {
      state.crop.zoom = Number(event.target.value) || 1;
      draw();
    });
  }
}

/** 把 256×256 的画布压成不超过限值的图片；实在太大再缩小画布 */
function encodeCrop(source) {
  const types = [
    ['image/webp', 0.85],
    ['image/jpeg', 0.75],
    ['image/jpeg', 0.6],
  ];
  for (const size of [256, 192, 160]) {
    let canvas = source;
    if (size !== source.width) {
      canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.getContext('2d').drawImage(source, 0, 0, size, size);
    }
    for (const [type, quality] of types) {
      const url = canvas.toDataURL(type, quality);
      if (url.length <= M.LIMITS.imageDataUrl) return url;
    }
  }
  return null;
}

async function applyCrop() {
  const canvas = appEl.querySelector('[data-crop-canvas]');
  if (!canvas || !state.crop) return;
  const image = encodeCrop(canvas);
  if (!image) {
    showToast('这张图太大了，换一张小一点的试试', true);
    return;
  }
  const score = state.crop.score;
  const next = structuredClone(state.data);
  const level = next.settings.levels.find((item) => item.score === score);
  if (!level) return;
  level.image = image;
  next.updatedAt = M.toLocalDateTime(new Date());
  const ok = await persist(next, '表情已更新');
  if (ok) {
    state.crop = null;
    render();
  }
}

async function handleFileInput(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;

  if (input.dataset.file === 'import') {
    await importFile(file);
    return;
  }

  if (input.dataset.file === 'background') {
    await setBackgroundImage(file);
    return;
  }

  if (input.dataset.file === 'image') {
    try {
      const src = await readFileAsDataUrl(file);
      cropImage = null;
      cropImageSrc = '';
      state.crop = { score: state.cropScore || 1, src, zoom: 1, offsetX: 0, offsetY: 0 };
      render();
    } catch (error) {
      showToast(error.message, true);
    }
  }
}

// ---------------------------------------------------------------- 备份导出 / 导入

function exportData() {
  const backup = M.buildRecordsBackup(state.data, new Date());
  const text = JSON.stringify(backup, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `jlrc-记录-${M.toLocalDateTime().replace(/[:T]/g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast('已导出记录');
}

async function importFile(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    showToast('文件不是合法的 JSON', true);
    return;
  }
  const result = M.parseRecordsBackup(parsed);
  if (!result.ok) {
    showToast(result.errors[0], true);
    return;
  }
  state.pendingImport = { records: result.records, events: result.events };
  state.dialog = {
    kind: 'import',
    text: `导入会用文件里的 ${result.records.length} 条状态记录、${result.events.length} 个大事件替换现在的记录；颜色、表情和背景保持不变。确定继续吗？`,
  };
  render();
}

async function confirmImport() {
  const pending = state.pendingImport;
  if (!pending) return;
  const merged = {
    ...structuredClone(state.data),
    records: pending.records,
    events: pending.events,
    updatedAt: M.toLocalDateTime(new Date()),
  };
  try {
    const response = await fetch('/api/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(merged),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((payload.errors && payload.errors[0]) || '导入失败');
    state.data = merged;
    state.pendingImport = null;
    state.dialog = null;
    showToast('已导入记录');
  } catch (error) {
    showToast(`导入失败：${error.message}`, true);
  }
  render();
}

// ---------------------------------------------------------------- 事件绑定

function handleAction(action, target) {
  switch (action) {
    case 'open-settings':
      if (state.tab !== 'settings') state.returnTab = state.tab;
      state.tab = 'settings';
      render();
      break;
    case 'close-settings':
      state.tab = state.returnTab || 'today';
      render();
      break;
    case 'add-record':
      openRecordSheet('create');
      break;
    case 'close-sheet':
      state.sheet = null;
      render();
      break;
    case 'sheet-type':
      if (state.sheet && state.sheet.kind === 'record') {
        state.sheet.type = target.dataset.type;
        render();
      }
      break;
    case 'score-minus':
      if (state.sheet) setScore(state.sheet.score - 1);
      break;
    case 'score-plus':
      if (state.sheet) setScore(state.sheet.score + 1);
      break;
    case 'save-record':
    case 'save-event':
      saveSheet();
      break;
    case 'card-menu':
      openCardMenu(target.dataset.kind, target.dataset.id);
      break;
    case 'close-menu':
      state.menu = null;
      render();
      break;
    case 'menu-edit': {
      const menu = state.menu;
      if (!menu) break;
      state.menu = null;
      if (menu.kind === 'event') openEventSheet('edit', { id: menu.id });
      else openRecordSheet('edit', { id: menu.id });
      break;
    }
    case 'menu-copy':
      copyCard();
      break;
    case 'menu-delete':
      askDelete();
      break;
    case 'edit-card':
      if (target.dataset.kind === 'event') openEventSheet('edit', { id: target.dataset.id });
      else openRecordSheet('edit', { id: target.dataset.id });
      break;
    case 'cancel-delete':
      state.dialog = null;
      render();
      break;
    case 'confirm-delete':
      confirmDelete();
      break;
    case 'prev-month':
      shiftMonth(-1);
      break;
    case 'next-month':
      shiftMonth(1);
      break;
    case 'goto-today':
      gotoToday();
      break;
    case 'chart-type':
      state.calendar.chartType = target.dataset.type;
      render();
      break;
    case 'filter':
      state.filter = target.dataset.filter;
      render();
      break;
    case 'switch-type':
      state.todayType = target.dataset.type;
      render();
      break;
    case 'close-day-menu':
      state.dayMenu = null;
      render();
      break;
    case 'day-menu-record': {
      const date = state.dayMenu && state.dayMenu.date;
      state.dayMenu = null;
      if (date) openRecordSheet('backfill', { date });
      break;
    }
    case 'day-menu-event': {
      const date = state.dayMenu && state.dayMenu.date;
      state.dayMenu = null;
      if (date) openEventSheet('create', { date });
      break;
    }
    case 'export-data':
      exportData();
      break;
    case 'import-data': {
      const input = appEl.querySelector('[data-file="import"]');
      if (input) input.click();
      break;
    }
    case 'change-image': {
      state.cropScore = Number(target.dataset.score) || 1;
      const input = appEl.querySelector('[data-file="image"]');
      if (input) input.click();
      break;
    }
    case 'cancel-crop':
      state.crop = null;
      render();
      break;
    case 'apply-crop':
      applyCrop();
      break;
    case 'confirm-import':
      confirmImport();
      break;
    case 'cancel-import':
      state.dialog = null;
      state.pendingImport = null;
      render();
      break;
    case 'bg-mode':
      updateBackground({ mode: target.dataset.mode });
      break;
    case 'bg-image': {
      const input = appEl.querySelector('[data-file="background"]');
      if (input) input.click();
      break;
    }
    case 'bg-clear':
      updateBackground({ image: null });
      break;
    case 'reset-appearance':
      resetAppearance();
      break;
    default:
      break;
  }
}

function bindEvents() {
  appEl.addEventListener('click', (event) => {
    const tabButton = event.target.closest('[data-tab]');
    if (tabButton) {
      state.tab = tabButton.dataset.tab;
      render();
      return;
    }
    const dayButton = event.target.closest('[data-day]');
    if (dayButton) {
      if (state.suppressDayClick) {
        state.suppressDayClick = false;
        return;
      }
      selectDay(dayButton.dataset.day);
      return;
    }
    const dot = event.target.closest('[data-point]');
    if (dot) {
      const note = dot.dataset.note ? ` · ${dot.dataset.note.slice(0, 24)}` : '';
      showToast(`${dot.dataset.clock} · ${dot.dataset.score} 分${note}`);
      return;
    }
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    handleAction(actionEl.dataset.action, actionEl);
  });

  appEl.addEventListener('input', (event) => {
    const range = event.target.closest('[data-appearance]');
    if (range) {
      applyRangeValue(range);
      return;
    }
    const field = event.target.dataset.field;
    if (!field || !state.sheet) return;
    state.sheet[field] = event.target.value;
  });

  appEl.addEventListener('change', (event) => {
    const range = event.target.closest('[data-appearance]');
    if (range) {
      persistAppearance();
      return;
    }
    const colorInput = event.target.closest('[data-color]');
    if (colorInput) {
      updateLevelColor(Number(colorInput.dataset.color), colorInput.value);
      return;
    }
    const bgColor = event.target.closest('[data-bg-color]');
    if (bgColor) {
      updateBackground({ [bgColor.dataset.bgColor]: bgColor.value });
      return;
    }
    const bgAngle = event.target.closest('[data-bg-angle]');
    if (bgAngle) {
      updateBackground({ angle: bgAngle.value });
      return;
    }
    const fileInput = event.target.closest('[data-file]');
    if (fileInput) handleFileInput(fileInput);
  });
}

// ---------------------------------------------------------------- 启动

async function boot() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error(`读取本地数据失败（${response.status}）`);
    state.data = M.normalizeData(await response.json());
    state.info = await fetch('/api/info')
      .then((info) => (info.ok ? info.json() : null))
      .catch(() => null);
    const latest = M.dayCards(state.data, state.today).find((card) => card.kind === 'record');
    if (latest) state.todayType = latest.type;
    const [year, month] = state.today.split('-').map(Number);
    state.calendar = { year, month, selected: state.today, chartType: 'body' };
    bindEvents();
    render();

    // 跨过午夜自动切到新的一天
    setInterval(() => {
      const today = M.todayKey();
      if (today !== state.today) {
        state.today = today;
        if (state.sheet && state.sheet.mode === 'create' && state.sheet.kind === 'event') {
          state.sheet.date = today;
        }
        render();
      }
    }, 60000);
  } catch (error) {
    appEl.innerHTML = `<div class="boot-error">
      <h1>打不开本地数据</h1>
      <p>${String(error.message)}</p>
      <p>请确认双击的是 jlrc 文件夹里的「启动」，并且 data 文件夹还在。</p>
    </div>`;
  }
}

if (hasDom) boot();

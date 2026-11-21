// 纯渲染层：所有页面和弹层都返回 HTML 字符串，不直接操作 DOM，方便单元测试。

import * as M from './model.mjs';
import { chartSvg } from './chart.mjs';
import { ringSvg } from './ring.mjs';

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

const ICON_CALENDAR = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>`;
const ICON_TODAY = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/></svg>`;
const ICON_LIST = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6.5h12M8 12h12M8 17.5h12"/><circle cx="4" cy="6.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="17.5" r="1.2" fill="currentColor" stroke="none"/></svg>`;
const ICON_GEAR = `<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.9 6.1l-1.4 1.4M7.5 16.5l-1.4 1.4M17.9 17.9l-1.4-1.4M7.5 7.5L6.1 6.1"/></svg>`;

const NAV_ITEMS = [
  { tab: 'calendar', label: '日历', icon: ICON_CALENDAR },
  { tab: 'today', label: '今日', icon: ICON_TODAY },
  { tab: 'list', label: '列表', icon: ICON_LIST },
];

/** 10 档颜色从下到上的渐变 */
export function scoreGradient(data) {
  const colors = [...data.settings.levels].sort((a, b) => a.score - b.score).map((level) => level.color);
  return `linear-gradient(to top, ${colors.join(', ')})`;
}

function faceHtml(data, score) {
  const image = M.levelImage(data, score);
  return image ? `<img class="face-img" src="${esc(image)}" alt="">` : esc(M.DEFAULT_FACES[score]);
}

// ---------------------------------------------------------------- 应用外壳

export function renderApp(state) {
  const page =
    state.tab === 'today'
      ? renderToday(state)
      : state.tab === 'calendar'
        ? renderCalendarPage(state)
        : state.tab === 'list'
          ? renderListPage(state)
          : renderSettingsPage(state);

  const nav = state.tab === 'settings' ? '' : renderNav(state);
  const gear =
    state.tab === 'settings'
      ? ''
      : `<button class="settings-fab" data-action="open-settings" aria-label="设置">${ICON_GEAR}</button>`;

  return `<div class="app-shell">${gear}${page}</div>${nav}${renderOverlays(state)}`;
}

export function renderNav(state) {
  const items = NAV_ITEMS.map(({ tab, label, icon }) => {
    const active = state.tab === tab;
    return `<button class="nav__item${active ? ' is-active' : ''}" data-tab="${tab}"${active ? ' aria-current="page"' : ''}>${icon}<span>${label}</span></button>`;
  }).join('');
  return `<nav class="nav" aria-label="主导航">${items}</nav>`;
}

// ---------------------------------------------------------------- 今日页

export function renderToday(state) {
  const data = state.data;
  const today = state.today;
  const charts = M.TYPES.map((type) => renderChartBlock(state, type)).join('');
  const cards = M.dayCards(data, today);
  const cardsHtml = cards.length
    ? `<div class="cards">${cards.map((card) => renderCard(card, state)).join('')}</div>`
    : `<p class="empty">今天还没有记录</p>`;

  return `<main class="page page--today">
  <header class="page-head">
    <h1 class="page-title">${M.formatShortDate(today, today)}</h1>
  </header>
  <section class="charts" aria-label="今天的折线图">${charts}</section>
  <section class="today-list">
    <h2 class="section-title">今天的记录</h2>
    ${cardsHtml}
  </section>
  <div class="today-actions">
    <button class="btn btn--primary" data-action="add-record">＋ 记状态</button>
    <button class="btn btn--ghost" data-action="add-event">＋ 大事件</button>
  </div>
</main>`;
}

export function renderChartBlock(state, type) {
  const svg = chartSvg(state.data, state.today, type.key, { height: 120 });
  const body = svg
    ? `<div class="chart-body">${svg}</div>`
    : `<p class="chart-empty">今天还没有${type.label}记录</p>`;
  return `<article class="chart-block" data-chart="${type.key}">
    <h2 class="chart-title">${type.label}</h2>
    ${body}
  </article>`;
}

// ---------------------------------------------------------------- 卡片

export function renderCard(card, state) {
  const more = `<button class="card__more" data-action="card-menu" data-kind="${card.kind}" data-id="${esc(card.id)}" aria-label="更多操作">⋯</button>`;

  if (card.kind === 'event') {
    return `<article class="card card--event" data-id="${esc(card.id)}">
    <div class="card__face" aria-hidden="true">📌</div>
    <div class="card__main" data-action="edit-card" data-kind="event" data-id="${esc(card.id)}">
      <div class="card__head"><span class="card__type">大事件</span></div>
      <p class="card__note">${esc(card.text)}</p>
    </div>
    ${more}
  </article>`;
  }

  const color = M.levelColor(state.data, card.score);
  return `<article class="card card--record" data-id="${esc(card.id)}">
    <div class="card__face" aria-hidden="true">${faceHtml(state.data, card.score)}</div>
    <div class="card__main" data-action="edit-card" data-kind="record" data-id="${esc(card.id)}">
      <div class="card__head">
        <span class="card__type">${M.typeLabel(card.type)}</span>
        <span class="card__score" style="color:${esc(color)}">${card.score}</span>
        <time class="card__time">${M.timeKeyOf(card.recordedAt)}</time>
      </div>
      ${card.note ? `<p class="card__note">${esc(card.note)}</p>` : ''}
    </div>
    ${more}
  </article>`;
}

// ---------------------------------------------------------------- 记录表单

export function renderRecordSheet(state) {
  const sheet = state.sheet;
  const data = state.data;
  const title = sheet.mode === 'edit' ? '编辑记录' : sheet.mode === 'backfill' ? '补记记录' : '添加记录';
  const color = M.levelColor(data, sheet.score);
  const thumbTop = Math.round(((10 - sheet.score) / 9) * 254);

  const typeTabs = M.TYPES.map(
    (type) =>
      `<button class="type-tab${sheet.type === type.key ? ' is-active' : ''}" data-action="sheet-type" data-type="${type.key}">${type.label}</button>`,
  ).join('');

  let meta = '';
  if (sheet.mode === 'backfill') {
    meta = `<div class="sheet__meta">
      <span class="sheet__date">${M.formatShortDate(sheet.date, state.today)}</span>
      <label class="time-field">时间
        <input type="time" data-field="time" value="${esc(sheet.time || '12:00')}">
      </label>
    </div>`;
  } else if (sheet.mode === 'edit') {
    meta = `<div class="sheet__meta"><span class="sheet__date">记录时间 ${esc(sheet.originalTime || '')}　不可修改</span></div>`;
  }

  const ticks = '<i></i>'.repeat(10);

  return `<div class="sheet-backdrop" data-action="close-sheet"></div>
  <section class="sheet" role="dialog" aria-modal="true" aria-label="${title}">
    <div class="sheet__grab" aria-hidden="true"></div>
    <header class="sheet__head">
      <h2 class="sheet__title">${title}</h2>
      <button class="icon-btn" data-action="close-sheet" aria-label="关闭">✕</button>
    </header>
    ${meta}
    <div class="sheet__types" role="tablist">${typeTabs}</div>
    <div class="sheet__score">
      <div class="slider-rail">
        <div class="slider" data-slider tabindex="0" role="slider" aria-label="分数" aria-valuemin="1" aria-valuemax="10" aria-valuenow="${sheet.score}">
          <div class="slider__track" style="background:${scoreGradient(data)}"></div>
          <div class="slider__thumb" style="top:${thumbTop}px">${faceHtml(data, sheet.score)}</div>
          <div class="slider__ticks" aria-hidden="true">${ticks}</div>
        </div>
        <div class="slider__scale" aria-hidden="true"><span>10</span><span>1</span></div>
      </div>
      <div class="sheet__preview">
        <div class="sheet__face">${faceHtml(data, sheet.score)}</div>
        <div class="sheet__scoreline">
          <span class="sheet__number" style="color:${esc(color)}">${sheet.score}</span>
          <span class="sheet__max">/ 10</span>
        </div>
        <div class="stepper">
          <button class="stepper__btn" data-action="score-minus" aria-label="减一分">−</button>
          <button class="stepper__btn" data-action="score-plus" aria-label="加一分">＋</button>
        </div>
      </div>
    </div>
    <label class="field">
      <span class="field__label">想说的话</span>
      <textarea data-field="note" maxlength="${M.LIMITS.note}" placeholder="想说的话…">${esc(sheet.note || '')}</textarea>
    </label>
    <div class="sheet__foot">
      <button class="btn btn--primary btn--block" data-action="save-record">保存</button>
    </div>
  </section>`;
}

// ---------------------------------------------------------------- 大事件表单

export function renderEventSheet(state) {
  const sheet = state.sheet;
  const title = sheet.mode === 'edit' ? '编辑大事件' : '添加大事件';
  return `<div class="sheet-backdrop" data-action="close-sheet"></div>
  <section class="sheet sheet--event" role="dialog" aria-modal="true" aria-label="${title}">
    <div class="sheet__grab" aria-hidden="true"></div>
    <header class="sheet__head">
      <h2 class="sheet__title">${title}</h2>
      <button class="icon-btn" data-action="close-sheet" aria-label="关闭">✕</button>
    </header>
    <label class="field">
      <span class="field__label">事件内容</span>
      <textarea data-field="text" maxlength="${M.LIMITS.eventText}" placeholder="发生了什么…">${esc(sheet.text || '')}</textarea>
    </label>
    <label class="field">
      <span class="field__label">日期</span>
      <input type="date" data-field="date" value="${esc(sheet.date)}" max="${state.today}">
    </label>
    <div class="sheet__foot">
      <button class="btn btn--primary btn--block" data-action="save-event">保存</button>
    </div>
  </section>`;
}

// ---------------------------------------------------------------- 卡片菜单 / 确认框

export function renderMenu(state) {
  const menu = state.menu;
  const title = menu.kind === 'event' ? '大事件' : M.typeLabel(menu.type);
  return `<div class="menu-backdrop" data-action="close-menu"></div>
  <section class="menu-sheet" role="dialog" aria-modal="true" aria-label="记录操作">
    <p class="menu-sheet__title">${esc(title)}</p>
    <button class="menu-sheet__item" data-action="menu-edit">编辑</button>
    <button class="menu-sheet__item" data-action="menu-copy">复制</button>
    <button class="menu-sheet__item menu-sheet__item--danger" data-action="menu-delete">删除</button>
    <button class="menu-sheet__item menu-sheet__item--cancel" data-action="close-menu">取消</button>
  </section>`;
}

export function renderConfirm(state) {
  const dialog = state.dialog;
  const isImport = dialog.kind === 'import';
  const cancelAction = isImport ? 'cancel-import' : 'cancel-delete';
  return `<div class="dialog-backdrop" data-action="${cancelAction}"></div>
  <section class="dialog" role="alertdialog" aria-modal="true" aria-label="确认">
    <p class="dialog__text">${esc(dialog.text)}</p>
    <div class="dialog__actions">
      <button class="btn btn--ghost" data-action="${cancelAction}">取消</button>
      <button class="btn ${isImport ? 'btn--primary' : 'btn--danger'}" data-action="${isImport ? 'confirm-import' : 'confirm-delete'}">${isImport ? '导入' : '删除'}</button>
    </div>
  </section>`;
}

function renderOverlays(state) {
  let html = '';
  if (state.sheet) {
    html += state.sheet.kind === 'record' ? renderRecordSheet(state) : renderEventSheet(state);
  }
  if (state.menu) html += renderMenu(state);
  if (state.dayMenu) html += renderDayMenu(state);
  if (state.dialog) html += renderConfirm(state);
  if (state.crop) html += renderCropDialog(state);
  return html;
}

// ---------------------------------------------------------------- 日历页

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

export function renderCalendarPage(state) {
  const { year, month } = state.calendar;
  const cells = M.monthMatrix(year, month, state.today);
  const grid = cells.map((cell) => renderDayCell(state, cell)).join('');
  return `<main class="page page--calendar">
  <header class="page-head"><h1 class="page-title">日历</h1></header>
  <section class="calendar">
    <div class="calendar__bar">
      <button class="icon-btn" data-action="prev-month" aria-label="上个月">‹</button>
      <h2 class="calendar__month">${year} 年 ${month} 月</h2>
      <button class="icon-btn" data-action="next-month" aria-label="下个月">›</button>
      <button class="calendar__today-btn" data-action="goto-today">今天</button>
    </div>
    <div class="calendar__week" aria-hidden="true">${WEEK_LABELS.map((label) => `<span>${label}</span>`).join('')}</div>
    <div class="calendar__grid">${grid}</div>
    <p class="calendar__hint">长按日期可以补记</p>
  </section>
  ${renderDayDetail(state)}
</main>`;
}

function renderDayCell(state, cell) {
  const date = cell.key;
  const hasEvent = M.eventsOn(state.data, date).length > 0;
  const selected = state.calendar.selected === date;
  const classes = ['day'];
  if (!cell.inMonth) classes.push('is-outside');
  if (cell.isToday) classes.push('is-today');
  if (selected) classes.push('is-selected');
  return `<button class="${classes.join(' ')}" data-day="${date}" aria-label="${M.formatShortDate(date, state.today)}"${cell.isToday ? ' aria-current="date"' : ''}>
      <span class="day__ring">${ringSvg(state.data, date)}</span>
      <span class="day__num">${cell.day}</span>
      ${hasEvent ? '<span class="day__dot" aria-hidden="true"></span>' : ''}
    </button>`;
}

export function renderDayDetail(state) {
  const date = state.calendar.selected;
  const averages = M.dayAverages(state.data, date);
  const chartType = state.calendar.chartType || 'body';
  const typeMeta = M.TYPES.find((type) => type.key === chartType) || M.TYPES[0];
  const tabs = averages
    .map(
      (average) => `<button class="avg-tab${average.type === chartType ? ' is-active' : ''}" data-action="chart-type" data-type="${average.type}">
        <span class="avg-tab__label">${average.label}</span>
        <span class="avg-tab__num" style="color:${average.color || 'var(--muted)'}">${M.averageLabel(average)}</span>
      </button>`,
    )
    .join('');
  const svg = chartSvg(state.data, date, chartType, { height: 180 });
  const events = M.eventsOn(state.data, date);
  const eventLine = events.length
    ? `<p class="day-events">大事件 · ${events.map((event) => esc(event.text)).join('、')}</p>`
    : '';
  return `<section class="day-detail" data-selected-day="${date}">
    <h2 class="day-detail__head">${M.formatDateLabel(date, state.today)}</h2>
    <div class="day-avgs" role="tablist">${tabs}</div>
    ${svg ? `<div class="day-chart">${svg}</div>` : `<p class="chart-empty">这天没有${typeMeta.label}记录</p>`}
    ${eventLine}
  </section>`;
}

export function renderDayMenu(state) {
  const { date, count } = state.dayMenu;
  const subtitle = count ? `已有 ${count} 条` : '还没有记录';
  return `<div class="menu-backdrop" data-action="close-day-menu"></div>
  <section class="menu-sheet" role="dialog" aria-modal="true" aria-label="补记">
    <p class="menu-sheet__title">${M.formatShortDate(date)} · ${subtitle}</p>
    <button class="menu-sheet__item" data-action="day-menu-record">记状态</button>
    <button class="menu-sheet__item" data-action="day-menu-event">记大事件</button>
    <button class="menu-sheet__item menu-sheet__item--cancel" data-action="close-day-menu">取消</button>
  </section>`;
}

// ---------------------------------------------------------------- 列表页

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'body', label: '身体' },
  { key: 'energy', label: '精力' },
  { key: 'mood', label: '心情' },
  { key: 'event', label: '大事件' },
];

export function renderListPage(state) {
  const filter = state.filter || 'all';
  const groups = M.groupAllCards(state.data)
    .map((group) => ({ ...group, items: M.filterCards(group.items, filter) }))
    .filter((group) => group.items.length > 0);

  const chips = FILTERS.map(
    (item) =>
      `<button class="chip${filter === item.key ? ' is-active' : ''}" data-action="filter" data-filter="${item.key}">${item.label}</button>`,
  ).join('');

  const body = groups.length
    ? groups
        .map(
          (group) => `<section class="day-group">
        <h2 class="day-group__head">${M.formatDateLabel(group.date, state.today)}</h2>
        <div class="cards">${group.items.map((card) => renderCard(card, state)).join('')}</div>
      </section>`,
        )
        .join('')
    : `<p class="empty">${filter === 'all' ? '还没有任何记录' : '没有符合条件的记录'}</p>`;

  return `<main class="page page--list">
  <header class="page-head"><h1 class="page-title">列表</h1></header>
  <div class="chips" role="tablist">${chips}</div>
  ${body}
</main>`;
}

// ---------------------------------------------------------------- 设置页

export function renderSettingsPage(state) {
  const levels = [...state.data.settings.levels].sort((a, b) => a.score - b.score);
  const rows = levels
    .map(
      (level) => `<li class="setting-row" data-score="${level.score}">
        <span class="setting-row__score">${level.score}</span>
        <span class="setting-row__face">${faceHtml(state.data, level.score)}</span>
        <input class="setting-row__color" type="color" value="${esc(level.color)}" data-color="${level.score}" aria-label="第 ${level.score} 分的颜色">
        <button class="setting-row__btn" data-action="change-image" data-score="${level.score}">换图</button>
      </li>`,
    )
    .join('');

  const info = state.info || {};
  const dataPath = info.dataFile || 'D:\\jlrc\\data\\data.json';
  const savedAt = state.data.updatedAt
    ? `${M.formatShortDate(state.data.updatedAt.slice(0, 10), state.today)} ${state.data.updatedAt.slice(11, 16)}`
    : '—';

  return `<main class="page page--settings">
  <header class="page-head page-head--row">
    <button class="icon-btn" data-action="close-settings" aria-label="返回">←</button>
    <h1 class="page-title">设置</h1>
  </header>
  <section class="settings-block">
    <h2 class="section-title">分数 · 表情 · 颜色</h2>
    <ul class="setting-list">${rows}</ul>
    <p class="settings-note">颜色点一下就能改，改完全站立刻生效。</p>
  </section>
  <section class="settings-block">
    <h2 class="section-title">数据</h2>
    <p class="settings-line">位置：${esc(dataPath)}</p>
    <p class="settings-line">上次保存：${esc(savedAt)}</p>
    <div class="settings-actions">
      <button class="btn btn--ghost" data-action="export-data">导出备份</button>
      <button class="btn btn--ghost" data-action="import-data">导入备份</button>
    </div>
  </section>
  <input type="file" accept="image/*" data-file="image" hidden>
  <input type="file" accept=".json,application/json" data-file="import" hidden>
</main>`;
}

// ---------------------------------------------------------------- 裁剪表情

export function renderCropDialog(state) {
  const crop = state.crop;
  return `<div class="dialog-backdrop" data-action="cancel-crop"></div>
  <section class="crop-dialog" role="dialog" aria-modal="true" aria-label="裁剪表情">
    <header class="crop-dialog__head">
      <h2>裁剪第 ${crop.score} 分的表情</h2>
      <button class="icon-btn" data-action="cancel-crop" aria-label="关闭">✕</button>
    </header>
    <canvas class="crop-canvas" width="256" height="256" data-crop-canvas></canvas>
    <label class="crop-zoom">缩放
      <input type="range" min="1" max="3" step="0.01" value="${crop.zoom}" data-field="zoom">
    </label>
    <div class="crop-actions">
      <button class="btn btn--ghost" data-action="cancel-crop">取消</button>
      <button class="btn btn--primary" data-action="apply-crop">使用</button>
    </div>
  </section>`;
}

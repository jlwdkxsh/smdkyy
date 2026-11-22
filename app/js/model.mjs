// 数据模型：纯函数，不依赖 DOM、不依赖浏览器存储。
//
// 时间统一使用「本地朴素时间」字符串：YYYY-MM-DDTHH:MM（不带时区）。
// 好处：排序可直接比较字符串，跨天判断只看前 10 位，图表横轴不需要时区换算。

export const VERSION = 1;

export const TYPES = [
  { key: 'body', label: '身体' },
  { key: 'energy', label: '精力' },
  { key: 'mood', label: '心情' },
];

export const TYPE_KEYS = TYPES.map((t) => t.key);

export function typeLabel(key) {
  const found = TYPES.find((t) => t.key === key);
  return found ? found.label : String(key);
}

export const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const DEFAULT_COLORS = [
  '#C64B3C', '#D86A45', '#E28A44', '#E8A944', '#E5C13F',
  '#C3C53F', '#97B842', '#6EA84B', '#4A9259', '#337A50',
];

export const DEFAULT_FACES = {
  1: '😞', 2: '😞', 3: '🙁', 4: '🙁', 5: '😐',
  6: '😐', 7: '🙂', 8: '🙂', 9: '😄', 10: '😄',
};

export const LIMITS = {
  note: 500,
  eventText: 200,
  imageDataUrl: 200000,
  // 背景图按 base64 长度算：约 2MB 原图 ≈ 2.8M 字符
  backgroundDataUrl: 2800000,
};

export const DEFAULT_BACKGROUND = {
  mode: 'solid',
  color: '#F7F6F3',
  from: '#F3F2EE',
  to: '#E8E6E1',
  angle: 'vertical',
  image: null,
  scrim: 30,
};

export const DEFAULT_APPEARANCE = {
  surfaceAlpha: 100,
  buttonColor: '#2F6B4F',
};

export const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
export const IMAGE_RE = /^data:image\/(png|jpeg|webp);base64,/;

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export class ValidationError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors && errors.length ? errors : [message];
  }
}

// ---------------------------------------------------------------- 时间基础

export function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Date -> 'YYYY-MM-DDTHH:MM'（本地时间，不转 UTC） */
export function toLocalDateTime(date = new Date()) {
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  );
}

export function todayKey(now = new Date()) {
  return toLocalDateTime(now).slice(0, 10);
}

export function isDateTimeString(value) {
  return typeof value === 'string' && DATETIME_RE.test(value);
}

export function isDateString(value) {
  return typeof value === 'string' && DATE_RE.test(value);
}

/** 严格校验日期键：既要格式对，也要是真实存在的日期（拒绝 2 月 30 日） */
export function isValidDateKey(key) {
  if (!isDateString(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function dateKeyOf(value) {
  if (typeof value === 'string') return value.slice(0, 10);
  return toLocalDateTime(value).slice(0, 10);
}

export function timeKeyOf(value) {
  return typeof value === 'string' ? value.slice(11, 16) : toLocalDateTime(value).slice(11, 16);
}

export function minutesOfTime(clock) {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
}

export function clockOfMinutes(minutes) {
  const total = Math.max(0, Math.min(1439, Math.round(minutes)));
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

export function shiftDate(dateKey, deltaDays) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

export function weekdayOf(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

/** '2026年11月21日 周五'，today 传入时追加 · 今天 / · 昨天 */
export function formatDateLabel(dateKey, today = null) {
  const [, m, d] = dateKey.split('-').map(Number);
  const base = `${dateKey.slice(0, 4)}年${m}月${d}日 ${weekdayOf(dateKey)}`;
  if (!today) return base;
  if (dateKey === today) return `${base} · 今天`;
  if (dateKey === shiftDate(today, -1)) return `${base} · 昨天`;
  return base;
}

/** '11月21日 周五 · 今天' */
export function formatShortDate(dateKey, today = null) {
  const [, m, d] = dateKey.split('-').map(Number);
  const base = `${m}月${d}日 ${weekdayOf(dateKey)}`;
  if (!today) return base;
  if (dateKey === today) return `${base} · 今天`;
  if (dateKey === shiftDate(today, -1)) return `${base} · 昨天`;
  return base;
}

/** 月历 42 格，从周日起。month 为 1–12 */
export function monthMatrix(year, month, today = null) {
  const first = new Date(year, month - 1, 1);
  const offset = first.getDay();
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(year, month - 1, 1 - offset + i);
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    cells.push({
      key,
      day: d.getDate(),
      inMonth: d.getFullYear() === year && d.getMonth() === month - 1,
      isToday: today ? key === today : false,
    });
  }
  return cells;
}

// ---------------------------------------------------------------- 初始数据

export function createEmptyData(now = new Date()) {
  return {
    version: VERSION,
    settings: {
      levels: SCORES.map((score, index) => ({
        score,
        color: DEFAULT_COLORS[index],
        image: null,
      })),
      eventIcon: null,
      background: { ...DEFAULT_BACKGROUND },
      appearance: { ...DEFAULT_APPEARANCE },
    },
    records: [],
    events: [],
    updatedAt: toLocalDateTime(now),
  };
}

/** 补全旧数据里缺失的外观字段（纯函数，不改原对象） */
export function normalizeData(data) {
  const settings = data.settings || {};
  return {
    ...data,
    settings: {
      ...settings,
      levels: settings.levels || [],
      eventIcon: settings.eventIcon ?? null,
      background: { ...DEFAULT_BACKGROUND, ...(settings.background || {}) },
      appearance: { ...DEFAULT_APPEARANCE, ...(settings.appearance || {}) },
    },
  };
}

export function makeId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------- 设置查询

export function levelEntry(data, score) {
  const level = Math.max(1, Math.min(10, Math.round(Number(score) || 1)));
  const levels = data.settings && Array.isArray(data.settings.levels) ? data.settings.levels : [];
  return levels.find((item) => item.score === level) || { score: level, color: DEFAULT_COLORS[level - 1], image: null };
}

export function levelColor(data, score) {
  return levelEntry(data, score).color || DEFAULT_COLORS[Math.min(9, Math.max(0, Math.round(score) - 1))];
}

export function levelImage(data, score) {
  const entry = levelEntry(data, score);
  return entry.image || null;
}

/** 图片存在时返回 <img> 用的地址，否则返回默认表情字符 */
export function levelFace(data, score) {
  return levelImage(data, score) || DEFAULT_FACES[Math.max(1, Math.min(10, Math.round(score)))] || '😐';
}

// ---------------------------------------------------------------- 校验

export function validateType(type) {
  return TYPE_KEYS.includes(type) ? null : '未知的记录类型';
}

export function validateScore(score) {
  if (!Number.isInteger(score) || score < 1 || score > 10) return '分数必须是 1–10 的整数';
  return null;
}

export function validateNote(note) {
  if (typeof note !== 'string') return '备注格式不正确';
  if (note.length > LIMITS.note) return `备注最多 ${LIMITS.note} 字`;
  return null;
}

export function validateEventText(text) {
  if (typeof text !== 'string') return '大事件内容格式不正确';
  if (!text.trim()) return '大事件不能为空';
  if (text.trim().length > LIMITS.eventText) return `大事件最多 ${LIMITS.eventText} 字`;
  return null;
}

export function validateEventDate(date, today) {
  if (!isValidDateKey(date)) return '日期格式不正确';
  if (today && date > today) return '还没到的日子不能记';
  return null;
}

export function validateRecordedAt(value, today) {
  if (!isDateTimeString(value)) return '记录时间格式不正确';
  if (today && dateKeyOf(value) > today) return '还没到的日子不能记';
  return null;
}

// ---------------------------------------------------------------- 状态记录

export function recordsOn(data, dateKey) {
  return data.records.filter((record) => dateKeyOf(record.recordedAt) === dateKey);
}

export function eventsOn(data, dateKey) {
  return data.events.filter((event) => event.date === dateKey);
}

function sortRecordsDesc(list) {
  return [...list].sort((a, b) => {
    if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? 1 : -1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

function sortEventsDesc(list) {
  return [...list].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

export function addRecord(data, input, now = new Date()) {
  const typeError = validateType(input.type);
  const scoreError = validateScore(input.score);
  const note = typeof input.note === 'string' ? input.note : '';
  const noteError = validateNote(note);
  const today = todayKey(now);
  const recordedAt = input.recordedAt || toLocalDateTime(now);
  const timeError = validateRecordedAt(recordedAt, today);
  const errors = [typeError, scoreError, noteError, timeError].filter(Boolean);
  if (errors.length) throw new ValidationError(errors[0], errors);

  const record = {
    id: makeId('rec'),
    type: input.type,
    score: input.score,
    note,
    recordedAt,
    createdAt: toLocalDateTime(now),
  };
  return {
    ...data,
    records: [...data.records, record],
    updatedAt: toLocalDateTime(now),
  };
}

export function findRecord(data, id) {
  return data.records.find((record) => record.id === id) || null;
}

export function updateRecord(data, id, patch, now = new Date()) {
  const current = findRecord(data, id);
  if (!current) throw new ValidationError('记录不存在');
  const next = { ...current };
  const errors = [];
  if (patch.type !== undefined) {
    const error = validateType(patch.type);
    if (error) errors.push(error); else next.type = patch.type;
  }
  if (patch.score !== undefined) {
    const error = validateScore(patch.score);
    if (error) errors.push(error); else next.score = patch.score;
  }
  if (patch.note !== undefined) {
    const error = validateNote(patch.note);
    if (error) errors.push(error); else next.note = patch.note;
  }
  if (errors.length) throw new ValidationError(errors[0], errors);
  return {
    ...data,
    records: data.records.map((record) => (record.id === id ? next : record)),
    updatedAt: toLocalDateTime(now),
  };
}

export function deleteRecord(data, id, now = new Date()) {
  if (!findRecord(data, id)) throw new ValidationError('记录不存在');
  return {
    ...data,
    records: data.records.filter((record) => record.id !== id),
    updatedAt: toLocalDateTime(now),
  };
}

export function duplicateRecord(data, id, now = new Date()) {
  const source = findRecord(data, id);
  if (!source) throw new ValidationError('记录不存在');
  const copy = {
    ...source,
    id: makeId('rec'),
    recordedAt: toLocalDateTime(now),
    createdAt: toLocalDateTime(now),
  };
  return {
    ...data,
    records: [...data.records, copy],
    updatedAt: toLocalDateTime(now),
  };
}

// ---------------------------------------------------------------- 大事件

export function addEvent(data, input, now = new Date()) {
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  const today = todayKey(now);
  const errors = [validateEventText(text), validateEventDate(input.date, today)].filter(Boolean);
  if (errors.length) throw new ValidationError(errors[0], errors);
  const event = {
    id: makeId('evt'),
    text,
    date: input.date,
    createdAt: toLocalDateTime(now),
  };
  return {
    ...data,
    events: [...data.events, event],
    updatedAt: toLocalDateTime(now),
  };
}

export function findEvent(data, id) {
  return data.events.find((event) => event.id === id) || null;
}

export function updateEvent(data, id, patch, now = new Date()) {
  const current = findEvent(data, id);
  if (!current) throw new ValidationError('大事件不存在');
  const next = { ...current };
  const errors = [];
  if (patch.text !== undefined) {
    const text = typeof patch.text === 'string' ? patch.text.trim() : '';
    const error = validateEventText(text);
    if (error) errors.push(error); else next.text = text;
  }
  if (patch.date !== undefined) {
    const error = validateEventDate(patch.date, todayKey(now));
    if (error) errors.push(error); else next.date = patch.date;
  }
  if (errors.length) throw new ValidationError(errors[0], errors);
  return {
    ...data,
    events: data.events.map((event) => (event.id === id ? next : event)),
    updatedAt: toLocalDateTime(now),
  };
}

export function deleteEvent(data, id, now = new Date()) {
  if (!findEvent(data, id)) throw new ValidationError('大事件不存在');
  return {
    ...data,
    events: data.events.filter((event) => event.id !== id),
    updatedAt: toLocalDateTime(now),
  };
}

export function duplicateEvent(data, id, now = new Date()) {
  const source = findEvent(data, id);
  if (!source) throw new ValidationError('大事件不存在');
  const copy = { ...source, id: makeId('evt'), createdAt: toLocalDateTime(now) };
  return {
    ...data,
    events: [...data.events, copy],
    updatedAt: toLocalDateTime(now),
  };
}

// ---------------------------------------------------------------- 统计与查询

/** 某天某类型的平均分：sum / count，四舍五入到 1–10；没有记录返回 null */
export function typeAverage(data, dateKey, type) {
  const list = recordsOn(data, dateKey).filter((record) => record.type === type);
  if (!list.length) return null;
  const sum = list.reduce((total, record) => total + record.score, 0);
  const avg = sum / list.length;
  const level = Math.max(1, Math.min(10, Math.round(avg)));
  return { type, count: list.length, sum, avg, level };
}

/** 日历圆环三段：每段是否亮、用什么颜色 */
export function ringState(data, dateKey) {
  return TYPES.map((type) => {
    const stats = typeAverage(data, dateKey, type.key);
    return {
      type: type.key,
      label: type.label,
      present: Boolean(stats),
      level: stats ? stats.level : null,
      avg: stats ? stats.avg : null,
      color: stats ? levelColor(data, stats.level) : null,
    };
  });
}

export function dayHasContent(data, dateKey) {
  return recordsOn(data, dateKey).length > 0 || eventsOn(data, dateKey).length > 0;
}

/** 某天的卡片：状态记录按时间倒序在前，大事件按创建时间倒序在后 */
export function dayCards(data, dateKey) {
  const records = sortRecordsDesc(recordsOn(data, dateKey)).map((record) => ({ kind: 'record', ...record }));
  const events = sortEventsDesc(eventsOn(data, dateKey)).map((event) => ({ kind: 'event', ...event }));
  return [...records, ...events];
}

/** 全部卡片按天分组，日期从新到旧 */
export function groupAllCards(data) {
  const groups = new Map();
  const push = (dateKey, card) => {
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey).push(card);
  };
  for (const record of data.records) push(dateKeyOf(record.recordedAt), { kind: 'record', ...record });
  for (const event of data.events) push(event.date, { kind: 'event', ...event });
  return [...groups.entries()]
    .map(([dateKey, cards]) => {
      const records = sortRecordsDesc(cards.filter((card) => card.kind === 'record'));
      const events = sortEventsDesc(cards.filter((card) => card.kind === 'event'));
      return { date: dateKey, items: [...records, ...events] };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** filter: 'all' | 'body' | 'energy' | 'mood' | 'event' */
export function filterCards(cards, filter) {
  if (!filter || filter === 'all') return cards;
  if (filter === 'event') return cards.filter((card) => card.kind === 'event');
  return cards.filter((card) => card.kind === 'record' && card.type === filter);
}

/** 某天某类型的图表数据点，按时间从早到晚 */
export function chartPoints(data, dateKey, type) {
  return recordsOn(data, dateKey)
    .filter((record) => record.type === type)
    .map((record) => ({
      id: record.id,
      minutes: minutesOfTime(timeKeyOf(record.recordedAt)),
      clock: timeKeyOf(record.recordedAt),
      score: record.score,
      color: levelColor(data, record.score),
      note: record.note,
    }))
    .sort((a, b) => a.minutes - b.minutes || (a.id < b.id ? -1 : 1));
}

/**
 * 横轴范围：最早记录前 30 分钟到最晚记录后 30 分钟，至少 2 小时，
 * 绝不跨出当天 00:00–24:00。
 */
export function chartAxis(points) {
  if (!points.length) return null;
  const first = points[0].minutes;
  const last = points[points.length - 1].minutes;
  let start = Math.max(0, first - 30);
  let end = Math.min(1440, last + 30);
  const minSpan = 120;
  if (end - start < minSpan) {
    const middle = (start + end) / 2;
    start = Math.max(0, Math.floor(middle - minSpan / 2));
    end = Math.min(1440, start + minSpan);
    if (end - start < minSpan) start = Math.max(0, end - minSpan);
  }
  return { start: Math.max(0, Math.floor(start)), end: Math.min(1440, Math.ceil(end)) };
}

export function dayAverages(data, dateKey) {
  return TYPES.map((type) => {
    const stats = typeAverage(data, dateKey, type.key);
    return {
      type: type.key,
      label: type.label,
      avg: stats ? stats.avg : null,
      level: stats ? stats.level : null,
      count: stats ? stats.count : 0,
      color: stats ? levelColor(data, stats.level) : null,
    };
  });
}

export function averageLabel(stats) {
  return stats.avg === null ? '—' : stats.avg.toFixed(1);
}

export function validateRecordItem(record) {
  if (!record || typeof record.id !== 'string' || !record.id) return '记录缺少编号';
  if (validateType(record.type)) return '记录类型不正确';
  if (validateScore(record.score)) return '记录分数不正确';
  if (validateNote(record.note)) return '记录备注不正确';
  if (!isDateTimeString(record.recordedAt)) return '记录时间不正确';
  if (!isDateTimeString(record.createdAt)) return '记录创建时间不正确';
  return null;
}

export function validateEventItem(event) {
  if (!event || typeof event.id !== 'string' || !event.id) return '大事件缺少编号';
  if (validateEventText(event.text)) return '大事件内容不正确';
  if (!isValidDateKey(event.date)) return '大事件日期不正确';
  if (!isDateTimeString(event.createdAt)) return '大事件创建时间不正确';
  return null;
}

// ---------------------------------------------------------------- 记录备份（不含外观）

export const RECORDS_BACKUP_KIND = 'jlrc-records';

/** 导出只包含记录与大事件，不含颜色、表情图、背景 */
export function buildRecordsBackup(data, now = new Date()) {
  return {
    kind: RECORDS_BACKUP_KIND,
    version: 1,
    exportedAt: toLocalDateTime(now),
    records: data.records,
    events: data.events,
  };
}

/**
 * 解析记录备份；也兼容旧版整份 data.json（读取其中的记录与大事件）。
 * @returns {{ok: true, records: Array, events: Array} | {ok: false, errors: string[]}}
 */
export function parseRecordsBackup(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: ['文件格式不正确'] };
  }
  const errors = [];
  if (payload.kind !== undefined && payload.kind !== RECORDS_BACKUP_KIND) {
    errors.push('这不是本应用的记录备份');
  }
  if (!Array.isArray(payload.records)) errors.push('文件里没有记录列表');
  if (!Array.isArray(payload.events)) errors.push('文件里没有大事件列表');
  if (errors.length) return { ok: false, errors };

  for (const record of payload.records) {
    const error = validateRecordItem(record);
    if (error) return { ok: false, errors: [`记录数据有误：${error}`] };
  }
  for (const event of payload.events) {
    const error = validateEventItem(event);
    if (error) return { ok: false, errors: [`大事件数据有误：${error}`] };
  }
  return { ok: true, records: payload.records, events: payload.events };
}

/** 只重置外观（背景 + 透明度），不动 10 档颜色、表情图和记录 */
export function resetAppearance(data, now = new Date()) {
  return {
    ...data,
    settings: {
      ...data.settings,
      background: { ...DEFAULT_BACKGROUND },
      appearance: { ...DEFAULT_APPEARANCE },
    },
    updatedAt: toLocalDateTime(now),
  };
}

// ---------------------------------------------------------------- 整份数据校验

export function validateData(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['数据格式不正确'];

  if (data.version !== VERSION) errors.push('数据版本不支持');

  const levels = data.settings && data.settings.levels;
  if (!Array.isArray(levels) || levels.length !== 10) {
    errors.push('设置损坏：需要 10 档表情与颜色');
  } else {
    const seen = new Set();
    for (const item of levels) {
      if (!item || !Number.isInteger(item.score) || item.score < 1 || item.score > 10) {
        errors.push('设置损坏：分数档位不正确');
        break;
      }
      if (seen.has(item.score)) {
        errors.push('设置损坏：分数档位重复');
        break;
      }
      seen.add(item.score);
      if (!COLOR_RE.test(String(item.color))) {
        errors.push('设置损坏：颜色格式不正确');
        break;
      }
      if (item.image !== null && item.image !== undefined) {
        if (typeof item.image !== 'string' || !IMAGE_RE.test(item.image) || item.image.length > LIMITS.imageDataUrl) {
          errors.push('设置损坏：表情图格式不正确');
          break;
        }
      }
    }
  }

  const eventIcon = data.settings && data.settings.eventIcon;
  if (eventIcon !== null && eventIcon !== undefined) {
    if (typeof eventIcon !== 'string' || !IMAGE_RE.test(eventIcon) || eventIcon.length > LIMITS.imageDataUrl) {
      errors.push('设置损坏：大事件图标格式不正确');
    }
  }

  const background = data.settings && data.settings.background;  if (background !== undefined) {
    if (!background || typeof background !== 'object' || !['solid', 'gradient', 'image'].includes(background.mode)) {
      errors.push('外观设置损坏：背景模式不正确');
    } else {
      for (const key of ['color', 'from', 'to']) {
        if (background[key] !== undefined && !COLOR_RE.test(String(background[key]))) {
          errors.push('外观设置损坏：颜色格式不正确');
          break;
        }
      }
      if (background.angle !== undefined && !['vertical', 'diagonal'].includes(background.angle)) {
        errors.push('外观设置损坏：渐变方向不正确');
      }
      if (
        background.scrim !== undefined &&
        (!Number.isInteger(background.scrim) || background.scrim < 0 || background.scrim > 100)
      ) {
        errors.push('外观设置损坏：遮罩强度不正确');
      }
      if (background.image !== null && background.image !== undefined) {
        if (
          typeof background.image !== 'string' ||
          !IMAGE_RE.test(background.image) ||
          background.image.length > LIMITS.backgroundDataUrl
        ) {
          errors.push('外观设置损坏：背景图格式不正确');
        }
      }
    }
  }

  const appearance = data.settings && data.settings.appearance;
  if (appearance !== undefined) {
    const alpha = appearance && appearance.surfaceAlpha;
    if (alpha !== undefined && (!Number.isInteger(alpha) || alpha < 0 || alpha > 100)) {
      errors.push('外观设置损坏：透明度不正确');
    }
    if (appearance && appearance.buttonColor !== undefined && !COLOR_RE.test(String(appearance.buttonColor))) {
      errors.push('外观设置损坏：按钮颜色不正确');
    }
  }

  if (!Array.isArray(data.records)) {
    errors.push('记录数据损坏');
  } else {
    for (const record of data.records) {
      const error = validateRecordItem(record);
      if (error) {
        errors.push(error);
        break;
      }
    }
  }

  if (!Array.isArray(data.events)) {
    errors.push('大事件数据损坏');
  } else {
    for (const event of data.events) {
      const error = validateEventItem(event);
      if (error) {
        errors.push(error);
        break;
      }
    }
  }

  if (!isDateTimeString(data.updatedAt)) errors.push('数据更新时间不正确');

  return errors;
}

// 单日、单类型的折线图：SVG 字符串。只画传入那一天的记录，绝不含跨天数据。
// 视觉：浅灰平滑曲线 + 分数色柔光点，最新一条额外有一圈细环。

import { chartAxis, chartPoints, clockOfMinutes, typeLabel } from './model.mjs';

const WIDTH = 520;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

/** 三次贝塞尔平滑；控制点被夹在相邻两点之间，曲线不会回环，也不会越过真实分数 */
export function smoothPath(points, xOf, yOf) {
  if (points.length < 2) return '';
  const coords = points.map((point) => ({ x: xOf(point.minutes), y: yOf(point.score) }));
  const clamp = (value, a, b) => Math.max(Math.min(a, b), Math.min(Math.max(a, b), value));

  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let index = 0; index < coords.length - 1; index += 1) {
    const p0 = coords[index - 1] || coords[index];
    const p1 = coords[index];
    const p2 = coords[index + 1];
    const p3 = coords[index + 2] || coords[index + 1];
    const lowX = Math.min(p1.x, p2.x);
    const highX = Math.max(p1.x, p2.x);
    const lowY = Math.min(p1.y, p2.y);
    const highY = Math.max(p1.y, p2.y);
    const c1x = clamp(p1.x + (p2.x - p0.x) / 6, lowX, highX);
    const c1y = clamp(p1.y + (p2.y - p0.y) / 6, lowY, highY);
    const c2x = clamp(p2.x - (p3.x - p1.x) / 6, lowX, highX);
    const c2y = clamp(p2.y - (p3.y - p1.y) / 6, lowY, highY);
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/**
 * @param {object} data 整份数据
 * @param {string} dateKey 只画这一天的数据
 * @param {string} type 记录类型
 * @param {{height?: number}} options
 * @returns {string} SVG 字符串；当天该类型没有记录时返回空串
 */
export function chartSvg(data, dateKey, type, options = {}) {
  const height = options.height || 160;
  const points = chartPoints(data, dateKey, type);
  if (!points.length) return '';
  const axis = chartAxis(points);

  const pad = { left: 30, right: 10, top: 12, bottom: 22 };
  const plotWidth = WIDTH - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const xOf = (minutes) => pad.left + ((minutes - axis.start) / (axis.end - axis.start)) * plotWidth;
  const yOf = (score) => pad.top + ((10 - score) / 9) * plotHeight;

  const grid = [1, 5, 10]
    .map((score) => {
      const y = yOf(score).toFixed(1);
      return (
        `<line class="chart-grid" x1="${pad.left}" y1="${y}" x2="${WIDTH - pad.right}" y2="${y}" />` +
        `<text class="chart-value-label" x="0" y="${(Number(y) + 3.5).toFixed(1)}" text-anchor="start">${score}</text>`
      );
    })
    .join('');

  let ticks;
  if (points.length === 1) {
    ticks = `<text class="chart-time-label" x="${xOf(points[0].minutes).toFixed(1)}" y="${height - 6}" text-anchor="middle">${points[0].clock}</text>`;
  } else {
    ticks =
      `<text class="chart-time-label" x="${pad.left}" y="${height - 6}" text-anchor="start">${clockOfMinutes(axis.start)}</text>` +
      `<text class="chart-time-label" x="${WIDTH - pad.right}" y="${height - 6}" text-anchor="end">${clockOfMinutes(axis.end)}</text>`;
  }

  const line =
    points.length > 1
      ? `<path class="chart-line" d="${smoothPath(points, xOf, yOf)}" />`
      : '';

  const dots = points
    .map((point, index) => {
      const cx = xOf(point.minutes).toFixed(1);
      const cy = yOf(point.score).toFixed(1);
      const isLatest = index === points.length - 1;
      const ring = isLatest
        ? `<circle class="chart-dot-ring" cx="${cx}" cy="${cy}" r="9" fill="none" stroke="${esc(point.color)}" stroke-width="1.2" opacity="0.45" />`
        : '';
      return `<g class="chart-point" data-point="${esc(point.id)}" data-clock="${esc(point.clock)}" data-score="${point.score}" data-note="${esc(point.note)}">
        <circle class="chart-dot-halo" cx="${cx}" cy="${cy}" r="11" fill="${esc(point.color)}" opacity="0.16" />
        ${ring}
        <circle class="chart-dot" cx="${cx}" cy="${cy}" r="5.5" fill="${esc(point.color)}" stroke="#ffffff" stroke-width="1.5"><title>${esc(point.clock)} · ${typeLabel(type)} ${point.score} 分${point.note ? ` · ${esc(point.note)}` : ''}</title></circle>
      </g>`;
    })
    .join('');

  return `<svg class="chart-svg" viewBox="0 0 ${WIDTH} ${height}" width="100%" height="${height}" role="img" aria-label="当天状态折线图">${grid}${ticks}${line}${dots}</svg>`;
}

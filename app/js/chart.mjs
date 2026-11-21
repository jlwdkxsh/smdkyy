// 单日、单类型的折线图：SVG 字符串。只画传入那一天的记录，绝不含跨天数据。

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
        `<text class="chart-axis-label" x="0" y="${Number(y) + 4}" text-anchor="start">${score}</text>`
      );
    })
    .join('');

  const middle = axis.start + (axis.end - axis.start) / 2;
  const ticks = [
    { at: axis.start, anchor: 'start' },
    { at: middle, anchor: 'middle' },
    { at: axis.end, anchor: 'end' },
  ]
    .map(({ at, anchor }) => {
      const x = xOf(at).toFixed(1);
      return `<text class="chart-axis-label" x="${x}" y="${height - 6}" text-anchor="${anchor}">${clockOfMinutes(at)}</text>`;
    })
    .join('');

  const line =
    points.length > 1
      ? `<polyline class="chart-line" points="${points
          .map((point) => `${xOf(point.minutes).toFixed(1)},${yOf(point.score).toFixed(1)}`)
          .join(' ')}" />`
      : '';

  const dots = points
    .map(
      (point) =>
        `<circle class="chart-dot" data-point="${esc(point.id)}" data-clock="${esc(point.clock)}" data-score="${point.score}" data-note="${esc(point.note)}" cx="${xOf(point.minutes).toFixed(1)}" cy="${yOf(point.score).toFixed(1)}" r="6" fill="${esc(point.color)}"><title>${esc(point.clock)} · ${typeLabel(type)} ${point.score} 分${point.note ? ` · ${esc(point.note)}` : ''}</title></circle>`,
    )
    .join('');

  return `<svg class="chart-svg" viewBox="0 0 ${WIDTH} ${height}" width="100%" height="${height}" role="img" aria-label="当天状态折线图">${grid}${ticks}${line}${dots}</svg>`;
}

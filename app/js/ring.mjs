// 日历圆环：三段圆弧（身体 / 精力 / 心情），每段颜色取当天该类平均分的档位颜色。
// 没有记录的类型只留浅灰底圈。

import { ringState } from './model.mjs';

export const RING_SIZE = 44;
export const RING_RADIUS = 17.25;
export const RING_STROKE = 3.5;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const SEGMENT = RING_CIRCUMFERENCE / 3;

export function ringSvg(data, dateKey, options = {}) {
  const size = options.size || RING_SIZE;
  const segments = ringState(data, dateKey);

  const arcs = segments
    .map((segment, index) => {
      if (!segment.present) return '';
      return `<circle class="ring-seg" data-type="${segment.type}" data-level="${segment.level}" cx="22" cy="22" r="${RING_RADIUS}" fill="none" stroke="${segment.color}" stroke-width="${RING_STROKE}" stroke-linecap="butt" stroke-dasharray="${SEGMENT.toFixed(2)} ${RING_CIRCUMFERENCE.toFixed(2)}" stroke-dashoffset="${(-SEGMENT * index).toFixed(2)}" transform="rotate(-90 22 22)" />`;
    })
    .join('');

  return `<svg class="ring" viewBox="0 0 44 44" width="${size}" height="${size}" aria-hidden="true"><circle class="ring-track" cx="22" cy="22" r="${RING_RADIUS}" fill="none" stroke="#ECECEA" stroke-width="${RING_STROKE}" />${arcs}</svg>`;
}

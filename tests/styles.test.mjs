import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const css = readFileSync(path.join(ROOT, 'app', 'styles.css'), 'utf8');

test('今日页标题：不换行，窄屏字号自动缩小', () => {
  assert.match(css, /\.page-head--today \.page-title\s*\{[^}]*white-space:\s*nowrap/);
  assert.match(css, /\.page-head--today \.page-title\s*\{[^}]*clamp\(16px, 4\.6vw, 20px\)/);
});

test('列表筛选：窄屏收紧间距与内边距，五个标签能排下', () => {
  const start = css.indexOf('@media (max-width: 520px)');
  assert.ok(start > -1, '应该有 520px 的窄屏断点');
  const end = css.indexOf('@media (max-width: 420px)', start);
  assert.ok(end > start, '应该有后续断点用于截取');
  const block = css.slice(start, end);

  assert.match(block, /\.chip\s*\{[^}]*padding:\s*6px 9px/);
  assert.match(block, /\.chip\s*\{[^}]*font-size:\s*12px/);
  assert.match(block, /\.chips\s*\{[^}]*gap:\s*6px/);
});


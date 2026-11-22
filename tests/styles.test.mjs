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

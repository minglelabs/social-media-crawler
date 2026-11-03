import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { addEntry, latestBlock, syncReadme } from './changelog.js';

test('adds entries under today, newest first', () => {
  let cl = '# Changelog\n';
  cl = addEntry(cl, 'feat: a', '2026-11-03');
  cl = addEntry(cl, 'fix(x): b', '2026-11-03');
  cl = addEntry(cl, 'fix(y): c', '2026-11-04');
  assert.equal(cl, '# Changelog\n\n## 2026-11-04\n\n- fix(y): c\n\n## 2026-11-03\n\n- fix(x): b\n- feat: a\n');
});

test('README block mirrors the latest entries', () => {
  const cl = '# Changelog\n\n## 2026-11-04\n\n- fix(y): c\n\n## 2026-11-03\n\n- feat: a\n';
  const readme = `# T\n<!-- LATEST-UPDATES:START -->\nold\n<!-- LATEST-UPDATES:END -->\n`;
  assert.match(syncReadme(readme, cl), /\*\*2026-11-04\*\* — fix\(y\): c\n- \*\*2026-11-03\*\* — feat: a/);
  assert.ok(latestBlock(cl).startsWith('<!-- LATEST-UPDATES:START -->'));
});

test('repo README is in sync with CHANGELOG.md', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const cl = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  assert.equal(syncReadme(readme, cl), readme);
});

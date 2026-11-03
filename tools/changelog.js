#!/usr/bin/env node
// Keeps CHANGELOG.md and the "Latest updates" block at the top of README.md in sync.
//   node tools/changelog.js add "fix(instagram): carousel images were skipped"
//   node tools/changelog.js sync     # regenerate the README block from CHANGELOG.md
//   node tools/changelog.js check    # exit 1 if README is out of date (used in CI/tests)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START = '<!-- LATEST-UPDATES:START -->';
const END = '<!-- LATEST-UPDATES:END -->';
const SHOWN = 8;

export function addEntry(changelog, text, date) {
  const heading = `## ${date}`;
  const bullet = `- ${text}`;
  // Same-day entries go on top of that day's list; a new day gets a new section right under the title.
  if (changelog.includes(`\n${heading}\n\n`)) return changelog.replace(`\n${heading}\n\n`, `\n${heading}\n\n${bullet}\n`);
  return changelog.replace(/(# Changelog\n)/, `$1\n${heading}\n\n${bullet}\n`);
}

export function latestBlock(changelog) {
  const out = [];
  let date = '';
  for (const line of changelog.split('\n')) {
    const h = line.match(/^## (\d{4}-\d{2}-\d{2})/);
    if (h) date = h[1];
    else if (line.startsWith('- ') && date && out.length < SHOWN) out.push(`- **${date}** — ${line.slice(2)}`);
  }
  return `${START}\n${out.join('\n')}\n${END}`;
}

export function syncReadme(readme, changelog) {
  const block = latestBlock(changelog);
  if (!readme.includes(START)) throw new Error('README.md is missing the LATEST-UPDATES markers');
  return readme.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, text] = process.argv.slice(2);
  const cl = path.join(root, 'CHANGELOG.md');
  const rd = path.join(root, 'README.md');
  if (cmd === 'add') {
    if (!text) throw new Error('usage: add "<type>(<platform>): message"');
    const date = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(cl, addEntry(fs.readFileSync(cl, 'utf8'), text, date));
  }
  if (cmd === 'add' || cmd === 'sync') {
    fs.writeFileSync(rd, syncReadme(fs.readFileSync(rd, 'utf8'), fs.readFileSync(cl, 'utf8')));
  } else if (cmd === 'check') {
    const readme = fs.readFileSync(rd, 'utf8');
    if (syncReadme(readme, fs.readFileSync(cl, 'utf8')) !== readme) {
      console.error('README "Latest updates" is out of date; run: node tools/changelog.js sync');
      process.exit(1);
    }
  }
}

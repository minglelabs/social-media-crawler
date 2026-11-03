import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseReviews, classify, checkReviews } from '../src/index.js';

const row = (id, rating, text) => [id, ['Someone', 'https://x/a.png'], rating, text, [1793561433, 1], [1793561433, 1], 0, null, null, null, null, '0.1.0', null, 'en', 'ext'];
const ID = (n) => `00000000-0000-0000-0000-00000000000${n}`;
const html = (rows) => `<script>AF_initDataCallback({key: 'ds:1', hash: '1', data:${JSON.stringify([['token'], rows])}, sideChannel: {}});</script>`;

test('parses reviews out of the embedded data block', () => {
  const reviews = parseReviews(html([row(ID(1), 1, 'broken')]));
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].rating, 1);
  assert.equal(reviews[0].version, '0.1.0');
});

test('classifies "not working" reports in several languages', () => {
  assert.ok(classify({ rating: 1, text: "Doesn't work anymore" }).broken);
  assert.ok(classify({ rating: 2, text: '더 이상 동작 안해요' }).broken);
  assert.ok(classify({ rating: 1, text: '動かない' }).broken);
  assert.ok(!classify({ rating: 5, text: 'Great, no error at all' }).broken);
  assert.ok(!classify({ rating: 1, text: 'Too expensive' }).broken);
});

test('reports each broken review only once across runs', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smc-'));
  const statePath = path.join(dir, 'seen.json');
  const fetchImpl = async () => parseReviews(html([row(ID(1), 1, '안돼요'), row(ID(2), 5, 'good')]));
  const first = await checkReviews('ext', { statePath, fetchImpl });
  assert.equal(first.broken.length, 1);
  assert.match(first.report, /1 new/);
  const second = await checkReviews('ext', { statePath, fetchImpl });
  assert.equal(second.broken.length, 0);
  assert.equal(second.report, null);
});

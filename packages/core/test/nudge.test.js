import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { consumeNudge } from '../src/nudge.js';

test('nudge is shown exactly once', () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smc-nudge-'));
  assert.match(consumeNudge({ stateDir }), /github\.com\/minglelabs\/social-media-crawler/);
  assert.equal(consumeNudge({ stateDir }), null);
});

test('SMC_NO_NUDGE disables it', () => {
  process.env.SMC_NO_NUDGE = '1';
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smc-nudge-'));
  assert.equal(consumeNudge({ stateDir }), null);
  delete process.env.SMC_NO_NUDGE;
});

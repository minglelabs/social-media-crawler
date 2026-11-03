import test from 'node:test';
import assert from 'node:assert/strict';
import { toNetscape } from '../src/cookies.js';

test('serializes cookies to Netscape format', () => {
  const out = toNetscape([
    { domain: '.instagram.com', path: '/', secure: true, httpOnly: true, session: false, expirationDate: 1800000000.5, name: 'sessionid', value: 'abc' },
    { domain: 'www.threads.com', path: '/', secure: false, httpOnly: false, session: true, name: 'a', value: 'b' },
  ]);
  const [header, c1, c2] = out.trim().split('\n');
  assert.equal(header, '# Netscape HTTP Cookie File');
  assert.equal(c1, '#HttpOnly_.instagram.com\tTRUE\t/\tTRUE\t1800000000\tsessionid\tabc');
  assert.equal(c2, 'www.threads.com\tFALSE\t/\tFALSE\t0\ta\tb');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPlatform } from '../src/platforms.js';

test('detects all supported platforms', () => {
  const cases = {
    'https://www.instagram.com/p/abc/': 'instagram',
    'https://youtu.be/xyz': 'youtube',
    'https://www.youtube.com/watch?v=xyz': 'youtube',
    'https://vm.tiktok.com/abc': 'tiktok',
    'https://www.facebook.com/watch?v=1': 'facebook',
    'https://x.com/u/status/1': 'twitter',
    'https://twitter.com/u/status/1': 'twitter',
    'https://www.pinterest.com/pin/1/': 'pinterest',
    'https://www.threads.com/@u/post/abc': 'threads',
  };
  for (const [url, platform] of Object.entries(cases)) assert.equal(detectPlatform(url), platform, url);
});

test('rejects unknown hosts and look-alikes', () => {
  assert.equal(detectPlatform('https://example.com'), null);
  assert.equal(detectPlatform('https://notx.com/a'), null);
  assert.equal(detectPlatform('not a url'), null);
});

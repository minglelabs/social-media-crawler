#!/usr/bin/env node
// Chrome native messaging host: 4-byte little-endian length prefix + UTF-8 JSON, over stdin/stdout.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { downloadMedia } from '@minglelabs/smc-core';

function send(obj) {
  const body = Buffer.from(JSON.stringify(obj));
  const head = Buffer.alloc(4);
  head.writeUInt32LE(body.length);
  process.stdout.write(Buffer.concat([head, body]));
}

async function handle(msg) {
  if (msg?.type !== 'download' || typeof msg.url !== 'string') return { ok: false, error: 'bad request' };
  let dir;
  try {
    const opts = { cookiesFromBrowser: process.env.SMC_COOKIES_BROWSER };
    if (typeof msg.cookies === 'string' && msg.cookies) {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smc-'));
      opts.cookiesFile = path.join(dir, 'cookies.txt');
      fs.writeFileSync(opts.cookiesFile, msg.cookies, { mode: 0o600 });
    }
    const result = await downloadMedia(msg.url, opts);
    return { ok: true, via: result.engine, files: result.files };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
}

let buf = Buffer.alloc(0);
process.stdin.on('data', async (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  while (buf.length >= 4 && buf.length >= 4 + buf.readUInt32LE(0)) {
    const len = buf.readUInt32LE(0);
    const msg = JSON.parse(buf.subarray(4, 4 + len).toString());
    buf = buf.subarray(4 + len);
    send(await handle(msg));
  }
});
process.stdin.on('end', () => process.exit(0));

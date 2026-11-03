#!/usr/bin/env node
// Chrome native messaging host: 4-byte little-endian length prefix + UTF-8 JSON, over stdin/stdout.
import { downloadMedia } from '@minglelabs/smc-core';

function send(obj) {
  const body = Buffer.from(JSON.stringify(obj));
  const head = Buffer.alloc(4);
  head.writeUInt32LE(body.length);
  process.stdout.write(Buffer.concat([head, body]));
}

async function handle(msg) {
  if (msg?.type !== 'download' || typeof msg.url !== 'string') return { ok: false, error: 'bad request' };
  try {
    const result = await downloadMedia(msg.url, { cookiesFromBrowser: process.env.SMC_COOKIES_BROWSER });
    return { ok: true, via: result.engine, files: result.files };
  } catch (err) {
    return { ok: false, error: err.message };
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

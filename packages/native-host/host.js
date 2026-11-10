#!/usr/bin/env node
// Chrome native messaging host: 4-byte little-endian length prefix + UTF-8 JSON, over stdin/stdout.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { downloadMedia } from '@minglelabs/smc-core';

function send(obj) {
  const body = Buffer.from(JSON.stringify(obj));
  const head = Buffer.alloc(4);
  head.writeUInt32LE(body.length);
  process.stdout.write(Buffer.concat([head, body]));
}

// Download into a scratch dir and serve it on 127.0.0.1 so the browser saves (and lists) the files itself.
async function handoff(url, opts) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'smc-out-'));
  const result = await downloadMedia(url, { ...opts, outDir: out });
  const files = result.files.filter((f) => fs.existsSync(f));
  const flat = fs.mkdtempSync(path.join(os.tmpdir(), 'smc-serve-'));
  const names = files.map((f, i) => {
    const name = `${i}_${path.basename(f)}`;
    fs.renameSync(f, path.join(flat, name));
    return name;
  });
  fs.rmSync(out, { recursive: true, force: true });
  if (!names.length) throw new Error('no files were produced');
  const token = crypto.randomBytes(16).toString('hex');
  const child = spawn(process.execPath, [fileURLToPath(new URL('./serve.js', import.meta.url)), flat, token], {
    detached: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const port = await new Promise((resolve, reject) => {
    child.stdout.once('data', (d) => resolve(Number(String(d).trim())));
    child.once('error', reject);
  });
  child.unref();
  child.stdout.destroy();
  return {
    ok: true,
    via: result.engine,
    serve: names.map((n) => ({ url: `http://127.0.0.1:${port}/${token}/${encodeURIComponent(n)}`, name: n.replace(/^\d+_/, '') })),
  };
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
    if (msg.handoff) return await handoff(msg.url, opts);
    const result = await downloadMedia(msg.url, opts);
    return { ok: true, via: result.engine, files: result.files };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
}

let buf = Buffer.alloc(0);
let inFlight = 0;
let ended = false;
process.stdin.on('data', async (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  while (buf.length >= 4 && buf.length >= 4 + buf.readUInt32LE(0)) {
    const len = buf.readUInt32LE(0);
    const msg = JSON.parse(buf.subarray(4, 4 + len).toString());
    buf = buf.subarray(4 + len);
    inFlight++;
    const res = await handle(msg);
    inFlight--;
    if (!ended) send(res);
    else if (!inFlight) process.exit(0);
  }
});
// Let a running download finish its cleanup (temp cookie file) before exiting.
process.stdin.on('end', () => {
  ended = true;
  if (!inFlight) process.exit(0);
});

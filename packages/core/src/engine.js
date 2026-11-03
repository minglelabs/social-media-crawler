import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { PLATFORMS, detectPlatform } from './platforms.js';

const DEFAULT_OUT = path.join(os.homedir(), 'Downloads', 'SocialMediaCrawler');
// Homebrew/pip bins are often missing from the PATH of GUI-launched processes (e.g. native messaging hosts).
const EXTRA_PATH = ['/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), '.local/bin')];

function run(cmd, args) {
  return new Promise((resolve) => {
    const env = { ...process.env, PATH: [process.env.PATH, ...EXTRA_PATH].filter(Boolean).join(':') };
    const child = spawn(cmd, args, { env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (err) => resolve({ code: -1, stdout, stderr: String(err.message) }));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function cookieArgs(engine, browser) {
  return browser ? ['--cookies-from-browser', browser] : [];
}

function enginesFor(url) {
  const platform = detectPlatform(url);
  if (!platform) throw new Error(`Unsupported URL: ${url}`);
  const engines = PLATFORMS[platform].engines;
  if (!engines.length) {
    throw new Error(`${platform} has no CLI engine; use the browser extension overlay on the page instead`);
  }
  return { platform, engines };
}

async function listWith(engine, url, opts) {
  if (engine === 'yt-dlp') {
    const r = await run('yt-dlp', ['-J', '--no-warnings', ...cookieArgs(engine, opts.cookiesFromBrowser), url]);
    if (r.code !== 0) throw new Error(r.stderr.trim().split('\n').pop() || 'yt-dlp failed');
    const info = JSON.parse(r.stdout);
    const entries = info.entries ?? [info];
    return entries.filter(Boolean).map((e) => ({
      type: 'video',
      title: e.title ?? null,
      ext: e.ext ?? null,
      pageUrl: e.webpage_url ?? url,
    }));
  }
  const r = await run('gallery-dl', ['-j', ...cookieArgs(engine, opts.cookiesFromBrowser), url]);
  if (r.code !== 0) throw new Error(r.stderr.trim().split('\n').pop() || 'gallery-dl failed');
  // gallery-dl -j emits [[2, {...}], [3, "https://...", {...}], ...]; type 3 = file URL.
  return JSON.parse(r.stdout)
    .filter((row) => row[0] === 3)
    .map(([, mediaUrl, meta]) => ({
      type: /\.(mp4|webm|mov|m4v)(\?|$)/i.test(mediaUrl) ? 'video' : 'image',
      url: mediaUrl,
      ext: meta?.extension ?? null,
      pageUrl: url,
    }));
}

async function downloadWith(engine, url, opts) {
  const outDir = opts.outDir ?? DEFAULT_OUT;
  if (engine === 'yt-dlp') {
    const r = await run('yt-dlp', [
      '-o', path.join(outDir, '%(extractor)s', '%(uploader)s_%(id)s.%(ext)s'),
      '--no-warnings', '--print', 'after_move:filepath',
      ...cookieArgs(engine, opts.cookiesFromBrowser), url,
    ]);
    if (r.code !== 0) throw new Error(r.stderr.trim().split('\n').pop() || 'yt-dlp failed');
    return r.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  }
  const r = await run('gallery-dl', ['-d', outDir, ...cookieArgs(engine, opts.cookiesFromBrowser), url]);
  if (r.code !== 0) throw new Error(r.stderr.trim().split('\n').pop() || 'gallery-dl failed');
  // Skipped (already downloaded) files are prefixed with "# ".
  return r.stdout.split('\n').map((l) => l.replace(/^# /, '').trim()).filter(Boolean);
}

async function withFallback(url, opts, fn) {
  const { platform, engines } = enginesFor(url);
  const errors = [];
  for (const engine of engines) {
    try {
      return { platform, engine, ...(await fn(engine, url, opts)) };
    } catch (err) {
      errors.push(`${engine}: ${err.message}`);
    }
  }
  throw new Error(`All engines failed for ${url}\n${errors.join('\n')}`);
}

export const listMedia = (url, opts = {}) =>
  withFallback(url, opts, async (engine) => ({ items: await listWith(engine, url, opts) }));

export const downloadMedia = (url, opts = {}) =>
  withFallback(url, opts, async (engine) => ({ files: await downloadWith(engine, url, opts) }));

export async function doctor() {
  const check = async (cmd, args) => {
    const r = await run(cmd, args);
    return r.code === 0 ? { ok: true, version: r.stdout.trim().split('\n')[0] } : { ok: false, error: r.stderr.trim() };
  };
  return {
    'yt-dlp': await check('yt-dlp', ['--version']),
    'gallery-dl': await check('gallery-dl', ['--version']),
    outDir: DEFAULT_OUT,
  };
}

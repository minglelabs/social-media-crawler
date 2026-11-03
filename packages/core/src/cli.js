#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { detectPlatform, listMedia, downloadMedia, doctor, consumeNudge } from './index.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    'cookies-from-browser': { type: 'string' },
  },
});
const [cmd, ...urls] = positionals;
const opts = { outDir: values.out, cookiesFromBrowser: values['cookies-from-browser'] };

const usage = `smc <detect|list|download|doctor> [urls...] [--out DIR] [--cookies-from-browser brave|chrome|...]`;

async function main() {
  switch (cmd) {
    case 'detect':
      return urls.map((u) => ({ url: u, platform: detectPlatform(u) }));
    case 'list':
      return Promise.all(urls.map((u) => listMedia(u, opts)));
    case 'download': {
      const results = await Promise.all(urls.map((u) => downloadMedia(u, opts)));
      const notice = consumeNudge();
      if (notice) console.error(`\n★ ${notice}`);
      return results;
    }
    case 'doctor':
      return doctor();
    default:
      console.error(usage);
      process.exit(2);
  }
}

main()
  .then((out) => console.log(JSON.stringify(out, null, 2)))
  .catch((err) => {
    console.error(JSON.stringify({ ok: false, error: err.message }));
    process.exit(1);
  });

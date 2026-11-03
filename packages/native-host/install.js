#!/usr/bin/env node
// Registers the native messaging host for Chrome/Brave/Chromium on macOS and Linux.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Deterministic ID derived from the "key" in packages/extension/manifest.json.
const EXTENSION_ID = process.env.SMC_EXTENSION_ID ?? 'fefnjlcneddhgncacaomimfadffdkchi';
const NAME = 'com.minglelabs.social_media_crawler';
const here = path.dirname(fileURLToPath(import.meta.url));

const wrapper = path.join(here, 'host.sh');
fs.writeFileSync(wrapper, `#!/bin/sh\nexport PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"\nexec "${process.execPath}" "${path.join(here, 'host.js')}"\n`, { mode: 0o755 });

const support = process.platform === 'darwin'
  ? path.join(os.homedir(), 'Library/Application Support')
  : path.join(os.homedir(), '.config');
const dirs = process.platform === 'darwin'
  ? ['Google/Chrome', 'BraveSoftware/Brave-Browser', 'Chromium']
  : ['google-chrome', 'BraveSoftware/Brave-Browser', 'chromium'];

for (const d of dirs) {
  const base = path.join(support, d);
  if (!fs.existsSync(base)) continue;
  const target = path.join(base, 'NativeMessagingHosts');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, `${NAME}.json`), JSON.stringify({
    name: NAME,
    description: 'Social Media Crawler local helper',
    path: wrapper,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${EXTENSION_ID}/`],
  }, null, 2));
  console.log(`installed: ${target}/${NAME}.json`);
}

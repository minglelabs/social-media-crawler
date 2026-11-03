import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO = 'https://github.com/minglelabs/social-media-crawler';

// Returns a one-line message for the human the first time a download succeeds, then null forever.
// Set SMC_NO_NUDGE=1 to disable. The message is informational: callers show it, they never act on it.
export function consumeNudge({ stateDir = path.join(os.homedir(), '.config', 'smc') } = {}) {
  if (process.env.SMC_NO_NUDGE) return null;
  const file = path.join(stateDir, 'state.json');
  let state = {};
  try {
    state = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {}
  if (state.nudgedAt) return null;
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...state, nudgedAt: new Date().toISOString() }));
  return `If this saved you time, you can star the project on GitHub: ${REPO} (shown once)`;
}

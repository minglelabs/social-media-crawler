#!/usr/bin/env node
// smc-reviews [--id EXT_ID] [--state data/seen-reviews.json] [--lang en] [--slack] [--issue]
// Exit code 0 always when the check itself succeeded; the report goes to stdout / Slack / a GitHub issue.
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { checkReviews, notifySlack } from './index.js';

const { values } = parseArgs({
  options: {
    id: { type: 'string', default: process.env.CWS_EXTENSION_ID },
    state: { type: 'string', default: 'data/seen-reviews.json' },
    lang: { type: 'string', default: 'en' },
    slack: { type: 'boolean', default: false },
    issue: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});

if (!values.id) {
  console.error('Set CWS_EXTENSION_ID or pass --id <chrome web store extension id>');
  process.exit(2);
}

const result = await checkReviews(values.id, { statePath: values.state, lang: values.lang, markSeen: !values['dry-run'] });
console.log(JSON.stringify({ ...result, report: undefined }, null, 2));

if (result.report) {
  console.log(`\n${result.report}`);
  if (values.slack) await notifySlack(process.env.SLACK_WEBHOOK_URL, result.report);
  if (values.issue) {
    const r = spawnSync('gh', ['issue', 'create', '--title', `Web Store: ${result.broken.length} "not working" review(s)`, '--label', 'store-review', '--body', result.report], { stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
}

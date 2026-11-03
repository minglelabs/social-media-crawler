import fs from 'node:fs';
import path from 'node:path';
import { fetchReviews } from './fetch.js';
import { classify } from './classify.js';

function loadSeen(statePath) {
  try {
    return new Set(JSON.parse(fs.readFileSync(statePath, 'utf8')));
  } catch {
    return new Set();
  }
}

function saveSeen(statePath, seen) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify([...seen].sort(), null, 2)}\n`);
}

export function renderReport(extensionId, broken) {
  const lines = broken.map(
    (r) => `- ★${r.rating} ${r.createdAt?.slice(0, 10) ?? ''} v${r.version ?? '?'} (${r.lang ?? '?'}) — ${r.text.replace(/\s+/g, ' ').slice(0, 300)}`,
  );
  return [
    `## ${broken.length} new "not working" review(s) for \`${extensionId}\``,
    '',
    ...lines,
    '',
    `https://chromewebstore.google.com/detail/${extensionId}/reviews`,
  ].join('\n');
}

// Returns only reviews not reported before, and records them in the state file so the next run skips them.
export async function checkReviews(extensionId, { statePath, lang, fetchImpl = fetchReviews, markSeen = true } = {}) {
  const reviews = await fetchImpl(extensionId, { lang });
  const seen = statePath ? loadSeen(statePath) : new Set();
  const fresh = reviews.filter((r) => !seen.has(r.id));
  const broken = fresh.map((r) => ({ ...r, ...classify(r) })).filter((r) => r.broken);
  if (statePath && markSeen) {
    for (const r of reviews) seen.add(r.id);
    saveSeen(statePath, seen);
  }
  return {
    extensionId,
    fetched: reviews.length,
    newReviews: fresh.length,
    broken,
    report: broken.length ? renderReport(extensionId, broken) : null,
  };
}

export async function notifySlack(webhookUrl, text) {
  const res = await fetch(webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
  if (!res.ok) throw new Error(`Slack webhook returned ${res.status}`);
}

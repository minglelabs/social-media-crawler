// The Chrome Web Store has no public reviews API. The reviews page embeds the newest page of reviews
// in an AF_initDataCallback JSON block, which is what we parse here. Older pages are not reachable this way.
const BLOCK = /AF_initDataCallback\(\{key: '(ds:\d+)', hash: '[^']*', data:(.*?), sideChannel: \{\}\}\);<\/script>/gs;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/;

function toReview(row) {
  const [id, author, rating, text, created, updated, , , , , , version, , lang] = row;
  return {
    id,
    author: Array.isArray(author) ? author[0] : null,
    rating,
    text: text ?? '',
    createdAt: Array.isArray(created) ? new Date(created[0] * 1000).toISOString() : null,
    updatedAt: Array.isArray(updated) ? new Date(updated[0] * 1000).toISOString() : null,
    version: version ?? null,
    lang: lang ?? null,
  };
}

function findRows(node, out = []) {
  if (!Array.isArray(node)) return out;
  if (typeof node[0] === 'string' && UUID.test(node[0]) && typeof node[2] === 'number' && typeof node[3] === 'string') {
    out.push(node);
    return out;
  }
  for (const child of node) findRows(child, out);
  return out;
}

export function parseReviews(html) {
  const reviews = [];
  for (const m of html.matchAll(BLOCK)) {
    let data;
    try {
      data = JSON.parse(m[2]);
    } catch {
      continue;
    }
    reviews.push(...findRows(data).map(toReview));
  }
  return reviews;
}

export async function fetchReviews(extensionId, { lang = 'en' } = {}) {
  const url = `https://chromewebstore.google.com/detail/${extensionId}/reviews?hl=${lang}`;
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; smc-review-monitor)' } });
  if (!res.ok) throw new Error(`Web Store returned ${res.status} for ${url}`);
  const reviews = parseReviews(await res.text());
  if (!reviews.length) throw new Error('No reviews parsed; the Web Store page format may have changed (or the extension has no reviews yet)');
  return reviews;
}

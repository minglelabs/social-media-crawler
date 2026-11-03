const NATIVE_HOST = 'com.minglelabs.social_media_crawler';
const ROOT = 'SocialMediaCrawler';

const PLATFORM_HOSTS = {
  instagram: 'instagram.com', youtube: 'youtube.com', tiktok: 'tiktok.com', facebook: 'facebook.com',
  twitter: 'x.com', pinterest: 'pinterest.com', threads: 'threads.',
};

function platformOf(url) {
  const host = new URL(url).hostname;
  if (host.includes('twitter.com')) return 'twitter';
  return Object.entries(PLATFORM_HOSTS).find(([, h]) => host.includes(h))?.[0] ?? 'misc';
}

// Highest-resolution variant of a CDN image URL, where the CDN allows it without re-signing.
function bestImageUrl(url) {
  const u = new URL(url);
  if (u.hostname === 'pbs.twimg.com') {
    u.searchParams.set('name', 'orig');
    return u.toString();
  }
  if (u.hostname === 'i.pinimg.com') return url.replace(/\/\d+x\//, '/originals/');
  return url;
}

function filenameFor(url, platform, kind) {
  const base = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'media').replace(/[^\w.-]+/g, '_');
  const hasExt = /\.[a-z0-9]{2,4}$/i.test(base);
  return `${ROOT}/${platform}/${hasExt ? base : `${base}.${kind === 'video' ? 'mp4' : 'jpg'}`}`;
}

function directUrl({ kind, mediaUrl }) {
  if (!mediaUrl || !/^https?:/.test(mediaUrl)) return null; // blob:/data: need the helper
  if (kind === 'image') return bestImageUrl(mediaUrl);
  return /\.mp4(\?|$)/i.test(mediaUrl) ? mediaUrl : null; // HLS/DASH segments need the helper
}

async function handle(msg) {
  const platform = platformOf(msg.pageUrl);
  const direct = directUrl(msg);
  if (direct) {
    await chrome.downloads.download({
      url: direct,
      filename: filenameFor(direct, platform, msg.kind),
      conflictAction: 'uniquify',
    });
    return { ok: true, via: 'browser' };
  }
  // Streams/blob media: hand the post URL to the local yt-dlp/gallery-dl helper.
  const res = await chrome.runtime.sendNativeMessage(NATIVE_HOST, { type: 'download', url: msg.permalink ?? msg.pageUrl });
  return res;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'download') return false;
  handle(msg).then(sendResponse, (err) => sendResponse({ ok: false, error: String(err.message ?? err) }));
  return true;
});

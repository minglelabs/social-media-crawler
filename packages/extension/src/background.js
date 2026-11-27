import { toNetscape } from './cookies.js';

const NATIVE_HOST = 'com.minglelabs.social_media_crawler';
const ROOT = 'SocialMediaCrawler';

const PLATFORM_HOSTS = {
  instagram: 'instagram.com', youtube: 'youtube.com', tiktok: 'tiktok.com', facebook: 'facebook.com',
  twitter: 'x.com', pinterest: 'pinterest.com', threads: 'threads.', linkedin: 'linkedin.com',
};

function platformOf(url) {
  const host = new URL(url).hostname;
  if (host.includes('twitter.com')) return 'twitter';
  return Object.entries(PLATFORM_HOSTS).find(([, h]) => host.includes(h))?.[0] ?? 'misc';
}

// instagram.com for www.instagram.com, x.com for x.com; good enough for the supported sites.
function registrableDomain(url) {
  return new URL(url).hostname.split('.').slice(-2).join('.');
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

const REPO = 'https://github.com/minglelabs/social-media-crawler';

// Shown once, after the first successful download. Store installs get a review link; GitHub/unpacked installs
// get the repo link only. The user can dismiss it and it never comes back.
async function maybeNudge() {
  const { downloads = 0, nudged = false } = await chrome.storage.local.get(['downloads', 'nudged']);
  await chrome.storage.local.set({ downloads: downloads + 1 });
  if (nudged) return null;
  await chrome.storage.local.set({ nudged: true });
  const fromStore = Boolean(chrome.runtime.getManifest().update_url);
  return { github: REPO, review: fromStore ? `https://chromewebstore.google.com/detail/${chrome.runtime.id}/reviews` : null };
}

// chrome.downloads.download() resolves as soon as the download starts, so wait for it to finish (or fail)
// before telling the user it was saved.
async function saveDirect(url, filename) {
  const id = await chrome.downloads.download({ url, filename, conflictAction: 'uniquify' });
  return new Promise((resolve) => {
    const done = (res) => {
      chrome.downloads.onChanged.removeListener(listener);
      resolve(res);
    };
    const listener = (d) => {
      if (d.id !== id || !d.state) return;
      if (d.state.current === 'complete') done({ ok: true, via: 'browser' });
      else if (d.state.current === 'interrupted') done({ ok: false, error: d.error?.current ?? 'interrupted' });
    };
    chrome.downloads.onChanged.addListener(listener);
    chrome.downloads.search({ id }).then(([d]) => {
      if (d?.state === 'complete') done({ ok: true, via: 'browser' });
      else if (d?.state === 'interrupted') done({ ok: false, error: d.error ?? 'interrupted' });
    });
  });
}

// A long-lived port (unlike sendNativeMessage) keeps the service worker alive while a long video downloads.
function askHelper(msg, onProgress) {
  return new Promise((resolve) => {
    const port = chrome.runtime.connectNative(NATIVE_HOST);
    port.onMessage.addListener((res) => {
      if (res?.type === 'progress') return onProgress?.(res.percent);
      resolve(res);
      port.disconnect();
    });
    port.onDisconnect.addListener(() =>
      resolve({ ok: false, error: chrome.runtime.lastError?.message ?? 'helper disconnected' }));
    port.postMessage(msg);
  });
}

// Facebook shows photos as small resized copies (a grid thumbnail is ~400px); the photo page itself has the
// original, which the helper (gallery-dl) can fetch. Try that first and keep the on-screen copy as a fallback.
const FB_PHOTO = /facebook\.com\/(photo\.php|photo\/\?)/;

async function download(msg, tabId) {
  const platform = platformOf(msg.pageUrl);
  const direct = directUrl(msg);
  if (direct && msg.kind === 'image' && FB_PHOTO.test(msg.permalink ?? '')) {
    const res = await viaHelper(msg, platform, tabId);
    if (res?.ok) return res;
    return saveDirect(direct, filenameFor(direct, platform, msg.kind));
  }
  if (direct) {
    const res = await saveDirect(direct, filenameFor(direct, platform, msg.kind));
    if (res.ok) return res;
    // The browser refused or the CDN rejected the request; the helper can still fetch the post itself.
  }
  return viaHelper(msg, platform, tabId);
}

// Streams/blob media: hand the post URL to the local yt-dlp/gallery-dl helper, together with this browser's
// login cookies for the site (Instagram reels/stories, private posts) so the helper sees what the user sees.
async function viaHelper(msg, platform, tabId) {
  const url = msg.permalink ?? msg.pageUrl;
  const cookies = toNetscape(await chrome.cookies.getAll({ domain: registrableDomain(url) }));
  const progress = (percent) => tabId != null && chrome.tabs.sendMessage(tabId, { type: 'progress', percent }).catch(() => {});
  const res = await askHelper({ type: 'download', url, cookies, handoff: true }, progress);
  if (!res?.ok || !res.serve) return res;
  // The helper serves what it fetched on localhost; saving it through the browser puts it in the download list.
  for (const f of res.serve) {
    const saved = await saveDirect(f.url, `${ROOT}/${platform}/${f.name}`);
    if (!saved.ok) return saved;
  }
  return { ok: true, via: res.via };
}

async function handle(msg, tabId) {
  const res = await download(msg, tabId);
  return res?.ok ? { ...res, nudge: await maybeNudge() } : res;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'download') return false;
  handle(msg, sender.tab?.id).then(sendResponse, (err) => sendResponse({ ok: false, error: String(err.message ?? err) }));
  return true;
});

// Content scripts only load on page load, so tabs opened before an install/update would keep a dead copy
// ("Cannot read properties of undefined (reading 'sendMessage')"). Inject the current scripts into them.
chrome.runtime.onInstalled.addListener(async () => {
  for (const cs of chrome.runtime.getManifest().content_scripts ?? []) {
    const tabs = await chrome.tabs.query({ url: cs.matches });
    for (const tab of tabs) {
      chrome.scripting
        .executeScript({ target: { tabId: tab.id }, files: cs.js, world: cs.world ?? 'ISOLATED' })
        .catch(() => {}); // discarded / not yet loaded tabs pick the scripts up on their next load
    }
  }
});

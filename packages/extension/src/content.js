// One overlay button for every image/video on the page. No other choices are shown to the user.
const MIN_SIZE = 160;
const SKIP_ALT = /profile|avatar|프로필|プロフィール/i;
const VIDEO_LINK = /\/(video|reel|reels|shorts)\/|watch\?v=/;
const PERMALINK = 'a[href*="/post/"], a[href*="/p/"], a[href*="/reel/"], a[href*="/status/"], a[href*="/video/"], a[href*="/pin/"], a[href*="watch?v="], a[href*="/shorts/"], a[href*="/feed/update/"], a[href*="/posts/"]';

const host = document.createElement('div');
host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
const shadow = host.attachShadow({ mode: 'closed' });
shadow.innerHTML = `
  <style>
    button{position:fixed;display:none;pointer-events:auto;width:36px;height:36px;border:0;border-radius:50%;
      background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;font:700 18px system-ui;cursor:pointer;
      box-shadow:0 2px 8px rgba(0,0,0,.4)}
    button:hover{filter:brightness(1.15)}
    .toast{position:fixed;right:16px;bottom:16px;padding:10px 14px;border-radius:8px;background:#111;color:#fff;
      font:13px system-ui;display:none;pointer-events:none;max-width:320px}
    .nudge{position:fixed;right:16px;bottom:64px;padding:12px 14px;border-radius:10px;background:#111;color:#fff;
      font:13px system-ui;display:none;pointer-events:auto;max-width:300px;box-shadow:0 4px 16px rgba(0,0,0,.5)}
    .nudge a{display:inline-block;margin:8px 8px 0 0;padding:6px 10px;border-radius:6px;background:#7c3aed;color:#fff;
      text-decoration:none}
    .nudge .x{position:absolute;top:4px;right:8px;cursor:pointer;opacity:.6}
  </style>
  <button title="Download">⬇</button><div class="toast"></div><div class="nudge"></div>`;
const button = shadow.querySelector('button');
const toast = shadow.querySelector('.toast');
const nudgeBox = shadow.querySelector('.nudge');
document.documentElement.append(host);

let target = null;
let hideTimer = null;

function mediaSource(el) {
  return el instanceof HTMLImageElement ? el.currentSrc || el.src : el.currentSrc || el.src || '';
}

// Threads streams videos from blob: URLs and no CLI engine supports it; page-video.js (page world) reads the
// player's progressive mp4 for us. Elsewhere, or if that fails, keep the element's own source.
function videoSource(el) {
  const own = mediaSource(el);
  if (!own.startsWith('blob:') || !/(^|\.)threads\.(com|net)$/.test(location.hostname)) return own;
  el.removeAttribute('data-smc-src');
  el.setAttribute('data-smc-want', '');
  document.dispatchEvent(new CustomEvent('smc-resolve-video'));
  return el.getAttribute('data-smc-src') || own;
}

// Facebook chat: the small fixed-position chat windows and the full /messages page. Chat photos are not
// something to download from one-click overlays, and the button covers the conversation.
function inMessenger(el) {
  if (!location.hostname.endsWith('facebook.com')) return false;
  if (location.pathname.startsWith('/messages')) return true;
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    if (n.offsetWidth > 0 && n.offsetWidth <= 420 && getComputedStyle(n).position === 'fixed') return true;
  }
  return false;
}

function isMedia(el) {
  if (!(el instanceof HTMLImageElement || el instanceof HTMLVideoElement)) return false;
  if (inMessenger(el)) return false;
  const r = el.getBoundingClientRect();
  if (r.width < MIN_SIZE || r.height < MIN_SIZE) return false;
  if (el instanceof HTMLImageElement && SKIP_ALT.test(el.alt || '')) return false;
  return Boolean(mediaSource(el)) || el instanceof HTMLVideoElement;
}

// The part of the media left after the viewport and every clipping (scrolling/carousel) container cut it.
// Only containing blocks clip: a fixed box escapes every ancestor, an absolute one skips static ancestors.
function visibleRect(el) {
  const r = el.getBoundingClientRect();
  const v = { left: Math.max(r.left, 0), top: Math.max(r.top, 0), right: Math.min(r.right, innerWidth), bottom: Math.min(r.bottom, innerHeight) };
  let pos = getComputedStyle(el).position;
  for (let n = el.parentElement; n && n !== document.documentElement && pos !== 'fixed'; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (pos === 'absolute' && cs.position === 'static') continue;
    if (cs.overflow !== 'visible') {
      const c = n.getBoundingClientRect();
      v.left = Math.max(v.left, c.left); v.top = Math.max(v.top, c.top);
      v.right = Math.min(v.right, c.right); v.bottom = Math.min(v.bottom, c.bottom);
    }
    pos = cs.position;
  }
  return v.right > v.left && v.bottom > v.top ? v : null;
}

function visibleAt(el, x, y) {
  const v = visibleRect(el);
  return Boolean(v) && x >= v.left && x <= v.right && y >= v.top && y <= v.bottom;
}

// Sites lay transparent click/gesture layers over media, so the topmost element is rarely the <img> itself.
// Accept the media only if that top layer belongs to it (their common ancestor is about the media's size);
// otherwise something else (a modal, a sidebar, another post) is in front and the media is not what the
// user is pointing at.
function inFront(top, el) {
  if (top === el || el.contains(top)) return true;
  let lca = el.parentElement;
  while (lca && !lca.contains(top)) lca = lca.parentElement;
  if (!lca) return false;
  const a = lca.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  return a.width * a.height <= 1.6 * b.width * b.height;
}

// Some sites (Threads) make the <img> itself unhittable, so elementsFromPoint can miss it; also compare the
// pointer with every media element's rectangle, then keep only media the user can actually see there.
function mediaAt(x, y) {
  const stack = document.elementsFromPoint(x, y);
  const top = stack[0];
  if (!top) return null;
  if (top === host) return target; // pointer is on our own button
  const candidates = stack.filter(isMedia);
  const rest = [];
  for (const el of document.querySelectorAll('img, video')) {
    if (candidates.includes(el) || !isMedia(el)) continue;
    const r = el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) rest.push(el);
  }
  rest.sort((a, b) => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    return ra.width * ra.height - rb.width * rb.height;
  });
  return [...candidates, ...rest].find((el) => visibleAt(el, x, y) && inFront(top, el)) ?? null;
}

// Nothing but the media itself (or its own transparent layers) is drawn at this point.
function frontAt(el, x, y) {
  const top = document.elementsFromPoint(x, y).find((n) => n !== host);
  return Boolean(top) && inFront(top, el);
}

// The button must sit where the media is actually visible, not just where the pointer is: try the corners of
// the visible part of the media, then next to the pointer, and take the first spot the whole button fits
// unclipped and uncovered (sticky headers, carousel edges, viewer chrome).
const BTN = 36;
const PAD = 8;
function spotFor(el, x, y) {
  const v = visibleRect(el);
  if (!v) return null;
  const clampX = (l) => Math.min(Math.max(l, v.left + PAD), v.right - PAD - BTN);
  const clampY = (t) => Math.min(Math.max(t, v.top + PAD), v.bottom - PAD - BTN);
  const spots = [
    [v.left + PAD, v.top + PAD], [v.right - PAD - BTN, v.top + PAD],
    [v.left + PAD, v.bottom - PAD - BTN], [v.right - PAD - BTN, v.bottom - PAD - BTN],
    [clampX(x - BTN / 2), clampY(y - BTN - 12)], [clampX(x - BTN / 2), clampY(y + 12)],
  ];
  const fits = ([l, t]) => {
    if (l < v.left || t < v.top || l + BTN > v.right || t + BTN > v.bottom) return false;
    const pts = [[l + 1, t + 1], [l + BTN - 1, t + 1], [l + 1, t + BTN - 1], [l + BTN - 1, t + BTN - 1], [l + BTN / 2, t + BTN / 2]];
    return pts.every(([px, py]) => frontAt(el, px, py));
  };
  return spots.find(fits) ?? null;
}

function show(el, x, y) {
  clearTimeout(hideTimer);
  if (el === target && button.style.display === 'block') return;
  const spot = spotFor(el, x, y);
  if (!spot) { if (target) hide(); return; }
  target = el;
  button.style.display = 'block';
  button.style.left = `${spot[0]}px`;
  button.style.top = `${spot[1]}px`;
}

function hide() {
  hideTimer = setTimeout(() => {
    button.style.display = 'none';
    target = null;
  }, 250);
}

let ticking = false;
document.addEventListener('mousemove', (e) => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const el = mediaAt(e.clientX, e.clientY);
    if (el) show(el, e.clientX, e.clientY);
    else if (target) hide();
  });
}, { passive: true });
window.addEventListener('scroll', () => { button.style.display = 'none'; target = null; }, { passive: true });
button.addEventListener('mouseenter', () => clearTimeout(hideTimer));

let toastTimer = null;
// Progress messages stay up until the result replaces them; results fade after a few seconds.
function notify(text, { sticky = false } = {}) {
  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.style.display = 'block';
  if (!sticky) toastTimer = setTimeout(() => (toast.style.display = 'none'), 3500);
}

// One-time, dismissible ask after the first successful download.
function showNudge({ github, review }) {
  nudgeBox.replaceChildren();
  const close = document.createElement('span');
  close.className = 'x';
  close.textContent = '✕';
  close.onclick = () => (nudgeBox.style.display = 'none');
  const text = document.createElement('div');
  text.textContent = 'Saved! If this helped, a rating or a star helps others find it.';
  nudgeBox.append(close, text);
  for (const [label, href] of [review && ['Rate on Chrome Web Store', review], ['Star on GitHub', github]].filter(Boolean)) {
    const a = document.createElement('a');
    a.textContent = label;
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    nudgeBox.append(a);
  }
  nudgeBox.style.display = 'block';
}

// Last resort for streams only the page can read: play the element once and save the captured stream.
async function recordVideo(video) {
  const stream = video.captureStream();
  const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((r) => (rec.onstop = r));
  video.currentTime = 0;
  rec.start();
  await video.play();
  await new Promise((r) => video.addEventListener('ended', r, { once: true }));
  rec.stop();
  await stopped;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }));
  a.download = `SocialMediaCrawler-${Date.now()}.webm`;
  a.click();
}

button.addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (!target) return;
  const el = target;
  const permalink = el.closest('article, [data-pressable-container], [role="article"]')?.querySelector(PERMALINK)?.href;
  notify('Downloading… long videos can take a few minutes', { sticky: true });
  // A cover image on a video link (TikTok/YouTube/Reels grids) stands for the video, not for the picture itself.
  const isVideo = el instanceof HTMLVideoElement || VIDEO_LINK.test(permalink ?? '');
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'download',
      kind: isVideo ? 'video' : 'image',
      mediaUrl: el instanceof HTMLVideoElement ? videoSource(el) : !isVideo ? mediaSource(el) : null,
      pageUrl: location.href,
      permalink: permalink ?? null,
    });
    if (!res?.ok && location.hostname.endsWith('linkedin.com') && el instanceof HTMLVideoElement && el.src.startsWith('blob:')) {
      // The helper cannot resolve some in-page streams (LinkedIn); record what the player is showing instead.
      notify('Recording…', { sticky: true });
      await recordVideo(el);
      notify('Saved ✓');
      return;
    }
    notify(res?.ok ? 'Saved ✓' : `Failed: ${res?.error ?? 'unknown error'}`);
    if (res?.nudge) showNudge(res.nudge);
  } catch (err) {
    notify(`Failed: ${err.message}`);
  }
}, true);

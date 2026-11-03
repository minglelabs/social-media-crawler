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

function isMedia(el) {
  if (!(el instanceof HTMLImageElement || el instanceof HTMLVideoElement)) return false;
  const r = el.getBoundingClientRect();
  if (r.width < MIN_SIZE || r.height < MIN_SIZE) return false;
  if (el instanceof HTMLImageElement && SKIP_ALT.test(el.alt || '')) return false;
  return Boolean(mediaSource(el)) || el instanceof HTMLVideoElement;
}

// Sites put transparent layers above media, and some (Threads) make the <img> itself unhittable, so
// elementsFromPoint can miss it. Fall back to comparing the pointer with every media element's rectangle.
function mediaAt(x, y) {
  const hit = document.elementsFromPoint(x, y).find(isMedia);
  if (hit) return hit;
  let best = null;
  let bestArea = Infinity;
  for (const el of document.querySelectorAll('img, video')) {
    if (!isMedia(el)) continue;
    const r = el.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    const area = r.width * r.height;
    if (area < bestArea) {
      best = el;
      bestArea = area;
    }
  }
  return best;
}

function show(el) {
  target = el;
  clearTimeout(hideTimer);
  const r = el.getBoundingClientRect();
  button.style.display = 'block';
  button.style.left = `${Math.max(8, r.left + 8)}px`;
  button.style.top = `${Math.max(8, r.top + 8)}px`;
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
    if (el) show(el);
    else if (target) hide();
  });
}, { passive: true });
window.addEventListener('scroll', () => { button.style.display = 'none'; target = null; }, { passive: true });
button.addEventListener('mouseenter', () => clearTimeout(hideTimer));

function notify(text) {
  toast.textContent = text;
  toast.style.display = 'block';
  setTimeout(() => (toast.style.display = 'none'), 3500);
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
  notify('Downloading…');
  // A cover image on a video link (TikTok/YouTube/Reels grids) stands for the video, not for the picture itself.
  const isVideo = el instanceof HTMLVideoElement || VIDEO_LINK.test(permalink ?? '');
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'download',
      kind: isVideo ? 'video' : 'image',
      mediaUrl: el instanceof HTMLVideoElement || !isVideo ? mediaSource(el) : null,
      pageUrl: location.href,
      permalink: permalink ?? null,
    });
    if (!res?.ok && el instanceof HTMLVideoElement && el.src.startsWith('blob:')) {
      // The helper cannot resolve some in-page streams (LinkedIn); record what the player is showing instead.
      notify('Recording…');
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

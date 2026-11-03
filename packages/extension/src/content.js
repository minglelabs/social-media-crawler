// One overlay button for every image/video on the page. No other choices are shown to the user.
const MIN_SIZE = 160;
const SKIP_ALT = /profile|avatar|프로필|プロフィール/i;
const PERMALINK = 'a[href*="/post/"], a[href*="/p/"], a[href*="/reel/"], a[href*="/status/"], a[href*="/video/"], a[href*="/pin/"], a[href*="watch?v="], a[href*="/shorts/"]';

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
  </style>
  <button title="Download">⬇</button><div class="toast"></div>`;
const button = shadow.querySelector('button');
const toast = shadow.querySelector('.toast');
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
    // Overlay layers sit above <img>/<video> on most sites, so look at everything under the pointer.
    const el = document.elementsFromPoint(e.clientX, e.clientY).find(isMedia);
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

button.addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (!target) return;
  const el = target;
  const permalink = el.closest('article, [data-pressable-container], [role="article"]')?.querySelector(PERMALINK)?.href;
  notify('Downloading…');
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'download',
      kind: el instanceof HTMLVideoElement ? 'video' : 'image',
      mediaUrl: mediaSource(el),
      pageUrl: location.href,
      permalink: permalink ?? null,
    });
    notify(res?.ok ? 'Saved ✓' : `Failed: ${res?.error ?? 'unknown error'}`);
  } catch (err) {
    notify(`Failed: ${err.message}`);
  }
}, true);

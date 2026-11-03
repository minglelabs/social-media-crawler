// Engines are tried in order; first success wins.
export const PLATFORMS = {
  instagram: { hosts: ['instagram.com'], engines: ['gallery-dl', 'yt-dlp'] },
  youtube: { hosts: ['youtube.com', 'youtu.be'], engines: ['yt-dlp'] },
  tiktok: { hosts: ['tiktok.com'], engines: ['yt-dlp', 'gallery-dl'] },
  facebook: { hosts: ['facebook.com', 'fb.watch'], engines: ['yt-dlp', 'gallery-dl'] },
  twitter: { hosts: ['twitter.com', 'x.com'], engines: ['gallery-dl', 'yt-dlp'] },
  pinterest: { hosts: ['pinterest.com', 'pin.it'], engines: ['gallery-dl', 'yt-dlp'] },
  // yt-dlp covers LinkedIn video; images come from the extension's direct-URL path.
  linkedin: { hosts: ['linkedin.com', 'lnkd.in'], engines: ['yt-dlp'] },
  // Neither yt-dlp nor gallery-dl supports Threads; the browser extension handles it from the DOM.
  threads: { hosts: ['threads.com', 'threads.net'], engines: [] },
};

export function detectPlatform(input) {
  let host;
  try {
    host = new URL(input).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const [name, { hosts }] of Object.entries(PLATFORMS)) {
    if (hosts.some((h) => host === h || host.endsWith(`.${h}`))) return name;
  }
  return null;
}

// Serialize chrome.cookies entries to the Netscape cookies.txt format yt-dlp and gallery-dl read.
export function toNetscape(cookies) {
  const lines = ['# Netscape HTTP Cookie File'];
  for (const c of cookies) {
    const domain = c.httpOnly ? `#HttpOnly_${c.domain}` : c.domain;
    const subdomains = c.domain.startsWith('.') ? 'TRUE' : 'FALSE';
    const expires = c.session || !c.expirationDate ? 0 : Math.floor(c.expirationDate);
    lines.push([domain, subdomains, c.path, c.secure ? 'TRUE' : 'FALSE', expires, c.name, c.value].join('\t'));
  }
  return `${lines.join('\n')}\n`;
}

# Social Media Crawler

One download button on every image and video of Instagram, YouTube, TikTok, Facebook, X, Pinterest and Threads,
plus a tool-calling harness (MCP server + CLI) so agents can do the same without a human.

## Packages

| Package | What it does |
|---|---|
| `packages/extension` | Chrome/Brave MV3 extension. Hover any media → one ⬇ button. Direct image/MP4 URLs are saved by the browser; streams (HLS/DASH/blob, YouTube) go to the local helper. |
| `packages/native-host` | Native messaging host the extension calls for streams. Runs yt-dlp / gallery-dl. |
| `packages/core` | URL → media list → download. Wraps yt-dlp and gallery-dl with per-platform fallback. CLI: `smc`. |
| `packages/mcp-server` | MCP stdio server exposing `detect_platform`, `list_media`, `download_media`, `download_batch`, `check_store_reviews`, `doctor`. |
| `packages/review-monitor` | Watches the Chrome Web Store reviews for "no longer works" reports and reports them (GitHub issue / Slack). |

## Setup

```bash
npm install
brew install yt-dlp gallery-dl          # engines
npm run install-host                    # registers the native host for Chrome/Brave
```

Load `packages/extension` via `chrome://extensions` → Developer mode → Load unpacked.
The extension ID is fixed by the `key` in `manifest.json`: `fefnjlcneddhgncacaomimfadffdkchi`.
Downloads go to `~/Downloads/SocialMediaCrawler/<platform>/`.

## Agent harness

```bash
npm run smc -- download https://x.com/user/status/123 --cookies-from-browser brave
npm run mcp                              # MCP stdio server
```

MCP client config:

```json
{ "mcpServers": { "social-media-crawler": { "command": "node", "args": ["/path/to/repo/packages/mcp-server/src/index.js"] } } }
```

Platform coverage in the CLI engines: Threads is DOM-only (extension); everything else goes through yt-dlp / gallery-dl.

## Store review monitor

Checks the newest page of Chrome Web Store reviews for failure reports (English, Korean, Japanese, Chinese keywords)
and reports each one once.

```bash
CWS_EXTENSION_ID=<id> node packages/review-monitor/src/cli.js --dry-run
```

`.github/workflows/review-monitor.yml` runs it daily and opens a GitHub issue (and posts to Slack if the
`SLACK_WEBHOOK_URL` secret is set). Set the repo variable `CWS_EXTENSION_ID` after publishing.
The store has no reviews API, so this parses the reviews page; it only sees the newest page and may break if Google changes the page.

## Caveats

- The extension has not been loaded in a browser end-to-end yet; core, MCP server and review monitor are covered by tests / smoke runs.
- The Chrome Web Store generally rejects YouTube downloaders; distribute via GitHub releases / unpacked install, or ship a store build without YouTube.
- Downloading may violate each platform's terms of service. Use for content you have the right to save.

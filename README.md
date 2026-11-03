# Social Media Crawler

One download button on every image and video of Instagram, YouTube, TikTok, Facebook, X, Pinterest, LinkedIn and Threads,
plus a tool-calling harness (MCP server + CLI) so agents can do the same without a human.


## Latest updates

Platforms change their UI all the time; we track those changes and ship fixes continuously. Full history: [CHANGELOG.md](CHANGELOG.md) · [Releases](https://github.com/minglelabs/social-media-crawler/releases)

<!-- LATEST-UPDATES:START -->
- **2026-11-03** — feat(linkedin): LinkedIn support (images/videos overlay, video via yt-dlp)
- **2026-11-03** — feat: one-time, dismissible rate/star prompt after the first download
- **2026-11-03** — feat: Chrome Web Store review monitor that reports "no longer works" reviews daily
- **2026-11-03** — feat: initial release — one-click overlay download for Instagram, YouTube, TikTok, Facebook, X, Pinterest, Threads; MCP + CLI harness
<!-- LATEST-UPDATES:END -->

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

## One-time rate / star prompt

After the first successful download the project asks once, and only once, for support:

- **Extension**: a dismissible card with a "Rate on Chrome Web Store" link (store installs only) and a "Star on GitHub" link.
- **CLI / MCP server**: a one-line GitHub star note, stored in `~/.config/smc/state.json`. In MCP it is returned as a
  "note for the user" so the agent relays it to the human; it never asks the agent to rate or star on anyone's behalf.
- Disable with `SMC_NO_NUDGE=1`.

## Caveats

- The extension has not been loaded in a browser end-to-end yet; core, MCP server and review monitor are covered by tests / smoke runs.
- The Chrome Web Store generally rejects YouTube downloaders; distribute via GitHub releases / unpacked install, or ship a store build without YouTube.
- Downloading may violate each platform's terms of service. Use for content you have the right to save.

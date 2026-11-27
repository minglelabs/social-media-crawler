# Changelog

## 2026-11-27

- fix(youtube): "Requested format is not available" after YouTube's player change; the helper now updates yt-dlp by itself when that happens
- fix(extension): no more "reading 'sendMessage'" after an update; open tabs get the new overlay without a refresh
- feat(youtube): show download progress in the toast; the helper logs failures to ~/Library/Logs/SocialMediaCrawler/helper.log

## 2026-11-23

- fix(threads): videos download again; the overlay now reads the player's original mp4 instead of the blob stream

## 2026-11-19

- fix(extension): place the download button only where it is actually visible, never under headers, viewers or clipped edges
- fix(youtube): downloads no longer stall at 403 when you are signed in to YouTube
- fix(youtube): save up to 1080p H.264 mp4 for fast, playable downloads; screen recording fallback only on LinkedIn
- fix(youtube): download just the clicked video when the URL comes from a mix or playlist
- fix(youtube): retry automatically when YouTube rejects a download with 403

## 2026-11-16

- fix: the download button only appears on media you can actually see under the pointer (not on carousel slides scrolled out of view or images behind a viewer/modal; Threads, Instagram, Facebook)

## 2026-11-10

- fix(youtube): long videos download ~4x faster (https streams over HLS), progress stays visible, and the download no longer dies when the browser idles
- feat: videos saved through the helper now appear in the browser's download list (and can be opened from there)
- fix: downloads from the helper now land directly in <platform>/ (no per-user subfolders, lowercase platform names)

## 2026-11-07

- fix(x): "Saved" is shown only after the file is actually on disk; failed direct downloads fall back to the helper

## 2026-11-04

- fix(facebook): no download overlay inside Messenger chat windows

## 2026-11-03

- fix(linkedin): feed videos that only the page can stream are recorded and saved as .webm
- fix(tiktok): grid/explore thumbnails now download the video instead of the cover image
- fix(instagram): reels and stories now download; the helper receives this browser's login cookies
- chore(release): v0.1.1 — Threads, LinkedIn, YouTube Shorts, Facebook Reels, X, Pinterest, TikTok verified end to end in Brave
- fix(threads): download button now appears on feed images (Threads made images unclickable under an overlay layer)
- feat(linkedin): LinkedIn support (images/videos overlay, video via yt-dlp)
- feat: one-time, dismissible rate/star prompt after the first download
- feat: Chrome Web Store review monitor that reports "no longer works" reviews daily
- feat: initial release — one-click overlay download for Instagram, YouTube, TikTok, Facebook, X, Pinterest, Threads; MCP + CLI harness

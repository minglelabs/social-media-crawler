# Changelog

## 2026-11-10

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

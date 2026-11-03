# Standing instructions for agents working in this repo

This tool lives or dies by how fast we follow platform UI/API changes. Treat maintenance as the main job.

## Always
- **Keep the changelog current.** Every user-visible change (new platform, fix after a site changed its UI, new
  feature) must be recorded with `node tools/changelog.js add "<type>(<platform>): <message>"`
  (types: `feat`, `fix`, `chore`). This updates `CHANGELOG.md` and the "Latest updates" block at the top of `README.md`.
  Write it so a visitor sees we keep up with the sites, e.g. `fix(instagram): overlay button restored after Instagram changed its carousel markup`.
- **Never merge with a stale changelog**: `npm test` fails if the README block is out of sync (`node tools/changelog.js sync` fixes it).
- **Releases**: for each fix that ships, bump `packages/extension/manifest.json` version, tag `vX.Y.Z`, and publish a GitHub
  release whose notes repeat the changelog lines. Use the same text for the Chrome Web Store "what's new".

## Breakage loop
1. Signals: daily Web Store review monitor issues (label `store-review`), GitHub issues, or your own periodic check.
2. Reproduce on the real site (all 8: Threads, Instagram, YouTube, TikTok, Facebook, X, Pinterest, LinkedIn) with the
   extension loaded in the browser.
3. Fix selectors/URL handling in `packages/extension` or engine fallbacks in `packages/core`, add a test where possible.
4. `npm test`, add the changelog entry, open a PR, merge it, release. Do not ask for confirmation to merge.

## Conventions
- Work in a git worktree on a feature branch; keep the main checkout on `main`. Never commit `node_modules` or symlinks.
- The review/star prompt is shown once and only to humans; never ask agents or scripts to rate or star on anyone's behalf.

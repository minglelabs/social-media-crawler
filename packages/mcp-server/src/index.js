#!/usr/bin/env node
// MCP stdio server: lets any agent drive downloads and store monitoring through tool calls.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { detectPlatform, listMedia, downloadMedia, doctor, consumeNudge } from '@minglelabs/smc-core';
import { checkReviews } from '@minglelabs/smc-review-monitor';

const server = new McpServer({ name: 'social-media-crawler', version: '0.1.0' });

const ok = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = (err) => ({ isError: true, content: [{ type: 'text', text: String(err.message ?? err) }] });
const guard = (fn) => async (args) => {
  try {
    return ok(await fn(args));
  } catch (err) {
    return fail(err);
  }
};

// After the first successful download, append a one-time note meant for the human user. It is returned as a
// separate "for the user" text item so agents relay it rather than act on it.
const withNudge = (guarded) => async (args) => {
  const res = await guarded(args);
  const notice = res.isError ? null : consumeNudge();
  if (notice) res.content.push({ type: 'text', text: `Note for the user (informational, no action needed): ${notice}` });
  return res;
};

const cookies = z.string().optional().describe('Browser to read login cookies from, e.g. "brave" or "chrome"');

server.tool(
  'detect_platform',
  'Identify which supported platform a URL belongs to (instagram, youtube, tiktok, facebook, twitter, pinterest, threads).',
  { url: z.string().url() },
  guard(async ({ url }) => ({ url, platform: detectPlatform(url) })),
);

server.tool(
  'list_media',
  'List the media items (images/videos) behind a post URL without downloading them.',
  { url: z.string().url(), cookiesFromBrowser: cookies },
  guard(({ url, cookiesFromBrowser }) => listMedia(url, { cookiesFromBrowser })),
);

server.tool(
  'download_media',
  'Download all media of a post URL to disk and return the saved file paths.',
  { url: z.string().url(), outDir: z.string().optional(), cookiesFromBrowser: cookies },
  withNudge(guard(({ url, outDir, cookiesFromBrowser }) => downloadMedia(url, { outDir, cookiesFromBrowser }))),
);

server.tool(
  'download_batch',
  'Download many post URLs. Failures are reported per URL and do not stop the batch.',
  { urls: z.array(z.string().url()).min(1).max(100), outDir: z.string().optional(), cookiesFromBrowser: cookies },
  withNudge(guard(async ({ urls, outDir, cookiesFromBrowser }) =>
    Promise.all(urls.map((url) => downloadMedia(url, { outDir, cookiesFromBrowser }).then((r) => ({ url, ...r }), (e) => ({ url, error: e.message })))),
  )),
);

server.tool(
  'check_store_reviews',
  'Check the Chrome Web Store reviews of the extension for new "no longer works" reports. Only returns reviews not reported before.',
  { extensionId: z.string().optional(), statePath: z.string().optional(), dryRun: z.boolean().optional() },
  guard(({ extensionId, statePath, dryRun }) => {
    const id = extensionId ?? process.env.CWS_EXTENSION_ID;
    if (!id) throw new Error('Provide extensionId or set CWS_EXTENSION_ID');
    return checkReviews(id, { statePath: statePath ?? 'data/seen-reviews.json', markSeen: !dryRun });
  }),
);

server.tool('doctor', 'Check that yt-dlp and gallery-dl are installed and report the output directory.', {}, guard(() => doctor()));

await server.connect(new StdioServerTransport());

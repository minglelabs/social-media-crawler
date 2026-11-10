#!/usr/bin/env node
// One-shot local file server: lets the browser fetch helper-downloaded files itself, so they show up in the
// browser's own download list. Usage: serve.js <dir> <token>. Prints the port, then exits once every file was
// fetched (or after 3 minutes) and removes <dir>.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const [dir, token] = process.argv.slice(2);
const pending = new Set(fs.readdirSync(dir));
const finish = () => {
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(0);
};

const server = http.createServer((req, res) => {
  const [, tok, rawName] = req.url.split('?')[0].split('/');
  const name = decodeURIComponent(rawName ?? '');
  if (tok !== token || !pending.has(name)) return res.writeHead(404).end();
  const file = path.join(dir, name);
  res.writeHead(200, { 'content-length': fs.statSync(file).size, 'content-type': 'application/octet-stream' });
  fs.createReadStream(file).pipe(res).on('close', () => {
    pending.delete(name);
    if (!pending.size) setTimeout(finish, 500);
  });
});
server.listen(0, '127.0.0.1', () => console.log(server.address().port));
setTimeout(finish, 180_000);

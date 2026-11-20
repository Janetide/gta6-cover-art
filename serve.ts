// Vice Sunset Cover Studio — tiny static server for local development.
// Serves app/ on http://localhost:8080. Run: `node serve.ts`
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, 'app');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json',
};

const server = createServer((req, res) => {
  const path = decodeURIComponent(
    new URL(req.url ?? '/', 'http://localhost').pathname,
  );
  const file = join(root, path === '/' ? 'index.html' : path);
  if (
    !file.startsWith(root) ||
    !existsSync(file) ||
    !statSync(file).isFile()
  ) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
  });
  res.end(readFileSync(file));
});

server.listen(8080, () => {
  console.log('Vice Sunset Cover Studio at http://localhost:8080');
});

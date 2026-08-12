/**
 * Serve `dist/` under a sub-path, the way GitHub Pages serves a project site.
 *
 * `vite preview` serves at `/`, so it cannot tell you whether the app survives
 * being mounted at `/<repo>/` — and the thing most likely to break there is the
 * service worker, because a worker registered at `/` cannot control
 * `/<repo>/`. That is the whole offline promise, so it gets tested, not assumed.
 *
 * Usage: node scripts/serve-subpath.mjs [--base /hartye-drive/] [--port 4300]
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const BASE = arg('base', '/hartye-drive/');
const PORT = Number(arg('port', '4300'));
const ROOT = join(process.cwd(), 'dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (!url.pathname.startsWith(BASE)) {
    // Exactly what Pages does for a path outside the project: 404.
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end(`not under ${BASE}`);
    return;
  }

  const rel = url.pathname.slice(BASE.length) || 'index.html';
  const safe = normalize(rel).replace(/^(\.\.[/\\])+/, '');

  const send = async (file) => {
    const body = await readFile(join(ROOT, file));
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      // A service worker must be allowed to claim the whole sub-path.
      ...(file.endsWith('sw.js') ? { 'service-worker-allowed': BASE } : {}),
    });
    res.end(body);
  };

  try {
    await send(safe);
  } catch {
    try {
      // SPA fallback — the same thing the service worker does offline.
      await send('index.html');
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    }
  }
}).listen(PORT, () => {
  console.log(`dist/ mounted at http://localhost:${PORT}${BASE}`);
});

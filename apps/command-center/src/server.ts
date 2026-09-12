import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve public assets from the application root in both tsx/dev and compiled/dist runs.
const appRoot = fileURLToPath(new URL('../../', import.meta.url));
const root = join(appRoot, 'public');
const port = Number(process.env.PORT ?? 4173);
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    const requested = pathname === '/' ? '/index.html' : pathname;
    const safe = requested.replace(/\\/g, '/').replace(/\.\./g, '');
    const data = await readFile(join(root, safe));
    res.writeHead(200, {
      'content-type': types[extname(safe)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
    });
    res.end(data);
  } catch {
    res.writeHead(404, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    res.end('Not found');
  }
});

server.listen(port, () => console.log(`LEO OS Command Center listening on :${port}`));

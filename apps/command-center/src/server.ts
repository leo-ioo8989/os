import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'public');
const port = Number(process.env.PORT ?? 4173);
const types: Record<string,string> = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server = createServer(async (req,res) => {
  try {
    const requested = req.url === '/' ? '/index.html' : (req.url ?? '/index.html').split('?')[0];
    const safe = requested.replace(/\\/g,'/').replace(/\.\./g,'');
    const data = await readFile(join(root, safe));
    res.writeHead(200, {'content-type': types[extname(safe)] ?? 'application/octet-stream','cache-control':'no-store'});
    res.end(data);
  } catch { res.writeHead(404, {'content-type':'text/plain; charset=utf-8'}); res.end('Not found'); }
});
server.listen(port, () => console.log(`LEO OS Command Center listening on :${port}`));

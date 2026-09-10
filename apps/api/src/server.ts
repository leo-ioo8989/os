import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? 4000);

const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok', service: 'founder-os-api' }));
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'NOT_FOUND' }));
});

server.listen(port, () => {
  console.log(`Founder OS API listening on :${port}`);
});

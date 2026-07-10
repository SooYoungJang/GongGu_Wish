import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.E2E_DASHBOARD_PORT ?? 4173);

createServer(async (request, response) => {
  const pathname = request.url === '/' ? '/index.html' : request.url;
  const filePath = path.resolve(root, `.${pathname}`);
  if (!filePath.startsWith(root)) {
    response.writeHead(403); response.end('Forbidden'); return;
  }
  try {
    const body = await readFile(filePath);
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404); response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`E2E dashboard: http://localhost:${port}`);
});

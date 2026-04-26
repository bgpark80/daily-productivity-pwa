import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { describeMetricsMode, sendMetricsResponse } from './metrics-endpoint.mjs';
import { describeUsageLimitMode, sendUsageLimitResponse } from './usage-limit-endpoint.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const serverPort = Number(process.env.CLAUDE_PWA_PORT || 4173);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.prom': 'text/plain; charset=utf-8'
};

async function sendFile(filePath, response) {
  try {
    const data = await fsp.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
      'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=3600'
    });
    response.end(data);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Internal server error');
  }
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (url.pathname === '/api/metrics') {
    await sendMetricsResponse(response, process.env);
    return;
  }

  if (url.pathname === '/api/usage-limit') {
    await sendUsageLimitResponse(response, process.env);
    return;
  }

  let targetPath = path.join(distDir, decodeURIComponent(url.pathname));

  if (url.pathname === '/' || url.pathname === '') {
    targetPath = path.join(distDir, 'index.html');
  }

  if (!targetPath.startsWith(distDir)) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
    targetPath = path.join(targetPath, 'index.html');
  }

  if (!path.extname(targetPath)) {
    targetPath = path.join(distDir, 'index.html');
  }

  await sendFile(targetPath, response);
});

server.listen(serverPort, () => {
  process.stdout.write(`Claude PWA server running at http://localhost:${serverPort}\n`);
  process.stdout.write(`Claude metrics endpoint: /api/metrics -> ${describeMetricsMode(process.env)}\n`);
  process.stdout.write(`Claude usage limit endpoint: /api/usage-limit -> ${describeUsageLimitMode(process.env)}\n`);
});

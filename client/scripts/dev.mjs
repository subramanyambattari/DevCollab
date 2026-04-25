import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildClient } from './build-client.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, '..');
const distRoot = path.join(clientRoot, 'dist');
const port = Number(process.env.PORT || 5173);

let rebuildTimer = null;
let rebuildInFlight = false;

function sendFile(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType =
    extension === '.html'
      ? 'text/html; charset=utf-8'
      : extension === '.css'
        ? 'text/css; charset=utf-8'
        : extension === '.js'
          ? 'application/javascript; charset=utf-8'
          : 'application/octet-stream';

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    res.setHeader('Content-Type', contentType);
    res.end(contents);
  });
}

async function rebuild() {
  if (rebuildInFlight) {
    return;
  }

  rebuildInFlight = true;
  try {
    await buildClient();
    console.log('[client] rebuilt');
  } catch (error) {
    console.error('[client] rebuild failed');
    console.error(error);
  } finally {
    rebuildInFlight = false;
  }
}

function queueRebuild() {
  if (rebuildTimer) {
    clearTimeout(rebuildTimer);
  }

  rebuildTimer = setTimeout(() => {
    void rebuild();
  }, 150);
}

await buildClient();

const server = http.createServer((req, res) => {
  const requestUrl = req.url ? new URL(req.url, `http://localhost:${port}`) : new URL('/', `http://localhost:${port}`);
  const pathname = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const filePath = path.join(distRoot, pathname);

  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isFile()) {
      sendFile(res, filePath);
      return;
    }

    sendFile(res, path.join(distRoot, 'index.html'));
  });
});

server.listen(port, () => {
  console.log(`[client] listening on http://localhost:${port}`);
});

fs.watch(path.join(clientRoot, 'src'), { recursive: true }, queueRebuild);
fs.watch(path.join(clientRoot, 'index.html'), queueRebuild);

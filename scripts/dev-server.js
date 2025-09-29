import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 5173);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function sendNotFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
}

async function serveFile(res, filePath) {
  try {
    const stats = await stat(filePath);
    if (stats.isDirectory()) {
      return false;
    }
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    createReadStream(filePath).pipe(res);
    return true;
  } catch (error) {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = req.url ? decodeURI(req.url.split('?')[0]) : '/';
  const targetPath = path.join(rootDir, requestUrl);

  if (await serveFile(res, targetPath)) {
    return;
  }

  const indexPath = path.join(rootDir, 'index.html');
  try {
    const html = await readFile(indexPath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] });
    res.end(html);
  } catch (error) {
    sendNotFound(res);
  }
});

server.listen(port, () => {
  console.log(`Dev server running at http://localhost:${port}`);
});

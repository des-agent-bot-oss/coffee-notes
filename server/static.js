// Static file serving for the app shell and its assets.
// Path traversal is rejected after decoding; every resolved path must stay
// inside the public directory.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { ApiError, notFoundError, validationError } from './router.js';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8'
};

export function contentTypeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export function createStaticHandler(publicDir) {
  const root = path.resolve(publicDir);

  return async function serveStatic({ req, res, pathname }) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      throw new ApiError(405, 'not_found', `Method ${req.method} is not allowed for ${pathname}.`, {});
    }

    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      throw validationError('Invalid request path.', {});
    }
    if (decoded.includes('\0')) throw validationError('Invalid request path.', {});

    const relative = decoded === '/' ? '/index.html' : decoded;
    if (relative.split('/').includes('..')) {
      throw validationError('Invalid request path.', {});
    }

    const filePath = path.resolve(root, `.${relative}`);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      throw validationError('Invalid request path.', {});
    }

    let stats;
    try {
      stats = await fsp.stat(filePath);
    } catch {
      throw notFoundError(`Not found: ${pathname}`);
    }
    if (stats.isDirectory()) throw notFoundError(`Not found: ${pathname}`);

    const etag = `"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;
    const lastModified = stats.mtime.toUTCString();
    const headers = {
      'Content-Type': contentTypeFor(filePath),
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache',
      ETag: etag,
      'Last-Modified': lastModified
    };

    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag, 'Last-Modified': lastModified, 'Cache-Control': 'no-cache' });
      res.end();
      return;
    }

    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      stream.on('error', reject);
      stream.on('close', resolve);
      stream.pipe(res);
    });
  };
}

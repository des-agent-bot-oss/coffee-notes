// Coffee Notes entrypoint: configuration, HTTP server, graceful shutdown.
// Loopback-only by design (docs/SPEC.md §9).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { openDatabase } from './db.js';
import { ApiError, MAX_BODY_BYTES, createRouter, errorEnvelope, readJsonBody, sendJson } from './router.js';
import { registerRoutes } from './api.js';
import { createStaticHandler } from './static.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '::1'];

function readVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function createConfig(env = process.env) {
  const host = String(env.COFFEE_NOTES_HOST ?? '127.0.0.1').trim();
  if (!LOOPBACK_HOSTS.includes(host)) {
    throw new Error(`COFFEE_NOTES_HOST must be a loopback address (got "${host}"); this app is local-only.`);
  }

  const rawPort = String(env.COFFEE_NOTES_PORT ?? '4317').trim();
  if (!/^\d{1,5}$/.test(rawPort) || Number(rawPort) > 65535) {
    throw new Error(`COFFEE_NOTES_PORT must be a port number (got "${env.COFFEE_NOTES_PORT}").`);
  }

  const dbPath = path.resolve(env.COFFEE_NOTES_DB ?? path.join(REPO_ROOT, 'data', 'coffee-notes.db'));

  return {
    host,
    port: Number(rawPort),
    dbPath,
    publicDir: path.join(REPO_ROOT, 'public'),
    version: readVersion(),
    maxBodyBytes: MAX_BODY_BYTES
  };
}

function isApiPath(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/');
}

export async function startServer(config = createConfig()) {
  const db = openDatabase(config.dbPath);
  const router = createRouter();
  registerRoutes(router, { db, version: config.version });
  const serveStatic = createStaticHandler(config.publicDir);

  async function handleApi(req, res, url) {
    const method = req.method === 'HEAD' ? 'GET' : req.method;
    const result = router.match(method, url.pathname);

    if (result.type === 'bad_path') throw new ApiError(400, 'validation', 'Invalid request path.', {});
    if (result.type === 'no_match') {
      throw new ApiError(404, 'not_found', `No API route for ${req.method} ${url.pathname}.`, {});
    }
    if (result.type === 'method_not_allowed') {
      throw new ApiError(
        405,
        'not_found',
        `Method ${req.method} is not allowed for ${url.pathname}.`,
        {},
        { headers: { Allow: result.allow.join(', ') } }
      );
    }

    let body = {};
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      body = await readJsonBody(req, config.maxBodyBytes);
    }

    const { status, body: payload } = await result.route.handler({
      req,
      res,
      params: result.params,
      query: url.searchParams,
      body,
      db,
      config
    });
    sendJson(req, res, status, payload);
  }

  async function handle(req, res) {
    const url = new URL(req.url, `http://${config.host}`);
    if (isApiPath(url.pathname)) return handleApi(req, res, url);
    return serveStatic({ req, res, pathname: url.pathname });
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      if (error instanceof ApiError) {
        sendJson(req, res, error.status, errorEnvelope(error), error.headers ?? {});
        return;
      }
      console.error('[coffee-notes] request failed:', error);
      sendJson(req, res, 500, errorEnvelope({ code: 'server', message: 'Internal server error.', fields: {} }));
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, resolve);
  });

  const address = server.address();

  return {
    server,
    db,
    config,
    host: address.address,
    port: address.port,
    url: `http://${config.host}:${address.port}`,
    async close() {
      await new Promise((resolve, reject) => {
        if (!server.listening) {
          resolve();
          return;
        }
        server.close((error) => (error ? reject(error) : resolve()));
        if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
      });
      db.close();
    }
  };
}

export async function main(env = process.env) {
  const config = createConfig(env);
  const app = await startServer(config);
  console.log(`[coffee-notes] listening on http://${config.host}:${app.port} — db ${config.dbPath}`);
  console.log(`[coffee-notes] health: GET ${app.url}/api/health`);

  let closing = false;
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      if (closing) return;
      closing = true;
      console.log(`[coffee-notes] ${signal} received, shutting down`);
      app
        .close()
        .then(() => {
          console.log('[coffee-notes] stopped');
          process.exit(0);
        })
        .catch((error) => {
          console.error('[coffee-notes] shutdown failed:', error);
          process.exit(1);
        });
      setTimeout(() => {
        console.error('[coffee-notes] shutdown timed out');
        process.exit(1);
      }, 5000).unref();
    });
  }

  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[coffee-notes] failed to start: ${error.message}`);
    process.exit(1);
  });
}

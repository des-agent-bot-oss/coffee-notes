// Tiny method+path router plus the HTTP plumbing shared by API and static
// routes: uniform JSON error envelope, bounded JSON body parsing.

export const MAX_BODY_BYTES = 256 * 1024;

export class ApiError extends Error {
  constructor(status, code, message, fields = {}, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.headers = options.headers ?? {};
  }
}

export function validationError(message, fields) {
  return new ApiError(400, 'validation', message, fields);
}

export function notFoundError(message) {
  return new ApiError(404, 'not_found', message, {});
}

export function conflictError(message, fields) {
  return new ApiError(409, 'conflict', message, fields);
}

export function errorEnvelope(error) {
  return {
    error: {
      code: error.code,
      message: error.message,
      fields: error.fields ?? {}
    }
  };
}

export function createRouter() {
  const routes = [];

  function add(method, pattern, handler) {
    routes.push({
      method,
      pattern,
      segments: pattern.split('/').filter((segment) => segment !== ''),
      handler
    });
  }

  function matchSegments(routeSegments, pathSegments) {
    if (routeSegments.length !== pathSegments.length) return null;
    const params = {};
    for (let index = 0; index < routeSegments.length; index += 1) {
      const segment = routeSegments[index];
      if (segment.startsWith(':')) {
        params[segment.slice(1)] = pathSegments[index];
      } else if (segment !== pathSegments[index]) {
        return null;
      }
    }
    return params;
  }

  function match(method, pathname) {
    let pathSegments;
    try {
      pathSegments = pathname
        .split('/')
        .filter((segment) => segment !== '')
        .map((segment) => decodeURIComponent(segment));
    } catch {
      return { type: 'bad_path' };
    }
    const allow = new Set();
    for (const route of routes) {
      const params = matchSegments(route.segments, pathSegments);
      if (!params) continue;
      allow.add(route.method);
      if (route.method === method) return { type: 'match', route, params };
    }
    if (allow.size > 0) return { type: 'method_not_allowed', allow: [...allow].sort() };
    return { type: 'no_match' };
  }

  return { add, match, routes };
}

/**
 * Read and parse a JSON request body. An empty body is treated as `{}` so
 * body-less POST actions (e.g. the demo seed) work from a plain curl call.
 * An oversized body is drained and discarded before the 400 is sent, so the
 * client always receives the clear error rather than a reset connection.
 */
export async function readJsonBody(req, limit = MAX_BODY_BYTES) {
  const chunks = [];
  let size = 0;
  let overflowed = false;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      overflowed = true;
      if (size > limit * 16) {
        req.destroy();
        break;
      }
      continue;
    }
    chunks.push(chunk);
  }
  if (overflowed) {
    throw new ApiError(400, 'validation', `Request body is larger than ${Math.floor(limit / 1024)} KB.`, {});
  }
  if (size === 0) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError(400, 'validation', 'Request body is not valid JSON.', {});
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiError(400, 'validation', 'Request body must be a JSON object.', {});
  }
  return parsed;
}

export function sendJson(req, res, status, payload, extraHeaders = {}) {
  const body = Buffer.from(JSON.stringify(payload));
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', body.length);
  res.setHeader('Cache-Control', 'no-store');
  for (const [name, value] of Object.entries(extraHeaders)) res.setHeader(name, value);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  res.end(body);
}

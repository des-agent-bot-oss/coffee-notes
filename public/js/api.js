// Same-origin JSON access to the API in docs/SPEC.md §7.
//
// Every failure is normalised into an ApiError carrying a plain-language
// message plus any server field errors, so a caller never has to look at a raw
// status code or a stack trace.

const OFFLINE = 'The Coffee Notes server is not answering. Check that it is still running, then retry.';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'network', fields = {} } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError(OFFLINE);
  }

  const raw = await response.text();
  let payload = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const detail = payload?.error ?? {};
    throw new ApiError(
      detail.message || `The server could not complete that request (HTTP ${response.status}).`,
      { status: response.status, code: detail.code ?? 'server', fields: detail.fields ?? {} }
    );
  }
  return payload;
}

export const api = {
  listNotes: (query = '') => request(`/api/notes${query}`),
  getNote: (id) => request(`/api/notes/${id}`),
  createNote: (payload) => request('/api/notes', { method: 'POST', body: payload }),
  updateNote: (id, payload) => request(`/api/notes/${id}`, { method: 'PUT', body: payload }),
  deleteNote: (id) => request(`/api/notes/${id}`, { method: 'DELETE' }),
  listGrinders: () => request('/api/grinders'),
  createGrinder: (name) => request('/api/grinders', { method: 'POST', body: { name } }),
  renameGrinder: (id, name) => request(`/api/grinders/${id}`, { method: 'PATCH', body: { name } }),
  setDefaultGrinder: (id) =>
    request(`/api/grinders/${id}`, { method: 'PATCH', body: { is_default: true } }),
  deleteGrinder: (id) => request(`/api/grinders/${id}`, { method: 'DELETE' }),
  seedDemo: () => request('/api/demo/seed', { method: 'POST' }),
  clearDemo: () => request('/api/demo', { method: 'DELETE' })
};

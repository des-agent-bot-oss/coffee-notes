// HTTP-level tests against a real server on an ephemeral port with a temporary
// database in the process temp dir (never the repo data/ directory).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createConfig, startServer } from '../server/index.js';

const tempDirs = [];

test.after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

async function withServer(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coffee-notes-api-'));
  tempDirs.push(dir);
  const app = await startServer(createConfig({ COFFEE_NOTES_PORT: '0', COFFEE_NOTES_DB: path.join(dir, 'test.db') }));
  const base = `http://127.0.0.1:${app.port}`;
  try {
    await run(base, app);
  } finally {
    await app.close();
  }
}

async function api(base, method, route, body) {
  const init = { method };
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const response = await fetch(`${base}${route}`, init);
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  return { status: response.status, body: payload, headers: response.headers };
}

// Raw socket request so a deliberately non-normalised path survives to the server.
function rawRequest(port, target) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.write(`GET ${target} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`);
    });
    let data = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      data += chunk;
    });
    socket.on('close', () => resolve(data));
    socket.on('error', reject);
  });
}

function notePayload(overrides = {}) {
  return {
    brewed_at: '2026-10-11T07:35',
    grinder_name: 'Hand grinder',
    grind_size: 14,
    dose_g: 16,
    water_g: 256,
    bean_name: 'Kenya Nyeri AA',
    bean_origin: 'Kenya',
    roast_level: 'light',
    tasting_notes: 'Blackcurrant and tamarind.',
    ...overrides
  };
}

test('GET /api/health reports the running version and database', async () => {
  await withServer(async (base) => {
    const { status, body } = await api(base, 'GET', '/api/health');
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.db, 'ok');
    assert.equal(typeof body.version, 'string');
    assert.match(body.now, /^\d{4}-\d{2}-\d{2}T/);
  });
});

test('note lifecycle over HTTP: create, list, read, update, delete', async () => {
  await withServer(async (base) => {
    const created = await api(base, 'POST', '/api/notes', notePayload());
    assert.equal(created.status, 201);
    assert.equal(created.body.note.brewed_at, '2026-10-11T07:35');
    assert.equal(created.body.note.ratio_display, '1:16');
    assert.equal(created.body.note.grinder_id, null);
    const id = created.body.note.id;

    const listed = await api(base, 'GET', '/api/notes');
    assert.equal(listed.status, 200);
    assert.equal(listed.body.notes.length, 1);
    assert.equal(listed.body.notes[0].id, id);
    assert.equal(listed.body.notes[0].grinder_name, 'Hand grinder');

    const read = await api(base, 'GET', `/api/notes/${id}`);
    assert.equal(read.status, 200);
    assert.deepEqual(read.body.note, created.body.note);

    const updated = await api(base, 'PUT', `/api/notes/${id}`, notePayload({ bean_name: 'Kenya Nyeri AB', dose_g: 15, water_g: 250 }));
    assert.equal(updated.status, 200);
    assert.equal(updated.body.note.bean_name, 'Kenya Nyeri AB');
    assert.equal(updated.body.note.ratio_display, '1:16.7');
    assert.equal(updated.body.note.created_at, created.body.note.created_at);

    const deleted = await api(base, 'DELETE', `/api/notes/${id}`);
    assert.deepEqual(deleted.body, { ok: true, deleted_id: id });

    assert.equal((await api(base, 'GET', `/api/notes/${id}`)).status, 404);
    assert.equal((await api(base, 'POST', '/api/notes', notePayload({ grinder_id: 1 }))).status, 400);
  });
});

test('brewed_at must be a real local calendar date and time, stored verbatim', async () => {
  await withServer(async (base) => {
    const cases = [
      ['2026-02-30T10:00', 'that date does not exist'],
      ['2026-10-11T25:00', 'hour out of range'],
      ['2026-02-29T10:00', '2026 is not a leap year'],
      ['2026-13-01T10:00', 'month out of range'],
      ['2026-10-11 10:00', 'space instead of T'],
      ['2026-10-11T10:00:00Z', 'timezone suffix is not accepted'],
      ['', 'empty']
    ];
    for (const [brewedAt] of cases) {
      const { status, body } = await api(base, 'POST', '/api/notes', notePayload({ brewed_at: brewedAt }));
      assert.equal(status, 400, `expected 400 for brewed_at "${brewedAt}"`);
      assert.equal(body.error.code, 'validation');
      assert.ok(body.error.fields.brewed_at, `expected a brewed_at message for "${brewedAt}"`);
    }
    // The value round-trips exactly as sent — no UTC conversion, no suffix.
    const ok = await api(base, 'POST', '/api/notes', notePayload({ brewed_at: '2028-02-29T23:59' }));
    assert.equal(ok.status, 201);
    assert.equal(ok.body.note.brewed_at, '2028-02-29T23:59');
  });
});

test('numeric fields are range-checked and numeric strings are normalised', async () => {
  await withServer(async (base) => {
    const bad = [
      ['grind_size', 'abc'],
      ['grind_size', -1],
      ['grind_size', 0],
      ['grind_size', 101],
      ['dose_g', 'heavy'],
      ['dose_g', 250],
      ['dose_g', -5],
      ['water_g', 5000],
      ['water_g', 0]
    ];
    for (const [field, value] of bad) {
      const { status, body } = await api(base, 'POST', '/api/notes', notePayload({ [field]: value }));
      assert.equal(status, 400, `expected 400 for ${field}=${value}`);
      assert.ok(body.error.fields[field], `expected a ${field} message`);
    }
    // Non-finite values cannot arrive as JSON numbers; the string forms must not crash.
    for (const value of ['Infinity', 'NaN']) {
      const { status, body } = await api(base, 'POST', '/api/notes', notePayload({ dose_g: value }));
      assert.equal(status, 400);
      assert.ok(body.error.fields.dose_g);
    }

    const ok = await api(base, 'POST', '/api/notes', notePayload({ grind_size: '12.5', dose_g: '18', water_g: '288' }));
    assert.equal(ok.status, 201);
    assert.equal(ok.body.note.grind_size, 12.5);
    assert.equal(ok.body.note.dose_g, 18);
    assert.equal(ok.body.note.water_g, 288);
    assert.equal(ok.body.note.ratio_display, '1:16');

    const empty = await api(base, 'POST', '/api/notes', notePayload({ grind_size: '', dose_g: null, water_g: undefined }));
    assert.equal(empty.status, 201);
    assert.equal(empty.body.note.grind_size, null);
    assert.equal(empty.body.note.dose_g, null);
    assert.equal(empty.body.note.ratio_display, null, 'no ratio without both dose and water');
  });
});

test('text and enum fields are validated with field-level messages', async () => {
  await withServer(async (base) => {
    const cases = [
      ['bean_name', 'x'.repeat(121)],
      ['bean_origin', 42],
      ['tasting_notes', 'y'.repeat(4001)],
      ['roast_level', 'extra'],
      ['grinder_name', '   ']
    ];
    for (const [field, value] of cases) {
      const payload = notePayload({ [field]: value });
      if (field === 'grinder_name') delete payload.grinder_id;
      const { status, body } = await api(base, 'POST', '/api/notes', payload);
      assert.equal(status, 400, `expected 400 for ${field}`);
      assert.ok(body.error.fields[field], `expected a ${field} message`);
    }

    const missingGrinder = notePayload();
    delete missingGrinder.grinder_name;
    const { status, body } = await api(base, 'POST', '/api/notes', missingGrinder);
    assert.equal(status, 400);
    assert.ok(body.error.fields.grinder_name, 'a free-text grinder name is required without grinder_id');

    const longText = await api(base, 'POST', '/api/notes', notePayload({ bean_origin: '', roast_level: null }));
    assert.equal(longText.status, 201);
    assert.equal(longText.body.note.roast_level, null);
  });
});

test('grinders: blank and duplicate names, single default invariant, rename', async () => {
  await withServer(async (base) => {
    const blank = await api(base, 'POST', '/api/grinders', { name: '   ' });
    assert.equal(blank.status, 400);
    assert.equal(blank.body.error.code, 'validation');
    assert.ok(blank.body.error.fields.name);

    const first = await api(base, 'POST', '/api/grinders', { name: 'Comandante C40' });
    assert.equal(first.status, 201);
    assert.equal(first.body.grinder.is_default, true, 'the first grinder becomes the default');
    assert.equal(first.body.grinder.note_count, 0);

    const duplicate = await api(base, 'POST', '/api/grinders', { name: 'comandante c40' });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, 'conflict');
    assert.ok(duplicate.body.error.fields.name);

    const second = await api(base, 'POST', '/api/grinders', { name: 'Timemore C2' });
    assert.equal(second.status, 201);
    assert.equal(second.body.grinder.is_default, false);

    const beforeSwitch = await api(base, 'GET', '/api/grinders');
    assert.equal(beforeSwitch.body.default_id, first.body.grinder.id);
    assert.equal(beforeSwitch.body.grinders.filter((grinder) => grinder.is_default).length, 1);

    const patched = await api(base, 'PATCH', `/api/grinders/${second.body.grinder.id}`, { is_default: true });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.grinder.is_default, true);

    const afterSwitch = await api(base, 'GET', '/api/grinders');
    assert.equal(afterSwitch.body.default_id, second.body.grinder.id);
    assert.equal(
      afterSwitch.body.grinders.filter((grinder) => grinder.is_default).length,
      1,
      'setting a default clears the previous one'
    );

    const noFields = await api(base, 'PATCH', `/api/grinders/${second.body.grinder.id}`, {});
    assert.equal(noFields.status, 400);
    assert.equal(noFields.body.error.code, 'validation');

    const clearDefault = await api(base, 'PATCH', `/api/grinders/${second.body.grinder.id}`, { is_default: false });
    assert.equal(clearDefault.status, 400, 'one grinder must stay the default');

    const renamed = await api(base, 'PATCH', `/api/grinders/${second.body.grinder.id}`, { name: 'Timemore C2 Pro' });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.grinder.name, 'Timemore C2 Pro');

    const clash = await api(base, 'PATCH', `/api/grinders/${second.body.grinder.id}`, { name: 'Comandante C40' });
    assert.equal(clash.status, 409);
    assert.ok(clash.body.error.fields.name);

    const selfRename = await api(base, 'PATCH', `/api/grinders/${second.body.grinder.id}`, { name: 'Timemore C2 Pro' });
    assert.equal(selfRename.status, 200, 'renaming to the same name is not a conflict');

    assert.equal((await api(base, 'PATCH', '/api/grinders/9999', { name: 'Nope' })).status, 404);
    assert.equal((await api(base, 'PATCH', '/api/grinders/abc', { name: 'Nope' })).status, 400);
    assert.equal((await api(base, 'DELETE', '/api/grinders/9999')).status, 404);
  });
});

test('deleting the default grinder promotes the oldest remaining grinder', async () => {
  await withServer(async (base) => {
    const a = (await api(base, 'POST', '/api/grinders', { name: 'Grinder A' })).body.grinder;
    const b = (await api(base, 'POST', '/api/grinders', { name: 'Grinder B' })).body.grinder;
    const c = (await api(base, 'POST', '/api/grinders', { name: 'Grinder C' })).body.grinder;
    await api(base, 'PATCH', `/api/grinders/${c.id}`, { is_default: true });

    const deleted = await api(base, 'DELETE', `/api/grinders/${c.id}`);
    assert.equal(deleted.status, 200);
    assert.deepEqual(deleted.body, { ok: true, deleted_id: c.id, new_default_id: a.id });

    const grinders = (await api(base, 'GET', '/api/grinders')).body;
    assert.deepEqual(grinders.grinders.map((grinder) => grinder.name), ['Grinder A', 'Grinder B']);
    assert.equal(grinders.default_id, a.id);
    assert.equal(grinders.grinders.find((grinder) => grinder.id === a.id).is_default, true);
    assert.equal(grinders.grinders.find((grinder) => grinder.id === b.id).is_default, false);
  });
});

test('deleting a grinder keeps its notes readable with the snapshot name', async () => {
  await withServer(async (base) => {
    const grinder = (await api(base, 'POST', '/api/grinders', { name: 'Timemore C2' })).body.grinder;
    const note = (await api(base, 'POST', '/api/notes', notePayload({ grinder_id: grinder.id }))).body.note;
    assert.equal(note.grinder_id, grinder.id);
    assert.equal(note.grinder_name, 'Timemore C2', 'the server resolved the snapshot from the grinder id');

    const deleted = await api(base, 'DELETE', `/api/grinders/${grinder.id}`);
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.new_default_id, null, 'no grinders remain');

    const read = await api(base, 'GET', `/api/notes/${note.id}`);
    assert.equal(read.status, 200);
    assert.equal(read.body.note.grinder_id, null);
    assert.equal(read.body.note.grinder_name, 'Timemore C2');
    assert.equal(read.body.note.bean_name, 'Kenya Nyeri AA');

    const unknown = await api(base, 'POST', '/api/notes', notePayload({ grinder_id: grinder.id }));
    assert.equal(unknown.status, 400);
    assert.equal(unknown.body.error.fields.grinder_id, 'That grinder does not exist.');
  });
});

test('demo seed and clear leave user notes untouched', async () => {
  await withServer(async (base) => {
    const mine = (await api(base, 'POST', '/api/notes', notePayload({ grinder_name: 'My hand grinder' }))).body.note;

    const seeded = await api(base, 'POST', '/api/demo/seed');
    assert.equal(seeded.status, 201);
    assert.equal(seeded.body.created, 5);
    assert.equal(seeded.body.ids.length, 5);

    const afterSeed = await api(base, 'GET', '/api/notes');
    assert.equal(afterSeed.body.notes.length, 6);
    assert.equal(afterSeed.body.notes.filter((note) => note.is_demo).length, 5);
    const grinders = (await api(base, 'GET', '/api/grinders')).body;
    assert.equal(grinders.grinders.length, 2, 'two demo grinders are added when none exist');
    assert.equal(grinders.grinders.filter((grinder) => grinder.is_default).length, 1);

    const cleared = await api(base, 'DELETE', '/api/demo');
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.removed, 5);

    const afterClear = await api(base, 'GET', '/api/notes');
    assert.equal(afterClear.body.notes.length, 1);
    assert.equal(afterClear.body.notes[0].id, mine.id);
    assert.equal((await api(base, 'GET', '/api/grinders')).body.grinders.length, 0);
  });
});

test('GET /api/notes supports q, grinder and limit, newest first', async () => {
  await withServer(async (base) => {
    const grinder = (await api(base, 'POST', '/api/grinders', { name: 'Timemore C2' })).body.grinder;
    await api(base, 'POST', '/api/notes', notePayload({ brewed_at: '2026-10-01T08:00', bean_name: 'Brazil Cerrado' }));
    await api(
      base,
      'POST',
      '/api/notes',
      notePayload({ brewed_at: '2026-10-09T08:00', bean_name: 'Ethiopia Chelbesa', grinder_id: grinder.id })
    );
    await api(base, 'POST', '/api/notes', notePayload({ brewed_at: '2026-10-05T08:00', bean_name: 'Sumatra Gayo' }));

    const all = await api(base, 'GET', '/api/notes');
    assert.deepEqual(
      all.body.notes.map((note) => note.bean_name),
      ['Ethiopia Chelbesa', 'Sumatra Gayo', 'Brazil Cerrado']
    );
    assert.equal((await api(base, 'GET', '/api/notes?q=cerrado')).body.notes.length, 1);
    assert.equal((await api(base, 'GET', '/api/notes?q=CERRADO')).body.notes.length, 1);
    assert.equal((await api(base, 'GET', '/api/notes?q=timemore')).body.notes.length, 1, 'q matches the grinder name');
    assert.equal((await api(base, 'GET', `/api/notes?grinder=${grinder.id}`)).body.notes.length, 1);
    assert.equal((await api(base, 'GET', '/api/notes?limit=2')).body.notes.length, 2);
    assert.equal((await api(base, 'GET', '/api/notes?q=nomatch')).body.notes.length, 0);

    for (const query of ['limit=abc', 'limit=0', 'limit=501', 'grinder=abc', 'grinder=9999']) {
      const { status, body } = await api(base, 'GET', `/api/notes?${query}`);
      assert.equal(status, 400, `expected 400 for ?${query}`);
      assert.equal(body.error.code, 'validation');
      assert.deepEqual(Object.keys(body.error.fields).length, 1);
    }
  });
});

test('malformed and oversized request bodies are rejected clearly', async () => {
  await withServer(async (base) => {
    const malformed = await api(base, 'POST', '/api/notes', '{"brewed_at": ');
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.error.code, 'validation');
    assert.match(malformed.body.error.message, /not valid JSON/);

    const arrayBody = await api(base, 'POST', '/api/notes', '[1,2,3]');
    assert.equal(arrayBody.status, 400);
    assert.match(arrayBody.body.error.message, /must be a JSON object/);

    const tooLarge = await api(base, 'POST', '/api/notes', notePayload({ tasting_notes: 'z'.repeat(300 * 1024) }));
    assert.equal(tooLarge.status, 400);
    assert.match(tooLarge.body.error.message, /larger than 256 KB/);

    // The body-less demo action still works with no body at all.
    const noBody = await api(base, 'POST', '/api/demo/seed');
    assert.equal(noBody.status, 201);
  });
});

test('unknown routes are 404 and known paths with a wrong method are 405', async () => {
  await withServer(async (base) => {
    const unknown = await api(base, 'GET', '/api/nope');
    assert.equal(unknown.status, 404);
    assert.equal(unknown.body.error.code, 'not_found');

    const wrongMethod = await api(base, 'PATCH', '/api/notes');
    assert.equal(wrongMethod.status, 405);
    assert.equal(wrongMethod.body.error.code, 'not_found');
    assert.ok(wrongMethod.headers.get('allow').includes('GET'));
    assert.ok(wrongMethod.headers.get('allow').includes('POST'));

    const wrongOnItem = await api(base, 'POST', '/api/notes/1');
    assert.equal(wrongOnItem.status, 405);

    const badId = await api(base, 'GET', '/api/notes/abc');
    assert.equal(badId.status, 400);
  });
});

test('static files are served with correct MIME types and no path traversal', async () => {
  await withServer(async (base, app) => {
    const shell = await api(base, 'GET', '/');
    assert.equal(shell.status, 200);
    assert.equal(shell.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.match(String(shell.body), /Coffee Notes/);

    for (const [route, type] of [
      ['/styles.css', 'text/css; charset=utf-8'],
      ['/app.js', 'text/javascript; charset=utf-8'],
      ['/fonts/dm-sans.css', 'text/css; charset=utf-8']
    ]) {
      const asset = await api(base, 'GET', route);
      assert.equal(asset.status, 200, `expected ${route} to be served`);
      assert.equal(asset.headers.get('content-type'), type);
    }

    assert.equal((await api(base, 'GET', '/missing.txt')).status, 404);

    const traversal = await rawRequest(app.port, '/../package.json');
    assert.match(traversal.split('\r\n')[0], /^HTTP\/1\.1 404 /, 'dot segments are normalised away, never served');
    assert.ok(!traversal.includes('"name": "coffee-notes"'), 'package.json is not served');

    // Percent-encoded separators survive URL normalisation, so the static layer
    // is what rejects them: ".." is rejected after decoding.
    const encoded = await rawRequest(app.port, '/%2e%2e%2fpackage.json');
    assert.match(encoded.split('\r\n')[0], /^HTTP\/1\.1 400 /, 'encoded traversal is rejected after decoding');
    assert.ok(!encoded.includes('"name": "coffee-notes"'), 'package.json is not served');
  });
});

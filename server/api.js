// API route handlers and payload validation. Paths and shapes follow docs/SPEC.md §7.

import { ApiError, conflictError, notFoundError, validationError } from './router.js';

const LIMIT_DEFAULT = 200;
const LIMIT_MAX = 500;
const ROAST_LEVELS = ['light', 'medium', 'dark'];

function invalidFields(fields) {
  return validationError('Check the highlighted fields.', fields);
}

function readPathId(value, label) {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1) {
    throw validationError(`Enter a whole number ${label} id.`, { id: 'Must be a whole number.' });
  }
  return Number(value);
}

function readInteger(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

function readTextField(value, { field, max, fields, required = false, requiredMessage }) {
  if (value === undefined || value === null) {
    if (required) fields[field] = requiredMessage ?? 'This field is required.';
    return '';
  }
  if (typeof value !== 'string') {
    fields[field] = required ? (requiredMessage ?? 'This field is required.') : 'Enter text.';
    return '';
  }
  const text = value.trim();
  if (text === '' && required) {
    fields[field] = requiredMessage ?? 'This field is required.';
    return '';
  }
  if (text.length > max) {
    fields[field] = `Keep it to ${max} characters or fewer.`;
    return '';
  }
  return text;
}

// Accepts JSON numbers and the numeric strings a datetime-local/date style form
// input can produce. Empty string and null mean "not set".
function readNumberField(value, { field, min, max, fields }) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  let number;
  if (typeof value === 'number') number = value;
  else if (typeof value === 'string') number = Number(value.trim());
  else {
    fields[field] = 'Enter a number.';
    return null;
  }
  if (!Number.isFinite(number)) {
    fields[field] = 'Enter a number.';
    return null;
  }
  if (number <= min || number > max) {
    fields[field] = `Enter a number greater than ${min} and at most ${max}.`;
    return null;
  }
  return number;
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isRealDateTime(text) {
  const [datePart, timePart] = text.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  if (month < 1 || month > 12) return false;
  if (hour > 23 || minute > 59) return false;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day >= 1 && day <= daysInMonth;
}

// Stored and returned verbatim: no Date parsing, no UTC conversion, no suffix.
function readBrewedAt(value, fields) {
  if (value === undefined || value === null) {
    fields.brewed_at = 'Brew date and time is required.';
    return '';
  }
  if (typeof value !== 'string') {
    fields.brewed_at = 'Enter the brew date and time as text.';
    return '';
  }
  const text = value.trim();
  if (text === '') {
    fields.brewed_at = 'Brew date and time is required.';
    return '';
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) {
    fields.brewed_at = 'Use the format YYYY-MM-DDTHH:MM.';
    return '';
  }
  if (!isRealDateTime(text)) {
    fields.brewed_at = 'That date and time does not exist.';
    return '';
  }
  return text;
}

function readRoastLevel(value, fields) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    fields.roast_level = 'Choose light, medium or dark.';
    return null;
  }
  const text = value.trim().toLowerCase();
  if (text === '') return null;
  if (!ROAST_LEVELS.includes(text)) {
    fields.roast_level = 'Choose light, medium or dark.';
    return null;
  }
  return text;
}

// grinder_id wins when present (server resolves the snapshot name); otherwise a
// free-text grinder_name is required so history survives preset removal.
function readGrinderRef(body, db, fields) {
  const rawId = body.grinder_id;
  if (rawId !== undefined && rawId !== null && rawId !== '') {
    const id = readInteger(rawId);
    if (id === null || id < 1) {
      fields.grinder_id = 'Enter a grinder id.';
      return { grinder_id: null, grinder_name: '' };
    }
    const grinder = db.getGrinder(id);
    if (!grinder) {
      fields.grinder_id = 'That grinder does not exist.';
      return { grinder_id: null, grinder_name: '' };
    }
    return { grinder_id: Number(grinder.id), grinder_name: grinder.name };
  }
  const name = readTextField(body.grinder_name, {
    field: 'grinder_name',
    max: 80,
    fields,
    required: true,
    requiredMessage: 'Choose a grinder or type its name.'
  });
  return { grinder_id: null, grinder_name: name };
}

function validateNotePayload(body, db) {
  const fields = {};
  const brewedAt = readBrewedAt(body.brewed_at, fields);
  const grinder = readGrinderRef(body, db, fields);
  const grindSize = readNumberField(body.grind_size, { field: 'grind_size', min: 0, max: 100, fields });
  const dose = readNumberField(body.dose_g, { field: 'dose_g', min: 0, max: 200, fields });
  const water = readNumberField(body.water_g, { field: 'water_g', min: 0, max: 2000, fields });
  const beanName = readTextField(body.bean_name, { field: 'bean_name', max: 120, fields });
  const beanOrigin = readTextField(body.bean_origin, { field: 'bean_origin', max: 120, fields });
  const roastLevel = readRoastLevel(body.roast_level, fields);
  const tastingNotes = readTextField(body.tasting_notes, { field: 'tasting_notes', max: 4000, fields });

  if (Object.keys(fields).length > 0) throw invalidFields(fields);

  return {
    brewed_at: brewedAt,
    grinder_id: grinder.grinder_id,
    grinder_name: grinder.grinder_name,
    grind_size: grindSize,
    dose_g: dose,
    water_g: water,
    bean_name: beanName,
    bean_origin: beanOrigin,
    roast_level: roastLevel,
    tasting_notes: tastingNotes
  };
}

function readGrinderName(value, fields) {
  if (value === undefined || value === null || typeof value !== 'string') {
    fields.name = 'Enter a grinder name.';
    return '';
  }
  const name = value.trim();
  if (name === '') {
    fields.name = 'Enter a grinder name.';
    return '';
  }
  if (name.length > 40) {
    fields.name = 'Keep it to 40 characters or fewer.';
    return '';
  }
  return name;
}

function readLimit(raw, fields) {
  if (raw === null || raw === undefined || raw === '') return LIMIT_DEFAULT;
  if (!/^\d+$/.test(String(raw).trim())) {
    fields.limit = `Enter a whole number between 1 and ${LIMIT_MAX}.`;
    return LIMIT_DEFAULT;
  }
  const limit = Number(String(raw).trim());
  if (limit < 1 || limit > LIMIT_MAX) {
    fields.limit = `Enter a whole number between 1 and ${LIMIT_MAX}.`;
    return LIMIT_DEFAULT;
  }
  return limit;
}

function readGrinderFilter(raw, db, fields) {
  if (raw === null || raw === undefined || raw === '') return null;
  const id = readInteger(raw);
  if (id === null || id < 1 || !db.getGrinder(id)) {
    fields.grinder = 'That grinder does not exist.';
    return null;
  }
  return id;
}

export function registerRoutes(router, { db, version }) {
  router.add('GET', '/api/health', () => {
    db.healthCheck();
    return { status: 200, body: { ok: true, version, db: 'ok', now: new Date().toISOString() } };
  });

  router.add('GET', '/api/notes', ({ query }) => {
    const fields = {};
    const limit = readLimit(query.get('limit'), fields);
    const grinderId = readGrinderFilter(query.get('grinder'), db, fields);
    if (Object.keys(fields).length > 0) throw invalidFields(fields);
    const notes = db.listNotes({ q: query.get('q'), grinderId, limit });
    return { status: 200, body: { notes } };
  });

  router.add('POST', '/api/notes', ({ body }) => {
    const note = db.createNote(validateNotePayload(body, db));
    return { status: 201, body: { note } };
  });

  router.add('GET', '/api/notes/:id', ({ params }) => {
    const id = readPathId(params.id, 'note');
    const note = db.getNote(id);
    if (!note) throw notFoundError('Note not found.');
    return { status: 200, body: { note } };
  });

  router.add('PUT', '/api/notes/:id', ({ params, body }) => {
    const id = readPathId(params.id, 'note');
    if (!db.getNote(id)) throw notFoundError('Note not found.');
    const note = db.updateNote(id, validateNotePayload(body, db));
    return { status: 200, body: { note } };
  });

  router.add('DELETE', '/api/notes/:id', ({ params }) => {
    const id = readPathId(params.id, 'note');
    if (!db.deleteNote(id)) throw notFoundError('Note not found.');
    return { status: 200, body: { ok: true, deleted_id: id } };
  });

  router.add('GET', '/api/grinders', () => {
    const grinder = db.getDefaultGrinder();
    return {
      status: 200,
      body: { grinders: db.listGrinders(), default_id: grinder ? Number(grinder.id) : null }
    };
  });

  router.add('POST', '/api/grinders', ({ body }) => {
    const fields = {};
    const name = readGrinderName(body.name, fields);
    if (Object.keys(fields).length > 0) throw invalidFields(fields);
    if (db.getGrinderByName(name)) {
      throw conflictError('A grinder with that name already exists.', { name: 'That name is already in use.' });
    }
    return { status: 201, body: { grinder: db.createGrinder(name) } };
  });

  router.add('PATCH', '/api/grinders/:id', ({ params, body }) => {
    const id = readPathId(params.id, 'grinder');
    if (!db.getGrinder(id)) throw notFoundError('Grinder not found.');

    const hasName = body.name !== undefined && body.name !== null;
    const wantsDefault = body.is_default !== undefined && body.is_default !== null;
    if (!hasName && !wantsDefault) {
      throw validationError('Provide a name or is_default.', {});
    }

    if (hasName) {
      const fields = {};
      const name = readGrinderName(body.name, fields);
      if (Object.keys(fields).length > 0) throw invalidFields(fields);
      const clash = db.getGrinderByName(name);
      if (clash && Number(clash.id) !== id) {
        throw conflictError('A grinder with that name already exists.', { name: 'That name is already in use.' });
      }
      db.renameGrinder(id, name);
    }

    if (wantsDefault) {
      const fields = {};
      if (body.is_default === true || body.is_default === 1) {
        db.setDefaultGrinder(id);
      } else if (body.is_default === false || body.is_default === 0) {
        // Exactly one grinder must be the default while any grinder exists.
        fields.is_default = 'Pick another grinder as the default instead of clearing this one.';
      } else {
        fields.is_default = 'Use true or false.';
      }
      if (Object.keys(fields).length > 0) throw invalidFields(fields);
    }

    return { status: 200, body: { grinder: db.getGrinderSummary(id) } };
  });

  router.add('DELETE', '/api/grinders/:id', ({ params }) => {
    const id = readPathId(params.id, 'grinder');
    const result = db.deleteGrinder(id);
    if (!result) throw notFoundError('Grinder not found.');
    return {
      status: 200,
      body: { ok: true, deleted_id: result.deleted_id, new_default_id: result.new_default_id }
    };
  });

  router.add('POST', '/api/demo/seed', () => {
    const { created, ids } = db.seedDemo();
    return { status: 201, body: { created, ids } };
  });

  router.add('DELETE', '/api/demo', () => {
    const { removed } = db.clearDemo();
    return { status: 200, body: { removed } };
  });

  return router;
}

export { ApiError };

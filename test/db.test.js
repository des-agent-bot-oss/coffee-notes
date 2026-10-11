// Storage-layer tests: migrations, CRUD, invariants and process-restart persistence.
// Databases live in a throwaway directory under the process temp dir — never in the repo.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { openDatabase, parseMigrations } from '../server/db.js';

const tempDirs = [];

function tempDbPath(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `coffee-notes-db-${label}-`));
  tempDirs.push(dir);
  assert.ok(!dir.startsWith(path.resolve('data')), 'test database must not live in the repo data directory');
  return path.join(dir, 'test.db');
}

test.after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function noteFixture(overrides = {}) {
  return {
    brewed_at: '2026-10-11T07:35',
    grinder_id: null,
    grinder_name: 'Hand grinder',
    grind_size: 14,
    dose_g: 16,
    water_g: 256,
    bean_name: 'Kenya Nyeri AA',
    bean_origin: 'Kenya',
    roast_level: 'light',
    tasting_notes: 'Blackcurrant.\nBright.',
    ...overrides
  };
}

test('schema.sql declares migrations in ascending order and each block has DDL', () => {
  const migrations = parseMigrations(fs.readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8'));
  assert.ok(migrations.length >= 1);
  const versions = migrations.map((migration) => migration.version);
  assert.deepEqual(versions, [...versions].sort((a, b) => a - b));
  for (const migration of migrations) assert.match(migration.statements, /CREATE|ALTER/);
});

test('fresh database is created, migrated and configured', () => {
  const dbPath = tempDbPath('fresh');
  const db = openDatabase(dbPath);
  try {
    assert.ok(fs.existsSync(dbPath), 'database file created');
    assert.equal(db.raw.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
    assert.equal(db.raw.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    const applied = db.raw.prepare('SELECT version FROM schema_migrations ORDER BY version').all();
    assert.deepEqual(
      applied.map((row) => row.version),
      [1, 2]
    );
    assert.ok(db.raw.prepare('PRAGMA foreign_keys').get());
    assert.equal(db.healthCheck(), true);
  } finally {
    db.close();
  }
});

test('re-opening an already migrated database does not re-apply migrations', () => {
  const dbPath = tempDbPath('idempotent');
  const first = openDatabase(dbPath);
  const appliedAt = first.raw.prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version').all();
  first.close();

  const second = openDatabase(dbPath);
  try {
    const again = second.raw.prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version').all();
    assert.deepEqual(again, appliedAt, 'migration records are untouched on a second open');
    assert.deepEqual(
      second.raw
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all()
        .map((row) => row.name),
      ['grinders', 'notes', 'schema_migrations']
    );
  } finally {
    second.close();
  }
});

test('note create/read/update/delete round-trip, including ratio_display', () => {
  const db = openDatabase(tempDbPath('notes'));
  try {
    const created = db.createNote(noteFixture());
    assert.equal(created.brewed_at, '2026-10-11T07:35');
    assert.equal(created.grinder_name, 'Hand grinder');
    assert.equal(created.grinder_id, null);
    assert.equal(created.grind_size, 14);
    assert.equal(created.ratio_display, '1:16');
    assert.equal(created.is_demo, false);
    assert.equal(created.roast_level, 'light');
    assert.match(created.created_at, /^\d{4}-\d{2}-\d{2}T.*Z$/);
    assert.equal(created.tasting_notes, 'Blackcurrant.\nBright.');

    const fetched = db.getNote(created.id);
    assert.deepEqual(fetched, created);

    const updated = db.updateNote(created.id, noteFixture({ bean_name: 'Kenya Nyeri AB', dose_g: 15, water_g: 250 }));
    assert.equal(updated.bean_name, 'Kenya Nyeri AB');
    assert.equal(updated.ratio_display, '1:16.7');
    assert.equal(updated.id, created.id);
    assert.equal(updated.created_at, created.created_at, 'created_at is not rewritten by an update');
    assert.ok(updated.updated_at >= created.updated_at);

    assert.equal(db.deleteNote(created.id), true);
    assert.equal(db.getNote(created.id), null);
    assert.equal(db.deleteNote(created.id), false, 'deleting a missing note reports no change');
  } finally {
    db.close();
  }
});

test('grinder names are unique case-insensitively and the first grinder is the default', () => {
  const db = openDatabase(tempDbPath('grinders'));
  try {
    const first = db.createGrinder('Comandante C40');
    assert.equal(first.is_default, true, 'the first grinder becomes the default');
    const second = db.createGrinder('Timemore C2');
    assert.equal(second.is_default, false);

    assert.throws(() => db.createGrinder('comandante c40'), /UNIQUE|constraint/i);
    assert.equal(db.getGrinderByName('COMANDANTE C40').id, first.id, 'lookup ignores case');
    assert.deepEqual(db.listGrinders().map((grinder) => grinder.name), ['Comandante C40', 'Timemore C2']);
  } finally {
    db.close();
  }
});

test('setting the default clears the previous one and deleting it promotes the oldest remaining', () => {
  const db = openDatabase(tempDbPath('default'));
  try {
    const first = db.createGrinder('Grinder A');
    const second = db.createGrinder('Grinder B');
    const third = db.createGrinder('Grinder C');

    db.setDefaultGrinder(third.id);
    assert.equal(db.getDefaultGrinder().id, third.id);
    assert.equal(
      db.raw.prepare('SELECT COUNT(*) AS count FROM grinders WHERE is_default = 1').get().count,
      1,
      'exactly one default'
    );

    // Deleting the current default promotes another grinder, and only ever one.
    const result = db.deleteGrinder(third.id);
    assert.equal(result.deleted_id, third.id);
    assert.notEqual(result.new_default_id, null);
    assert.equal(db.getDefaultGrinder().id, result.new_default_id);
    assert.equal(db.raw.prepare('SELECT COUNT(*) AS count FROM grinders WHERE is_default = 1').get().count, 1);

    // Deleting every remaining grinder: promotion happens until none are left.
    const remaining = db.listGrinders().map((grinder) => grinder.id);
    const promoted = db.deleteGrinder(remaining[0]);
    assert.equal(promoted.new_default_id, remaining[1]);
    const last = db.deleteGrinder(remaining[1]);
    assert.deepEqual(last, { deleted_id: remaining[1], new_default_id: null });
    assert.equal(db.listGrinders().length, 0);
    assert.equal(db.getDefaultGrinder(), null);
  } finally {
    db.close();
  }
});

test('deleting a grinder keeps its notes readable with the snapshot name', () => {
  const db = openDatabase(tempDbPath('snapshot'));
  try {
    const grinder = db.createGrinder('Timemore C2');
    const note = db.createNote(noteFixture({ grinder_id: grinder.id, grinder_name: 'Timemore C2' }));
    const idle = db.createGrinder('Baratza Encore');

    db.deleteGrinder(grinder.id);

    const after = db.getNote(note.id);
    assert.ok(after, 'the note still exists');
    assert.equal(after.grinder_id, null, 'the foreign key is cleared');
    assert.equal(after.grinder_name, 'Timemore C2', 'the snapshot name is preserved');
    assert.equal(db.getDefaultGrinder().id, idle.id, 'the surviving grinder took over as default');
  } finally {
    db.close();
  }
});

test('notes and grinders survive closing and reopening the database handle', () => {
  const dbPath = tempDbPath('persistence');
  const first = openDatabase(dbPath);
  const grinder = first.createGrinder('Comandante C40');
  const note = first.createNote(noteFixture({ grinder_id: grinder.id, grinder_name: grinder.name }));
  first.close();

  // Simulates an application-process restart: a brand new handle on the same file.
  const second = openDatabase(dbPath);
  try {
    const reloaded = second.getNote(note.id);
    assert.equal(reloaded.bean_name, note.bean_name);
    assert.equal(reloaded.brewed_at, note.brewed_at);
    assert.equal(reloaded.grinder_id, grinder.id);
    assert.equal(second.getGrinder(grinder.id).name, 'Comandante C40');
    assert.equal(second.getDefaultGrinder().id, grinder.id);
  } finally {
    second.close();
  }
});

test('demo seed and clear only touch demo rows', () => {
  const db = openDatabase(tempDbPath('demo'));
  try {
    const userNote = db.createNote(noteFixture({ grinder_name: 'My grinder' }));
    const seeded = db.seedDemo();
    assert.equal(seeded.created, 5);
    assert.equal(seeded.ids.length, 5);
    assert.equal(db.raw.prepare('SELECT COUNT(*) AS count FROM notes WHERE is_demo = 1').get().count, 5);
    assert.equal(db.raw.prepare('SELECT COUNT(*) AS count FROM grinders WHERE is_demo = 1').get().count, 2);
    assert.equal(db.listGrinders().length, 2, 'demo grinders only when none existed');
    assert.equal(db.listGrinders().filter((g) => g.is_default).length, 1, 'demo grinders keep the single-default rule');

    const cleared = db.clearDemo();
    assert.equal(cleared.removed, 5);
    assert.equal(db.raw.prepare('SELECT COUNT(*) AS count FROM notes WHERE is_demo = 1').get().count, 0);
    assert.equal(db.raw.prepare('SELECT COUNT(*) AS count FROM grinders WHERE is_demo = 1').get().count, 0);
    assert.ok(db.getNote(userNote.id), 'the user note is untouched');
    assert.equal(db.listNotes().length, 1);
  } finally {
    db.close();
  }
});

test('re-seeding demo data uses existing grinders instead of adding demo presets', () => {
  const db = openDatabase(tempDbPath('demo-existing'));
  try {
    const mine = db.createGrinder('My grinder');
    const seeded = db.seedDemo();
    assert.equal(seeded.created, 5);
    assert.equal(db.listGrinders().length, 1, 'no demo grinders added when a grinder already exists');
    const notes = db.listNotes();
    assert.equal(notes.length, 5);
    for (const note of notes) assert.equal(note.grinder_name, mine.name);

    db.clearDemo();
    assert.equal(db.listGrinders().length, 1, 'the user grinder survives the demo clear');
    assert.equal(db.getGrinder(mine.id).id, mine.id);
  } finally {
    db.close();
  }
});

test('listNotes filters by text and grinder, newest first, with a limit', () => {
  const db = openDatabase(tempDbPath('list'));
  try {
    const grinder = db.createGrinder('Timemore C2');
    db.createNote(noteFixture({ brewed_at: '2026-10-01T08:00', bean_name: 'Brazil Cerrado', grinder_name: 'Hand grinder' }));
    db.createNote(
      noteFixture({
        brewed_at: '2026-10-09T08:00',
        bean_name: 'Ethiopia Chelbesa',
        tasting_notes: 'Jasmine',
        grinder_id: grinder.id,
        grinder_name: grinder.name
      })
    );
    db.createNote(noteFixture({ brewed_at: '2026-10-05T08:00', bean_name: 'Sumatra Gayo', bean_origin: 'Indonesia' }));

    assert.deepEqual(
      db.listNotes().map((note) => note.brewed_at),
      ['2026-10-09T08:00', '2026-10-05T08:00', '2026-10-01T08:00'],
      'newest brewed_at first'
    );
    assert.deepEqual(db.listNotes({ q: 'jasmine' }).map((note) => note.bean_name), ['Ethiopia Chelbesa'], 'q matches tasting notes');
    assert.deepEqual(db.listNotes({ q: 'indonesia' }).map((note) => note.bean_name), ['Sumatra Gayo'], 'q matches origin');
    assert.deepEqual(db.listNotes({ q: 'cerrado' }).map((note) => note.bean_name), ['Brazil Cerrado'], 'q is case-insensitive');
    assert.deepEqual(db.listNotes({ q: 'timemore' }).map((note) => note.bean_name), ['Ethiopia Chelbesa'], 'q matches grinder name');
    assert.deepEqual(db.listNotes({ grinderId: grinder.id }).map((note) => note.bean_name), ['Ethiopia Chelbesa']);
    assert.equal(db.listNotes({ limit: 2 }).length, 2);

    const summary = db.listNotes({ limit: 1 })[0];
    assert.deepEqual(Object.keys(summary).sort(), ['bean_name', 'brewed_at', 'grind_size', 'grinder_name', 'id', 'is_demo'].sort());
  } finally {
    db.close();
  }
});

test('updateNote returns null once the note is gone', () => {
  const db = openDatabase(tempDbPath('missing'));
  try {
    assert.equal(db.updateNote(4242, noteFixture()), null);
    assert.equal(db.getNote(4242), null);
  } finally {
    db.close();
  }
});

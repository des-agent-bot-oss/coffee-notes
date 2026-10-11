// SQLite storage for Coffee Notes. Every query in the application lives here;
// the HTTP layer only calls these methods. Synchronous by design (node:sqlite
// DatabaseSync), which also removes any interleaving between a uniqueness check
// and the write that follows it.

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');

const NOTE_COLUMNS =
  'id, brewed_at, grinder_id, grinder_name, grind_size, dose_g, water_g, bean_name, ' +
  'bean_origin, roast_level, tasting_notes, is_demo, created_at, updated_at';

const GRINDER_SUMMARY_COLUMNS = `g.id, g.name, g.is_default,
  (SELECT COUNT(*) FROM notes n WHERE n.grinder_id = g.id) AS note_count`;

const GRINDER_COLUMNS = 'id, name, is_default, is_demo, created_at';

const DEMO_GRINDERS = ['Timemore C2', 'Baratza Encore ESP'];

// Realistic synthetic data for the explicit sample-data action only.
const DEMO_NOTES = [
  {
    brewed_at: '2026-10-11T07:35',
    grind_size: 12.5,
    dose_g: 15,
    water_g: 240,
    bean_name: 'Ethiopia Yirgacheffe Chelbesa',
    bean_origin: 'Ethiopia',
    roast_level: 'light',
    tasting_notes: 'Jasmine and bergamot on the nose, clean apricot finish.\nBest cup so far at this grind setting.'
  },
  {
    brewed_at: '2026-10-10T08:05',
    grind_size: 14,
    dose_g: 16,
    water_g: 256,
    bean_name: 'Kenya Nyeri Karindundu AA',
    bean_origin: 'Kenya',
    roast_level: 'light',
    tasting_notes: 'Blackcurrant and tamarind. Bright, juicy acidity — try a slightly lower water temperature next time.'
  },
  {
    brewed_at: '2026-10-08T18:40',
    grind_size: 15,
    dose_g: 18,
    water_g: 288,
    bean_name: 'Colombia Huila El Diviso Pink Bourbon',
    bean_origin: 'Colombia',
    roast_level: 'medium',
    tasting_notes: 'Red apple and cocoa nibs, balanced with a round body. Good everyday recipe.'
  },
  {
    brewed_at: '2026-10-06T07:50',
    grind_size: 18,
    dose_g: 20,
    water_g: 300,
    bean_name: 'Sumatra Mandheling Gayo',
    bean_origin: 'Indonesia',
    roast_level: 'dark',
    tasting_notes: 'Cedar and dark chocolate. Low acidity, syrupy mouthfeel.'
  },
  {
    brewed_at: '2026-10-04T16:15',
    grind_size: 16,
    dose_g: 18,
    water_g: 288,
    bean_name: 'Brazil Cerrado Daterra Yellow Bourbon',
    bean_origin: 'Brazil',
    roast_level: 'medium',
    tasting_notes: 'Peanut brittle and caramel. Comfortable daily cup.'
  }
];

function round1(value) {
  return Math.round(value * 10) / 10;
}

function toNumberOrNull(value) {
  return value === null || value === undefined ? null : Number(value);
}

function toNote(row) {
  if (!row) return null;
  const dose = toNumberOrNull(row.dose_g);
  const water = toNumberOrNull(row.water_g);
  return {
    id: Number(row.id),
    brewed_at: row.brewed_at,
    grinder_id: toNumberOrNull(row.grinder_id),
    grinder_name: row.grinder_name,
    grind_size: toNumberOrNull(row.grind_size),
    dose_g: dose,
    water_g: water,
    bean_name: row.bean_name,
    bean_origin: row.bean_origin,
    roast_level: row.roast_level ?? null,
    tasting_notes: row.tasting_notes,
    is_demo: row.is_demo === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ratio_display: dose !== null && water !== null && dose > 0 ? `1:${round1(water / dose)}` : null
  };
}

function toNoteSummary(row) {
  return {
    id: Number(row.id),
    brewed_at: row.brewed_at,
    grinder_name: row.grinder_name,
    bean_name: row.bean_name,
    grind_size: toNumberOrNull(row.grind_size),
    is_demo: row.is_demo === 1
  };
}

function toGrinderSummary(row) {
  return {
    id: Number(row.id),
    name: row.name,
    is_default: row.is_default === 1,
    note_count: Number(row.note_count ?? 0)
  };
}

export function parseMigrations(sql) {
  const migrations = [];
  let current = null;
  for (const line of sql.split(/\r?\n/)) {
    const marker = /^--\s*migrate:\s*(\d+)\s*$/.exec(line);
    if (marker) {
      current = { version: Number(marker[1]), statements: '' };
      migrations.push(current);
    } else if (current) {
      current.statements += `${line}\n`;
    }
  }
  return migrations.filter((migration) => migration.statements.trim() !== '');
}

function applyMigrations(db) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)'
  );
  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((row) => Number(row.version))
  );
  const record = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)');
  for (const migration of parseMigrations(fs.readFileSync(SCHEMA_FILE, 'utf8'))) {
    if (applied.has(migration.version)) continue;
    db.exec('BEGIN');
    try {
      db.exec(migration.statements);
      record.run(migration.version, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${migration.version} failed: ${error.message}`, { cause: error });
    }
  }
}

/**
 * Open (creating if needed) the database file and bring the schema up to date.
 */
export function openDatabase(dbPath) {
  if (typeof dbPath !== 'string' || dbPath.trim() === '') {
    throw new Error('openDatabase requires a database file path');
  }
  const resolved = path.resolve(dbPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const db = new DatabaseSync(resolved);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  applyMigrations(db);

  const sql = {
    ping: db.prepare('SELECT 1 AS ok'),
    noteById: db.prepare(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ?`),
    insertNote: db.prepare(
      `INSERT INTO notes (brewed_at, grinder_id, grinder_name, grind_size, dose_g, water_g, bean_name,
        bean_origin, roast_level, tasting_notes, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ),
    updateNote: db.prepare(
      `UPDATE notes SET brewed_at = ?, grinder_id = ?, grinder_name = ?, grind_size = ?, dose_g = ?,
        water_g = ?, bean_name = ?, bean_origin = ?, roast_level = ?, tasting_notes = ?, updated_at = ?
       WHERE id = ?`
    ),
    deleteNote: db.prepare('DELETE FROM notes WHERE id = ?'),
    grinderById: db.prepare(`SELECT ${GRINDER_COLUMNS} FROM grinders WHERE id = ?`),
    grinderByName: db.prepare(`SELECT ${GRINDER_COLUMNS} FROM grinders WHERE name = ?`),
    grinderCount: db.prepare('SELECT COUNT(*) AS count FROM grinders'),
    defaultGrinder: db.prepare(`SELECT ${GRINDER_COLUMNS} FROM grinders WHERE is_default = 1`),
    oldestGrinder: db.prepare(`SELECT ${GRINDER_COLUMNS} FROM grinders ORDER BY created_at ASC, id ASC LIMIT 1`),
    grinderSummaryById: db.prepare(`SELECT ${GRINDER_SUMMARY_COLUMNS} FROM grinders g WHERE g.id = ?`),
    listGrinderSummaries: db.prepare(
      `SELECT ${GRINDER_SUMMARY_COLUMNS} FROM grinders g ORDER BY g.name COLLATE NOCASE ASC, g.id ASC`
    ),
    insertGrinder: db.prepare('INSERT INTO grinders (name, is_default, is_demo, created_at) VALUES (?, ?, ?, ?)'),
    renameGrinder: db.prepare('UPDATE grinders SET name = ? WHERE id = ?'),
    clearOtherDefaults: db.prepare('UPDATE grinders SET is_default = 0 WHERE is_default = 1 AND id != ?'),
    setDefaultGrinder: db.prepare('UPDATE grinders SET is_default = 1 WHERE id = ?'),
    deleteGrinder: db.prepare('DELETE FROM grinders WHERE id = ?'),
    demoGrinders: db.prepare(`SELECT ${GRINDER_COLUMNS} FROM grinders WHERE is_demo = 1 ORDER BY id ASC`),
    countDemoNotes: db.prepare('SELECT COUNT(*) AS count FROM notes WHERE is_demo = 1'),
    deleteDemoNotes: db.prepare('DELETE FROM notes WHERE is_demo = 1')
  };

  function runInTransaction(work) {
    db.exec('BEGIN');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // the transaction is already gone; report the original failure
      }
      throw error;
    }
  }

  function insertGrinderRow(name, { isDemo = false } = {}) {
    const isDefault = Number(sql.grinderCount.get().count) === 0 ? 1 : 0;
    const info = sql.insertGrinder.run(name, isDefault, isDemo ? 1 : 0, new Date().toISOString());
    return sql.grinderById.get(Number(info.lastInsertRowid));
  }

  function insertNoteRow(record, { isDemo = false } = {}) {
    const now = new Date().toISOString();
    const info = sql.insertNote.run(
      record.brewed_at,
      record.grinder_id ?? null,
      record.grinder_name,
      record.grind_size ?? null,
      record.dose_g ?? null,
      record.water_g ?? null,
      record.bean_name,
      record.bean_origin,
      record.roast_level ?? null,
      record.tasting_notes,
      isDemo ? 1 : 0,
      now,
      now
    );
    return sql.noteById.get(Number(info.lastInsertRowid));
  }

  // Deletes a grinder inside the caller's transaction. Notes keep their snapshot
  // name (ForeignKey ON DELETE SET NULL), and the single-default invariant is
  // restored by promoting the oldest remaining grinder.
  function deleteGrinderRow(id) {
    const row = sql.grinderById.get(id);
    if (!row) return null;
    sql.deleteGrinder.run(id);
    let newDefaultId = null;
    if (row.is_default === 1) {
      const next = sql.oldestGrinder.get();
      if (next) {
        sql.setDefaultGrinder.run(next.id);
        newDefaultId = Number(next.id);
      }
    } else {
      const current = sql.defaultGrinder.get();
      newDefaultId = current ? Number(current.id) : null;
    }
    return { deleted_id: Number(row.id), new_default_id: newDefaultId };
  }

  return {
    path: resolved,
    raw: db,

    close() {
      db.close();
    },

    healthCheck() {
      sql.ping.get();
      return true;
    },

    getNote(id) {
      return toNote(sql.noteById.get(id));
    },

    listNotes({ q = null, grinderId = null, limit = 200 } = {}) {
      const where = [];
      const params = [];
      if (q) {
        const needle = String(q).toLowerCase();
        where.push(
          '(instr(lower(bean_name), ?) > 0 OR instr(lower(bean_origin), ?) > 0 ' +
            'OR instr(lower(tasting_notes), ?) > 0 OR instr(lower(grinder_name), ?) > 0)'
        );
        params.push(needle, needle, needle, needle);
      }
      if (grinderId !== null && grinderId !== undefined) {
        where.push('grinder_id = ?');
        params.push(grinderId);
      }
      const statement = db.prepare(
        `SELECT ${NOTE_COLUMNS} FROM notes
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY brewed_at DESC, id DESC
         LIMIT ?`
      );
      params.push(limit);
      return statement.all(...params).map(toNoteSummary);
    },

    createNote(record) {
      return toNote(insertNoteRow(record));
    },

    updateNote(id, record) {
      const info = sql.updateNote.run(
        record.brewed_at,
        record.grinder_id ?? null,
        record.grinder_name,
        record.grind_size ?? null,
        record.dose_g ?? null,
        record.water_g ?? null,
        record.bean_name,
        record.bean_origin,
        record.roast_level ?? null,
        record.tasting_notes,
        new Date().toISOString(),
        id
      );
      if (Number(info.changes) === 0) return null;
      return toNote(sql.noteById.get(id));
    },

    deleteNote(id) {
      return Number(sql.deleteNote.run(id).changes) > 0;
    },

    getGrinder(id) {
      return sql.grinderById.get(id) ?? null;
    },

    getGrinderSummary(id) {
      const row = sql.grinderSummaryById.get(id);
      return row ? toGrinderSummary(row) : null;
    },

    getGrinderByName(name) {
      return sql.grinderByName.get(name) ?? null;
    },

    getDefaultGrinder() {
      return sql.defaultGrinder.get() ?? null;
    },

    listGrinders() {
      return sql.listGrinderSummaries.all().map(toGrinderSummary);
    },

    // The first grinder created in an empty database becomes the default so the
    // "exactly one default whenever a grinder exists" rule always holds.
    createGrinder(name, { isDemo = false } = {}) {
      return runInTransaction(() => {
        const row = insertGrinderRow(name, { isDemo });
        return toGrinderSummary(sql.grinderSummaryById.get(Number(row.id)));
      });
    },

    renameGrinder(id, name) {
      const info = sql.renameGrinder.run(name, id);
      if (Number(info.changes) === 0) return null;
      return toGrinderSummary(sql.grinderSummaryById.get(id));
    },

    setDefaultGrinder(id) {
      return runInTransaction(() => {
        const grinder = sql.grinderById.get(id);
        if (!grinder) return null;
        sql.clearOtherDefaults.run(id);
        sql.setDefaultGrinder.run(id);
        return toGrinderSummary(sql.grinderSummaryById.get(id));
      });
    },

    deleteGrinder(id) {
      return runInTransaction(() => deleteGrinderRow(id));
    },

    // Demo rows are flagged, always inserted by an explicit action, and removed
    // only by the explicit clear action. User rows are never touched.
    seedDemo() {
      return runInTransaction(() => {
        const existing = sql.listGrinderSummaries.all();
        let picks;
        if (existing.length === 0) {
          picks = DEMO_GRINDERS.map((name) => {
            const row = insertGrinderRow(name, { isDemo: true });
            return { id: Number(row.id), name: row.name };
          });
        } else {
          const fallback = existing.find((grinder) => grinder.is_default === 1) ?? existing[0];
          picks = [{ id: Number(fallback.id), name: fallback.name }];
        }
        const ids = DEMO_NOTES.map((note, index) => {
          const grinder = picks[index % picks.length];
          const row = insertNoteRow(
            { ...note, grinder_id: grinder.id, grinder_name: grinder.name },
            { isDemo: true }
          );
          return Number(row.id);
        });
        return { created: ids.length, ids };
      });
    },

    clearDemo() {
      return runInTransaction(() => {
        const removed = Number(sql.countDemoNotes.get().count);
        sql.deleteDemoNotes.run();
        for (const grinder of sql.demoGrinders.all()) {
          deleteGrinderRow(Number(grinder.id));
        }
        return { removed };
      });
    }
  };
}

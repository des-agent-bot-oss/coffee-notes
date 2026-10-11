-- Coffee Notes schema.
-- One block per migration version. Blocks are applied in ascending version order
-- at startup, each inside a transaction, and recorded in schema_migrations so a
-- database is only ever migrated once per version. Fresh databases are created
-- automatically. No down-migrations.

-- migrate: 1
CREATE TABLE IF NOT EXISTS grinders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS grinders_name_unique ON grinders(name COLLATE NOCASE);
CREATE UNIQUE INDEX IF NOT EXISTS grinders_one_default ON grinders(is_default) WHERE is_default = 1;

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brewed_at TEXT NOT NULL,            -- 'YYYY-MM-DDTHH:MM', local wall clock, no timezone conversion ever
  grinder_id INTEGER REFERENCES grinders(id) ON DELETE SET NULL,
  grinder_name TEXT NOT NULL,         -- snapshot taken at save time; keeps history after preset removal
  grind_size REAL,                    -- optional, > 0
  dose_g REAL,                        -- required for ratio
  water_g REAL,                       -- required for ratio
  bean_name TEXT NOT NULL DEFAULT '',
  bean_origin TEXT NOT NULL DEFAULT '',
  roast_level TEXT CHECK (roast_level IN ('light','medium','dark') OR roast_level IS NULL),
  tasting_notes TEXT NOT NULL DEFAULT '',
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
  created_at TEXT NOT NULL,           -- ISO 8601 UTC, audit only
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS notes_brewed_idx ON notes(brewed_at DESC, id DESC);

-- migrate: 2
-- Demo provenance for grinder presets. The sample-data action creates two presets
-- when none exist, and DELETE /api/demo must remove exactly the seeded rows, so
-- grinders need the same flag the notes table already carries. Additive only:
-- existing rows default to 0 (user-created).
ALTER TABLE grinders ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1));

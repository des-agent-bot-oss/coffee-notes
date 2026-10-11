# Coffee Notes — technical specification (binding for implementers)

Project: `coffee-notes` — a single-user, locally hosted coffee brewing/tasting journal.
Repo: local `git` repo at `/home/hermes/workspace/coffee-notes`.
Owner brief: `docs/BRIEF.md`. Assumptions: `docs/ASSUMPTIONS.md`.

## 1. Stack (fixed — do not substitute)

- Node.js 26 (`node:sqlite` built in). **Zero runtime npm dependencies.** No Express, no ORM, no bundler, no CSS framework.
- HTTP: `node:http` with a small hand-rolled router (~60 lines). Static files served by the same process.
- DB: SQLite via `node:sqlite` (`DatabaseSync`). File: `data/coffee-notes.db` (gitignored).
- Frontend: static ES modules in `public/`. No build step.
- Tests: `node:test` + `node:assert/strict`. No test framework dependency.
- Dev-only dependency permitted: `playwright` (npm, for coordinator browser evidence scripts only). It must not be required at runtime.

## 2. Layout

```
package.json            type=module, scripts (see §6)
server/index.js         entrypoint: config, http server, graceful shutdown
server/router.js        tiny method+path router, JSON body parse, error mapping
server/db.js            open/migrate DB, prepared statements, all queries
server/schema.sql       DDL + migration list
server/api.js           route handlers + validation
server/seed.js          demo seed data + demo clear
server/static.js        static file serving (mime, ETag/Last-Modified, no path traversal)
test/api.test.js        HTTP-level tests (ephemeral port + temp DB)
test/db.test.js         store/migration tests
public/index.html       app shell
public/styles.css       design system + layout + responsive
public/app.js           app logic (may be split into a few modules under public/js/)
public/fonts/           vendored DM Sans woff2 (see §5)
docs/SPEC.md            this file
docs/BRIEF.md           owner brief, verbatim
docs/ASSUMPTIONS.md     material assumptions (human readable)
docs/OPERATIONS.md      start/stop, DB path, backup, SSH tunnel
evidence/               receipts + RUN-REPORT.md + DELEGATION-TRACE.jsonl (coordinator owns)
evidence/ui/            screenshots + walkthrough video
scripts/                coordinator evidence tooling (playwright) — optional for coder
```

## 3. Configuration

- `COFFEE_NOTES_HOST` default `127.0.0.1` (**never** 0.0.0.0)
- `COFFEE_NOTES_PORT` default `4317`
- `COFFEE_NOTES_DB` default `<repo>/data/coffee-notes.db`
- `PORT`/`HOST`/`DB_PATH` are **not** alias names; use the prefixed ones only.
- Logs to stdout: startup line with resolved host/port/db path + `GET /api/health` line. No request logging of bodies.

## 4. Data model

```sql
CREATE TABLE grinders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX grinders_name_unique ON grinders(name COLLATE NOCASE);
CREATE UNIQUE INDEX grinders_one_default ON grinders(is_default) WHERE is_default = 1;

CREATE TABLE notes (
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
CREATE INDEX notes_brewed_idx ON notes(brewed_at DESC, id DESC);
```

Rules:
- Exactly one default grinder whenever ≥1 grinder exists (partial unique index enforces it; app keeps the invariant).
- Deleting the default grinder promotes the oldest remaining grinder to default; if none remain, `new_default_id` is `null`.
- Deleting a grinder **never** deletes or rewrites notes: `grinder_id` becomes `NULL`, `grinder_name` snapshot stays.
- Migration: `schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT)`, applied in order inside a transaction, idempotent, run at startup. Fresh DB is created automatically.
- `PRAGMA journal_mode=WAL`, `PRAGMA foreign_keys=ON`.

## 5. Design tokens (frontend)

```
--cream:#F7F0E6; --surface:#FFFBF5; --espresso:#3C2415; --brown:#6B4A30;
--tan:#C9A87C; --tan-soft:#E6D6BD; --line:#E4D8C6; --muted:#8A7461;
--danger:#9C3B2E; --ok:#3F6B4A;
radius: 14px cards / 10px controls; shadow: 0 1px 2px rgba(60,36,21,.06), 0 8px 24px rgba(60,36,21,.06)
```
Font: `font-family: 'DM Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`. Vendored DM Sans woff2 lives in `public/fonts/` (`@font-face`, `font-display:swap`). If the font files are missing, the app must still look correct with the fallback stack. Body 16px, line-height 1.55; headings 600 weight, tight tracking; no decorative fonts.

## 6. npm scripts

```
start   node server/index.js
dev     COFFEE_NOTES_PORT=4317 node --watch server/index.js
test    node --test
seed    node server/seed.js --demo        (CLI equivalent of POST /api/demo/seed)
check   node scripts/check.js             (see below)
```
`npm test` runs the suite with a bare `node --test` (built-in discovery of `test/**/*.test.js`). Do not pass the directory positionally: on Node 26.7.0 `node --test test/` exits 1 with `Cannot find module '…/test'`, i.e. the argument is resolved as a module entry point rather than a test path.
`npm run check` must: syntax-check every `.js` file under `server/`, `public/`, `test/`, `scripts/` via `node --check` (ESM-safe, run per file with `--input-type=module` fallback), validate `package.json`/JSON files parse, assert every file listed in §2 exists, assert `public/index.html` references the CSS+JS assets, and assert no `node_modules` import appears in runtime files. Exit non-zero on any failure with an itemised report. This is the project "build/type check".

## 7. HTTP API (JSON, `Content-Type: application/json`)

Success: resource object. Errors: HTTP 400/404/409/500 with body
`{"error":{"code":"validation|not_found|conflict|server","message":str,"fields":{"field":"message"}}}`.

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/api/health` | – | 200 `{ok:true,version,db:"ok",now}` |
| GET | `/api/notes` | – | 200 `{notes:[summary...]}` newest first |
| POST | `/api/notes` | note | 201 `{note}` |
| GET | `/api/notes/:id` | – | 200 `{note}` |
| PUT | `/api/notes/:id` | note | 200 `{note}` |
| DELETE | `/api/notes/:id` | – | 200 `{ok:true,deleted_id}` |
| GET | `/api/grinders` | – | 200 `{grinders:[{id,name,is_default,note_count}],default_id}` |
| POST | `/api/grinders` | `{name}` | 201 `{grinder}` |
| PATCH | `/api/grinders/:id` | `{name?,is_default?}` | 200 `{grinder}` |
| DELETE | `/api/grinders/:id` | – | 200 `{ok:true,deleted_id,new_default_id}` |
| POST | `/api/demo/seed` | – | 201 `{created,ids}` |
| DELETE | `/api/demo` | – | 200 `{removed}` |

Query params: `GET /api/notes?q=<text>&grinder=<id>&limit=<n>` — `q` case-insensitive substring over bean_name, bean_origin, tasting_notes, grinder_name; `grinder` filters by id; `limit` default 200, max 500. Invalid `limit`/`grinder` → 400 with field errors, never a crash.

Note payload (create/update) and validation:
- `brewed_at` required, regex `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$`, must be a real calendar date/time (validate by hand, e.g. month 1-12, day valid for month/year, hour 0-23, minute 0-59). **Stored and returned verbatim; no `Date` parsing, no UTC conversion, no timezone suffix.**
- `grinder_id` optional int; if given it must exist (else 400 on that field). Server resolves `grinder_name` from it. If absent, `grinder_name` is required non-empty (≤80 chars) — this is what keeps history intact after preset removal.
- `grind_size` optional number > 0 and ≤ 100 (0.1 steps allowed); empty string/`null` = not set.
- `dose_g` optional number > 0 and ≤ 200; `water_g` optional number > 0 and ≤ 2000. Ratio is only shown when both present: `ratio_display = "1:" + round(water_g/dose_g, 1)`.
- `bean_name` ≤ 120 chars, `bean_origin` ≤ 120, `roast_level` one of light|medium|dark or null, `tasting_notes` ≤ 4000 chars, newlines allowed.
- Unknown fields ignored; wrong types → 400 with a message for that field. Trim whitespace before length checks. Reject `NaN`/`Infinity`/negative.
- Numeric fields accept JSON numbers only (also accept numeric strings from `datetime-local`-style form input — normalise, then validate).

Grinder payload: `name` required, trimmed, 1..40 chars, unique case-insensitively → duplicate is 409 `conflict` with field `name`; blank/whitespace-only is 400 with field `name`. `PATCH {name}` renames (same rules, 409 on clash with a *different* grinder). `PATCH {is_default:true}` clears the flag on all others in one transaction. `PATCH` with neither field → 400.

Demo: seed inserts 5 realistic notes (`is_demo=1`, varied grinders/dates/beans) plus 2 demo grinders only if none exist; `DELETE /api/demo` removes rows where `is_demo=1` only. User-created notes are never touched by either call. Demo notes must be visually labelled in the UI and the app must state they come from the sample-data action.

## 8. Frontend behaviour (acceptance-critical)

Views: **history sidebar** (left, 320–360px) + **detail/editor pane** (right).
- Sidebar: `New note` button, search input, list newest first. Each row shows date+time, grinder name, bean name (fallback `—`), and grind size when set. Clear selected state (branded left accent bar + tinted background + `aria-current="true"`).
- Detail: read-only note view with edit + delete actions, all fields, ratio line `Ratio 1:16.0`, tasting notes preserving line breaks.
- Editor: same pane; labelled inputs with `for`/`id`, inline field errors with `aria-describedby`, `aria-invalid`. Save/Cancel. Saving shows a success toast and returns to detail. Cancel of a *new* note discards without creating a row. Cancel of an edited note reverts to the server version.
- **New note defaults:** `brewed_at` = current local date/time formatted `YYYY-MM-DDTHH:MM` from the browser's local clock (use `datetime-local` with a locally-computed value — never `toISOString()`), and grinder = the current default grinder. If no grinder exists yet, show a hint linking to Settings and leave the grinder empty (note still savable via free-text name).
- **Unsaved changes guard:** `beforeunload` prompt when the editor is dirty; in-app navigation (selecting another note / opening settings) asks for confirmation first; `Esc` in a dirty editor asks for confirmation before discarding.
- **Delete:** confirmation dialog naming the note's date + grinder, focus trapped, `Esc` cancels, destructive button labelled `Delete note`. Never delete without confirmation.
- **Settings** (dialog on desktop, full-height sheet on mobile): list grinders with note counts, add form, rename, `Make default` (single default indicated by a badge and a radio-like control), remove with confirmation that explains historical notes keep their grinder label. Duplicate name → inline error next to the input; blank name → inline error; never a silent failure.
- **Keyboard:** `Ctrl/Cmd+N` starts a new note, ignored while focus is in an input/textarea/select/contenteditable or while a dialog is open; `Esc` closes dialogs/drawer; `Tab` order logical; visible focus ring (`:focus-visible`, 2px `--brown` outline, offset 2px). All controls reachable and labelled.
- **Mobile (≤ 820px):** sidebar becomes a drawer opened by a `Notes` button, with a dimmed backdrop, focus trap, `Esc`/backdrop-click close, `aria-modal`, body scroll lock, and `aria-hidden` handling for the background. Forms single-column, inputs ≥ 44px tall, no horizontal overflow at 360px width.
- **States:** loading skeletons for sidebar + pane; empty state (no notes: friendly copy + `New note` + `Load sample notes`); filtered-empty state (different copy + `Clear search`); API-error banner with `Retry`; offline/server-down message; success toasts for save/delete/settings; disabled Save with `Saving…` label while a request is in flight.
- Copy is specific and human (no lorem, no marketing sections). Dates display like `Sat 11 Oct 2026 · 07:35`.

## 9. Local-only operation

Bind `127.0.0.1` only, no LAN/public exposure, no external services, no telemetry, no model inference. Application process is independent of Hermes: plain `node server/index.js` (or `npm start`), stoppable with `Ctrl+C`/`SIGTERM`, graceful shutdown closing the HTTP server and DB.
`docs/OPERATIONS.md` documents: start/stop, the exact URL, DB path, backup (`sqlite3 data/coffee-notes.db ".backup ..."` or copy while stopped), and the Windows SSH tunnel
`ssh -L 4317:127.0.0.1:4317 hermes@<vm-ip>` (plus a note that Hermes' own dashboard tunnel is separate).

## 10. Evidence protocol

- `evidence/RUN-REPORT.md` and `evidence/DELEGATION-TRACE.jsonl` are updated by the coordinator; append, never rewrite history.
- Coder receipts go to `evidence/receipts/<task-id>.md` (task id, candidate SHA, commands, exit codes, observed behaviour, limitations). Tester/reviewer receipts use distinct filenames.
- Every receipt names the candidate commit SHA. Any later source change invalidates it.

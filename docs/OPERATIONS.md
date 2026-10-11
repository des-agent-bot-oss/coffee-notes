# Coffee Notes — operations

Single-user journal, hosted only inside this VM. The application process is
independent of Hermes: it is a plain Node process, not a Hermes service, and
stopping Hermes does not stop it. The API contract lives in `docs/SPEC.md` §7.

## Start / stop

```
cd /home/hermes/workspace/coffee-notes
npm start          # node server/index.js — foreground, Ctrl+C to stop
npm run dev        # same, with node --watch (restarts on file changes)
```

Stop with `Ctrl+C` (SIGINT) or `SIGTERM`; both close the HTTP server and the
database handle before exiting.

## Access

- URL: http://127.0.0.1:4317 (loopback only — never bound to 0.0.0.0 or the LAN)
- Health check: `curl -s http://127.0.0.1:4317/api/health`
- From Windows, forward the port over SSH:
  `ssh -L 4317:127.0.0.1:4317 hermes@<vm-ip>` then open http://127.0.0.1:4317.
  Hermes' own dashboard tunnel is a separate, unrelated forward.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `COFFEE_NOTES_HOST` | `127.0.0.1` | non-loopback values are refused at startup |
| `COFFEE_NOTES_PORT` | `4317` | `0` picks a free ephemeral port |
| `COFFEE_NOTES_DB` | `<repo>/data/coffee-notes.db` | created with its directory if missing |

`PORT`/`HOST`/`DB_PATH` are deliberately ignored; only the prefixed names are read.
The database uses WAL mode, so `coffee-notes.db-wal` and `-shm` sit next to it.

## Database and backup

Path: `/home/hermes/workspace/coffee-notes/data/coffee-notes.db` (gitignored).

```
# consistent copy while the server is running
sqlite3 data/coffee-notes.db ".backup '/home/hermes/backups/coffee-notes-$(date +%F).db'"

# or, with the server stopped, a plain copy is safe
cp data/coffee-notes.db /home/hermes/backups/
```

Migrations run automatically at startup and are recorded in `schema_migrations`;
no manual step is required, and re-running an existing database is a no-op.

## Sample data

`npm run seed` (or `POST /api/demo/seed`) inserts 5 demo notes and, only when no
grinder exists, 2 demo grinders. All of them are flagged `is_demo`. They are
removed only by `DELETE /api/demo`, which never touches user notes.

## Checks

```
npm run check   # syntax, JSON, layout, script and import-policy assertions
npm test        # node:test storage + HTTP suites
```

## API

See `docs/SPEC.md` §7 for the full contract. Short version: notes at
`/api/notes` (GET list, POST create) and `/api/notes/:id` (GET, PUT, DELETE);
grinders at `/api/grinders` and `/api/grinders/:id` (POST, PATCH, DELETE);
health at `/api/health`; sample data at `/api/demo`. `GET /api/notes` accepts
`?q=` (text search), `?grinder=<id>` and `?limit=<1-500>`. Errors use the
envelope `{"error":{"code":"validation|not_found|conflict|server","message":...,"fields":{...}}}`.

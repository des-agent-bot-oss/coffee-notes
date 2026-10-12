# Coffee Notes

A small, single-user coffee brewing and tasting journal that runs entirely on your own machine.
Notes, grinder presets and settings live in a local SQLite database behind a real HTTP API — the
browser is only a view onto the server, never the store.

> **This repository is a test run.** Coffee Notes was built end to end by an automated software team
> running on [Hermes Agent](https://hermes-agent.nousresearch.com/docs) — a coordinator profile that
> writes task contracts, plus `coder`, `tester` and `reviewer` profiles scheduled through a durable
> Kanban board. The point of the exercise was to evaluate that workflow on a real, non-trivial
> deliverable, so the repository deliberately ships the whole paper trail: task contracts, one
> receipt per handoff, verification logs, screenshots, a walkthrough video and a candid
> [self-review](SELF-REVIEW.md) of what the workflow got right and wrong. Treat it as a worked
> example first and a product second.

## What it does

- Create, browse, view, edit and delete coffee notes; history is newest-first with date, grinder and
  bean visible at a glance and a clear selected state.
- Each note records brew date and time, grinder, optional grind size, dose and water (shown as a
  `1:X` ratio), bean name/origin/roast and free-text tasting notes.
- A new note defaults to your current local date and time and your preferred grinder. Times are
  wall-clock strings stored verbatim — there is no timezone conversion anywhere.
- Settings manage grinder presets: add, rename, pick one default, remove. Removing a preset never
  touches history, because each note also keeps the grinder *name* it was brewed with.
- Search across beans, origins, grinders and tasting notes; a distinct "no matches" state.
- Sample notes are available only through an explicit action and are labelled as samples, so they
  never blend into your own notes.
- Keyboard and accessibility: `Ctrl`/`Cmd`+`N` for a new note, `Esc` to close dialogs and the mobile
  drawer, visible focus everywhere, labelled inputs, focus-trapped dialogs and inline validation.
- Responsive: a sidebar-and-detail workspace on desktop, a drawer with a backdrop on mobile.

## Requirements

Node.js **22.5 or newer** (tested on 26.7.0). Nothing else — no build step, no bundler, no framework
and **zero runtime dependencies**. SQLite comes from Node's built-in `node:sqlite`.

## Quick start

```sh
npm start                  # http://127.0.0.1:4317
```

Then open <http://127.0.0.1:4317>. The app binds to loopback only; it is never exposed to your LAN
or the internet. To look around immediately, press **Load sample notes** in the empty state.

```sh
npm run dev                # same server with --watch
npm test                   # 25 behavioural HTTP + storage tests (node:test)
npm run check              # syntax/layout/dependency check ("build" check)
npm run seed:demo          # same as the in-app sample action, from the CLI
```

Configuration is by environment variable:

| Variable | Default | Purpose |
| --- | --- | --- |
| `COFFEE_NOTES_HOST` | `127.0.0.1` | bind address (leave as loopback) |
| `COFFEE_NOTES_PORT` | `4317` | listen port |
| `COFFEE_NOTES_DB` | `<repo>/data/coffee-notes.db` | SQLite file |

Data lives in `data/coffee-notes.db` (WAL mode) and is created and migrated automatically on first
start. To back it up, stop the app and copy `data/coffee-notes.db*`, or run
`sqlite3 data/coffee-notes.db ".backup 'backup.db'"` while it is running.

## API

A small JSON API over loopback; every route is documented in [`docs/SPEC.md`](docs/SPEC.md) §7.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | liveness and database status |
| GET/POST | `/api/notes` | list (newest first, `?q=`, `?grinder=`, `?limit=`) / create |
| GET/PUT/DELETE | `/api/notes/:id` | read, update, delete one note |
| GET/POST | `/api/grinders` | list presets with note counts / add |
| PATCH/DELETE | `/api/grinders/:id` | rename or set default / remove |
| POST | `/api/demo/seed` | load the labelled sample notes |
| DELETE | `/api/demo` | remove sample notes only |

Errors use one envelope — `{"error":{"code","message","fields"}}` — with field-level messages for
validation failures. Invalid dates, non-numeric or out-of-range values, duplicate or blank grinder
names and unknown ids are all rejected with a clear message rather than a stack trace.

## Layout

```
server/     node:http server, router, validation, SQLite store, migrations, seed
public/     static frontend: index.html, one stylesheet, ES modules (no build step)
test/       node:test suites against a real server and a temporary database
docs/       the owner's brief, technical spec, assumptions, operations guide
evidence/   the team's paper trail for this test run (see below)
scripts/    the check script and the font vendoring script
```

## Checks and evidence

Everything in `evidence/` was produced by actually running the app, and the numbers below are from
those runs rather than from intent:

- `npm run check` — exit 0. `npm test` — **25/25 passing**.
- A coordinator acceptance sweep of the running app — **36/36 browser checks, zero page errors** —
  covering ordering, selected state, `1:X` rendering, unchanged wall-clock times, grinder CRUD,
  validation, the offline banner with `Retry`, sample separation, delete confirmation, persistence
  across reload, and mobile layout at 360/390 px.
- An independent tester profile re-verified the final candidate: every verdict pass, including a
  **real process restart** (kill and restart against the same database) and confirmation that no
  browser storage is used at all.
- An independent reviewer profile reproduced the checks, ran 12 API probes and a 13/13 XSS probe
  (all user text is written as literal text, never as HTML), and assessed complexity.
- `evidence/ui/` — the four required screenshots plus `walkthrough.mp4` (create → save → refresh →
  edit), captured from the running app with Playwright.
- `evidence/receipts/`, `evidence/coordinator-checks/`, `evidence/test/` — per-task receipts and raw
  verification logs. `evidence/DELEGATION-TRACE.jsonl` — the routing decisions.
  `evidence/kanban-export.json` — the native task, run and event export.

Four real defects were found by verification and fixed during the run (stale grinder state after
mutations, no error feedback when loading a single note failed at the network level, and two dialog
focus-trap failures), plus a fifth found by the reviewer (a discarded draft staying mounted and still
writable). Each fix was re-verified. The self-review explains what those findings say about the
workflow.

## Known limitations

- **No authentication.** It is a single-user local app bound to loopback; anyone with shell access to
  the machine can read and edit the notes. Do not put it on a network you do not control.
- **Wall-clock times only.** `brewed_at` is stored exactly as entered with no timezone. Two machines
  in different timezones would display the same literal value.
- **Delete is permanent** (no trash or undo) — a confirmation dialog is the only safeguard.
- A request body above roughly 16× the 256 KB limit is dropped with a connection reset instead of a
  clean `400`, and there are ~12–15 lines of unused exports left in the server modules. Both were
  found in review and deliberately left as known, documented rough edges.
- Not built: brew timers, bean inventory, charts, export/sharing, cloud sync, notifications.

## License

MIT — see [`LICENSE`](LICENSE). The bundled **DM Sans** webfont in `public/fonts/` is licensed
separately under the SIL Open Font License; its licence text ships alongside it in
`public/fonts/OFL.txt` and it is fetched by `scripts/fetch-fonts.py`.

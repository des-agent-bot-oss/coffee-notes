# Coffee Notes — run report

Status: **IMPLEMENTATION COMPLETE AND COORDINATOR-VERIFIED — independent re-verification and diff review in flight**
Started 2026-10-12 02:00 UTC (10:00 Asia/Kuala_Lumpur). Last updated 2026-10-12 03:45 UTC by the coordinator.
Owner: Desmond (Asia/Kuala_Lumpur). Executed by the VM software team (coordinator/coder/tester/reviewer).

## 1. Requirements and material assumptions
Owner brief verbatim: `docs/BRIEF.md`. Binding technical contract: `docs/SPEC.md`. Material assumptions
recorded before implementation: `docs/ASSUMPTIONS.md` (single local user with no auth; wall-clock local
times stored verbatim with no UTC conversion; zero runtime dependencies; `is_demo` keeps sample data
separate; grinder presets store a name snapshot so history survives preset removal; permanent delete with
confirmation; linear idempotent migrations; loopback port 4317; DM Sans vendored locally; explicit
out-of-scope list).

## 2. Outcome and acceptance status
The application is complete and runs locally. Every brief acceptance check has been verified on the final
candidate by the coordinator, in a real browser against the real API and SQLite database:

1. Add a grinder, make it default, create a note with it — **PASS**. The default is preselected in the
   editor and `Make default` moves the badge immediately (fix `4f982fe`).
2. View/edit a note, cancel an unsaved note, delete with confirmation — **PASS**. Edit-cancel reverts to
   the stored version; cancelling a new note creates no row; `Esc` cancels the delete; the confirmed
   delete removes exactly one row.
3. Refresh and restart persistence — **PASS**. Page reload persists; a real process kill/restart on the
   same DB keeps the note, both grinder names and the default. The independent tester also confirmed no
   browser storage is used (`localStorage`/`sessionStorage`/IndexedDB/cookies all empty), so the data is
   genuinely server-side.
4. Remove a grinder preset without damaging historical notes — **PASS**. The unit suite asserts a deleted
   grinder leaves notes readable with the snapshot name and `grinder_id: null`; the tester's browser run
   confirms the UI shows the orphaned note with its grinder name, no 5xx and no crash.
5. Invalid dates/numeric values and API failures give useful feedback — **PASS**. `2026-02-30T10:00`,
   `25:00`, negative grind size and out-of-range dose/water all return 400 with a `fields` message and
   render inline; an empty date and an out-of-range grind size show field errors with no row written; a
   failed list load, a network-level failed **single-note** load and a 5xx all show a plain-language
   banner with a working `Retry` (fix `c1222f9`).
6. Desktop and mobile layouts usable without overflow — **PASS**. 1440×900, 390×844 and 360×844 all show
   no horizontal overflow; controls are ≥44 px tall on mobile; the drawer opens with a backdrop and `Esc`
   closes it, returning focus to the notes button.

Independent acceptance re-verification (card `t_a1c985a8`) and the independent diff review with the
explicit unnecessary-complexity check (card `t_8fc61842`) are still running; their findings are added here
when they land.

## 3. Repository, branch, final SHA
Local: `/home/hermes/workspace/coffee-notes`, branch `main`.
Remote: **https://github.com/des-agent-bot-oss/coffee-notes** (private).
Implementation candidate frozen for this report: **`c1222f9`** — "fix(t6): surface failed detail loads
and trap focus in dialogs" — with evidence/receipt commits on top (`48654a9` and the delivery commit that
follows this file).

## 4. Changed components
Backend: `server/{schema.sql,db.js,router.js,api.js,static.js,index.js,seed.js}`.
Frontend: `public/{index.html,styles.css,app.js}` and `public/js/{api,format,dom,toast,dialog,sidebar,
detail,editor,drawer,settings}.js`; vendored `public/fonts/dm-sans-*.woff2` + OFL licence.
Tooling/docs: `scripts/check.js`, `scripts/fetch-fonts.py`, `docs/{BRIEF,SPEC,ASSUMPTIONS,OPERATIONS}.md`,
`evidence/**`, `package.json`. Verification tooling lives outside the app repo at
`/home/hermes/workspace/tools/ui-evidence` (Playwright; never a runtime dependency of the app).

## 5. Checks and results (coordinator-run unless stated)
- `npm run check` — exit 0: 20 `.js` files syntax-checked, 20 required files present, no `node_modules`
  import in 17 runtime files.
- `npm test` — exit 0: **25 pass / 0 fail** (`node --test`): validation matrix, grinder invariants, preset
  removal keeping history, demo seed/clear isolation, ordering/filtering, malformed JSON, 404/405, static
  path traversal, and persistence across a closed/reopened DB handle.
- Browser acceptance sweep (`tools/ui-evidence/run-sweep.sh`) — **36/36 PASS**, 0 page errors, on the
  frozen candidate: sidebar newest-first with date/grinder/bean, `aria-current` selected state, detail
  `Ratio 1:16.0` with the wall-clock time unchanged, settings list, duplicate + blank name errors with the
  list intact, `Make default` moving the badge, `Ctrl/Cmd+N` local-time default and default-grinder
  preselection, save, dirty-edit cancel, new-note cancel with no row, field validation, offline banner
  with a working Retry, sample load/label/remove leaving user notes intact, delete confirmation and `Esc`
  cancel, settings + default persisting across reload, mobile drawer with backdrop and `Esc`, and no
  overflow at 360/390 px.
- Focus and error-path probe (`probe-a11y.mjs`) — **PASS after `c1222f9`**: the settings dialog retains
  focus for 15 consecutive `Tab` presses (all inside the dialog), the delete confirmation opens with focus
  on `Keep note` and keeps focus inside for 15 presses, and an aborted `GET /api/notes/:id` now shows the
  banner "That note could not be opened. The Coffee Notes server is not answering…" with a `Retry` that
  re-renders the note.
- Restart persistence (`check-persistence.sh`) — **PASS** twice (before and after the T6 fix). One
  intermediate run failed while harness servers overlapped and did not reproduce; recorded as a harness
  flake, not an app defect, and the underlying behaviour is independently confirmed by the unit suite and
  the tester's client-side evidence.
- Independent tester (`t_5d0de379`, candidate `88f6660`) — 41/45 browser checks passed; raw artifacts in
  `evidence/test/`; consolidated receipt at `evidence/receipts/T4-tester.md`.
- Independent tester re-verification after the fixes (`t_a1c985a8`) — in flight.

## 6. Defects found by verification, and their resolution
1. **Settings never refreshed grinder state** (`add`/`rename`/`makeDefault` performed the API call but not
   the `loadGrinders()` that `remove`/`seed`/`clearDemo` do, so the dialog re-rendered a stale list): new
   presets never appeared and the `Default` badge never moved. Found by the coordinator. **Fixed** in
   `4f982fe` (card T3b), re-verified by the coordinator.
2. **A failed single-note load showed no feedback** at the network level (no banner, no Retry), unlike the
   list-load and 5xx paths. Found by the tester, reproduced by the coordinator. **Fixed** in `c1222f9`
   (card T6), re-verified by the coordinator.
3. **Delete-confirmation dialog did not take or trap focus** (focus started on `<body>` and leaked on
   every second `Tab`). Found by the tester, reproduced by the coordinator. **Fixed** in `c1222f9`.
4. **Settings dialog focus trap leaked** after several `Tab` presses (it did not wrap from the last
   control). Found by the tester, reproduced by the coordinator. **Fixed** in `c1222f9`.
Two worker-reported failures ("Settings dialog never opens", plus one assertion race) did **not** reproduce
and were races in workers' throwaway scripts, not app defects.

## 7. Unresolved issues
- Independent acceptance re-verification and the independent diff review are still running; their findings
  are added here if they report anything.
- No known data-loss, security or corruption issue. The single-user local design deliberately implements
  no authentication (recorded assumption).
- Several Kanban cards (backend, frontend, one tester run) were closed with an operator override or left
  `blocked` after their workers exhausted the fixed iteration budget. Each is annotated on the card with
  what was verified and by whom; no evidence was discarded.

## 8. Launch and access
```
cd /home/hermes/workspace/coffee-notes
npm start        # http://127.0.0.1:4317 (loopback only); Ctrl+C or SIGTERM to stop
```
From Windows: `ssh -L 4317:127.0.0.1:4317 hermes@<vm-ip>`, then open `http://127.0.0.1:4317`
(the Hermes dashboard tunnel is separate). Config: `COFFEE_NOTES_HOST`, `COFFEE_NOTES_PORT`,
`COFFEE_NOTES_DB` (default `<repo>/data/coffee-notes.db`). Detail: `docs/OPERATIONS.md`.

## 9. Database and backup
SQLite (WAL) at `data/coffee-notes.db`, created and migrated automatically at startup. Back up while
stopped with `cp data/coffee-notes.db* <dest>/`, or live with
`sqlite3 data/coffee-notes.db ".backup '<dest>/backup.db'"`.

## 10. Evidence paths
`evidence/ui/01-desktop-journal.png`, `02-note-editor.png`, `03-grinder-settings.png`,
`04-mobile-drawer.png`, `05-mobile-detail.png`, `evidence/ui/walkthrough.mp4` (create → save → refresh →
edit) and `evidence/ui/walkthrough/frame-*.png`; `evidence/test/` (tester raw artifacts);
`evidence/receipts/T1-coder.md`, `T2-coder.md`, `T3-coder.md`, `T3b-coder.md`, `T6-coder.md`,
`T4-tester.md` (consolidated by the coordinator from the tester's own artifacts);
`evidence/DELEGATION-TRACE.jsonl`. All captures were regenerated against the frozen candidate.

## 11. Time and cost
Elapsed: ~1 h 50 m of wall clock. Provider API usage/cost: **not available** from this environment (no
billing or token accounting is exposed to the VM) — marked unavailable rather than estimated.

## 12. Remaining work and how to resume
Only the two independent verification cards remain: `t_a1c985a8` (focused acceptance re-verification) and
`t_8fc61842` (diff review + unnecessary-complexity check). Resume with
`/home/hermes/.local/bin/hermes kanban list` — the board is the source of truth. Verification tooling:
`bash tools/ui-evidence/run-sweep.sh <port>`, `check-persistence.sh <port>`, `probe-a11y.mjs <url>`,
`run-capture.sh <port> <dir>`.

## 13. Telegram delivery receipt
Recorded below with the actual send result after delivery.

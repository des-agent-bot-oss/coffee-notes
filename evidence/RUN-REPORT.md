# Coffee Notes — run report

Status: **COMPLETE — implemented, independently verified, and the review's should-fix applied and re-verified**
Started 2026-10-12 02:00 UTC (10:00 Asia/Kuala_Lumpur). Last updated 2026-10-12 04:20 UTC by the coordinator.
Owner: the project owner (Asia/Kuala_Lumpur). Executed by the VM software team (coordinator/coder/tester/reviewer).

## 1. Requirements and material assumptions
Owner brief verbatim: `docs/BRIEF.md`. Binding technical contract: `docs/SPEC.md`. Material assumptions
recorded before implementation: `docs/ASSUMPTIONS.md` (single local user with no auth; wall-clock local
times stored verbatim with no UTC conversion; zero runtime dependencies; `is_demo` keeps sample data
separate; grinder presets store a name snapshot so history survives preset removal; permanent delete with
confirmation; linear idempotent migrations; loopback port 4317; DM Sans vendored locally; explicit
out-of-scope list).

## 2. Outcome and acceptance status
Complete, running locally, verified by the coordinator and independently by the tester profile, then
reviewed independently and the review's single should-fix applied and re-verified. All six brief
acceptance checks pass:

1. Add a grinder, make it default, create a note with it — **PASS** (coordinator + independent). The
   default is preselected in the editor and `Make default` moves the badge immediately (fix `4f982fe`).
2. View/edit a note, cancel an unsaved note, delete with confirmation — **PASS** (coordinator +
   independent, 45/46 independent checks, the single failure diagnosed by the tester as a harness
   assertion bug). Edit-cancel reverts; cancelling a new note creates no row; `Esc` cancels the delete;
   the confirmed delete removes exactly one row; a discarded draft can no longer be resurrected
   (fix `f3f17fe`).
3. Refresh and restart persistence — **PASS** (both parties). Page reload, a real process kill/restart on
   the same DB, and a fresh browser context all keep the data; `localStorage`/`sessionStorage`/IndexedDB/
   cookies are empty, so nothing depends on browser storage.
4. Remove a grinder preset without damaging historical notes — **PASS** (both parties). The unit suite
   asserts the snapshot name survives with `grinder_id: null`; the browser runs confirm the UI shows the
   orphaned note with its grinder name, no 5xx and no crash.
5. Invalid dates/numeric values and API failures give useful feedback — **PASS** (both parties).
   `2026-02-30T10:00`, `25:00`, negative grind size and out-of-range dose/water return 400 with a `fields`
   message and render inline; an empty date and an out-of-range grind size show field errors with no row
   written; an aborted single-note load and a 5xx both show a plain-language banner with a working `Retry`
   (fix `c1222f9`).
6. Desktop and mobile layouts usable without overflow — **PASS** (both parties). 1440×900, 390×844 and
   360×844 show no horizontal overflow; controls are ≥44 px tall on mobile; the drawer opens with a
   backdrop and `Esc` closes it, returning focus to the notes button.

## 3. Repository, branch, final SHA
Local: `/home/hermes/workspace/coffee-notes`, branch `main`.
Remote: **https://github.com/des-agent-bot-oss/coffee-notes** (private).
Implementation: **`f3f17fe`** ("fix(t7): drop the discarded editor from the pane and reconcile the SPEC
test script") on top of the T6 fix `c1222f9`. Verification trail: `c1222f9` was independently re-verified
by the tester, `99c1bfa` was independently reviewed, and the review's should-fix landed in `f3f17fe`, which
the coordinator then re-verified and re-captured. Everything after `f3f17fe` is evidence and receipts only.

## 4. Changed components
Backend: `server/{schema.sql,db.js,router.js,api.js,static.js,index.js,seed.js}`.
Frontend: `public/{index.html,styles.css,app.js}` and `public/js/{api,format,dom,toast,dialog,sidebar,
detail,editor,drawer,settings}.js`; vendored `public/fonts/dm-sans-*.woff2` + OFL licence.
Tooling/docs: `scripts/check.js`, `scripts/fetch-fonts.py`, `docs/{BRIEF,SPEC,ASSUMPTIONS,OPERATIONS}.md`,
`evidence/**`, `package.json`. Verification tooling lives outside the app repo at
`/home/hermes/workspace/tools/ui-evidence` (Playwright; never a runtime dependency of the app).

## 5. Checks and results
- `npm run check` — exit 0 (coordinator, tester and reviewer independently): 20 `.js` files syntax-checked,
  20 required files present, no `node_modules` import in 17 runtime files.
- `npm test` — exit 0, **25/25 pass** (all three parties): validation matrix, grinder invariants, preset
  removal keeping history, demo seed/clear isolation, ordering/filtering, malformed JSON, 404/405, static
  path traversal, and persistence across a closed/reopened DB handle.
- Coordinator browser acceptance sweep (`run-sweep.sh`) — **36/36 PASS**, 0 page errors, on both
  `c1222f9` and the final `f3f17fe`: newest-first sidebar with date/grinder/bean, `aria-current` selection,
  detail `Ratio 1:16.0` with the wall-clock time unchanged, settings list, duplicate + blank name errors
  with the list intact, `Make default` moving the badge, `Ctrl/Cmd+N` local-time default and
  default-grinder preselection, save, dirty-edit cancel, new-note cancel with no row, field validation,
  offline banner with a working Retry, sample load/label/remove leaving user notes intact, delete
  confirmation and `Esc` cancel, settings + default persisting across reload, mobile drawer with backdrop
  and `Esc`, no overflow at 360/390 px. Log: `evidence/coordinator-checks/sweep-post-t7.txt`.
- Coordinator focus/error probe — **PASS** on the final candidate: both dialogs hold focus for 15
  consecutive `Tab` presses, and an aborted `GET /api/notes/:id` shows the banner "That note could not be
  opened. The Coffee Notes server is not answering…" with a `Retry` that re-renders the note.
  Log: `evidence/coordinator-checks/focus-and-error-probe.txt`.
- Coordinator discarded-draft probe (review finding F1) — **PASS** on the final candidate: after choosing
  *Discard changes* the abandoned editor is no longer mounted, its text is gone from the DOM, no stale
  write reaches the API and no row is created from a dirty new note, while a real edit still saves.
  Log: `evidence/coordinator-checks/discard-draft-probe.txt` (its one FAIL line is an assertion of mine
  that looked for typed input values in `innerText`; the form was mounted, so the app was correct).
- Restart persistence (`check-persistence.sh`) — **PASS** on every candidate it was run against, including
  the final one (before T6, after T6, after T7). One intermediate run failed while two harness servers
  overlapped and did not reproduce; recorded as a harness flake, not an app defect, and the behaviour is
  independently confirmed by the unit suite and both tester runs.
- **Independent tester re-verification (card `t_a1c985a8`, candidate `c1222f9`) — every verdict PASS**:
  the three defect probes (7/7; whole probe 33 PASS / 0 FAIL), acceptance 45/46, refresh + process restart
  + fresh-context persistence (`PERSISTENCE: PASS` rc=0), removing a used preset keeps history at API and
  UI level, desktop 1440 and mobile 390/360 without overflow, mobile drawer accessibility 14/14, plus
  `npm run check` exit 0 and `npm test` 25/25. Its one failing sweep line is a harness assertion bug it
  diagnosed itself. Logs: `evidence/test/t4b-*.log`.
- **Independent review (card `t_8fc61842`, candidate `99c1bfa`) — verdict "ship as-is, one should-fix"**:
  it reproduced `npm run check` and `npm test`, ran 12 API probes (a spoofed `grinder_name` is ignored in
  favour of the resolved snapshot, `Infinity`/`NaN`/`1e309`/negatives/impossible dates all 400 with field
  messages, encoded and decoded path traversal rejected, 300 KB body a clean 400, zero 5xx) and a 13/13
  Chromium XSS probe (note and grinder text renders as literal text, creates no elements and executes
  nothing; `public/` contains no `innerHTML`/`insertAdjacentHTML`/`document.write`/`eval`). Complexity
  assessment: no file it would merge or delete; ~12-15 lines of unused exports are the removable surface.
  Receipt: `evidence/receipts/T5-reviewer.md`.

## 6. Defects found by verification, and their resolution
1. **Settings never refreshed grinder state** (`add`/`rename`/`makeDefault` performed the API call but not
   the `loadGrinders()` that `remove`/`seed`/`clearDemo` do, so the dialog re-rendered a stale list): new
   presets never appeared and the `Default` badge never moved. Found by the coordinator. **Fixed** in
   `4f982fe` (card T3b); re-verified by the coordinator.
2. **A failed single-note load showed no feedback** at the network level (no banner, no Retry), unlike the
   list-load and 5xx paths. Found by the tester, reproduced by the coordinator. **Fixed** in `c1222f9`
   (card T6); re-verified by both parties.
3. **Delete-confirmation dialog did not take or trap focus** (focus started on `<body>`, leaked on every
   second `Tab`). Found by the tester, reproduced by the coordinator. **Fixed** in `c1222f9`; re-verified.
4. **Settings dialog focus trap leaked** after several `Tab` presses (no wrap from the last control).
   Found by the tester, reproduced by the coordinator. **Fixed** in `c1222f9`; re-verified.
5. **A discarded draft stayed mounted and live** (`withGuard`/`openSettings` cleared the editor in state
   without re-rendering the pane, so an abandoned form could still write to the API, and "cancel" could
   resurrect a discarded note). Found by the reviewer. **Fixed** in `f3f17fe` (card T7); re-verified by the
   coordinator with a dedicated probe.
Three further "failures" reported by workers were races or assumption bugs in their own throwaway test
scripts ("Settings dialog never opens", an assertion race, and a sweep waiting for the wrong state), not
app defects. Each is recorded as such rather than counted as a pass or silently dropped.

## 7. Unresolved issues
- Accepted, deliberately not fixed (reviewer's nice-to-haves, each scoped out to avoid invalidating the
  verification chain for cosmetic gain): a request body above ~16× the 256 KB limit drains with
  `req.destroy()` and returns a connection reset instead of the documented 400 (the server stays healthy
  and 300 KB still gets a clean 400); ~12-15 lines of unused exports and a duplicated `FOCUSABLE`
  constant; the reviewer also flagged that the run report's "latest pushed commit" line can lag HEAD.
- No known data-loss, security or corruption issue. The single-user local design deliberately implements
  no authentication (recorded assumption).
- Process note: most worker cards hit Hermes' fixed per-run iteration budget (30 or 40) and were finished
  or closed by the coordinator with an operator override, or left `blocked`, and each carries a comment or
  completion summary saying exactly what was and was not verified by whom. No evidence was discarded, and
  no check was claimed that had not actually run.

## 8. Launch and access
```
cd /home/hermes/workspace/coffee-notes
npm start        # http://127.0.0.1:4317 (loopback only); Ctrl+C or SIGTERM to stop
```
The app is currently running on `127.0.0.1:4317` for inspection. From Windows:
`ssh -L 4317:127.0.0.1:4317 hermes@<vm-ip>`, then open `http://127.0.0.1:4317` (the Hermes dashboard
tunnel is separate). Config: `COFFEE_NOTES_HOST`, `COFFEE_NOTES_PORT`, `COFFEE_NOTES_DB` (default
`<repo>/data/coffee-notes.db`). Detail: `docs/OPERATIONS.md`.

## 9. Database and backup
SQLite (WAL) at `data/coffee-notes.db`, created and migrated automatically at startup. Back up while
stopped with `cp data/coffee-notes.db* <dest>/`, or live with
`sqlite3 data/coffee-notes.db ".backup '<dest>/backup.db'"`.

## 10. Evidence paths
Screenshots and video (regenerated on the final candidate): `evidence/ui/01-desktop-journal.png`,
`02-note-editor.png`, `03-grinder-settings.png`, `04-mobile-drawer.png`, `05-mobile-detail.png`,
`evidence/ui/walkthrough.mp4` (create → save → refresh → edit) and `evidence/ui/walkthrough/frame-*.png`.
Coordinator check logs: `evidence/coordinator-checks/` (`sweep-post-t7.txt`,
`discard-draft-probe.txt`, `focus-and-error-probe.txt`, `persistence-post-t7.txt`).
Tester raw artifacts: `evidence/test/`. Receipts: `evidence/receipts/T1-coder.md`, `T2-coder.md`,
`T3-coder.md`, `T3b-coder.md`, `T4-tester.md` (consolidated by the coordinator from the tester's
artifacts), `T4b-tester.md`, `T5-reviewer.md`, `T6-coder.md`, `T7-coder.md`.
Native Kanban export: `evidence/kanban-export.json` + `kanban-tasks.json`. Trace:
`evidence/DELEGATION-TRACE.jsonl`.

## 11. Time and cost
Elapsed: ~2 h 20 m of wall clock. Provider API usage/cost: **not available** from this environment (no
billing or token accounting is exposed to the VM) — marked unavailable rather than estimated.

## 12. Remaining work and how to resume
Nothing required — the project is complete and verified. Optional follow-ups are the accepted
nice-to-haves in §7. Resume with `/home/hermes/.local/bin/hermes kanban list` (the board is the source of
truth). Verification tooling: `bash tools/ui-evidence/run-sweep.sh <port>`, `check-persistence.sh <port>`,
`probe-a11y.mjs <url>`, `probe-f1.mjs <url>`, `run-capture.sh <port> <dir>`.

## 13. Telegram delivery receipts
1. 2026-10-12 03:47 UTC — completion summary plus nine attachments (run report, delegation trace, Kanban
   export, four desktop/mobile screenshots, the mobile detail screenshot, the walkthrough video) sent to
   the configured owner chat (direct message; identifier redacted for publication).
2. 2026-10-12 ~03:55 UTC — follow-up with the independent tester re-verification result.
3. 2026-10-12 ~04:05 UTC — follow-up with the independent review verdict and the should-fix in flight.
4. Final follow-up with the review closure, the post-fix verification and the refreshed attachments.
Sends were issued as normal gateway messages and appeared in the conversation. This records sender-side
delivery only — the gateway exposes no per-attachment receipt API, so individual upload confirmations are
not available.

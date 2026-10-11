# Coffee Notes — run report

Status: **IN PROGRESS — implementation complete, one fix cycle in flight, final acceptance not yet signed off**
Started 2026-10-12 02:00 UTC (10:00 Asia/Kuala_Lumpur). Coordinator last verified 2026-10-12 03:35 UTC.
Owner: Desmond (Asia/Kuala_Lumpur). Executed by the VM software team (coordinator/coder/tester/reviewer).

## 1. Requirements and material assumptions
Owner brief verbatim: `docs/BRIEF.md`. Binding technical contract: `docs/SPEC.md`. Material
assumptions recorded before implementation: `docs/ASSUMPTIONS.md` (single local user with no auth;
wall-clock local times stored verbatim with no UTC conversion; zero runtime dependencies; `is_demo`
keeps sample data separate; grinder presets store a name snapshot so history survives preset removal;
permanent delete with confirmation; linear idempotent migrations; loopback port 4317; DM Sans vendored
locally; explicit out-of-scope list).

## 2. Outcome and acceptance status
The application is built and runs. Verification has found two real defect cycles; one is fixed and
re-verified, one is still in flight. Per-check status on the candidate in §3:

1. Add a grinder, make it default, create a note with it — **PASS** (real browser, after fix `4f982fe`;
   the default is preselected in the editor).
2. View/edit a note, cancel an unsaved note, delete with confirmation — **PASS** (edit-cancel reverts;
   cancelling a new note creates no row; `Esc` cancels the delete; confirmed delete removes one row).
3. Refresh and restart persistence — **PASS** (page reload, plus a real process kill/restart on the same
   DB with note, grinder names and default intact).
4. Remove a grinder preset without damaging historical notes — **PASS at API/DB level** (unit suite
   asserts a deleted grinder leaves notes readable with the snapshot name and `grinder_id: null`); the
   UI removal path is exercised by the acceptance tester on the final candidate.
5. Invalid dates/numeric values and API failures give useful feedback — **PARTIAL, FIX IN FLIGHT**.
   Field validation passes in UI and API (`2026-02-30T10:00`, hour 25, negative grind size,
   out-of-range dose/water → 400 with a `fields` message, inline in the UI). A failure loading a
   *single* note produced no banner and no Retry: confirmed defect, fix card T6.
6. Desktop and mobile layouts usable without overflow — **PASS** (1440×900, 390×844, 360×844: no
   horizontal overflow; drawer opens with a backdrop and `Esc` closes it).

Independent acceptance testing and an independent diff review are still running (§11).

## 3. Repository, branch, final SHA
Local: `/home/hermes/workspace/coffee-notes`, branch `main`.
Remote: **https://github.com/des-agent-bot-oss/coffee-notes** (private; `main` pushed at `a7c465d`,
later commits not yet pushed).
Implementation candidate when written: `88f6660` (T3b fix `4f982fe` + receipts). Final SHA: pending T6.

## 4. Changed components
Backend: `server/{schema.sql,db.js,router.js,api.js,static.js,index.js,seed.js}`.
Frontend: `public/{index.html,styles.css,app.js}` and `public/js/{api,format,dom,toast,dialog,sidebar,
detail,editor,drawer,settings}.js`; vendored `public/fonts/dm-sans-*.woff2` + OFL licence.
Tooling/docs: `scripts/check.js`, `scripts/fetch-fonts.py`, `docs/{BRIEF,SPEC,ASSUMPTIONS,OPERATIONS}.md`,
`evidence/**`, `package.json`. Verification tooling lives outside the app repo at
`/home/hermes/workspace/tools/ui-evidence` (Playwright; never a runtime dependency).

## 5. Checks and results (coordinator-run unless stated)
- `npm run check` — exit 0: 20 `.js` files syntax-checked, 20 required files present, no `node_modules`
  import in 17 runtime files.
- `npm test` — exit 0: **25 pass / 0 fail** (`node --test`) covering validation, grinder invariants,
  preset removal keeping history, demo seed/clear isolation, ordering/filtering, malformed JSON,
  404/405, static path traversal, and DB handle close/reopen persistence.
- Coordinator browser sweep (`tools/ui-evidence/run-sweep.sh`) — **36/36 PASS**, 0 page errors, fresh DB,
  candidate `88f6660`: newest-first sidebar with date/grinder/bean, `aria-current` selected state, detail
  `Ratio 1:16.0` with wall-clock time unchanged, settings list, duplicate + blank name errors with the
  list intact, `Make default` moving the badge, `Ctrl/Cmd+N` local-time default and default-grinder
  preselection, save, dirty-edit cancel, new-note cancel creating no row, field validation, offline
  banner + working Retry, sample load/label/remove leaving user notes, delete confirmation and `Esc`
  cancel, settings + default persisting across reload, mobile drawer with backdrop and `Esc`, no
  overflow at 360/390 px.
- `check-persistence.sh` — **PASS** (real process restart on the same DB).
- Independent tester run (card `t_5d0de379`, candidate `88f6660`) — 41/45 checks passed; raw artifacts in
  `evidence/test/`; it independently confirmed the API validation matrix and found three defects.

## 6. Defects found by verification
1. **Settings never refreshed grinder state** (`add`/`rename`/`makeDefault` skipped the `loadGrinders()`
   that `remove`/`seed`/`clearDemo` call): new presets never appeared, the `Default` badge never moved.
   Found by the coordinator, fixed in `4f982fe` (card T3b), re-verified by the coordinator.
2. **A failed single-note load gives no feedback** (no banner, no Retry). **Open** — fix card T6.
3. **Delete-confirmation dialog does not take or trap focus** (focus starts on `<body>`, leaks every
   second `Tab`). **Open** — fix card T6.
4. **Settings dialog focus trap leaks** after several `Tab` presses. **Open** — fix card T6.
Two worker-reported failures ("Settings dialog never opens", plus one assertion race) did **not**
reproduce and were races in the workers' throwaway scripts, not app defects.

## 7. Unresolved issues
The three T6 defects; final acceptance sign-off; independent diff review. No known data loss, security
or corruption issue. The single-user local design means no authentication is implemented.

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
edit), `evidence/ui/walkthrough/frame-*.png`, `evidence/test/` (tester artifacts),
`evidence/receipts/T1..T4b-*.md`, `evidence/DELEGATION-TRACE.jsonl`. Captures are re-run against the
frozen final commit before delivery.

## 11. Time and cost
Elapsed: ~1 h 40 m of wall clock so far. Provider API usage/cost: **not available** from this
environment (no billing or token accounting is exposed to the VM) — marked unavailable, not estimated.

## 12. Remaining work and how to resume
T6 (fix) → T4b (focused independent re-verification) → T5 (independent diff review + complexity check) →
re-run captures against the frozen commit, update §2/§3, push the repo, send the Telegram report.
Resume: `/home/hermes/.local/bin/hermes kanban list` — the board is the source of truth. Tooling:
`bash tools/ui-evidence/run-sweep.sh <port>`, `check-persistence.sh <port>`, `run-capture.sh <port> <dir>`.

## 13. Telegram delivery receipt
Pending — recorded with the actual send result.

# Coffee Notes — run report

Status: **IN PROGRESS** (started 2026-10-12, coordinator working unattended)
Owner: Desmond (Asia/Kuala_Lumpur). Executed by the VM software team (coordinator/coder/tester/reviewer).

## 1. Requirements
Verbatim owner brief: `docs/BRIEF.md`. Technical contract: `docs/SPEC.md`.
Summary: single-user local coffee brewing/tasting journal — create/browse/view/edit/delete notes
(newest first, selected state, date+grinder+bean summaries), grinder presets with one default,
local-time defaults, search/filter, warm cream/espresso visual language, accessible desktop +
mobile layouts, real backend API + durable SQLite storage, loopback-only hosting, explicit demo
seed separate from user content, and browser-verified acceptance evidence.

## 2. Material assumptions
See `docs/ASSUMPTIONS.md` (12 recorded assumptions: no auth, wall-clock times, zero runtime deps,
`is_demo` separation, grinder snapshot, permanent delete, linear migrations, port 4317, vendored
fonts, explicit out-of-scope list).

## 3. Outcome and acceptance status
Pending — populated as tasks complete.

## 4. Repository, branch, final SHA
Local: `/home/hermes/workspace/coffee-notes` (branch `main`).
Remote: pending creation of private `des-agent-bot-oss/coffee-notes`.
Final SHA: pending.

## 5. Changed components
Pending.

## 6. Checks and results
Pending.

## 7. Unresolved issues
Pending.

## 8. Launch and access
`npm start` → http://127.0.0.1:4317 (loopback only). Tunnel and stop instructions: `docs/OPERATIONS.md`.

## 9. Database location and backup
`data/coffee-notes.db` (SQLite, WAL). Backup guidance in `docs/OPERATIONS.md`.

## 10. Evidence paths
`evidence/ui/` — screenshots; `evidence/receipts/` — per-task receipts.

## 11. Time and cost
Elapsed: in progress. Provider API usage/cost: not available from this environment (marked unavailable).

## 12. Remaining work / resume instructions
Pending.

## 13. Telegram delivery receipt
Pending.

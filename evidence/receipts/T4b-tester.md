# Receipt — T4b tester: focused re-verification after the T6 fix

- Task: `t_a1c985a8` (T4b). Candidate **source** commit: `c1222f9` (T6 fix), frozen.
- Repo HEAD during my runs: `ba1c6e6` (evidence-only commits on top of `c1222f9`). HEAD moved
  `67c59ae` → `ba1c6e6` mid-session via a commit made by another actor; `git diff c1222f9 HEAD --
  server public test scripts package.json docs` is **empty**, so the source under test did not change.
- Env: Node 26.7.0, headless Chromium via Playwright 1.56 (`/home/hermes/workspace/tools/ui-evidence`).
- All runs used fresh scratch DBs (`$TMPDIR`-side `/home/hermes/.hermes/cache/scratch/*.db`) and
  non-default ports (4381/4382/4385/4386/4387); `data/coffee-notes.db` untouched (`git status` clean
  of source changes).
- I re-ran every check myself this session; nothing below is inherited from the earlier T4 receipt.

## Verdict table

| # | Check | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Defect 1: failed detail load → banner + Retry | **PASS** | `t4b-probe-fresh.log` D1 (7/7, whole probe 33 PASS / 0 FAIL); abort → `GETs=["GET 1"] banner.hidden=false retry=1 detail=0`, banner text plain-language, Retry restores detail |
| 2 | Defect 2: delete-confirm focus trap | **PASS** | `t4b-probe-fresh.log` D2; first focus "Keep note", Tab×12 + Shift+Tab×4 contained, Esc returns to Delete |
| 3 | Defect 3: settings focus trap incl. re-renders | **PASS** | `t4b-probe-fresh.log` D3; contained after add/rename/make-default re-render |
| 4 | Acceptance 1–2, 5: grinders, note CRUD, validation/api errors | **PASS** | `t4b-acceptance-fresh.log/json` 45/46 (see note) |
| 5 | Acceptance 3: refresh + process restart + fresh context | **PASS** | `t4b-reload.log` 3/3; `t4b-persistence.log` `PERSISTENCE: PASS` rc=0; `t4b-flow.log` check3-fresh |
| 6 | Acceptance 4: remove a used grinder preset | **PASS** | `t4b-flow.log`: DELETE 200, notes stay 200, snapshot name kept, UI renders, no 5xx |
| 7 | Acceptance 6: desktop/mobile overflow + drawer | **PASS** | acceptance `layout 1440`; `t4b-mobile.log` M390/M360 no overflow, backdrop, Esc, search usable |
| 8 | Mobile drawer accessibility | **PASS** | `t4b-probe-fresh.log` E5 (14/14): backdrop, focus in, aria-hidden, aria-modal, scroll lock, Esc + backdrop close |
| 9 | `npm run check` / `npm test` | **PASS** | check exit 0 ("All checks passed"); `node --test` 25/25 pass, 0 fail |

## Commands and exit codes
- `bash run-sweep`-style driver `~/.hermes/cache/scratch/t4b-run.sh` → probe `0 failing assertion(s)`;
  acceptance `45/46 checks passed`, exit 0; `npm run check` exit 0; `npm test` exit 0 (25 pass).
- `bash check-persistence.sh 4384` → `PERSISTENCE: PASS`, rc=0 (kill + restart on the same DB).
- Resource limits observed: `scrollWidth == innerWidth` at 1440/390/360.

## Limitations / notes
- **Not a product defect:** `validation: cleanup the editor` fails in the acceptance sweep (3rd run
  reproduced). The sweep waits for `.placeholder`, but at that point a note is still selected, so after
  Cancel/Discard the app correctly re-renders the note detail (`t4b-mobile.log`: `editor=0 dialogs=0
  detail=1 placeholder=0`). Harness assertion bug; all downstream steps pass.
- The first probe capture (`evidence/test/t4b-probe.log`) shows `D2 Esc did not delete the note — rows=2`
  failing because it ran on a DB that already held 4 seeded notes while the assertion expects 2; on a
  fresh DB the probe reports 0 failures. Harness setup artifact, not app behavior.
- Not run: headed-browser runs, real-device testing, multi-user/concurrency. No check was silently skipped.

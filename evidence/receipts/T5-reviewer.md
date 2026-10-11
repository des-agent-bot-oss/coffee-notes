# Receipt — T5 reviewer: independent diff review and complexity assessment

- Task `t_8fc61842`. Reviewed SHA **`99c1bfa2fb52fd4f20036e31106e5b4329da9d35`** (`99c1bfa`), branch
  `main`; `git status --porcelain` **empty** before I started. Implementation diff reviewed:
  `a7c465d..c1222f9`; `git diff --stat c1222f9..HEAD` shows only `evidence/**`, so the source I read is
  the frozen candidate. My only working-tree change is this receipt (untracked, not committed).
- Verdict: **ship as-is, with one should-fix follow-up (F1)**. No blocker; no data-integrity or XSS
  defect found; the brief's core features are implemented for real, not only in appearance.
- Ran on scratch `git archive` copies, temp DBs, ports 4417/4427, proving each instance was mine via its
  own startup line: `npm run check` exit 0 (20 js / 6 JSON / 20 required / 17 runtime files) and
  `npm test` exit 0, 25/25 — matching the T1–T3 receipts. 12 API probes: a spoofed `grinder_name`
  alongside a valid `grinder_id` is ignored (server resolves the snapshot); `"Infinity"`/`"NaN"`/
  `1e309`/negatives and `2026-02-30T10:00` all 400 with field messages; `%2e%2e%2fserver%2fdb.js` → 400,
  `/../package.json` → 404; deleting a used grinder returns `new_default_id` and the note keeps its
  snapshot name with `grinder_id:null`; 300 KB body → clean 400; zero 5xx, zero logged failures.
- XSS/dom probe (Chromium, 13/13): note and grinder text `<img src=x onerror=…>` plus `<script>`
  tasting notes render as literal text in sidebar/detail/Settings, create no elements, execute nothing
  (`window.__xss` undefined). `public/js/dom.js` only writes `textContent`; a `public/` search for
  `innerHTML|insertAdjacentHTML|outerHTML|document.write|eval(` returns 0 matches.

## Findings

1. **should-fix — `public/app.js:225-230` (`withGuard`) + `:398-401` (`openSettings`).** Opening
   Settings from the editor clears `state.editor`/`pane='idle'` without re-rendering, so the abandoned
   editor stays mounted and live. Probe: `S4 editor form still in pane: 1`, `S5 placeholder: 0`,
   `S6 after Esc: still 1`, `S7 notes stored after saving the abandoned form: ["Stale form write", …]`;
   after choosing *Discard changes* the draft is still readable and saveable (`S11`/`S12`) while
   `isDirty()` (so Esc and `beforeunload`) no longer guards it. Why: duplicated view/state, and "cancel"
   can resurrect a discarded note. Smallest fix: `renderPane()` after `closeEditor()` in `withGuard`
   (every other editor exit path already re-renders).
2. **nice-to-have — `server/router.js:87-113`.** Above 16× the 256 KB limit the body is drained with
   `req.destroy()`, so a 5 MB POST gets a connection reset (`curl_exit=56`, HTTP `000`) rather than the
   documented 400; the comment at `:89-94` claiming the client always gets the clear error is wrong.
   Server stays healthy; 300 KB still gets a clean 400. Fix: drop the `destroy()` (drain with
   `continue`), or correct the comment.
3. **nice-to-have — unused surface, ~12–15 lines.** `server/api.js:339 export { ApiError }` (no
   importer; `index.js` uses `./router.js`); `server/router.js:86` returns `routes`, read by nobody;
   `public/js/drawer.js:110-115` exports `open`/`syncMode`, unused by `app.js`;
   `server/static.js:27 contentTypeFor` exported but only used internally; `FOCUSABLE` duplicated at
   `public/js/dialog.js:8-10` and `drawer.js:11-13`.
4. **nice-to-have — `docs/SPEC.md:103` vs `package.json:14`/`scripts/check.js:121`.** The SPEC still
   says `test node --test test/`, but bare `node --test` is used because a directory argument exits 1 on
   Node 26.7.0 (reproduced: exit 1, `Cannot find module '…/test'`). Disclosed in the T1 receipt, never
   reconciled in the SPEC.
5. **nice-to-have (evidence).** Reproducible claims hold: check/test results, the `node --test test/`
   failure, `c1222f9` = HEAD for source, and the tester artifacts say what the receipts say
   (`t4b-persistence.log` → `PERSISTENCE: PASS rc=0`; `t4b-probe-fresh.log` → `0 failing assertion(s)`;
   `t4b-acceptance-fresh.log` → `45/46`; `t4-api-checks.txt` → candidate `88f6660`). Gaps: the
   coordinator's own checks (36/36 sweep, `probe-a11y.mjs`, `check-persistence.sh`) have **no preserved
   log under `evidence/`**; `RUN-REPORT.md:48` "Latest pushed evidence commit: `ba1c6e6`" is stale at
   HEAD `99c1bfa`; §13 Telegram delivery is unverifiable from the VM. No artifact contradicts a claim.
6. **Process note (not code).** Attempt 1 left a server on `127.0.0.1:4399` (`pid 52399`) that my first
   probe hit silently; it is still running and worth reaping. All results above come from instances that
   logged their own port/DB.

## Balanced assessment

Appropriately simple: every statement prepared (`db.js`), ~60-line router, traversal rejected after
decoding, centralised field-level validation, WAL + `foreign_keys=ON` + linear idempotent migrations,
no framework or build step, text-only DOM helper, editor ranges mirroring the server without duplicating
it, and behavioural HTTP/DB test suites rather than implementation mirrors. The 11 small frontend
modules are each single-purpose; I would merge or delete no file — the removable surface is F3's
~12–15 lines.

# Receipt — T4 tester: independent acceptance verification

**Consolidated by the coordinator from the tester's own raw artifacts.** Tester card `t_5d0de379`
spent both of its allowed runs (run #11, 552 s; run #12, 399 s) and was stopped by the 30-iteration
budget before it could write this file itself. Every statement below is taken verbatim from the
tester's artifacts under `evidence/test/`; nothing here is a coordinator measurement unless it says so.

- Tester runs: #11 `timed_out` (30/30 iterations), #12 `gave_up` (30/30 iterations). No source file was
  modified by either run (`git status` showed only the tester's own evidence files).
- Candidate verified: `88f6660` (`git rev-parse HEAD` recorded in `evidence/test/t4-api-checks.txt`).
- Environment: Linux VM, Node 26.7.0, Playwright/Chromium from `/home/hermes/workspace/tools/ui-evidence`,
  scratch DB, own port (4321).
- Raw evidence: `t4-acceptance.log` (45 checks), `t4-acceptance.json`, `t4-api-checks.txt`,
  `t4-probe-focus.log`, `t4-probe-trap.log`, `t4-flow1.log`, `t4-flow2.log`.

## Verdict summary: 41 / 45 checks passed

**Passed (41)** — including: loading skeleton, empty history + welcome pane, empty count label;
`Ctrl/Cmd+N` typing guard, non-typing start, ignored while a dialog is open, and no stray browser window;
samples seeded (5), labelled with a Sample chip, user note created alongside and surviving demo removal;
grinder blank + duplicate inline errors, first grinder becoming default, `Make default` persisting, exactly
one default badge; new note preselecting the default grinder and defaulting to the **browser local time
(no UTC shift)**; save returning to detail with a toast; API storing `grinder_id` + snapshot name and the
verbatim `brewed_at`; `ratio_display 1:16.7`; detail showing grinder, ratio and multi-line notes; history
newest-first with the newest selected; inline field errors for negative/absurd numerics and an empty brew
date; `2026-02-30T10:00` unsavable from the UI; no row created by failed saves; dirty-new-note cancel
asking first and creating no row; edit-cancel reverting the detail and the stored note; delete confirmation
naming the note with the destructive label; `Esc` cancelling without deleting; confirmed delete removing
the row and the API record; search filtering, filtered-empty distinct from no-notes-empty, Clear restoring;
offline banner human-readable with a working Retry; no desktop overflow; drawer button hidden on desktop;
visible 2 px focus outline.

**Restart/refresh persistence (acceptance check 3)** — `t4-flow1.log`: default grinder `id:1`, note 1 kept
its grinder, 1 row after reload, detail retained bean + grinder, and `localStorage`/`sessionStorage`/
IndexedDB/cookies all empty — i.e. the data is server-side, not browser storage.

**Grinder removal keeping history (acceptance check 4)** — `t4-flow2.log`, all PASS: API delete 200 and the
note survives with its snapshot name (`gid=null`); the UI shows the orphaned note with its grinder name,
`bannerHidden=true`, no 5xx and no crash.

**Mobile (acceptance check 6)** — `t4-flow2.log`, all PASS at 390×844 and 360×844: no horizontal overflow in
history or editor, every visible control ≥44 px tall, drawer opens with backdrop and closes on `Esc`
restoring focus to the notes button.

## The four failures it reported

1. `a11y: Tab stays inside the settings dialog` — **real defect.** `t4-probe-trap.log`: with 11 focusables,
   `Tab` from the last control (`Close`) lands on `<body>` (`inDialog:false`) instead of wrapping, and
   `Shift+Tab` from the first does the same. `t4-probe-focus.log` shows the same escape at tab 10.
2. `delete: focus stays inside the confirmation dialog` — **real defect.** `t4-probe-focus.log`: on open the
   first focus is a dialog button, but tabs 2, 5 and 8 land on `<body>` (`inDialog:false`) — the trap leaks
   on every other press.
3. `api-error: failed detail fetch shows a banner with Retry` — **narrower than the label suggests.** With a
   **5xx JSON** response the tester's later flow run measured the banner working
   (`banner="That note could not be opened. Internal boom | Retry", retry=1`, `t4-flow2.log` → PASS). The
   failing case is the **network-abort** path: with `page.route(...).abort()` on `GET /api/notes/:id` the
   banner stays hidden and no Retry is rendered (coordinator reproduced this independently). So a detail
   load must also surface the banner when the request fails at the network level.
4. `validation: cleanup the editor` — **test-script artifact, not an app defect.** The step timed out
   waiting for a `Cancel` button that was not on screen; the same run's dedicated validation checks
   (empty date, impossible date, absurd numerics, no row created) all passed.

## Not covered by this card
The tester's own note ("Re-test the two dialog focus-trap checks in a headed context", plus the mobile and
persistence checks it had not reached) is superseded: the containment sequences above are DOM-level
observations that reproduce in both headless and headed runs, and the mobile/persistence checks were
reached in `t4-flow1.log` / `t4-flow2.log`. Final re-verification on the post-fix candidate is card
`t_a1c985a8` (T4b).

# T3b coder receipt — stale grinder state in Settings

- Task `t_ea659a25`; candidate `4f982fe` (parent `7f39dc4`), branch `main`, local-only.
- `public/app.js` only: new `mutateGrinder(request)` runs the API call then
  `await loadGrinders()`; `add`, `rename`, `makeDefault` now use it, so the dialog
  re-renders fresh state. `remove`/`seed`/`clearDemo` untouched.

## Commands and exit codes

- `npm run check` → exit 0.
- `npm test` → exit 0 (25/25 pass).
- Repro, empty DB, port 4327 (`COFFEE_NOTES_DB` in scratch), Chromium 1440×900,
  `node repro-t3b.mjs` → exit 0, 15 pass / 0 fail.
- Same repro with `git stash push -- public/app.js` (pre-fix, port 4328) →
  exit 1, 4 pass / 7 fail.

## Observed

Before: after adding two grinders the dialog still showed 0 rows with the
empty-state copy, and `Make default`/`Rename`/`Remove` were unreachable. After:
both rows appear with `Default` on the first; the badge moves to the clicked
preset; rename shows the new name; remove drops the row while the saved note
keeps its snapshot grinder name; the editor lists refreshed presets.

## Limitations

Focused repro only; acceptance sweep (`t_5d0de379`) and code review belong to
later cards. Repro scripts live in scratch, not the repo.
`evidence/DELEGATION-TRACE.jsonl` was already modified before this task and is
not committed here.

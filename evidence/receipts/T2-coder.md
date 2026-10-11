# Receipt — T2 coder: frontend core (design system, sidebar, detail, editor)

- Task: `t_465f2318` (T2 coder, Coffee Notes), local-only completion, no push.
- Candidate commit: `06e72b44f7e693b6db92a495938846a5058e8e65` (`feat(t2): warm design
  system, history sidebar, note detail and editor`), one commit after the T1
  baseline `6862eff`. This receipt is an evidence-only commit on top of it; no
  source file changed after the checks below.
- Environment: Linux VM, Node `v26.7.0`, npm `11.19.0`, Chromium via the
  coordinator's Playwright at `/home/hermes/workspace/tools/ui-evidence`.
- Delivered (11 files, +1988/−71): `public/index.html` (shell only, no inline
  styles), `public/styles.css` (SPEC §5 tokens + all view styles),
  `public/app.js` (controller: data, views, guards, retries) and
  `public/js/{api,format,dom,toast,dialog,sidebar,detail,editor}.js`. No file
  outside `public/` was touched; `server/`, `test/`, `docs/` and other receipts
  are unchanged.

## Commands run

| Command | Exit | Observed |
|---|---|---|
| `npm run check` | 0 | 6/6 ok: 18 `.js` files syntax-checked, 20 required files present, `index.html` still references `styles.css` + `app.js` + `fonts/dm-sans.css`, no `node_modules` import in 15 runtime files. `scripts/check.js` needed no change. |
| `npm test` | 0 | 25 pass / 0 fail (backend suites unaffected). |
| `COFFEE_NOTES_DB=<scratch>/coffee-notes.db node server/index.js` | – | started on `127.0.0.1:4317`; scratch DB, deleted afterwards; no listener left on 4317. |
| `curl` API round-trip | 200/201 | health 200; `POST /api/grinders` 201; `POST /api/notes` 201 (`brewed_at` verbatim, `ratio_display` `1:16`); `GET /api/notes`, `GET /api/grinders` 200. |
| `curl` for `/`, `/styles.css`, `/app.js`, `/js/*.js` (8), `/fonts/dm-sans.css`, both `.woff2` | 200 | every shipped asset returns 200 with the right MIME type; no 404 in the server log for the app shell. |
| `node t2-smoke.mjs` (throwaway, Playwright/Chromium, outside the repo) | 1 | 50/51 assertions passed. |

## Browser behaviour actually observed

Sidebar rows newest-first with `Sun 11 Oct 2026 · 07:35`, grinder, bean and
`Grind 22`; the selected row carries `aria-current="true"`, a `rgb(241,228,208)`
tint, a 3px `::before` accent and a 700-weight title. Detail shows `Ratio 1:16.0`,
`18 g` / `288 g`, and `white-space: pre-wrap` tasting notes. New-note defaults use
the local clock (`2026-10-12T02:38`, never `toISOString()`), with the default
grinder preselected as `id:1`/“… — default”. Cancelling an untouched new note
made **no** API call (note count 3 → 3); cancelling a dirty edit reverted to the
stored version; cancelling a dirty new note returned to the previously selected
note and left no row behind. Save showed a disabled `Saving…` button (verified
against a delayed PUT), then a toast and the updated detail. Validation: empty
`brewed_at` and `grind_size=500` produced inline errors with `aria-invalid="true"`,
`aria-describedby="err-…"` and no write. Dirty guards: `beforeunload` prevented,
selecting another row and `Esc` both asked first, “Keep editing” preserved the
draft. Delete named the date and grinder, `Esc` cancelled, the destructive label
is `Delete note`, and confirming deleted server-side and selected the next note.
Filtered-empty copy, “Clear search”, the no-notes empty state, an API-failure
banner with a working `Retry`, and a failed save that re-enables `Save` with a
plain message all behaved. 360×780: `scrollWidth === innerWidth === 360`. No
console errors and no request left `127.0.0.1:4317`.

## Deviations and limitations

1. **The smoke run reported 50/51, exit 1.** The single failure is a race in my
   throwaway assertion: after clicking `Retry` the preceding wait confirmed the
   banner hidden, but the row count was read on the same tick, before the list
   re-rendered. The app path was exercised; the script was deleted and is not in
   the repo.
2. **Settings is a read-only shell here.** `Settings` opens a dialog listing
   presets with note counts and a `Default` badge, plus `Close`. Add / rename /
   make default / remove are T3 (`t_24b95f3b`), as are the sample-data actions,
   the mobile drawer, `Ctrl/Cmd+N` and the accessibility sweep.
3. **Search is deliberately minimal**: 200 ms debounce, a request-sequence guard
   so a slow response cannot overwrite a newer one, the filtered-empty state and
   a `Clear search` button; T3 owns any further polish.
4. **Not built or not exercised in T2** (assigned to T3 or the tester): the demo
   `Sample` chip (SPEC §7 demo labelling), grinder management, the mobile drawer,
   restart persistence, grinder removal, and the ≥820px drawer behaviour.
5. The narrow-viewport block (≤820px, one column, sidebar above the pane) is a
   deliberate fallback for the desktop shell that T3 replaces with the drawer.

## Brief acceptance checks: exercised vs left

- **#2 view / edit / cancel / delete with confirmation — exercised in a browser.**
- **#5 invalid dates and numbers, API failures → useful feedback — exercised**
  (inline field errors, failure banner + Retry, non-stuck save).
- **#6 layouts without overflow — partly**: 1440×900 desktop and 360×780 without
  horizontal overflow; the mobile drawer is T3.
- **#1 (add grinder / make default / create with it)**, **#3 (refresh and restart
  persistence)** and **#4 (remove a preset without damaging history)** were **not**
  exercised in T2 — they depend on the T3 settings dialog and are left to the
  tester/coordinator against the final commit.

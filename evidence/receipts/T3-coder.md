# Receipt — T3 coder: settings, sample data, mobile drawer, accessibility polish

- Task: `t_24b95f3b` (T3 coder, Coffee Notes), local-only, no push.
- Candidate commit: `b69a65ee5870569412be71c647485e886a239052` — one commit after T2's `06e72b4`. This receipt is an
  evidence-only commit on top of it; no source file changed afterwards.
- Environment: Linux VM, Node `v26.7.0`, npm `11.19.0`, Chromium via the
  coordinator's Playwright at `/home/hermes/workspace/tools/ui-evidence`.

## Delivered (`public/` only)

`public/js/settings.js` (grinder add/rename/make-default/remove + sample-data
section, inline errors), `public/js/drawer.js` (mobile drawer: inert background,
`aria-hidden`, `aria-modal`, body scroll lock, Tab wrap), `public/js/api.js`
(grinder PATCH/POST/DELETE + demo seed/clear), `public/js/sidebar.js` (Sample
chip, `Load sample notes` in the empty state), `public/js/detail.js` (Sample
chip in the header), `public/app.js` (settings wiring, search Clear,
Ctrl/Cmd+N, Esc ordering, sample state), `public/index.html` (skip link,
`Notes` button, Clear button, backdrop), `public/styles.css` (drawer, sheet
dialogs, settings, chips, skip link, contrast fix).

## Commands actually run

| Command | Exit | Observed |
|---|---|---|
| `npm run check` | 0 | 6/6 ok: 20 `.js` files syntax-checked, 20 required files present, 17 runtime files with no `node_modules` import. |
| `npm test` | 0 | 25 pass / 0 fail (backend suites unaffected). |
| `COFFEE_NOTES_PORT=4318 COFFEE_NOTES_DB=<scratch>/t3.db node server/index.js` + `curl /api/health` | 200 | `{"ok":true,"version":"0.1.0","db":"ok",...}` on loopback. |
| `node t3-smoke.mjs` (throwaway Playwright/Chromium script, outside the repo) | 1 | **2/3 — the browser pass FAILED.** |

## Browser result — NOT accepted

```
PASS empty state visible
ERROR page.waitForSelector: Timeout 30000ms exceeded.
PASS no console or page errors
```

The empty state rendered, then `page.click('#settings-button')` was followed by
`waitForSelector('dialog[open] .settings')`, which timed out: **the Settings
dialog does not open in a real browser.** No console or page error was reported,
so the likely cause is an exception inside `openSettings()/createSettings()`
swallowed as an unhandled rejection; the exact fault was not diagnosed within
the run budget. Every later check (add/duplicate/default grinder, save → refresh
→ dirty-edit cancel → delete-with-confirm, sample chips, seed-once guard,
Ctrl/Cmd+N, drawer at 390×844, 360px overflow) was therefore **never reached and
is unverified**, as are the CSS/drawer changes in general.

## Deviations and limitations

1. `--muted` darkened `#8a7461` → `#786252` (docs/SPEC.md §5 lists the former)
   so secondary text reaches 4.5:1: cream 5.06, surface 5.55, selected row 4.57.
   Measured with a throwaway contrast script; body text is espresso-on-cream
   (12.75:1).
2. Frontend guard only for "load samples twice": `Load sample notes` is replaced
   by `Remove sample notes` once demo rows exist, because `server/` was out of
   scope and `POST /api/demo/seed` is not itself idempotent.
3. `docs/KEYBOARD.md` (optional item 7) was not written.
4. This commit must be treated as a failed first pass, not a verified handoff.

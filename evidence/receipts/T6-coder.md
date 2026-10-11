# T6 coder receipt — detail-load feedback + dialog focus traps

Task: `t_22570dcc`. Candidate: `c1222f9` (`public/app.js`, `public/js/dialog.js`).
Env: Node 26.7.0; headless Chromium via Playwright 1.56; scratch DBs on ports
4351 (5 demo notes) and 4352 (exactly one note); throwaway probes
`tools/ui-evidence/t6v2-probe.mjs` + `t6-repro3.mjs`, never committed.

Commands / exit codes
- `npm run check` → 0 (all checks passed).
- `npm test` → 0 (tests 25, pass 25, fail 0).
- `node t6v2-probe.mjs`, `node t6-repro3.mjs` → real Chromium runs below.

Observed before → after
- D1 single-note repro (abort `GET /api/notes/*`, click the selected row):
  before no request at all, `banner hidden=true retry=0`, stale pane;
  after `GET /api/notes/1` fails, banner visible with plain copy, `retry=1`,
  pane idle; Retry reloads the note and hides the banner.
- D2 delete dialog: on-open focus `Keep note` both; containment before
  `tfttfttfttft` / `fttf`, after `tttttttttttt` / `tttt`; Esc returns focus to
  the `Delete` button.
- D3 settings: before `tttttttttftt`, after `tttttttttttt`; after an add
  re-render before `tttftttttttt`, after all in-dialog; disabled-while-busy
  before `tfttft`, after `tttttt`; nested remove-confirm before `tfttft`, after
  `tttttt`; Esc returns to `Settings`.

Limitations: focus measured via `dialog[open].contains(activeElement)`; no broad
regression sweep — `t_5d0de379`'s successor re-verifies acceptance.

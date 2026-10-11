# Receipt — T7 coder: discarded draft stays live + SPEC test script

- Task `t_0270576b`. Candidate **`f3f17fe`** (`fix(t7): drop the discarded editor from the pane …`),
  parent `f6e4f1f`; `git status --porcelain` empty before and after. Repo `/home/hermes/workspace/coffee-notes`,
  branch `main`, local-only (no push).
- Changes (2 files, 7 insertions / 1 deletion): `public/app.js` `withGuard` re-renders the pane when it
  closes a mounted editor (`if (wasEditing) renderPane()`), so a discarded draft's form leaves the DOM and
  its listeners; `docs/SPEC.md` §6 `test` script corrected to bare `node --test`, noting that a directory
  argument is unresolved on Node 26.7.0 (reproduced: `node --test test/` exit 1, `Cannot find module '…/test'`).
- `npm run check` exit 0; `npm test` exit 0, 25/25 pass.
- Browser repro (Chromium/Playwright 1.56, fresh scratch DBs, ports 4351 pre-fix / 4352 candidate;
  full log `evidence/test/t7-discard.log`):
  - **before**: after Discard, `editorForms 1`, draft readable `"STALE EDIT"`, its Save wrote
    `bean_name:"STALE EDIT"`; dirty new note → stale Save created a row `GHOST DRAFT` (1→2).
  - **after**: `editorForms 0`, placeholder shown, draft unreadable, nothing to save; note stays
    `T7 baseline`, rows 1→1.
  - normal paths unchanged: dirty Cancel reverts to the stored note; clean Cancel → detail, no dialog;
    Esc guards (Keep editing keeps the draft); a real edit saves (`T7 SAVED EDIT` in pane and API).
- Limitation: after Discard via Settings the pane shows the idle placeholder while the sidebar row stays
  highlighted (`state.selectedId` untouched) — cosmetic; the row reopens the note. Nice-to-haves untouched.

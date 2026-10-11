# Receipt — T1 coder: scaffold repo + backend API/DB + tests

- Task: `t_008fc7e9` (T1 coder, Coffee Notes), local-only completion.
- Candidate commit (implementation): `037135e0a9bf6b71300c71f3da435af44541c4cf`
  (`feat(t1): SQLite store, HTTP API, tests and operations doc`, branch `main`,
  parent `a7c465d`; HEAD was `53ca555` when this task started). This receipt is
  added in the following evidence-only commit; no source file changed after the
  checks below.
- Environment: Linux VM, Node `v26.7.0`, npm `11.19.0`, `node:sqlite` built in.
  No runtime dependencies, no browser/network involvement.
- Scope delivered: `package.json`, `server/{schema.sql,db.js,router.js,api.js,static.js,index.js,seed.js}`,
  `test/{db.test.js,api.test.js}`, `scripts/check.js`, `public/{index.html,styles.css,app.js}`,
  `docs/OPERATIONS.md` (15 files, +2407 lines).

## Commands run and results

| Command | Exit | Observed |
|---|---|---|
| `npm run check` | 0 | 6/6 items ok: 10 `.js` files syntax-checked, 1 JSON parsed, 20 required files present, package.json metadata/scripts/zero deps, index.html references `styles.css`+`app.js`+`fonts/dm-sans.css`, no `node_modules` import in 7 runtime files |
| `npm test` | 0 | `node --test`: 25 tests, 25 pass, 0 fail (~27 s), storage + HTTP suites |
| `COFFEE_NOTES_PORT=4317 node server/index.js` | – | startup line: `listening on http://127.0.0.1:4317 — db …/data/coffee-notes.db` plus the `GET /api/health` line |
| `curl -sS /api/health` | 200 | `{"ok":true,"version":"0.1.0","db":"ok","now":"2026-10-11T18:20:49.366Z"}` |
| `curl -X POST /api/grinders -d '{"name":"Comandante C40"}'` | 201 | `{"grinder":{"id":1,"name":"Comandante C40","is_default":true,"note_count":0}}` |
| `curl -X POST /api/notes -d '{brewed_at,grinder_id:1,…}'` | 201 | note 1 with `grinder_name:"Comandante C40"`, `brewed_at:"2026-10-11T07:35"` verbatim, `ratio_display:"1:16"` |
| `curl /api/notes?limit=5` | 200 | `{"notes":[{id:1,brewed_at,grinder_name,bean_name,grind_size,is_demo:false}]}` newest first |
| `curl -X DELETE /api/notes/1` | 200 | `{"ok":true,"deleted_id":1}` |
| `timeout -s TERM 3 node server/index.js` | 124 (timeout's own signal) | log: `SIGTERM received, shutting down` then `stopped` — server and DB closed |

The curl round-trip ran against a real server process on port 4317; the throwaway
`data/` directory created by that run was removed afterwards (it is gitignored).

## Coverage exercised by the suites

CRUD for notes and grinders; validation of `brewed_at` (`2026-02-30T10:00`, `2026-10-11T25:00`,
`2026-02-29T10:00`, month 13, space separator, `Z` suffix, empty) with field-level messages;
numeric ranges and numeric-string normalisation (`grind_size`, `dose_g`, `water_g`,
`Infinity`/`NaN` strings); text/enum limits and blank grinder name; case-insensitive duplicate
grinder names (409 `conflict`, field `name`); the single-default invariant (first grinder becomes
default, setting a default clears the previous one, `is_default:false` rejected); deleting the
default promotes the oldest remaining grinder and reports `new_default_id`; deleting a grinder
leaves its notes readable with the snapshot name and `grinder_id:null`; `q`/`grinder`/`limit`
filtering with 400 field errors on invalid values; malformed JSON, non-object body, >256 KB body;
unknown route 404, known path with wrong method 405 (+`Allow`); static MIME types and path
traversal (`..` rejected after decoding); demo seed/clear leaving user rows intact; and
persistence across a closed-and-reopened database handle.

## Decisions and limitations

1. **`grinders.is_demo` added (migration 2).** SPEC §4's grinder DDL has no demo flag, but task
   item 5 requires demo grinders to be flagged so `DELETE /api/demo` can remove them. Migration 1 is
   SPEC §4 verbatim; migration 2 adds the additive `is_demo` column. SPEC.md was not modified.
2. **`npm test` is `node --test`, not SPEC §6's `node --test test/`.** On this VM's Node 26.7.0 a
   directory argument is not scanned — `node --test test/` (and `test`) exits 1 with
   `Cannot find module '…/test'`, while bare `node --test` discovers exactly `test/*.test.js`
   (verified: 25 pass). `scripts/check.js` asserts the string actually in use.
3. **`new_default_id` = the default grinder after the delete** (`null` when none remain). Deleting a
   non-default grinder therefore returns the unchanged default id rather than `null`.
4. `is_default`/`is_demo` are JSON booleans; `ratio_display` follows SPEC §7's formula
   (`"1:" + round(water/dose, 1)` → `1:16`, `1:16.7`), so the UI may need to format one decimal for
   its `1:16.0` display.
5. `roast_level` is trimmed and lower-cased before the enum check; `PATCH {is_default:false}` is a
   400 rather than a silent invariant violation.
6. Not verified here: browser/UI behaviour (T2), the GitHub publication step (coordinator), and any
   check on a different Node version. The `test` script divergence in item 2 is the only known
   deviation from the SPEC text.
